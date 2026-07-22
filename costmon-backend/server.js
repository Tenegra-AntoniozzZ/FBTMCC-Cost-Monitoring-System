require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const ExcelJS = require('exceljs');

const app = express();

// ==========================================
// 1. SECURITY: CORS
// ==========================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// ==========================================
// UPLOADS FOLDER SETUP
// ==========================================
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'receipt-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = /image\/(jpeg|jpg|png|gif|webp)|application\/pdf/.test(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only images and PDFs are allowed.'));
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'isang_temporary_fallback_secret';


// ==========================================
// 2. SECURITY: RATE LIMITING
// ==========================================
// 3. JWT MIDDLEWARE
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access Denied. No valid token." });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Session expired. Please log in again." });
    req.user = user;
    next();
  });
};

const requireCEO = (req, res, next) => {
  if (req.user && req.user.role === 'ceo') return next();
  return res.status(403).json({ error: "Access denied. CEO role required." });
};

// ==========================================
// DATABASE
// ==========================================
const dbPath = path.resolve(__dirname, 'costmon_local.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error connecting to database:', err.message);
  else {
    console.log('Connected to the local SQLite database.');
    db.run("PRAGMA foreign_keys = ON;");
  }
});

// ==========================================
// ACTIVITY LOGGER HELPER
// ==========================================
const logActivity = (username, action, entityType, entityId, details) => {
  const timestamp = new Date().toISOString();
  db.run(
    'INSERT INTO audit_logs (username, action, entity_type, entity_id, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [username || 'system', action, entityType, String(entityId || ''), details || '', timestamp],
    (err) => { if (err) console.error('Audit log error:', err.message); }
  );
};

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS disbursements (
    id TEXT PRIMARY KEY, project_code TEXT, date TEXT, payee TEXT, particulars TEXT,
    tin TEXT, cv_no TEXT, bank TEXT, check_no TEXT, or_inv_no TEXT, accts_pay REAL, input_tax REAL,
    output_tax REAL, target_cib REAL, gross_amount REAL, ewt_amount REAL, net_amount REAL,
    expenses_json TEXT, created_at TEXT, costing_type TEXT DEFAULT 'normal', attachments_json TEXT DEFAULT '[]',
    FOREIGN KEY (project_code) REFERENCES projects(project_code) ON DELETE CASCADE
  )`);
  db.run("ALTER TABLE disbursements ADD COLUMN costing_type TEXT DEFAULT 'normal'", () => { });
  db.run("ALTER TABLE disbursements ADD COLUMN attachments_json TEXT DEFAULT '[]'", () => { });
  db.run("ALTER TABLE disbursements ADD COLUMN bank TEXT", () => { });
  db.run("ALTER TABLE disbursements ADD COLUMN stocks_amount REAL DEFAULT 0", () => { });
  db.run("ALTER TABLE disbursements ADD COLUMN stock_description TEXT DEFAULT ''", () => { });
  db.run("ALTER TABLE disbursements ADD COLUMN is_monitoring_only INTEGER DEFAULT 0", () => { });

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, project_code TEXT UNIQUE, project_name TEXT,
    contract_cost REAL DEFAULT 0, profit_percentage REAL DEFAULT 0.30,
    project_type TEXT DEFAULT 'Construction'
  )`);
  db.run("UPDATE projects SET profit_percentage = 0.30 WHERE profit_percentage = 0.20 OR profit_percentage = 0.15", (err) => {
    if (err) console.error("Error updating old default profit percentages:", err.message);
  });
  db.run("ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'Construction'", (err) => {
    if (!err) {
      db.run("UPDATE projects SET project_type = 'Office' WHERE project_code LIKE '%ADMIN%' OR project_code LIKE '%OFFICE%' OR project_code LIKE '%SHOP%'");
    }
  });
  db.run("ALTER TABLE projects ADD COLUMN project_area TEXT", () => { });
  db.run("ALTER TABLE projects ADD COLUMN project_start TEXT", () => { });
  db.run("ALTER TABLE projects ADD COLUMN days_end TEXT", () => { });


  db.run(`CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, category_type TEXT DEFAULT 'Construction'
  )`);
  db.run("ALTER TABLE expense_categories ADD COLUMN category_type TEXT DEFAULT 'Construction'", (err) => {
    if (!err) {
      const officeCats = ["[MAIN] Payroll", "[MAIN] Electrical Office/Payatas", "[MAIN] Water/office/Payatas", "[MAIN] Comunication/Telephone", "[MAIN] Retainer", "[MISC] Office supplies/Outing", "[MISC] Car Repair & Maintenance", "[MISC] Car Registration", "[MISC] Contribution"];
      const stmt = db.prepare("INSERT OR IGNORE INTO expense_categories (name, category_type) VALUES (?, 'Office')");
      officeCats.forEach(c => stmt.run(c));
      stmt.finalize();
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    security_question TEXT,
    security_answer TEXT,
    is_active INTEGER DEFAULT 1,
    preferences TEXT DEFAULT '{}'
  )`);
  db.run("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1", () => { });
  db.run("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'", () => { });

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    timestamp TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stocks (
    id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    sku TEXT UNIQUE,
    category TEXT,
    quantity REAL DEFAULT 0,
    unit TEXT,
    reorder_level REAL DEFAULT 10,
    unit_cost REAL DEFAULT 0,
    project_code TEXT,
    last_updated TEXT,
    FOREIGN KEY (project_code) REFERENCES projects(project_code) ON DELETE SET NULL
  )`);

  db.get("SELECT count(*) as count FROM users", async (err, row) => {
    if (row && row.count === 0) {
      console.log("Creating default users...");
      const defaultUsers = [
        { u: 'admin', p: 'admin123', r: 'ceo', sq: 'Ano ang pangalan ng unang alaga mong hayop?', sa: 'bantay' },
        { u: 'encoder', p: 'enc123', r: 'encoder', sq: 'Ano ang paborito mong kulay?', sa: 'blue' },
        { u: 'engineer', p: 'eng123', r: 'engineer', sq: 'Saan ka ipinanganak?', sa: 'manila' }
      ];
      const stmt = db.prepare("INSERT INTO users (username, password, role, security_question, security_answer, is_active) VALUES (?, ?, ?, ?, ?, 1)");
      for (let user of defaultUsers) {
        const hashedPassword = await bcrypt.hash(user.p, 10);
        const hashedAnswer = await bcrypt.hash(user.sa.toLowerCase(), 10);
        stmt.run(user.u, hashedPassword, user.r, user.sq, hashedAnswer);
      }
      stmt.finalize();
      console.log("Default users created!");
    }
  });


  db.get("SELECT count(*) as count FROM expense_categories", (err, row) => {
    if (row && row.count === 0) {
      const initialCats = ['Materials/Purchases', 'Labor /SUBCONTRACTOR', 'Gas & Oil', 'Office Supplies', 'Tools & Equipment', 'Office Furniture', 'Shop Supplies', 'Food/Meals', 'Transpo/Travel', 'Repair & Maint.', 'Parking', 'Toll Fee', 'Handling Fee', 'Communication', 'Miscellaneous / Sending Fee / Schematic', 'Light & Power', 'Water', 'Rental/Hotel Accom.', 'Representation', 'Salaries & Wages', 'Cash Advance/Payroll', 'Cash Advance/Project', 'Permit/Licenses', 'Insurance Expense/CONST', 'Insurance Expenses/CAR', 'SOP/Retainer Fee', 'Incentives Fee', 'Service Fee', 'Entrance'];
      const stmt = db.prepare("INSERT INTO expense_categories (name, category_type) VALUES (?, 'Construction')");
      initialCats.forEach(c => stmt.run(c));
      stmt.finalize();
      const officeCats = ["[MAIN] Payroll", "[MAIN] Electrical Office/Payatas", "[MAIN] Water/office/Payatas", "[MAIN] Comunication/Telephone", "[MAIN] Retainer", "[MISC] Office supplies/Outing", "[MISC] Car Repair & Maintenance", "[MISC] Car Registration", "[MISC] Contribution"];
      const stmt2 = db.prepare("INSERT INTO expense_categories (name, category_type) VALUES (?, 'Office')");
      officeCats.forEach(c => stmt2.run(c));
      stmt2.finalize();
    }
  });
});

// ==========================================
// AUTH ENDPOINTS
// ==========================================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(401).json({ error: "Wrong credentials. Pls try again." });
    if (user.is_active === 0) return res.status(403).json({ error: "This account is not active. Contact your administrator." });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Wrong credentials. Pls try again." });
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    logActivity(user.username, 'LOGIN', 'session', user.id, 'User logged in with role: ' + user.role);
    res.json({ success: true, token, role: user.role, username: user.username });
  });
});

app.post('/api/forgot-password/question', (req, res) => {
  db.get("SELECT security_question FROM users WHERE username = ?", [req.body.username], (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(404).json({ error: "Can't find this username." });
    res.json({ question: user.security_question });
  });
});

app.post('/api/forgot-password/reset', async (req, res) => {
  const { username, answer, newPassword } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(404).json({ error: "User not found." });
    const match = await bcrypt.compare(answer.toLowerCase().trim(), user.security_answer);
    if (!match) return res.status(401).json({ error: "Wrong security answer!" });
    const hashedNewPass = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE id = ?", [hashedNewPass, user.id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "Failed to update password." });
      logActivity(username, 'RESET_PASSWORD', 'user', user.id, 'Password reset via security question');
      res.json({ success: true, message: "Password updated successfully!" });
    });
  });
});

app.post('/api/verify-password', authenticateToken, (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT password FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(401).json({ error: "User not found." });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Wrong password." });
    res.json({ success: true });
  });
});

// ==========================================
// USER PREFERENCES ENDPOINTS
// ==========================================
app.get('/api/users/preferences', authenticateToken, (req, res) => {
  db.get("SELECT preferences FROM users WHERE id = ?", [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!row) return res.status(404).json({ error: "User not found." });
    try {
      const prefs = row.preferences ? JSON.parse(row.preferences) : {};
      res.json(prefs);
    } catch (e) {
      res.json({});
    }
  });
});

app.put('/api/users/preferences', authenticateToken, (req, res) => {
  db.get("SELECT preferences FROM users WHERE id = ?", [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!row) return res.status(404).json({ error: "User not found." });

    let currentPrefs = {};
    try {
      currentPrefs = row.preferences ? JSON.parse(row.preferences) : {};
    } catch (e) { }

    const newPrefs = { ...currentPrefs, ...req.body };
    const prefsString = JSON.stringify(newPrefs);

    db.run("UPDATE users SET preferences = ? WHERE id = ?", [prefsString, req.user.id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "Failed to update preferences." });
      res.json({ success: true, preferences: newPrefs });
    });
  });
});

// ==========================================
// USER MANAGEMENT ENDPOINTS (CEO ONLY)
// ==========================================
app.get('/api/users', authenticateToken, requireCEO, (req, res) => {
  db.all("SELECT id, username, role, is_active, security_question FROM users ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', authenticateToken, requireCEO, async (req, res) => {
  const { username, password, role, security_question, security_answer } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: "Username, password, and role are required." });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = security_answer ? await bcrypt.hash(security_answer.toLowerCase().trim(), 10) : '';
    db.run(
      "INSERT INTO users (username, password, role, security_question, security_answer, is_active) VALUES (?, ?, ?, ?, ?, 1)",
      [username, hashedPassword, role, security_question || '', hashedAnswer],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(409).json({ error: "Username already exists." });
          return res.status(500).json({ error: err.message });
        }
        logActivity(req.user.username, 'CREATE_USER', 'user', this.lastID, 'Created user: ' + username + ' (' + role + ')');
        res.json({ success: true, id: this.lastID });
      }
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireCEO, async (req, res) => {
  const { username, role, newPassword, security_question, security_answer } = req.body;
  const userId = req.params.id;
  let fields = []; let params = [];
  if (username !== undefined) { fields.push("username=?"); params.push(username); }
  if (role !== undefined) { fields.push("role=?"); params.push(role); }
  if (security_question !== undefined) { fields.push("security_question=?"); params.push(security_question); }
  if (newPassword) {
    const hashed = await bcrypt.hash(newPassword, 10);
    fields.push("password=?"); params.push(hashed);
  }
  if (security_answer) {
    const hashedAns = await bcrypt.hash(security_answer.toLowerCase().trim(), 10);
    fields.push("security_answer=?"); params.push(hashedAns);
  }
  if (fields.length === 0) return res.json({ success: true, message: "No changes." });
  params.push(userId);
  db.run('UPDATE users SET ' + fields.join(', ') + ' WHERE id=?', params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logActivity(req.user.username, 'UPDATE_USER', 'user', userId, 'Updated: ' + fields.map(f => f.split('=')[0]).join(', '));
    res.json({ success: true });
  });
});

app.put('/api/users/:id/toggle-active', authenticateToken, requireCEO, (req, res) => {
  const userId = req.params.id;
  if (String(req.user.id) === String(userId)) {
    return res.status(400).json({ error: "You can't deactivate your own account." });
  }
  db.get("SELECT username, is_active FROM users WHERE id=?", [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: "User not found." });
    const newStatus = user.is_active === 1 ? 0 : 1;
    db.run("UPDATE users SET is_active=? WHERE id=?", [newStatus, userId], function (updateErr) {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      const action = newStatus === 1 ? 'ACTIVATE_USER' : 'DEACTIVATE_USER';
      logActivity(req.user.username, action, 'user', userId, 'User ' + user.username + (newStatus === 1 ? ' activated' : ' deactivated'));
      res.json({ success: true, is_active: newStatus });
    });
  });
});

app.put('/api/users/:id/change-own-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.params.id;
  if (String(req.user.id) !== String(userId)) return res.status(403).json({ error: "You can only change your own password this way." });
  db.get("SELECT password FROM users WHERE id=?", [userId], async (err, user) => {
    if (err || !user) return res.status(404).json({ error: "User not found." });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: "Wrong password." });
    const hashed = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password=? WHERE id=?", [hashed, userId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      logActivity(req.user.username, 'CHANGE_PASSWORD', 'user', userId, 'User changed own password');
      res.json({ success: true });
    });
  });
});

// ==========================================
// AUDIT LOG ENDPOINT (CEO ONLY)
// ==========================================

// ==========================================
// USER SETTINGS ENDPOINTS
// ==========================================
app.get('/api/users/me/settings', authenticateToken, (req, res) => {
  db.get("SELECT settings_json FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "User not found" });
    let parsedSettings = {};
    try { parsedSettings = JSON.parse(user.settings_json || '{}'); } catch (e) { }
    res.json({ settings: parsedSettings });
  });
});

app.put('/api/users/me/settings', authenticateToken, (req, res) => {
  const { settings } = req.body;
  if (!settings) return res.status(400).json({ error: "No settings provided" });

  db.run("UPDATE users SET settings_json = ? WHERE id = ?", [JSON.stringify(settings), req.user.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/audit-logs', authenticateToken, requireCEO, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const { username, action, entity_type, startDate, endDate } = req.query;
  let conditions = []; let params = [];
  if (username) { conditions.push("username LIKE ?"); params.push('%' + username + '%'); }
  if (action) { conditions.push("action = ?"); params.push(action); }
  if (entity_type) { conditions.push("entity_type = ?"); params.push(entity_type); }
  if (startDate) { conditions.push("timestamp >= ?"); params.push(startDate); }
  if (endDate) { conditions.push("timestamp <= ?"); params.push(endDate + 'T23:59:59Z'); }
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  db.get('SELECT COUNT(*) as total FROM audit_logs ' + whereClause, params, (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(
      'SELECT * FROM audit_logs ' + whereClause + ' ORDER BY id DESC LIMIT ? OFFSET ?',
      [...params, limit, offset],
      (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ logs: rows, total: countRow.total, page, limit });
      }
    );
  });
});

// ==========================================
// AUDIT LOG EXCEL EXPORT (CEO ONLY)
// ==========================================
// GET /api/audit-logs/export
// Accepts the same filter params as the paginated endpoint but fetches ALL
// matching rows, then builds and streams a styled .xlsx file via ExcelJS.
app.get('/api/audit-logs/export', authenticateToken, requireCEO, async (req, res) => {
  const { username, action, entity_type, startDate, endDate } = req.query;
  let conditions = []; let params = [];
  if (username) { conditions.push("username LIKE ?"); params.push('%' + username + '%'); }
  if (action) { conditions.push("action = ?"); params.push(action); }
  if (entity_type) { conditions.push("entity_type = ?"); params.push(entity_type); }
  if (startDate) { conditions.push("timestamp >= ?"); params.push(startDate); }
  if (endDate) { conditions.push("timestamp <= ?"); params.push(endDate + 'T23:59:59Z'); }
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM audit_logs ' + whereClause + ' ORDER BY id DESC',
        params,
        (err, data) => { if (err) reject(err); else resolve(data); }
      );
    });

    // ── Build styled workbook ──────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FBTMCC Cost Monitoring System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Audit Trail', {
      // Freeze the header row so it stays pinned while scrolling
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // ── Column definitions with widths ────────────────────────
    sheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 24 },
      { header: 'Username', key: 'username', width: 18 },
      { header: 'Action', key: 'action', width: 30 },
      { header: 'Entity Type', key: 'entity_type', width: 18 },
      { header: 'Entity ID', key: 'entity_id', width: 22 },
      { header: 'Details', key: 'details', width: 55 },
    ];

    // ── Shared border style for every data cell ───────────────
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, // gray-300
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };

    // ── Style the header row (row 1) ──────────────────────────
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      // Deep indigo fill (#3730a3 = indigo-800)
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FF3730A3' }
      };
      cell.font = {
        bold: true, color: { argb: 'FFFFFFFF' }, size: 11,
        name: 'Calibri'
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF3730A3' } },
        left: { style: 'medium', color: { argb: 'FF3730A3' } },
        bottom: { style: 'medium', color: { argb: 'FF3730A3' } },
        right: { style: 'medium', color: { argb: 'FF3730A3' } },
      };
    });
    headerRow.height = 28;
    headerRow.commit();

    // ── Add data rows with formatting ─────────────────────────
    rows.forEach((log, idx) => {
      // Format timestamp nicely
      const ts = log.timestamp
        ? new Date(log.timestamp).toLocaleString('en-PH', {
          year: 'numeric', month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
        : '—';

      const dataRow = sheet.addRow({
        timestamp: ts,
        username: log.username || '—',
        action: log.action || '—',
        entity_type: log.entity_type || '—',
        entity_id: log.entity_id || '—',
        details: log.details || '—',
      });

      // Alternating row background: white / very light indigo tint
      const rowFill = idx % 2 === 0
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }   // white
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };  // indigo-50

      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = rowFill;
        cell.border = thinBorder;
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } }; // slate-800
        cell.alignment = { vertical: 'middle', wrapText: true };
      });

      dataRow.height = 18;
      dataRow.commit();
    });

    // ── Stream to response ────────────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `audit_log_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    logActivity(req.user.username, 'EXPORT_AUDIT_LOG', 'audit_log', 'excel', `Exported ${rows.length} log entries`);

  } catch (err) {
    console.error('Audit log Excel export error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Excel file.' });
    }
  }
});

// ==========================================
// PROJECTS ENDPOINTS
// ==========================================
app.get('/api/projects', authenticateToken, (req, res) => { db.all("SELECT * FROM projects ORDER BY project_code ASC", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/projects', authenticateToken, (req, res) => { const { id, project_code, project_name, contract_cost, profit_percentage, project_type, project_area, project_start, days_end } = req.body; const newId = id || Math.random().toString(36).substr(2, 9); db.run("INSERT INTO projects (id, project_code, project_name, contract_cost, profit_percentage, project_type, project_area, project_start, days_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [newId, project_code, project_name, contract_cost || 0, profit_percentage || 0.20, project_type || 'Construction', project_area || '', project_start || '', days_end || ''], function (err) { if (err) return res.status(500).json({ error: err.message }); logActivity(req.user.username, 'CREATE_PROJECT', 'project', newId, 'Created: ' + project_code + ' - ' + project_name); res.json({ success: true, id: newId }); }); });
app.put('/api/projects/:id', authenticateToken, (req, res) => { const { project_code, project_name, contract_cost, profit_percentage, project_type, project_area, project_start, days_end } = req.body; let fields = []; let params = []; if (project_code !== undefined) { fields.push("project_code=?"); params.push(project_code); } if (project_name !== undefined) { fields.push("project_name=?"); params.push(project_name); } if (contract_cost !== undefined) { fields.push("contract_cost=?"); params.push(contract_cost); } if (profit_percentage !== undefined) { fields.push("profit_percentage=?"); params.push(profit_percentage); } if (project_type !== undefined) { fields.push("project_type=?"); params.push(project_type); } if (project_area !== undefined) { fields.push("project_area=?"); params.push(project_area); } if (project_start !== undefined) { fields.push("project_start=?"); params.push(project_start); } if (days_end !== undefined) { fields.push("days_end=?"); params.push(days_end); } if (fields.length === 0) return res.json({ success: true, message: "No changes" }); params.push(req.params.id); db.run('UPDATE projects SET ' + fields.join(', ') + ' WHERE id=?', params, function (err) { if (err) return res.status(500).json({ error: err.message }); logActivity(req.user.username, 'UPDATE_PROJECT', 'project', req.params.id, 'Updated project'); res.json({ success: true }); }); });
app.delete('/api/projects/:id', authenticateToken, (req, res) => { db.get("SELECT project_code FROM projects WHERE id=?", [req.params.id], (e, proj) => { db.run("DELETE FROM projects WHERE id=?", req.params.id, function (err) { if (err) return res.status(500).json({ error: err.message }); logActivity(req.user.username, 'DELETE_PROJECT', 'project', req.params.id, 'Deleted: ' + (proj ? proj.project_code : req.params.id)); res.json({ success: true }); }); }); });

// ==========================================
// STOCKS ENDPOINTS
// ==========================================
app.get('/api/stocks', authenticateToken, (req, res) => {
  db.all("SELECT * FROM stocks ORDER BY item_name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/stocks', authenticateToken, (req, res) => {
  const { id, item_name, sku, category, quantity, unit, reorder_level, unit_cost, project_code } = req.body;
  const newId = id || Math.random().toString(36).substr(2, 9);
  const last_updated = new Date().toISOString();
  db.run(
    "INSERT INTO stocks (id, item_name, sku, category, quantity, unit, reorder_level, unit_cost, project_code, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [newId, item_name, sku, category, quantity || 0, unit || '', reorder_level || 10, unit_cost || 0, project_code || null, last_updated],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logActivity(req.user.username, 'CREATE_STOCK_ITEM', 'stock', newId, `Created item: ${item_name} (SKU: ${sku || 'N/A'})`);
      res.json({ success: true, id: newId });
    }
  );
});

app.put('/api/stocks/:id', authenticateToken, (req, res) => {
  const { item_name, sku, category, quantity, unit, reorder_level, unit_cost, project_code } = req.body;
  const last_updated = new Date().toISOString();
  let fields = [];
  let params = [];

  if (item_name !== undefined) { fields.push("item_name=?"); params.push(item_name); }
  if (sku !== undefined) { fields.push("sku=?"); params.push(sku); }
  if (category !== undefined) { fields.push("category=?"); params.push(category); }
  if (quantity !== undefined) { fields.push("quantity=?"); params.push(quantity); }
  if (unit !== undefined) { fields.push("unit=?"); params.push(unit); }
  if (reorder_level !== undefined) { fields.push("reorder_level=?"); params.push(reorder_level); }
  if (unit_cost !== undefined) { fields.push("unit_cost=?"); params.push(unit_cost); }
  if (project_code !== undefined) { fields.push("project_code=?"); params.push(project_code); }

  if (fields.length === 0) return res.json({ success: true, message: "No changes" });

  fields.push("last_updated=?");
  params.push(last_updated);

  params.push(req.params.id);

  db.run('UPDATE stocks SET ' + fields.join(', ') + ' WHERE id=?', params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logActivity(req.user.username, 'UPDATE_STOCK_ITEM', 'stock', req.params.id, `Updated item ${item_name || 'ID: ' + req.params.id}`);
    res.json({ success: true });
  });
});

app.delete('/api/stocks/:id', authenticateToken, (req, res) => {
  db.get("SELECT item_name FROM stocks WHERE id=?", [req.params.id], (e, stock) => {
    db.run("DELETE FROM stocks WHERE id=?", req.params.id, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logActivity(req.user.username, 'DELETE_STOCK_ITEM', 'stock', req.params.id, `Deleted: ${stock ? stock.item_name : req.params.id}`);
      res.json({ success: true });
    });
  });
});

// ==========================================================
// CATEGORIES ENDPOINTS
// ==========================================
app.get('/api/categories', authenticateToken, (req, res) => { db.all("SELECT * FROM expense_categories ORDER BY name ASC", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/categories', authenticateToken, (req, res) => { db.run("INSERT INTO expense_categories (name, category_type) VALUES (?, ?)", [req.body.name, req.body.category_type || 'Construction'], function (err) { if (err) return res.status(500).json({ error: err.message }); logActivity(req.user.username, 'CREATE_CATEGORY', 'category', this.lastID, 'Added: ' + req.body.name); res.json({ success: true, id: this.lastID }); }); });
app.delete('/api/categories/:id', authenticateToken, (req, res) => { db.get("SELECT name FROM expense_categories WHERE id=?", [req.params.id], (e, cat) => { db.run("DELETE FROM expense_categories WHERE id=?", req.params.id, function (err) { if (err) return res.status(500).json({ error: err.message }); logActivity(req.user.username, 'DELETE_CATEGORY', 'category', req.params.id, 'Deleted: ' + (cat ? cat.name : req.params.id)); res.json({ success: true }); }); }); });

// ==========================================
// DISBURSEMENTS ENDPOINTS
// ==========================================
app.get('/api/disbursements', authenticateToken, (req, res) => {
  db.all("SELECT * FROM disbursements ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const formattedRows = rows.map(row => ({
      ...row,
      expenses: row.expenses_json ? JSON.parse(row.expenses_json) : [],
      attachments: row.attachments_json ? JSON.parse(row.attachments_json) : []
    }));
    res.json(formattedRows);
  });
});

app.post('/api/disbursements', authenticateToken, (req, res) => {
  const dataList = Array.isArray(req.body) ? req.body : [req.body];

  // Backend validation: skip net-amount check for stock allocation entries and monitoring-only drafts
  for (let data of dataList) {
    if (data.is_stock_allocation) continue;
    if (data.is_monitoring_only) continue; // monitoring drafts may have any amount; excluded from totals
    const computed_net_amount = Number(data.gross_amount || 0) - Number(data.ewt_amount || 0) - Number(data.stocks_amount || 0);
    if (Math.abs(computed_net_amount - Number(data.net_amount || 0)) > 0.01) {
      return res.status(400).json({ error: "Data integrity check failed: Net amount mismatch." });
    }
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare('INSERT INTO disbursements (id, project_code, date, payee, particulars, tin, cv_no, bank, check_no, or_inv_no, accts_pay, input_tax, output_tax, target_cib, gross_amount, ewt_amount, net_amount, expenses_json, created_at, costing_type, attachments_json, stocks_amount, stock_description, is_monitoring_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    let hasError = false;
    let completed = 0;

    dataList.forEach(data => {
      if (hasError) return;
      const newId = Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);

      const s = (val) => (val === "" || val === undefined) ? null : val;

      stmt.run(newId, s(data.project_code), data.date, s(data.payee), s(data.particulars), s(data.tin), s(data.cv_no), s(data.bank), s(data.check_no), s(data.or_inv_no), data.accts_pay || 0, data.input_tax || 0, data.output_tax || 0, data.target_cib || 0, data.gross_amount || 0, data.ewt_amount || 0, data.net_amount || 0, JSON.stringify(data.expenses), data.created_at, data.costing_type || 'normal', JSON.stringify(data.attachments || []), data.stocks_amount || 0, data.stock_description || '', data.is_monitoring_only ? 1 : 0, function (err) {
        if (hasError) return;
        if (err) {
          hasError = true;
          db.run("ROLLBACK");
          return res.status(500).json({ error: err.message });
        }

        logActivity(req.user.username, 'CREATE_DISBURSEMENT', 'disbursement', newId, 'CV# ' + data.cv_no + ' | Project: ' + data.project_code + ' | Amount: ' + data.gross_amount);

        const afterInsert = () => {
          completed++;
          if (completed === dataList.length) {
            db.run("COMMIT", (commitErr) => {
              if (commitErr) return res.status(500).json({ error: commitErr.message });
              res.json({ success: true, message: 'Record(s) saved successfully.' });
            });
          }
        };

        // If this is a stock allocation, deduct the explicit allocated_amount from the source stock record
        if (data.is_stock_allocation && data.source_cv_no && data.allocated_amount > 0) {
          const deductAmount = Number(data.allocated_amount);
          db.run(
            "UPDATE disbursements SET stocks_amount = stocks_amount - ? WHERE cv_no = ?",
            [deductAmount, data.source_cv_no],
            function (deductErr) {
              if (hasError) return;
              if (deductErr) {
                hasError = true;
                db.run("ROLLBACK");
                return res.status(500).json({ error: 'Stock deduction failed: ' + deductErr.message });
              }
              if (this.changes === 0) {
                hasError = true;
                db.run("ROLLBACK");
                return res.status(400).json({ error: `Stock deduction failed: CV# ${data.source_cv_no} not found or insufficient stock.` });
              }
              logActivity(req.user.username, 'STOCK_ALLOCATION', 'disbursement', newId, `Deducted ₱${deductAmount} from stock CV# ${data.source_cv_no}`);
              afterInsert();
            }
          );
        } else {
          afterInsert();
        }
      });
    });
    stmt.finalize();
  });
});

app.put('/api/disbursements/:id', authenticateToken, (req, res) => {
  const data = req.body; const id = req.params.id;

  // Backend validation: Compute expected net amount (Gross - EWT - Stocks)
  // Skip check for monitoring-only drafts — amounts are display-only, excluded from grand totals
  if (!data.is_monitoring_only) {
    const computed_net_amount = Number(data.gross_amount || 0) - Number(data.ewt_amount || 0) - Number(data.stocks_amount || 0);
    if (Math.abs(computed_net_amount - Number(data.net_amount || 0)) > 0.01) {
      return res.status(400).json({ error: "Data integrity check failed: Net amount mismatch." });
    }
  }

  const s = (val) => (val === "" || val === undefined) ? null : val;
  const stmt = db.prepare('UPDATE disbursements SET project_code=?, date=?, payee=?, particulars=?, tin=?, cv_no=?, bank=?, check_no=?, or_inv_no=?, accts_pay=?, input_tax=?, output_tax=?, target_cib=?, gross_amount=?, ewt_amount=?, net_amount=?, expenses_json=?, costing_type=?, attachments_json=?, stocks_amount=?, stock_description=?, is_monitoring_only=? WHERE id=?');
  stmt.run(s(data.project_code), data.date, s(data.payee), s(data.particulars), s(data.tin), s(data.cv_no), s(data.bank), s(data.check_no), s(data.or_inv_no), data.accts_pay || 0, data.input_tax || 0, data.output_tax || 0, data.target_cib || 0, data.gross_amount || 0, data.ewt_amount || 0, data.net_amount || 0, JSON.stringify(data.expenses), data.costing_type || 'normal', JSON.stringify(data.attachments || []), data.stocks_amount || 0, data.stock_description || '', data.is_monitoring_only ? 1 : 0, id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logActivity(req.user.username, 'UPDATE_DISBURSEMENT', 'disbursement', id, 'CV# ' + data.cv_no + ' | Project: ' + data.project_code);
    res.json({ success: true, message: 'Record updated successfully.' });
  });
  stmt.finalize();
});

app.delete('/api/disbursements/:id', authenticateToken, (req, res) => {
  db.get("SELECT cv_no, project_code FROM disbursements WHERE id=?", [req.params.id], (e, d) => {
    db.run("DELETE FROM disbursements WHERE id=?", req.params.id, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logActivity(req.user.username, 'DELETE_DISBURSEMENT', 'disbursement', req.params.id, 'CV# ' + (d ? d.cv_no : 'N/A') + ' | Project: ' + (d ? d.project_code : 'N/A'));
      res.json({ success: true });
    });
  });
});

// ==========================================
// DISBURSEMENTS EXCEL EXPORT
// ==========================================
app.get('/api/disbursements/export', authenticateToken, async (req, res) => {
  const { search, months, years, transactionFilter } = req.query;
  const monthArray = months ? months.split(',') : [];
  const yearArray = years ? years.split(',') : [];

  db.all("SELECT * FROM disbursements ORDER BY date DESC, cv_no DESC", [], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // 1. Filter rows in JavaScript
    let filtered = rows.filter(row => row.costing_type !== 'additional');

    if (monthArray.length > 0 || yearArray.length > 0) {
      filtered = filtered.filter(d => {
        if (!d.date) return false;
        const y = d.date.substring(0, 4);
        const m = d.date.substring(5, 7);
        const yearMatches = yearArray.length === 0 || yearArray.includes(y);
        const monthMatches = monthArray.length === 0 || monthArray.includes(m);
        return yearMatches && monthMatches;
      });
    }

    if (transactionFilter === 'EWT') {
      filtered = filtered.filter(d => (parseFloat(d.ewt_amount) || 0) > 0);
    }

    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(d => d.cv_no && d.cv_no.toLowerCase().includes(q));
    }

    // Parse expenses and collect dynamic categories
    const allCategories = new Set();
    let processedRows = filtered.map(row => {
      let expenses = [];
      try {
        expenses = row.expenses_json ? JSON.parse(row.expenses_json) : [];
      } catch (e) {
        expenses = [];
      }
      expenses.forEach(exp => {
        if (exp.category && (parseFloat(exp.amount) || 0) > 0) {
          allCategories.add(exp.category);
        }
      });
      return { ...row, expenses };
    });

    if (transactionFilter === 'EWT') {
      processedRows = processedRows.map(row => {
        let laborNet = 0;
        let laborEwt = 0;
        let laborGross = 0;

        row.expenses.forEach(exp => {
          if (exp.category && exp.category.toUpperCase().includes('LABOR')) {
            const amt = parseFloat(exp.amount) || 0;
            laborNet += amt;
            laborEwt += (amt / 0.98) - amt;
            laborGross += (amt / 0.98);
          }
        });

        return {
          ...row,
          net_amount: laborNet,
          ewt_amount: laborEwt,
          gross_amount: laborGross,
          target_cib: laborGross,
          accts_pay: 0,
          input_tax: 0,
          output_tax: 0,
          stocks_amount: 0,
          expenses: row.expenses.filter(exp => exp.category && exp.category.toUpperCase().includes('LABOR'))
        };
      });
    }

    const dynamicCategories = Array.from(allCategories).sort((a, b) => a.localeCompare(b));

    // 2. Build the Excel Workbook
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'FBTMCC Cost Monitoring System';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Disbursement Ledger', {
        pageSetup: { paperSize: 9, orientation: 'landscape' }
      });

      // BUILD ACCOUNTING SUMMARY AT TOP
      let totalDrGross = 0;
      let totalCrCIB = 0;
      let totalCrEWT = 0;

      processedRows.forEach(row => {
        totalDrGross += parseFloat(row.gross_amount) || 0;
        const isCreditCard = row.project_code && row.project_code.toLowerCase() === 'credit card';
        const originalNet = parseFloat(row.net_amount) || 0;
        const originalAcctsPay = parseFloat(row.accts_pay) || 0;
        // Combine CIB and Accts Pay
        totalCrCIB += (isCreditCard ? 0 : originalNet) + (isCreditCard ? (originalAcctsPay + originalNet) : originalAcctsPay);
        totalCrEWT += parseFloat(row.ewt_amount) || 0;
      });

      // Format Date String
      const monthNames = {
        '01': 'JANUARY', '02': 'FEBRUARY', '03': 'MARCH', '04': 'APRIL', '05': 'MAY', '06': 'JUNE',
        '07': 'JULY', '08': 'AUGUST', '09': 'SEPTEMBER', '10': 'OCTOBER', '11': 'NOVEMBER', '12': 'DECEMBER'
      };

      let dateString = '';
      if (monthArray.length > 0 && yearArray.length > 0) {
        const mStr = monthArray.map(m => monthNames[m] || m).join(', ');
        const yStr = yearArray.join(', ');
        dateString = `For the month of ${mStr} ${yStr}`;
      } else if (monthArray.length > 0) {
        dateString = `For the month of ${monthArray.map(m => monthNames[m] || m).join(', ')}`;
      } else if (yearArray.length > 0) {
        dateString = `For the year ${yearArray.join(', ')}`;
      } else {
        dateString = `All Records`;
      }

      // Add Summary Rows (Rows 1 to 5)
      const sumR1 = sheet.addRow(['FBT MARKETING AND CONSTR', '', '', 'Dr', 'Cr']);
      const sumR2 = sheet.addRow(['Summary of Disbursement', '', '', totalDrGross, totalCrCIB]);
      const sumR3 = sheet.addRow([dateString, '', '', null, transactionFilter === 'EWT' ? totalCrEWT : (totalCrEWT > 0 ? totalCrEWT : null)]);
      const sumR4 = sheet.addRow(['', '', '', totalDrGross, totalCrCIB + totalCrEWT]);
      sheet.addRow([]); // Empty row 5

      // Style Summary block
      [sumR1, sumR2, sumR3, sumR4].forEach(r => {
        r.getCell(1).font = { bold: true, name: 'Calibri', size: 11 };
        r.getCell(4).numFmt = '#,##0.00';
        r.getCell(5).numFmt = '#,##0.00';
      });

      sumR1.getCell(4).font = { bold: true, color: { argb: 'FF2563EB' } };
      sumR1.getCell(5).font = { bold: true, color: { argb: 'FF2563EB' } };
      sumR1.getCell(4).alignment = { horizontal: 'center' };
      sumR1.getCell(5).alignment = { horizontal: 'center' };

      sumR3.getCell(5).border = { bottom: { style: 'thin' } };
      sumR4.getCell(4).border = { top: { style: 'thin' }, bottom: { style: 'double' } };
      sumR4.getCell(5).border = { bottom: { style: 'double' } };

      sheet.mergeCells(`A1:C1`);
      sheet.mergeCells(`A2:C2`);
      sheet.mergeCells(`A3:C3`);
      sheet.mergeCells(`A4:C4`);

      // Define Columns WITHOUT sheet.columns (to avoid writing header to row 1)
      let colDefinitions = [];
      let headers = [];

      if (transactionFilter === 'EWT') {
        colDefinitions = [
          { key: 'date', width: 11 },
          { key: 'payee', width: 18 },
          { key: 'cv_no', width: 10 },
          { key: 'project', width: 10 },
          { key: 'gross', width: 13 },
          { key: 'ewt', width: 12 },
          { key: 'labor_payroll', width: 15 },
          { key: 'particulars', width: 25 }
        ];
        headers = ['Date', 'Payee', 'CV No.', 'Project', 'Debit (Gross)', 'EWT', 'LABOR/PAYROLL', 'Particulars'];
      } else {
        colDefinitions = [
          { key: 'date', width: 15 },
          { key: 'payee', width: 25 },
          { key: 'cv_no', width: 15 },
          { key: 'project', width: 18 },
          { key: 'gross', width: 18 },
          { key: 'cib', width: 18 },
          { key: 'accts_pay', width: 22 },
          { key: 'ewt', width: 18 }
        ];
        dynamicCategories.forEach(cat => {
          colDefinitions.push({ key: `cat_${cat}`, width: 16 });
        });
        colDefinitions.push({ key: 'particulars', width: 40 });

        headers = ['Date', 'Payee', 'CV No.', 'Project', 'Debit (Gross)', 'Credit (CIB)', 'Accts Pay (Credit Card)', 'EWT'];
        dynamicCategories.forEach(cat => headers.push(cat));
        headers.push('Particulars');
      }

      // Apply widths and keys manually
      colDefinitions.forEach((col, i) => {
        const colObj = sheet.getColumn(i + 1);
        colObj.width = col.width;
        colObj.key = col.key;
      });

      // ADD HEADER ROW (Row 6)
      const headerRow = sheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3730A3' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF3730A3' } },
          left: { style: 'medium', color: { argb: 'FF3730A3' } },
          bottom: { style: 'medium', color: { argb: 'FF3730A3' } },
          right: { style: 'medium', color: { argb: 'FF3730A3' } }
        };
      });
      headerRow.height = 28;
      headerRow.commit();

      // Freeze panes below header
      sheet.views = [{ state: 'frozen', ySplit: 6 }];

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };

      const startDataRowIndex = sheet.rowCount + 1; // Row 7

      // Populate Data Rows
      processedRows.forEach((row, idx) => {
        const isCreditCard = row.project_code && row.project_code.toLowerCase() === 'credit card';

        let grossAmount = parseFloat(row.gross_amount) || 0;
        let originalNet = parseFloat(row.net_amount) || 0;
        let originalAcctsPay = parseFloat(row.accts_pay) || 0;
        let ewtAmount = parseFloat(row.ewt_amount) || 0;

        let cib = isCreditCard ? 0 : originalNet;
        let finalAcctsPay = isCreditCard ? (originalAcctsPay + originalNet) : originalAcctsPay;

        let rowData = {};

        if (transactionFilter === 'EWT') {
          let laborAmount = 0;
          row.expenses.forEach(e => {
            if (e.category && (e.category.toUpperCase() === 'LABOR/PAYROLL' || e.category.toUpperCase().includes('LABOR'))) {
              laborAmount += parseFloat(e.amount) || 0;
            }
          });
          rowData = {
            date: row.date || '',
            payee: row.payee || '',
            cv_no: row.cv_no ? `#${row.cv_no}` : '',
            project: row.project_code || '',
            gross: grossAmount,
            ewt: ewtAmount,
            labor_payroll: laborAmount,
            particulars: row.particulars || ''
          };
        } else {
          rowData = {
            date: row.date || '',
            payee: row.payee || '',
            cv_no: row.cv_no ? `#${row.cv_no}` : '',
            project: row.project_code || '',
            gross: grossAmount,
            cib: cib,
            accts_pay: finalAcctsPay,
            ewt: ewtAmount,
            particulars: row.particulars || ''
          };
          // Add dynamic category amounts
          dynamicCategories.forEach(cat => {
            const exp = row.expenses.find(e => e.category === cat);
            rowData[`cat_${cat}`] = (exp && parseFloat(exp.amount)) ? parseFloat(exp.amount) : 0;
          });
        }

        const dataRow = sheet.addRow(rowData);

        const rowFill = idx % 2 === 0
          ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
          : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

        const ewtColIndex = transactionFilter === 'EWT' ? 6 : 8;
        const lastNumCol = transactionFilter === 'EWT' ? 7 : (8 + dynamicCategories.length);

        dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.fill = rowFill;
          cell.border = thinBorder;
          cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle', wrapText: true };

          // EWT column highlight
          if (colNumber === ewtColIndex) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF9F1239' }, bold: true };
          }

          // Format numbers as Currency
          if (colNumber >= 5 && colNumber <= lastNumCol) {
            cell.numFmt = '"₱"#,##0.00';
            if (cell.value === 0) {
              cell.value = null; // To display blank instead of 0 if preferred, or keep 0. Let's keep 0 but Excel will format it
            }
          }

          // Align CV No and Project to center
          if (colNumber === 3 || colNumber === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
        });
        dataRow.height = 18;
        dataRow.commit();
      });

      // TOTAL SUMMARY ROW
      const summaryRow = sheet.addRow({});
      summaryRow.getCell(4).value = 'TOTAL SUMMARY:';
      summaryRow.getCell(4).font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF475569' } };
      summaryRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

      // Add SUM formulas
      const rowCount = processedRows.length;
      if (rowCount > 0) {
        const endRow = sheet.rowCount - 1;

        const sumCols = [];
        const lastNumCol = transactionFilter === 'EWT' ? 7 : (8 + dynamicCategories.length);
        for (let c = 5; c <= lastNumCol; c++) {
          sumCols.push(c);
        }

        const ewtColIndex = transactionFilter === 'EWT' ? 6 : 8;

        sumCols.forEach(colIndex => {
          const colLetter = sheet.getColumn(colIndex).letter;
          const cell = summaryRow.getCell(colIndex);
          cell.value = { formula: `SUM(${colLetter}${startDataRowIndex}:${colLetter}${endRow})` };
          cell.numFmt = '"₱"#,##0.00';
          cell.font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF1E293B' } };
          // Highlight EWT sum
          if (colIndex === ewtColIndex) {
            cell.font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF9F1239' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
          }
        });
      }

      summaryRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF1E293B' } }
        };
      });
      summaryRow.height = 24;
      summaryRow.commit();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      let filePrefix = 'All_Transaction_Disbursement';
      if (transactionFilter === 'EWT') {
        filePrefix = 'EWT_Transaction_Disbursement';
      } else if (transactionFilter && transactionFilter !== 'All') {
        filePrefix = `${transactionFilter}_Transaction_Disbursement`;
      }
      const filename = `${filePrefix}_${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();

      logActivity(req.user.username, 'EXPORT_DISBURSEMENT_LEDGER', 'disbursements', 'excel', `Exported ${processedRows.length} filtered records`);
    } catch (err) {
      console.error('Disbursement export error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate Excel file.' });
      }
    }
  });
});

// ==========================================
// FILE UPLOAD ENDPOINTS
// ==========================================
app.post('/api/disbursements/:id/upload', authenticateToken, upload.single('receipt'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const { id } = req.params;
  const fileInfo = { filename: req.file.filename, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, uploadedAt: new Date().toISOString(), uploadedBy: req.user.username };
  db.get("SELECT attachments_json FROM disbursements WHERE id=?", [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Disbursement not found.' });
    let attachments = [];
    try { attachments = JSON.parse(row.attachments_json || '[]'); } catch (e) { attachments = []; }
    attachments.push(fileInfo);
    db.run("UPDATE disbursements SET attachments_json=? WHERE id=?", [JSON.stringify(attachments), id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      logActivity(req.user.username, 'UPLOAD_ATTACHMENT', 'disbursement', id, 'Uploaded: ' + req.file.originalname);
      res.json({ success: true, file: fileInfo });
    });
  });
});

app.delete('/api/disbursements/:id/attachments/:filename', authenticateToken, (req, res) => {
  const { id, filename } = req.params;
  const filePath = path.join(uploadsDir, filename);
  db.get("SELECT attachments_json FROM disbursements WHERE id=?", [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Disbursement not found.' });
    let attachments = [];
    try { attachments = JSON.parse(row.attachments_json || '[]'); } catch (e) { attachments = []; }
    attachments = attachments.filter(a => a.filename !== filename);
    db.run("UPDATE disbursements SET attachments_json=? WHERE id=?", [JSON.stringify(attachments), id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      logActivity(req.user.username, 'DELETE_ATTACHMENT', 'disbursement', id, 'Deleted: ' + filename);
      res.json({ success: true });
    });
  });
});

// ==========================================
// DATABASE EXPORT / IMPORT ENDPOINTS
// ==========================================

// Helper: verify the calling user's own login password via bcrypt
const verifyUserPassword = (username, password) => new Promise((resolve, reject) => {
  db.get('SELECT password FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return reject(new Error('User not found.'));
    const match = await bcrypt.compare(password, user.password);
    if (!match) return reject(new Error('Incorrect password.'));
    resolve(true);
  });
});

// Dedicated multer instance for .db file uploads only
const dbUploadDir = path.resolve(__dirname, 'db_uploads_temp');
if (!fs.existsSync(dbUploadDir)) {
  fs.mkdirSync(dbUploadDir, { recursive: true });
}
const dbUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dbUploadDir),
  filename: (req, file, cb) => cb(null, `imported_${Date.now()}.db`)
});
const dbUpload = multer({
  storage: dbUploadStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
  fileFilter: (req, file, cb) => {
    const extOk = path.extname(file.originalname).toLowerCase() === '.db';
    if (extOk) cb(null, true);
    else cb(new Error('Only .db files are allowed for database import.'));
  }
});

// POST /api/db/export
// Accepts { password } in the body. Verifies the calling CEO's own login password,
// then streams costmon_local.db back to the client as a downloadable attachment.
app.post('/api/db/export', authenticateToken, requireCEO, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  try {
    await verifyUserPassword(req.user.username, password);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || 'Incorrect password. Export denied.' });
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'Database file not found on server.' });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const exportFilename = `costmon_backup_${timestamp}.db`;

  logActivity(req.user.username, 'EXPORT_DATABASE', 'database', 'costmon_local.db', 'Database exported successfully');

  res.setHeader('Content-Disposition', `attachment; filename="${exportFilename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  const readStream = fs.createReadStream(dbPath);
  readStream.on('error', (streamErr) => {
    console.error('Export stream error:', streamErr.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream database file.' });
    }
  });
  readStream.pipe(res);
});

// POST /api/db/import
// Accepts multipart/form-data with { password, dbFile }. Verifies the calling CEO's own
// login password, then safely replaces the live .db file with the uploaded one.
app.post('/api/db/import', authenticateToken, requireCEO, dbUpload.single('dbFile'), async (req, res) => {
  const { password } = req.body;

  // Verify password first; clean up temp file on failure
  try {
    await verifyUserPassword(req.user.username, password);
  } catch (authErr) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(401).json({ error: authErr.message || 'Incorrect password. Import denied.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No database file was uploaded.' });
  }

  const uploadedPath = req.file.path;
  const backupPath = dbPath + '.bak';

  try {
    // Step 1: Close connections gracefully by checkpointing WAL if it exists
    await new Promise((resolve) => {
      db.run('PRAGMA wal_checkpoint(FULL);', () => resolve());
    });

    // Step 2: Create a backup of the current live database
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    // Step 3: Replace the live database with the uploaded one
    fs.copyFileSync(uploadedPath, dbPath);

    // Step 4: Remove temp uploaded file
    fs.unlinkSync(uploadedPath);

    // Step 5: Remove backup after successful swap
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    logActivity(req.user.username, 'IMPORT_DATABASE', 'database', 'costmon_local.db', 'Database replaced via import. Server restart may be required.');

    res.json({
      success: true,
      message: 'Database imported successfully. Please restart the server for all changes to take full effect.'
    });

  } catch (err) {
    console.error('Database import error:', err.message);

    // Attempt to restore from backup on failure
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, dbPath);
        fs.unlinkSync(backupPath);
        console.log('Backup restored after failed import.');
      } catch (restoreErr) {
        console.error('CRITICAL: Failed to restore backup:', restoreErr.message);
      }
    }

    // Clean up temp upload
    if (fs.existsSync(uploadedPath)) {
      try { fs.unlinkSync(uploadedPath); } catch (_) { }
    }

    res.status(500).json({ error: 'Database import failed. The original database has been restored. Error: ' + err.message });
  }
});

// ==========================================
// OFFICE LEDGER EXCEL EXPORT
// ==========================================
// GET /api/office-ledger/export
// Query params:
//   year            - e.g. "2026" or "All"
//   overheadProjects - comma-separated codes e.g. "OFFICE,PAYATAS,RESIDENCE"
//   customColumns   - JSON array of { id, title, mappedCategories[] }
app.get('/api/office-ledger/export', authenticateToken, async (req, res) => {
  try {
    const { year, overheadProjects: opRaw, customColumns: ccRaw, hiddenProjects: hpRaw, hiddenMonths: hmRaw } = req.query;

    // Parse params
    const overheadProjects = opRaw
      ? opRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : ['OFFICE', 'PAYATAS', 'RESIDENCE'];

    let customColumns = [];
    try {
      customColumns = ccRaw ? JSON.parse(ccRaw) : [];
    } catch (_) {
      customColumns = [];
    }

    let hiddenProjects = [];
    try {
      hiddenProjects = hpRaw ? JSON.parse(hpRaw) : [];
    } catch (_) {
      hiddenProjects = [];
    }

    let hiddenMonths = [];
    try {
      hiddenMonths = hmRaw ? JSON.parse(hmRaw) : [];
    } catch (_) {
      hiddenMonths = [];
    }

    // ── Fetch all data from DB ────────────────────────────────
    let [allProjects, allDisbursements] = await Promise.all([
      new Promise((resolve, reject) =>
        db.all('SELECT * FROM projects ORDER BY project_code ASC', [], (err, rows) =>
          err ? reject(err) : resolve(rows)
        )
      ),
      new Promise((resolve, reject) =>
        db.all('SELECT * FROM disbursements ORDER BY date ASC', [], (err, rows) =>
          err ? reject(err) : resolve(rows)
        )
      )
    ]);

    // Exclude hidden projects
    allProjects = allProjects.filter(p => !hiddenProjects.includes(p.project_code));

    // Parse expenses_json
    const disbursements = allDisbursements.map(d => ({
      ...d,
      expenses: d.expenses_json ? (() => { try { return JSON.parse(d.expenses_json); } catch (_) { return []; } })() : []
    }));

    // ── Apply year filter ─────────────────────────────────────
    const filtered = year && year !== 'All'
      ? disbursements.filter(d => d.date && String(d.date).startsWith(year))
      : disbursements;

    // ── Helper: match category against mapped keywords ────────
    const matchesCol = (category, mappedCategories) => {
      const eClean = String(category).toLowerCase().replace(/[^a-z0-9]/g, '');
      return mappedCategories.some(kw => {
        const kClean = String(kw).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!eClean || !kClean) return false;
        return eClean.includes(kClean) || kClean.includes(eClean);
      });
    };

    // ── 1. Compute per-project data (construction projects only) ──
    const officeProjectCodes = new Set(
      allProjects.filter(p => p.project_type === 'Office').map(p => p.project_code.toUpperCase())
    );

    const constructionProjects = allProjects.filter(p => p.project_type !== 'Office');

    const projectData = constructionProjects.map(p => {
      const projExpenses = filtered.filter(d =>
        d.project_code && d.project_code.toUpperCase() === p.project_code.toUpperCase()
      );

      let TAW = 0;
      projExpenses.filter(d => d.costing_type === 'additional').forEach(d => {
        (d.expenses || []).forEach(exp => { TAW += parseFloat(exp.amount) || 0; });
      });

      const CC = parseFloat(p.contract_cost) || 0;
      const TCC = CC + TAW;
      const CONTRACT_WO_VAT = TCC / 1.12;
      const CONTRACT_WO_VAT_OH_PM = CONTRACT_WO_VAT / 1.3;
      const EQ_30_OH = CONTRACT_WO_VAT_OH_PM * 0.3;
      const EQ_10_RETENTION = TCC * 0.1;
      const EFFECTIVE_OH = EQ_30_OH - EQ_10_RETENTION;
      const NET_PROFIT = EFFECTIVE_OH;

      // Overhead project expenses attributed to this project's month
      const overheadProjExpenses = filtered.filter(d =>
        d.project_code && overheadProjects.includes(d.project_code.toUpperCase())
      );

      let total_specific_expenses = 0;
      const dynamicExpenses = {};
      customColumns.forEach(col => {
        const sum = overheadProjExpenses.reduce((total, d) => {
          const lineTotal = (d.expenses || [])
            .filter(e => e.category && matchesCol(e.category, col.mappedCategories))
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
          return total + lineTotal;
        }, 0);
        dynamicExpenses[col.id] = sum;
        total_specific_expenses += sum;
      });

      const projectMk = (p.project_start && String(p.project_start).trim())
        ? String(p.project_start).slice(0, 7)
        : '__unscheduled__';

      return {
        projectMk,
        project_code: p.project_code,
        project_name: p.project_name,
        TCC, CONTRACT_WO_VAT, CONTRACT_WO_VAT_OH_PM,
        EQ_30_OH, EQ_10_RETENTION, EFFECTIVE_OH,
        NET_PROFIT, total_specific_expenses,
        ...dynamicExpenses
      };
    });

    // ── 2. Aggregate overhead expenses by month ───────────────
    const oprDisb = filtered.filter(d =>
      d.project_code && overheadProjects.includes(d.project_code.toUpperCase())
    );

    const expsByMonth = {};
    oprDisb.forEach(d => {
      const mk = d.date && String(d.date).trim() ? String(d.date).slice(0, 7) : '__unscheduled__';
      if (!expsByMonth[mk]) {
        expsByMonth[mk] = {};
        customColumns.forEach(col => { expsByMonth[mk][col.id] = 0; });
      }
      (d.expenses || []).forEach(e => {
        if (!e.category) return;
        customColumns.forEach(col => {
          if (matchesCol(e.category, col.mappedCategories)) {
            expsByMonth[mk][col.id] = (expsByMonth[mk][col.id] || 0) + (parseFloat(e.amount) || 0);
          }
        });
      });
    });

    // ── 3. Gather all month keys ──────────────────────────────
    const monthKeysSet = new Set();
    projectData.forEach(p => monthKeysSet.add(p.projectMk));
    Object.keys(expsByMonth).forEach(mk => monthKeysSet.add(mk));

    let monthKeysArray = Array.from(monthKeysSet);
    if (year && year !== 'All') {
      monthKeysArray = monthKeysArray.filter(mk => mk.startsWith(year) || mk === '__unscheduled__');
    }

    // Filter out hidden months
    monthKeysArray = monthKeysArray.filter(mk => !hiddenMonths.includes(mk));

    const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const allMonths = monthKeysArray.map(mk => {
      if (mk === '__unscheduled__') return { mk, label: 'NO DATE' };
      const [y, m] = mk.split('-');
      const mIdx = parseInt(m, 10) - 1;
      return { mk, label: (monthsNames[mIdx] || 'UNK').toUpperCase() };
    }).sort((a, b) => {
      if (a.mk === '__unscheduled__') return 1;
      if (b.mk === '__unscheduled__') return -1;
      return a.mk.localeCompare(b.mk);
    });

    // ── 4. Build ExcelJS Workbook ─────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FBTMCC Cost Monitoring System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Monthly Master Ledger', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // ── Color / Style constants ───────────────────────────────
    const INDIGO = 'FF3730A3'; // header bg
    const AMBER_LIGHT = 'FFFFF3CD'; // month header bg
    const SLATE_LIGHT = 'FFF1F5F9'; // monthly-total bg
    const GRAND_BG = 'FF312E81'; // grand total bg (darker indigo)
    const WHITE = 'FFFFFFFF';
    const GRAY_BORDER = 'FFD1D5DB';
    const DARK_TEXT = 'FF1E293B';

    const thinBorder = {
      top: { style: 'thin', color: { argb: GRAY_BORDER } },
      left: { style: 'thin', color: { argb: GRAY_BORDER } },
      bottom: { style: 'thin', color: { argb: GRAY_BORDER } },
      right: { style: 'thin', color: { argb: GRAY_BORDER } }
    };

    const mediumBorder = {
      top: { style: 'medium', color: { argb: INDIGO } },
      left: { style: 'medium', color: { argb: INDIGO } },
      bottom: { style: 'medium', color: { argb: INDIGO } },
      right: { style: 'medium', color: { argb: INDIGO } }
    };

    // Fixed columns + dynamic expense columns + Total + Net Profit
    const fixedColCount = 9; // Date, Code, TCC, CC_WO_VAT, CC_WO_VAT_OH_PM, EQ_30_OH, EQ_10_RETENTION, EFFECTIVE_OH, Total_EOC
    const dynamicColCount = customColumns.length;
    const totalCols = fixedColCount + dynamicColCount + 2; // + Total + Net Profit

    // ── Column widths ─────────────────────────────────────────
    const colDefs = [
      { key: 'date', width: 10 },
      { key: 'code', width: 16 },
      { key: 'TCC', width: 20 },
      { key: 'CONTRACT_WO_VAT', width: 20 },
      { key: 'CWOV_OH_PM', width: 22 },
      { key: 'EQ_30_OH', width: 22 },
      { key: 'EQ_10_RET', width: 24 },
      { key: 'EFFECTIVE_OH', width: 20 },
      { key: 'TOTAL_EOC', width: 20 },
      ...customColumns.map(col => ({ key: col.id, width: 18 })),
      { key: 'total_exp', width: 18 },
      { key: 'net_profit', width: 18 },
    ];

    colDefs.forEach((col, i) => {
      const c = sheet.getColumn(i + 1);
      c.key = col.key;
      c.width = col.width;
    });

    // ── Title rows ────────────────────────────────────────────
    const title1 = sheet.addRow(['FBTMCC — MONTHLY UNIFIED MASTER LEDGER']);
    sheet.mergeCells(`A1:${sheet.getColumn(totalCols).letter}1`);
    title1.getCell(1).font = { bold: true, size: 14, color: { argb: INDIGO }, name: 'Calibri' };
    title1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    title1.height = 24;

    const yearLabel = (year && year !== 'All') ? `Year: ${year}` : 'All Records';
    const title2 = sheet.addRow([yearLabel]);
    sheet.mergeCells(`A2:${sheet.getColumn(totalCols).letter}2`);
    title2.getCell(1).font = { italic: true, size: 11, color: { argb: 'FF64748B' }, name: 'Calibri' };
    title2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    title2.height = 16;

    sheet.addRow([]); // Spacer row 3

    // ── Header Row (Row 4) ────────────────────────────────────
    const headerLabels = [
      'Date',
      'Code',
      "Contract plus Add'l w/ VAT",
      'Contract w/o Vat',
      'Contract w/o Vat & Overhead & PM',
      'Equivalent 30% Overhead, Contingency & PM',
      'Equivalent 10% Retention base on Contract w/ Vat',
      'Effective Overhead',
      'Total EOC per Month',
      ...customColumns.map(col => col.title),
      'Total',
      'Net Profit'
    ];

    const headerRow = sheet.addRow(headerLabels);
    headerRow.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
      cell.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = mediumBorder;
    });
    headerRow.height = 44;
    headerRow.commit();

    // Freeze panes below header
    sheet.views = [{ state: 'frozen', ySplit: 4 }];

    // ── Number format helper ──────────────────────────────────
    const MONEY_FMT = '#,##0.00';

    // Helper: set em-dash or number value
    const fmtNum = (v) => (v === null || v === undefined || v === '') ? '' : v;

    // Helper: apply cell style for a data cell
    const styleDataCell = (cell, fill, isNumeric = false, isBold = false, fontColor = DARK_TEXT) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.font = { name: 'Calibri', size: 10, color: { argb: fontColor }, bold: isBold };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = thinBorder;
      if (isNumeric && typeof cell.value === 'number') {
        cell.numFmt = MONEY_FMT;
      }
    };

    // ── Grand total accumulators ──────────────────────────────
    const grandTotal = {
      TCC: 0, CONTRACT_WO_VAT: 0, CONTRACT_WO_VAT_OH_PM: 0,
      EQ_30_OH: 0, EQ_10_RETENTION: 0, EFFECTIVE_OH: 0,
      total_specific_expenses: 0, NET_PROFIT: 0
    };
    customColumns.forEach(col => { grandTotal[col.id] = 0; });

    // ── Per-month blocks ──────────────────────────────────────
    let dataRowIndex = 0;

    allMonths.forEach(({ mk, label }) => {
      const projs = projectData.filter(p => p.projectMk === mk);
      const exps = expsByMonth[mk] || {};

      // Compute dynamic expense sum for this month
      const dynamicExpensesSum = customColumns.reduce((sum, col) => sum + (parseFloat(exps[col.id]) || 0), 0);

      // Skip empty months
      if (projs.length === 0 && dynamicExpensesSum === 0) return;

      // ── Month Header Row ──────────────────────────────────
      const mhRow = sheet.addRow([label]);
      sheet.mergeCells(`A${mhRow.number}:${sheet.getColumn(totalCols).letter}${mhRow.number}`);
      mhRow.getCell(1).value = label;
      mhRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_LIGHT } };
      mhRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF78350F' }, name: 'Calibri' };
      mhRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      mhRow.getCell(1).border = {
        top: { style: 'medium', color: { argb: 'FFFFFBEB' } },
        bottom: { style: 'thin', color: { argb: GRAY_BORDER } },
        left: { style: 'thin', color: { argb: GRAY_BORDER } },
        right: { style: 'thin', color: { argb: GRAY_BORDER } }
      };
      mhRow.height = 20;
      mhRow.commit();

      // ── Per-project rows ──────────────────────────────────
      projs.forEach((p, idx) => {
        const rowFill = idx % 2 === 0 ? WHITE : 'FFF8FAFC';

        const values = [
          '',                            // Date (blank for project rows)
          p.project_code,               // Code
          fmtNum(p.TCC),
          fmtNum(p.CONTRACT_WO_VAT),
          fmtNum(p.CONTRACT_WO_VAT_OH_PM),
          fmtNum(p.EQ_30_OH),
          fmtNum(p.EQ_10_RETENTION),
          fmtNum(p.EFFECTIVE_OH),
          fmtNum(p.TCC),        // Total EOC per Month ≈ TCC
          ...customColumns.map(() => '—'),  // Expense cols: n/a for project rows
          '—',                          // Total (expense total: n/a)
          fmtNum(p.NET_PROFIT)
        ];

        const dr = sheet.addRow(values);
        dr.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const isNumericCol = colNumber >= 3;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
          cell.font = { name: 'Calibri', size: 10, color: { argb: DARK_TEXT } };
          cell.alignment = { vertical: 'middle', wrapText: false };
          cell.border = thinBorder;
          if (isNumericCol && typeof cell.value === 'number') {
            cell.numFmt = MONEY_FMT;
          }
          // Center code column
          if (colNumber === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
        dr.height = 18;
        dr.commit();
        dataRowIndex++;
      });

      // ── Monthly Total Row ─────────────────────────────────
      const projSums = projs.reduce((acc, p) => {
        acc.TCC += p.TCC || 0;
        acc.CONTRACT_WO_VAT += p.CONTRACT_WO_VAT || 0;
        acc.CONTRACT_WO_VAT_OH_PM += p.CONTRACT_WO_VAT_OH_PM || 0;
        acc.EQ_30_OH += p.EQ_30_OH || 0;
        acc.EQ_10_RETENTION += p.EQ_10_RETENTION || 0;
        acc.EFFECTIVE_OH += p.EFFECTIVE_OH || 0;
        acc.NET_PROFIT += p.NET_PROFIT || 0;
        customColumns.forEach(col => {
          acc[col.id] = (acc[col.id] || 0); // project rows don't have expense data
        });
        return acc;
      }, {
        TCC: 0, CONTRACT_WO_VAT: 0, CONTRACT_WO_VAT_OH_PM: 0,
        EQ_30_OH: 0, EQ_10_RETENTION: 0, EFFECTIVE_OH: 0, NET_PROFIT: 0,
        ...customColumns.reduce((o, col) => ({ ...o, [col.id]: 0 }), {})
      });

      // Add expense column sums to monthly total
      let monthlyExpTotal = 0;
      customColumns.forEach(col => {
        projSums[col.id] = (parseFloat(exps[col.id]) || 0);
        monthlyExpTotal += projSums[col.id];
      });
      projSums.total_specific_expenses = monthlyExpTotal;
      projSums.NET_PROFIT -= dynamicExpensesSum;

      const totalEOC = projSums.TCC; // Total EOC per Month = project TCC sum

      const mtValues = [
        '',                                           // Date
        'MONTHLY TOTAL',                             // Code
        fmtNum(projSums.TCC),
        fmtNum(projSums.CONTRACT_WO_VAT),
        fmtNum(projSums.CONTRACT_WO_VAT_OH_PM),
        fmtNum(projSums.EQ_30_OH),
        fmtNum(projSums.EQ_10_RETENTION),
        fmtNum(projSums.EFFECTIVE_OH),
        fmtNum(totalEOC),
        ...customColumns.map(col => fmtNum(projSums[col.id])),
        fmtNum(projSums.total_specific_expenses),
        fmtNum(projSums.NET_PROFIT)
      ];

      const mtRow = sheet.addRow(mtValues);
      mtRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_LIGHT } };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: DARK_TEXT } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = {
          top: { style: 'thin', color: { argb: '99AAAAAA' } },
          bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: GRAY_BORDER } },
          right: { style: 'thin', color: { argb: GRAY_BORDER } }
        };
        if (colNumber >= 3 && typeof cell.value === 'number') {
          cell.numFmt = MONEY_FMT;
        }
        if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
          cell.font = { ...cell.font, color: { argb: 'FF475569' }, italic: true };
        }
      });
      mtRow.height = 20;
      mtRow.commit();

      // Accumulate grand totals
      grandTotal.TCC += projSums.TCC;
      grandTotal.CONTRACT_WO_VAT += projSums.CONTRACT_WO_VAT;
      grandTotal.CONTRACT_WO_VAT_OH_PM += projSums.CONTRACT_WO_VAT_OH_PM;
      grandTotal.EQ_30_OH += projSums.EQ_30_OH;
      grandTotal.EQ_10_RETENTION += projSums.EQ_10_RETENTION;
      grandTotal.EFFECTIVE_OH += projSums.EFFECTIVE_OH;
      grandTotal.NET_PROFIT += projSums.NET_PROFIT;
      grandTotal.total_specific_expenses += projSums.total_specific_expenses;
      customColumns.forEach(col => {
        grandTotal[col.id] = (grandTotal[col.id] || 0) + (projSums[col.id] || 0);
      });
    });

    // ── Grand Total Row ───────────────────────────────────────
    const spacerRow = sheet.addRow([]);
    spacerRow.commit();

    const gtLabel = 'TOTAL';
    const gtValues = [
      '',
      gtLabel,
      fmtNum(grandTotal.TCC),
      fmtNum(grandTotal.CONTRACT_WO_VAT),
      fmtNum(grandTotal.CONTRACT_WO_VAT_OH_PM),
      fmtNum(grandTotal.EQ_30_OH),
      fmtNum(grandTotal.EQ_10_RETENTION),
      fmtNum(grandTotal.EFFECTIVE_OH),
      fmtNum(grandTotal.TCC),
      ...customColumns.map(col => fmtNum(grandTotal[col.id])),
      fmtNum(grandTotal.total_specific_expenses),
      fmtNum(grandTotal.NET_PROFIT)
    ];

    const gtRow = sheet.addRow(gtValues);
    gtRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAND_BG } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
      cell.border = {
        top: { style: 'medium', color: { argb: GRAND_BG } },
        bottom: { style: 'medium', color: { argb: GRAND_BG } },
        left: { style: 'medium', color: { argb: GRAND_BG } },
        right: { style: 'medium', color: { argb: GRAND_BG } }
      };
      cell.alignment = { vertical: 'middle', wrapText: false };
      if (colNumber >= 3 && typeof cell.value === 'number') {
        cell.numFmt = MONEY_FMT;
      }
      if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      }
    });
    gtRow.height = 24;
    gtRow.commit();

    // ── Stream file to client ─────────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const yearSuffix = (year && year !== 'All') ? `_${year}` : '';
    const filename = `MONTHLY_MASTER_LEDGER${yearSuffix}_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    logActivity(req.user.username, 'EXPORT_OFFICE_LEDGER', 'office_ledger', 'excel', `Exported Monthly Master Ledger${yearSuffix}`);

  } catch (err) {
    console.error('Office Ledger export error:', err.message, err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Office Ledger Excel file.' });
    }
  }
});

// ==========================================
// EXPORT PROJECT MASTER SPREADSHEET (STYLED)
// ==========================================
app.post('/api/project-ledger/export-styled', authenticateToken, async (req, res) => {
  try {
    const { projectData, dateFilterLabel } = req.body;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('PROJECT MASTER SPREADSHEET');

    // Color Constants (Matching Office Dashboard)
    const INDIGO = 'FF3730A3';
    const WHITE = 'FFFFFFFF';
    const GRAY_BORDER = 'FFD1D5DB';
    const DARK_TEXT = 'FF1E293B';
    const BLUE_TEXT = 'FF2563EB';
    const RED_TEXT = 'FFDC2626';

    const thinBorder = {
      top: { style: 'thin', color: { argb: GRAY_BORDER } },
      left: { style: 'thin', color: { argb: GRAY_BORDER } },
      bottom: { style: 'thin', color: { argb: GRAY_BORDER } },
      right: { style: 'thin', color: { argb: GRAY_BORDER } }
    };

    const colDefs = [
      { key: 'code', width: 15 },
      { key: 'name', width: 35 },
      { key: 'cc', width: 18 },
      { key: 'add_parts', width: 25 },
      { key: 'add_amount', width: 15 },
      { key: 'taw', width: 18 },
      { key: 'tcc', width: 18 },
      { key: 'vat', width: 15 },
      { key: 'cc_wo_vat', width: 18 },
      { key: 'oh_30', width: 15 },
      { key: 'oh_20', width: 15 },
      { key: 'oh_12', width: 15 },
      { key: 'dlm_30', width: 18 },
      { key: 'dlm_20', width: 18 },
      { key: 'dlm_12', width: 18 },
      { key: 'adlm', width: 15 },
      { key: 'sav_30', width: 15 },
      { key: 'sav_20', width: 15 },
      { key: 'sav_12', width: 15 },
      { key: 'remarks', width: 15 },
      { key: 'proj_area', width: 20 },
      { key: 'proj_start', width: 15 }
    ];

    colDefs.forEach((col, i) => {
      const c = sheet.getColumn(i + 1);
      c.key = col.key;
      c.width = col.width;
    });

    // Title Row
    sheet.mergeCells(1, 1, 1, colDefs.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = 'FBTMCC - PROJECT MASTER SPREADSHEET';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: WHITE } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Subtitle Row
    sheet.mergeCells(2, 1, 2, colDefs.length);
    const subCell = sheet.getCell(2, 1);
    subCell.value = dateFilterLabel ? `Filter Period: ${dateFilterLabel}` : "Period: All-Time Records";
    subCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: DARK_TEXT } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Empty Row
    sheet.addRow([]);

    // Headers
    const headerVals = [
      "Code", "Store Name", "Contract Cost (CC)",
      "Additional Works Particulars", "Amount", "Total Additional (TAW)",
      "Total Contract (TCC)", "12% VAT of TCC", "CC without VAT",
      "Overhead 30%", "Overhead 20%", "Overhead 12%",
      "Target DLM @ 30%", "Target DLM @ 20%", "Target DLM @ 12%",
      "Actual ADLM", "Saving @ 30%", "Saving @ 20%", "Saving @ 12%", "Remarks", "PROJECT AREA", "PROJECT START"
    ];

    const headerRow = sheet.addRow(headerVals);
    headerRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });
    headerRow.height = 35;

    // Formatting Helpers
    const formatMoney = (val) => {
      if (val === null || val === undefined || val === '') return '';
      const v = parseFloat(val);
      return isNaN(v) ? '' : v;
    };
    const formatDate = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    };

    function styleRow(r) {
      r.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.border = thinBorder;
        if (colNumber >= 3 && colNumber <= 19) {
          cell.numFmt = '#,##0.00';
        }
        if (colNumber >= 17 && colNumber <= 19 && typeof cell.value === 'number') {
          if (cell.value < 0) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: RED_TEXT } };
          else cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: BLUE_TEXT } };
        }
        if (colNumber === 7 || colNumber === 9 || colNumber === 16) {
          cell.font = { name: 'Arial', size: 9, bold: true };
        }
      });
    }

    function styleSubRow(r) {
      r.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
        cell.border = thinBorder;
        if (colNumber === 5) {
          cell.numFmt = '#,##0.00';
        }
      });
    }

    function styleSubTotalRow(r) {
      r.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        if (colNumber === 5) {
          cell.numFmt = '#,##0.00';
        }
      });
    }

    // Data Loop
    (projectData || []).forEach(p => {
      const adds = p.additionalExpensesList || [];
      const pArea = p.project_area || "";
      const pStart = formatDate(p.project_start);

      if (adds.length === 0) {
        const row = sheet.addRow([
          p.project_code, p.project_name, formatMoney(p.CC),
          "-", 0, formatMoney(p.TAW), formatMoney(p.TCC), formatMoney(p.VAT_12), formatMoney(p.CC_WITHOUT_VAT),
          formatMoney(p.OH_30), formatMoney(p.OH_20), formatMoney(p.OH_12),
          formatMoney(p.TARGET_DLM_30), formatMoney(p.TARGET_DLM_20), formatMoney(p.TARGET_DLM_12),
          formatMoney(p.ADLM), formatMoney(p.SAVING_30), formatMoney(p.SAVING_20), formatMoney(p.SAVING_12),
          "No Record", pArea, pStart
        ]);
        styleRow(row);
      } else {
        adds.forEach((add, idx) => {
          if (idx === 0) {
            const row = sheet.addRow([
              p.project_code, p.project_name, formatMoney(p.CC),
              add.particulars, formatMoney(add.amount), formatMoney(p.TAW), formatMoney(p.TCC), formatMoney(p.VAT_12), formatMoney(p.CC_WITHOUT_VAT),
              formatMoney(p.OH_30), formatMoney(p.OH_20), formatMoney(p.OH_12),
              formatMoney(p.TARGET_DLM_30), formatMoney(p.TARGET_DLM_20), formatMoney(p.TARGET_DLM_12),
              formatMoney(p.ADLM), formatMoney(p.SAVING_30), formatMoney(p.SAVING_20), formatMoney(p.SAVING_12),
              "Active Works", pArea, pStart
            ]);
            styleRow(row);
          } else {
            const row = sheet.addRow([
              "", "", "",
              add.particulars, formatMoney(add.amount), "", "", "", "",
              "", "", "", "", "", "", "", "", "", "", "", "", ""
            ]);
            styleSubRow(row);
          }
        });
        if (adds.length > 1) {
          const row = sheet.addRow([
            "", "", "",
            "Total Add'l Works Subtotal", formatMoney(p.TAW), "", "", "", "",
            "", "", "", "", "", "", "", "", "", "", "", "", ""
          ]);
          styleSubTotalRow(row);
        }
      }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `PROJECT_MASTER_SPREADSHEET_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    logActivity(req.user.username, 'EXPORT_PROJECT_LEDGER', 'project_ledger', 'excel', 'Exported Project Master Spreadsheet');

  } catch (err) {
    console.error('Project Ledger export error:', err.message, err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Project Ledger Excel file.' });
    }
  }
});

// ==========================================
// SERVE THE BUILD FRONTEND
// ==========================================

// I-serve ang files mula sa root directory (kung saan nakalapag ang index.html)
app.use(express.static(path.join(__dirname)));

// Modern catch-all route para sa client-side routing ng React
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// START SERVER
// ==========================================
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Local Network API Server running on port ' + PORT);
});
