const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('server/csdl_hostelmate.sqlite');
db.all('SELECT id, khu_vuc, so_phong FROM phong', (err, rows) => {
  if (err) console.error(err);
  else console.log(rows);
});
