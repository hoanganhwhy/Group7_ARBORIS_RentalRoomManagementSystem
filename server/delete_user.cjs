const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('csdl_hostelmate.sqlite');

db.run('DELETE FROM users WHERE username = ?', ['khachmoi'], (err) => {
  if (err) console.error(err);
  else console.log('Deleted khachmoi');
});
