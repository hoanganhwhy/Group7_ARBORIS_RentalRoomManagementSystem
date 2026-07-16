const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./csdl_hostelmate.sqlite');

db.run(`
  INSERT INTO users (id, username, password_hash, role, tenant_id, full_name, phone, email)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`, ['USR_test', 'test_user', 'hash', 'TENANT', 'KT_test', 'Test Name', '0123456789', 'test@example.com'], function(err) {
  if (err) console.error("Error inserting user:", err);
  else console.log("User inserted successfully");
});
