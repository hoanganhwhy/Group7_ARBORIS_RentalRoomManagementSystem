const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('../database.sqlite');
db.all('SELECT id, trang_thai FROM khach_thue', [], (err, rows) => {
  if (err) console.error(err);
  else console.log("Tenants:", rows);
});
