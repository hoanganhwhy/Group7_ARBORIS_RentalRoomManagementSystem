import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE users ADD COLUMN full_name TEXT");
  db.run("ALTER TABLE users ADD COLUMN phone TEXT");
  
  db.run("UPDATE users SET full_name = 'Nguyễn Văn Chủ Nhà', phone = '0901234567' WHERE role = 'ADMIN'", () => {
    console.log("Added full_name and phone to users and updated Admin.");
  });
});
