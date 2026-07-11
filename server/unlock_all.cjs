const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('csdl_hostelmate.sqlite');

db.run('UPDATE users SET login_attempts = 0, locked_until = NULL', [], (err) => {
  if (err) console.error(err);
  else console.log('Unlocked all users');
});
