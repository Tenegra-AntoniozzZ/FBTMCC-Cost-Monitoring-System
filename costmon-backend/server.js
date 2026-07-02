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
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173'];
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

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
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Masyadong maraming maling login. Subukan ulit mamaya." }
});

// ==========================================
// 3. JWT MIDDLEWARE
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access Denied. Walang valid na token." });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid o Expired na ang session mo. Mag-login ulit." });
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

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, project_code TEXT UNIQUE, project_name TEXT,
    contract_cost REAL DEFAULT 0, profit_percentage REAL DEFAULT 0.20,
    project_type TEXT DEFAULT 'Construction'
  )`);
  db.run("ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'Construction'", (err) => {
    if (!err) {
      db.run("UPDATE projects SET project_type = 'Office' WHERE project_code LIKE '%ADMIN%' OR project_code LIKE '%OFFICE%' OR project_code LIKE '%SHOP%'");
    }
  });

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
    is_active INTEGER DEFAULT 1
  )`);
  db.run("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1", () => { });

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    timestamp TEXT
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
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(401).json({ error: "Mali ang username o password." });
    if (user.is_active === 0) return res.status(403).json({ error: "Ang account na ito ay hindi na aktibo. Makipag-ugnayan sa admin." });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Mali ang username o password." });
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    logActivity(user.username, 'LOGIN', 'session', user.id, 'User logged in with role: ' + user.role);
    res.json({ success: true, token, role: user.role, username: user.username });
  });
});

app.post('/api/forgot-password/question', loginLimiter, (req, res) => {
  db.get("SELECT security_question FROM users WHERE username = ?", [req.body.username], (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(404).json({ error: "Hindi nahanap ang username na ito." });
    res.json({ question: user.security_question });
  });
});

app.post('/api/forgot-password/reset', loginLimiter, async (req, res) => {
  const { username, answer, newPassword } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(404).json({ error: "User not found." });
    const match = await bcrypt.compare(answer.toLowerCase().trim(), user.security_answer);
    if (!match) return res.status(401).json({ error: "Mali ang sagot sa security question!" });
    const hashedNewPass = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE id = ?", [hashedNewPass, user.id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "Hindi ma-update ang password." });
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
    if (!match) return res.status(401).json({ error: "Mali ang password." });
    res.json({ success: true });
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
  if (!username || !password || !role) return res.status(400).json({ error: "Username, password, at role ay kailangan." });
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
    return res.status(400).json({ error: "Hindi mo maaaring i-deactivate ang sarili mong account." });
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
    if (!match) return res.status(401).json({ error: "Mali ang kasalukuyang password." });
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
  if (username)    { conditions.push("username LIKE ?");      params.push('%' + username + '%'); }
  if (action)      { conditions.push("action = ?");           params.push(action); }
  if (entity_type) { conditions.push("entity_type = ?");      params.push(entity_type); }
  if (startDate)   { conditions.push("timestamp >= ?");       params.push(startDate); }
  if (endDate)     { conditions.push("timestamp <= ?");       params.push(endDate + 'T23:59:59Z'); }
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
    const workbook  = new ExcelJS.Workbook();
    workbook.creator = 'FBTMCC Cost Monitoring System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Audit Trail', {
      // Freeze the header row so it stays pinned while scrolling
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // ── Column definitions with widths ────────────────────────
    sheet.columns = [
      { header: 'Timestamp',   key: 'timestamp',   width: 24 },
      { header: 'Username',    key: 'username',     width: 18 },
      { header: 'Action',      key: 'action',       width: 30 },
      { header: 'Entity Type', key: 'entity_type',  width: 18 },
      { header: 'Entity ID',   key: 'entity_id',    width: 22 },
      { header: 'Details',     key: 'details',      width: 55 },
    ];

    // ── Shared border style for every data cell ───────────────
    const thinBorder = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } }, // gray-300
      left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
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
        top:    { style: 'medium', color: { argb: 'FF3730A3' } },
        left:   { style: 'medium', color: { argb: 'FF3730A3' } },
        bottom: { style: 'medium', color: { argb: 'FF3730A3' } },
        right:  { style: 'medium', color: { argb: 'FF3730A3' } },
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
        timestamp:   ts,
        username:    log.username    || '—',
        action:      log.action      || '—',
        entity_type: log.entity_type || '—',
        entity_id:   log.entity_id   || '—',
        details:     log.details     || '—',
      });

      // Alternating row background: white / very light indigo tint
      const rowFill = idx % 2 === 0
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }   // white
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };  // indigo-50

      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill      = rowFill;
        cell.border    = thinBorder;
        cell.font      = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } }; // slate-800
        cell.alignment = { vertical: 'middle', wrapText: true };
      });

      dataRow.height = 18;
      dataRow.commit();
    });

    // ── Stream to response ────────────────────────────────────
    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename   = `audit_log_${timestamp}.xlsx`;

    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
app.post('/api/projects', authenticateToken, (req, res) => { const { id, project_code, project_name, contract_cost, profit_percentage, project_type } = req.body; const newId = id || Math.random().toString(36).substr(2, 9); db.run("INSERT INTO projects (id, project_code, project_name, contract_cost, profit_percentage, project_type) VALUES (?, ?, ?, ?, ?, ?)", [newId, project_code, project_name, contract_cost || 0, profit_percentage || 0.20, project_type || 'Construction'], function (err) { if (err) return res.status(500).json({ error: err.message }); logActivity(req.user.username, 'CREATE_PROJECT', 'project', newId, 'Created: ' + project_code + ' - ' + project_name); res.json({ success: true, id: newId }); }); });
app.put('/api/projects/:id', authenticateToken, (req, res) => { const { project_code, project_name, contract_cost, profit_percentage, project_type } = req.body; let fields = []; let params = []; if (project_code !== undefined) { fields.push("project_code=?"); params.push(project_code); } if (project_name !== undefined) { fields.push("project_name=?"); params.push(project_name); } if (contract_cost !== undefined) { fields.push("contract_cost=?"); params.push(contract_cost); } if (profit_percentage !== undefined) { fields.push("profit_percentage=?"); params.push(profit_percentage); } if (project_type !== undefined) { fields.push("project_type=?"); params.push(project_type); } if (fields.length === 0) return res.json({ success: true, message: "No changes" }); params.push(req.params.id); db.run('UPDATE projects SET ' + fields.join(', ') + ' WHERE id=?', params, function (err) { if (err) return res.status(500).json({ error: err.message }); logActivity(req.user.username, 'UPDATE_PROJECT', 'project', req.params.id, 'Updated project'); res.json({ success: true }); }); });
app.delete('/api/projects/:id', authenticateToken, (req, res) => { db.get("SELECT project_code FROM projects WHERE id=?", [req.params.id], (e, proj) => { db.run("DELETE FROM projects WHERE id=?", req.params.id, function (err) { if (err) return res.status(500).json({ error: err.message }); logActivity(req.user.username, 'DELETE_PROJECT', 'project', req.params.id, 'Deleted: ' + (proj ? proj.project_code : req.params.id)); res.json({ success: true }); }); }); });

// ==========================================
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
  const data = req.body;

  // Backend validation: Compute expected net amount (Gross - EWT)
  const computed_net_amount = Number(data.gross_amount || 0) - Number(data.ewt_amount || 0);
  if (Math.abs(computed_net_amount - Number(data.net_amount || 0)) > 0.01) {
    return res.status(400).json({ error: "Data integrity check failed: Net amount mismatch." });
  }

  const stmt = db.prepare('INSERT INTO disbursements (id, project_code, date, payee, particulars, tin, cv_no, bank, check_no, or_inv_no, accts_pay, input_tax, output_tax, target_cib, gross_amount, ewt_amount, net_amount, expenses_json, created_at, costing_type, attachments_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(data.id, data.project_code, data.date, data.payee, data.particulars, data.tin, data.cv_no, data.bank, data.check_no, data.or_inv_no, data.accts_pay || 0, data.input_tax || 0, data.output_tax || 0, data.target_cib || 0, data.gross_amount || 0, data.ewt_amount || 0, data.net_amount || 0, JSON.stringify(data.expenses), data.created_at, data.costing_type || 'normal', JSON.stringify(data.attachments || []), function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logActivity(req.user.username, 'CREATE_DISBURSEMENT', 'disbursement', data.id, 'CV# ' + data.cv_no + ' | Project: ' + data.project_code + ' | Amount: ' + data.gross_amount);
    res.json({ success: true, message: 'Record saved successfully.' });
  });
  stmt.finalize();
});

app.put('/api/disbursements/:id', authenticateToken, (req, res) => {
  const data = req.body; const id = req.params.id;

  // Backend validation: Compute expected net amount (Gross - EWT)
  const computed_net_amount = Number(data.gross_amount || 0) - Number(data.ewt_amount || 0);
  if (Math.abs(computed_net_amount - Number(data.net_amount || 0)) > 0.01) {
    return res.status(400).json({ error: "Data integrity check failed: Net amount mismatch." });
  }

  const stmt = db.prepare('UPDATE disbursements SET project_code=?, date=?, payee=?, particulars=?, tin=?, cv_no=?, bank=?, check_no=?, or_inv_no=?, accts_pay=?, input_tax=?, output_tax=?, target_cib=?, gross_amount=?, ewt_amount=?, net_amount=?, expenses_json=?, costing_type=?, attachments_json=? WHERE id=?');
  stmt.run(data.project_code, data.date, data.payee, data.particulars, data.tin, data.cv_no, data.bank, data.check_no, data.or_inv_no, data.accts_pay || 0, data.input_tax || 0, data.output_tax || 0, data.target_cib || 0, data.gross_amount || 0, data.ewt_amount || 0, data.net_amount || 0, JSON.stringify(data.expenses), data.costing_type || 'normal', JSON.stringify(data.attachments || []), id, function (err) {
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
      try { fs.unlinkSync(uploadedPath); } catch (_) {}
    }

    res.status(500).json({ error: 'Database import failed. The original database has been restored. Error: ' + err.message });
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