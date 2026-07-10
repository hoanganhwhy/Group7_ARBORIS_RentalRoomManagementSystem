import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);

async function run() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log("New hash:", hash);
  db.run('UPDATE users SET password_hash = ? WHERE username = "admin"', [hash], (err) => {
    if (err) console.error(err);
    else console.log("Password updated successfully");
  });
}
run();
