const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('server/csdl_hostelmate.sqlite');

db.run('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE username = ?', ['khachmoi'], async (err) => {
  if (err) console.error(err);
  const hash = await bcrypt.hash('123456', 10);
  db.run('UPDATE users SET password_hash = ? WHERE username = ?', [hash, 'khachmoi'], (err) => {
    if (err) console.error(err);
    console.log('Unlocked and updated password for khachmoi');
  });
});
