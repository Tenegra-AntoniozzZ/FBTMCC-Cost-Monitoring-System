const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
// Pinapayagan ang lahat sa local network na kumonekta sa backend
app.use(cors()); 
app.use(express.json());

// Gagawa ng database file na 'costmon_local.db' sa loob ng backend folder
const dbPath = path.resolve(__dirname, 'costmon_local.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the local SQLite database.');
  }
});

// Setup Database Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS disbursements (
    id TEXT PRIMARY KEY,
    project_code TEXT,
    date TEXT,
    payee TEXT,
    particulars TEXT,
    tin TEXT,
    cv_no TEXT,
    check_no TEXT,
    or_inv_no TEXT,
    accts_pay REAL,
    input_tax REAL,
    output_tax REAL,
    target_cib REAL,
    gross_amount REAL,
    ewt_amount REAL,
    net_amount REAL,
    expenses_json TEXT,
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_code TEXT UNIQUE,
    project_name TEXT,
    contract_cost REAL DEFAULT 0,
    profit_percentage REAL DEFAULT 0.20
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  // Insert Initial Data if tables are empty
  db.get("SELECT count(*) as count FROM projects", (err, row) => {
    if (row && row.count === 0) {
      const initialProjects = [
        ['1', 'RF-105', 'Unitop Dasma', 800000, 0.15],
        ['2', 'W-308', 'Amazing Place QC', 1600000, 0.20],
        ['3', 'RF-126', 'WM Tanauan', 990000, 0.15],
        ['4', 'ADMIN', 'Shop/Admin 2026', 0, 0]
      ];
      const stmt = db.prepare("INSERT INTO projects (id, project_code, project_name, contract_cost, profit_percentage) VALUES (?, ?, ?, ?, ?)");
      initialProjects.forEach(p => stmt.run(p));
      stmt.finalize();
    }
  });

  db.get("SELECT count(*) as count FROM expense_categories", (err, row) => {
    if (row && row.count === 0) {
      const initialCats = [
        'Materials/Purchases', 'Labor /SUBCONTRACTOR', 'Gas & Oil', 'Office Supplies', 
        'Tools & Equipment', 'Office Furniture', 'Shop Supplies', 'Food/Meals', 
        'Transpo/Travel', 'Repair & Maint.', 'Parking', 'Toll Fee', 'Handling Fee', 
        'Communication', 'Miscellaneous / Sending Fee / Schematic', 'Light & Power', 
        'Water', 'Rental/Hotel Accom.', 'Representation', 'Salaries & Wages', 
        'Cash Advance/Payroll', 'Cash Advance/Project', 'Permit/Licenses', 
        'Insurance Expense/CONST', 'Insurance Expenses/CAR', 'SOP/Retainer Fee', 
        'Incentives Fee', 'Service Fee', 'Entrance'
      ];
      const stmt = db.prepare("INSERT INTO expense_categories (name) VALUES (?)");
      initialCats.forEach(c => stmt.run(c));
      stmt.finalize();
    }
  });
});

// ==========================================
// API ENDPOINTS - PROJECTS
// ==========================================

app.get('/api/projects', (req, res) => {
  db.all("SELECT * FROM projects ORDER BY project_code ASC", [], (err, rows) => {
    if (err) {
      console.error("Database error (GET projects):", err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`Fetched ${rows.length} projects`);
    res.json(rows);
  });
});

app.post('/api/projects', (req, res) => {
  const { id, project_code, project_name, contract_cost, profit_percentage } = req.body;
  const newId = id || Math.random().toString(36).substr(2, 9);
  db.run(
    "INSERT INTO projects (id, project_code, project_name, contract_cost, profit_percentage) VALUES (?, ?, ?, ?, ?)",
    [newId, project_code, project_name, contract_cost || 0, profit_percentage || 0.20],
    function(err) {
      if (err) {
        console.error("Database error (POST project):", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, id: newId });
    }
  );
});

app.put('/api/projects/:id', (req, res) => {
  const { project_code, project_name, contract_cost, profit_percentage } = req.body;
  
  // We allow partial updates for the Cost Monitoring screen
  let query = "UPDATE projects SET ";
  let params = [];
  const fields = [];
  
  if (project_code !== undefined) { fields.push("project_code=?"); params.push(project_code); }
  if (project_name !== undefined) { fields.push("project_name=?"); params.push(project_name); }
  if (contract_cost !== undefined) { fields.push("contract_cost=?"); params.push(contract_cost); }
  if (profit_percentage !== undefined) { fields.push("profit_percentage=?"); params.push(profit_percentage); }
  
  if (fields.length === 0) return res.json({ success: true, message: "No changes" });
  
  query += fields.join(", ") + " WHERE id=?";
  params.push(req.params.id);

  db.run(query, params, function(err) {
    if (err) {
      console.error("Database error (PUT project):", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.delete('/api/projects/:id', (req, res) => {
  db.run("DELETE FROM projects WHERE id=?", req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ==========================================
// API ENDPOINTS - CATEGORIES
// ==========================================

app.get('/api/categories', (req, res) => {
  db.all("SELECT * FROM expense_categories ORDER BY name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/categories', (req, res) => {
  db.run("INSERT INTO expense_categories (name) VALUES (?)", [req.body.name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

app.delete('/api/categories/:id', (req, res) => {
  db.run("DELETE FROM expense_categories WHERE id=?", req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ==========================================
// API ENDPOINTS - DISBURSEMENTS
// ==========================================

// 1. GET - Kunin lahat ng records
app.get('/api/disbursements', (req, res) => {
  db.all("SELECT * FROM disbursements ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // I-format ang JSON string pabalik sa array bago ibigay sa Frontend
    const formattedRows = rows.map(row => ({
      ...row,
      expenses: row.expenses_json ? JSON.parse(row.expenses_json) : []
    }));
    res.json(formattedRows);
  });
});

// 2. POST - Mag-save ng bagong record
app.post('/api/disbursements', (req, res) => {
  const data = req.body;
  const stmt = db.prepare(`
    INSERT INTO disbursements (
      id, project_code, date, payee, particulars, tin, cv_no, check_no, or_inv_no, 
      accts_pay, input_tax, output_tax, target_cib, gross_amount, ewt_amount, net_amount, expenses_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    data.id, data.project_code, data.date, data.payee, data.particulars, data.tin, data.cv_no, 
    data.check_no, data.or_inv_no, data.accts_pay || 0, data.input_tax || 0, data.output_tax || 0, 
    data.target_cib || 0, data.gross_amount || 0, data.ewt_amount || 0, data.net_amount || 0, 
    JSON.stringify(data.expenses), data.created_at,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Record saved successfully.' });
    }
  );
  stmt.finalize();
});

// 3. PUT - I-update ang umiiral na record (kapag nag-double click at nag-edit)
app.put('/api/disbursements/:id', (req, res) => {
  const data = req.body;
  const id = req.params.id;
  
  const stmt = db.prepare(`
    UPDATE disbursements SET 
      project_code=?, date=?, payee=?, particulars=?, tin=?, cv_no=?, check_no=?, or_inv_no=?, 
      accts_pay=?, input_tax=?, output_tax=?, target_cib=?, gross_amount=?, ewt_amount=?, net_amount=?, expenses_json=?
    WHERE id=?
  `);

  stmt.run(
    data.project_code, data.date, data.payee, data.particulars, data.tin, data.cv_no, 
    data.check_no, data.or_inv_no, data.accts_pay || 0, data.input_tax || 0, data.output_tax || 0, 
    data.target_cib || 0, data.gross_amount || 0, data.ewt_amount || 0, data.net_amount || 0, 
    JSON.stringify(data.expenses), id,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Record updated successfully.' });
    }
  );
  stmt.finalize();
});

// Simulan ang Server sa Port 3001
const PORT = 3001;
// Ang '0.0.0.0' ay kailangan para makapasok ang ibang computers sa network
app.listen(PORT, '0.0.0.0', () => { 
  console.log(`Local Network API Server running on port ${PORT}`);
  console.log(`Access it across the network via your PC's IP Address.`);
});