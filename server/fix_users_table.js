import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('e:/Quan Li Phong Tro/HostelMate/server/csdl_hostelmate.sqlite');

db.serialize(() => {
  db.run("PRAGMA foreign_keys=off;");
  db.run("BEGIN TRANSACTION;");
  
  db.run("ALTER TABLE users RENAME TO users_old;");
  
  db.run(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MANAGER', 'TENANT', 'GUEST')),
      tenant_id TEXT REFERENCES khach_thue(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      full_name TEXT, phone TEXT, email TEXT, cccd TEXT, date_of_birth TEXT, address TEXT, login_attempts INTEGER DEFAULT 0, locked_until TEXT, token_version INTEGER DEFAULT 0, google_id TEXT
  );`);

  db.run("INSERT INTO users SELECT * FROM users_old;");
  
  db.run("DROP TABLE users_old;");
  
  db.run("COMMIT;");
  db.run("PRAGMA foreign_keys=on;", () => {
    console.log("Fixed users table constraints!");
    db.close();
  });
});
