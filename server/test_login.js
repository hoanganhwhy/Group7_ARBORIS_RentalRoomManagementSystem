import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);

db.get('SELECT * FROM users WHERE username = "admin"', async (err, user) => {
  if (err) {
    console.error(err);
  } else if (user) {
    console.log("User found:", user.username, "Role:", user.role);
    const valid = await bcrypt.compare("admin123", user.password_hash);
    console.log("Password check 'admin123':", valid);
  } else {
    console.log("Admin user not found in DB!");
  }
});
