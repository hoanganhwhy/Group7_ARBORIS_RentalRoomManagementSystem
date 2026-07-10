import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);
db.serialize(async () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('LANDLORD', 'TENANT')),
      tenant_id TEXT REFERENCES khach_thue(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.get("SELECT id FROM users WHERE role = 'LANDLORD'", async (err, row) => {
    if (!err && !row) {
      const hash = await bcrypt.hash('admin123', 10);
      db.run("INSERT INTO users (id, username, password_hash, role) VALUES ('admin-id-1', 'admin', ?, 'LANDLORD')", [hash]);
      console.log("Created default admin user (admin / admin123)");
    } else if (row) {
      console.log("Admin user already exists.");
    } else {
      console.error(err);
    }
  });
});
