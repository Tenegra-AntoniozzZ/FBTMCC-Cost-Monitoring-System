const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('costmon_local.db');
// Delete the bad test entry and any others added with wrong type
db.run("DELETE FROM expense_categories WHERE name LIKE '%Testing%'", function(err) {
  if (err) console.error(err);
  else console.log('Deleted test rows:', this.changes);
  db.close();
});
