const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'costmon_local.db');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("DELETE FROM disbursements", (err) => {
    if (err) console.error(err);
    else console.log("Cleared disbursements.");
  });
  db.run("DELETE FROM projects", (err) => {
    if (err) console.error(err);
    else console.log("Cleared projects.");
  });
  db.run("DELETE FROM expense_categories", (err) => {
    if (err) console.error(err);
    else console.log("Cleared expense_categories.");
  });
  db.run("DELETE FROM audit_logs", (err) => {
    if (err) console.error(err);
    else console.log("Cleared audit_logs.");
  });
  // Keep users table intact so they can still log in!
  
  db.run("VACUUM", (err) => {
    if (err) console.error(err);
    else console.log("Vacuumed database.");
  });
});

db.close(() => {
  console.log("Database cleared successfully.");
});
