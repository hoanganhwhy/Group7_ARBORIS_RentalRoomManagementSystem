import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0", (err) => {
    if (err && !err.message.includes("duplicate column name")) console.error(err);
  });
  db.run("ALTER TABLE users ADD COLUMN locked_until TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) console.error(err);
  });
  db.run("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0", (err) => {
    if (err && !err.message.includes("duplicate column name")) console.error(err);
  });
  db.run("ALTER TABLE users ADD COLUMN google_id TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) console.error(err);
  });
  console.log("Updated users table with security columns.");
});
