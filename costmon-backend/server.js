const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit'); // BAGONG IMPORT

const app = express();

// ==========================================
// 1. SECURITY: HIGPITAN ANG CORS
// ==========================================
// Ilagay dito ang IP address ng computer na ginagamit para sa frontend
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://192.168.2.124:5173',
    'http://192.168.2.117:5173',
    'http://192.168.2.117:5174',
    'http://192.168.2.103:5173',
    'http://192.168.2.125:5173',
    'http://192.168.2.125:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

const JWT_SECRET = 'FBTMCC_SUPER_SECRET_KEY_2026';

// ==========================================
// 2. SECURITY: RATE LIMITING (Iwas Brute-Force)
// ==========================================
// Limitahan sa 5 maling attempt kada 15 minuto
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { error: "Masyadong maraming maling login. Subukan ulit mamaya." }
});

// ==========================================
// 3. SECURITY: JWT MIDDLEWARE (Taga-check ng Token)
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Kunin ang token mula sa "Bearer <token>"

  if (!token) return res.status(401).json({ error: "Access Denied. Walang valid na token." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid o Expired na ang session mo. Mag-login ulit." });
    req.user = user; // Ipasa ang user info sa susunod na function
    next();
  });
};

const dbPath = path.resolve(__dirname, 'costmon_local.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error connecting to database:', err.message);
  else console.log('Connected to the local SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS disbursements (id TEXT PRIMARY KEY, project_code TEXT, date TEXT, payee TEXT, particulars TEXT, tin TEXT, cv_no TEXT, check_no TEXT, or_inv_no TEXT, accts_pay REAL, input_tax REAL, output_tax REAL, target_cib REAL, gross_amount REAL, ewt_amount REAL, net_amount REAL, expenses_json TEXT, created_at TEXT, costing_type TEXT DEFAULT 'normal')`);
  
  db.run("ALTER TABLE disbursements ADD COLUMN costing_type TEXT DEFAULT 'normal'", (err) => {
    // Expected to fail if column already exists
  });

  db.run(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, project_code TEXT UNIQUE, project_name TEXT, contract_cost REAL DEFAULT 0, profit_percentage REAL DEFAULT 0.20)`);
  db.run(`CREATE TABLE IF NOT EXISTS expense_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    security_question TEXT,
    security_answer TEXT
  )`);

  db.get("SELECT count(*) as count FROM users", async (err, row) => {
    if (row && row.count === 0) {
      console.log("Creating default users...");
      const defaultUsers = [
        { u: 'admin', p: 'admin123', r: 'ceo', sq: 'Ano ang pangalan ng unang alaga mong hayop?', sa: 'bantay' },
        { u: 'encoder', p: 'enc123', r: 'encoder', sq: 'Ano ang paborito mong kulay?', sa: 'blue' },
        { u: 'engineer', p: 'eng123', r: 'engineer', sq: 'Saan ka ipinanganak?', sa: 'manila' }
      ];
      const stmt = db.prepare("INSERT INTO users (username, password, role, security_question, security_answer) VALUES (?, ?, ?, ?, ?)");
      
      for (let user of defaultUsers) {
        const hashedPassword = await bcrypt.hash(user.p, 10);
        const hashedAnswer = await bcrypt.hash(user.sa.toLowerCase(), 10);
        stmt.run(user.u, hashedPassword, user.r, user.sq, hashedAnswer);
      }
      stmt.finalize();
      console.log("Default users created!");
    }
  });

  db.get("SELECT count(*) as count FROM projects", (err, row) => {
    if (row && row.count === 0) {
      const initialProjects = [ ['1', 'RF-105', 'Unitop Dasma', 800000, 0.15], ['2', 'W-308', 'Amazing Place QC', 1600000, 0.20], ['3', 'RF-126', 'WM Tanauan', 990000, 0.15], ['4', 'ADMIN', 'Shop/Admin 2026', 0, 0] ];
      const stmt = db.prepare("INSERT INTO projects (id, project_code, project_name, contract_cost, profit_percentage) VALUES (?, ?, ?, ?, ?)");
      initialProjects.forEach(p => stmt.run(p));
      stmt.finalize();
    }
  });

  db.get("SELECT count(*) as count FROM expense_categories", (err, row) => {
    if (row && row.count === 0) {
      const initialCats = [ 'Materials/Purchases', 'Labor /SUBCONTRACTOR', 'Gas & Oil', 'Office Supplies', 'Tools & Equipment', 'Office Furniture', 'Shop Supplies', 'Food/Meals', 'Transpo/Travel', 'Repair & Maint.', 'Parking', 'Toll Fee', 'Handling Fee', 'Communication', 'Miscellaneous / Sending Fee / Schematic', 'Light & Power', 'Water', 'Rental/Hotel Accom.', 'Representation', 'Salaries & Wages', 'Cash Advance/Payroll', 'Cash Advance/Project', 'Permit/Licenses', 'Insurance Expense/CONST', 'Insurance Expenses/CAR', 'SOP/Retainer Fee', 'Incentives Fee', 'Service Fee', 'Entrance' ];
      const stmt = db.prepare("INSERT INTO expense_categories (name) VALUES (?)");
      initialCats.forEach(c => stmt.run(c));
      stmt.finalize();
    }
  });
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Inilagay ang loginLimiter dito
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(401).json({ error: "Mali ang username o password." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Mali ang username o password." });

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
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
// PROTECTED API ENDPOINTS (Dapat may token bago makapasok)
// ==========================================

// Ginamit ang authenticateToken sa lahat ng GET, POST, PUT, DELETE
app.get('/api/projects', authenticateToken, (req, res) => { db.all("SELECT * FROM projects ORDER BY project_code ASC", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/projects', authenticateToken, (req, res) => { const { id, project_code, project_name, contract_cost, profit_percentage } = req.body; const newId = id || Math.random().toString(36).substr(2, 9); db.run("INSERT INTO projects (id, project_code, project_name, contract_cost, profit_percentage) VALUES (?, ?, ?, ?, ?)", [newId, project_code, project_name, contract_cost || 0, profit_percentage || 0.20], function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true, id: newId }); }); });
app.put('/api/projects/:id', authenticateToken, (req, res) => { const { project_code, project_name, contract_cost, profit_percentage } = req.body; let query = "UPDATE projects SET "; let params = []; const fields = []; if (project_code !== undefined) { fields.push("project_code=?"); params.push(project_code); } if (project_name !== undefined) { fields.push("project_name=?"); params.push(project_name); } if (contract_cost !== undefined) { fields.push("contract_cost=?"); params.push(contract_cost); } if (profit_percentage !== undefined) { fields.push("profit_percentage=?"); params.push(profit_percentage); } if (fields.length === 0) return res.json({ success: true, message: "No changes" }); query += fields.join(", ") + " WHERE id=?"; params.push(req.params.id); db.run(query, params, function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); }); });
app.delete('/api/projects/:id', authenticateToken, (req, res) => { db.run("DELETE FROM projects WHERE id=?", req.params.id, function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); }); });

app.get('/api/categories', authenticateToken, (req, res) => { db.all("SELECT * FROM expense_categories ORDER BY name ASC", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/categories', authenticateToken, (req, res) => { db.run("INSERT INTO expense_categories (name) VALUES (?)", [req.body.name], function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true, id: this.lastID }); }); });
app.delete('/api/categories/:id', authenticateToken, (req, res) => { db.run("DELETE FROM expense_categories WHERE id=?", req.params.id, function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); }); });

app.get('/api/disbursements', authenticateToken, (req, res) => { db.all("SELECT * FROM disbursements ORDER BY created_at DESC", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); const formattedRows = rows.map(row => ({ ...row, expenses: row.expenses_json ? JSON.parse(row.expenses_json) : [] })); res.json(formattedRows); }); });
app.post('/api/disbursements', authenticateToken, (req, res) => { const data = req.body; const stmt = db.prepare(`INSERT INTO disbursements (id, project_code, date, payee, particulars, tin, cv_no, check_no, or_inv_no, accts_pay, input_tax, output_tax, target_cib, gross_amount, ewt_amount, net_amount, expenses_json, created_at, costing_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`); stmt.run(data.id, data.project_code, data.date, data.payee, data.particulars, data.tin, data.cv_no, data.check_no, data.or_inv_no, data.accts_pay || 0, data.input_tax || 0, data.output_tax || 0, data.target_cib || 0, data.gross_amount || 0, data.ewt_amount || 0, data.net_amount || 0, JSON.stringify(data.expenses), data.created_at, data.costing_type || 'normal', function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true, message: 'Record saved successfully.' }); }); stmt.finalize(); });
app.put('/api/disbursements/:id', authenticateToken, (req, res) => { const data = req.body; const id = req.params.id; const stmt = db.prepare(`UPDATE disbursements SET project_code=?, date=?, payee=?, particulars=?, tin=?, cv_no=?, check_no=?, or_inv_no=?, accts_pay=?, input_tax=?, output_tax=?, target_cib=?, gross_amount=?, ewt_amount=?, net_amount=?, expenses_json=?, costing_type=? WHERE id=?`); stmt.run(data.project_code, data.date, data.payee, data.particulars, data.tin, data.cv_no, data.check_no, data.or_inv_no, data.accts_pay || 0, data.input_tax || 0, data.output_tax || 0, data.target_cib || 0, data.gross_amount || 0, data.ewt_amount || 0, data.net_amount || 0, JSON.stringify(data.expenses), data.costing_type || 'normal', id, function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true, message: 'Record updated successfully.' }); }); stmt.finalize(); });
app.delete('/api/disbursements/:id', authenticateToken, (req, res) => { db.run("DELETE FROM disbursements WHERE id=?", req.params.id, function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); }); });

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => { 
  console.log(`Local Network API Server running on port ${PORT}`);
});