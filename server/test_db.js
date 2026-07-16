import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('csdl_hostelmate.sqlite');
db.all('PRAGMA table_info(hop_dong_thue)', [], (err, rows) => {
  if (err) console.error(err);
  else console.log(rows);
});
