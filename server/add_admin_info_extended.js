import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE users ADD COLUMN email TEXT");
  db.run("ALTER TABLE users ADD COLUMN cccd TEXT");
  db.run("ALTER TABLE users ADD COLUMN date_of_birth TEXT");
  db.run("ALTER TABLE users ADD COLUMN address TEXT");
  
  // Set default values for existing admin just in case
  db.run("UPDATE users SET email = '', cccd = '', date_of_birth = '', address = '' WHERE role = 'ADMIN'", () => {
    console.log("Added extended profile info to users table.");
  });
});
