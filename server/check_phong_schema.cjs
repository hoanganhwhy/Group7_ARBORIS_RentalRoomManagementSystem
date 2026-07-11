const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('csdl_hostelmate.sqlite');

db.all("PRAGMA table_info(phong)", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log("TABLE phong SCHEMA:");
    console.table(rows);
  }
});
