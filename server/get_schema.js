import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('e:/Quan Li Phong Tro/HostelMate/server/csdl_hostelmate.sqlite');
db.all("SELECT sql FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) throw err;
  rows.forEach(row => console.log(row.sql));
  db.close();
});
