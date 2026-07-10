import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('ALTER TABLE users RENAME TO users_old');
  
  db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MANAGER', 'TENANT')),
      tenant_id TEXT REFERENCES khach_thue(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    INSERT INTO users (id, username, password_hash, role, tenant_id, created_at)
    SELECT id, username, password_hash, CASE WHEN role = 'LANDLORD' THEN 'ADMIN' ELSE role END, tenant_id, created_at
    FROM users_old
  `);
  
  db.run('DROP TABLE users_old', () => {
    console.log('Migrated users table to support ADMIN, MANAGER, TENANT roles.');
  });
});
