const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./csdl_hostelmate.sqlite');

db.run("INSERT INTO notification_recipients (notification_id, tenant_id) VALUES (1, 'KT00001')", (err) => {
  if (err) console.error(err);
  else console.log("Fixed recipient for notification 1");
});
