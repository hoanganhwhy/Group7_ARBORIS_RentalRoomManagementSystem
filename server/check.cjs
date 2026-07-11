const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./csdl_hostelmate.sqlite');

db.all('SELECT * FROM notification_recipients', [], (err, rows) => console.log('Recipients:', rows));
db.all('SELECT * FROM notifications', [], (err, rows) => console.log('Notifs:', rows));
