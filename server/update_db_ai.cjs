const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'csdl_hostelmate.sqlite');
const db = new sqlite3.Database(dbPath);

const columnsToAdd = [
  "ALTER TABLE phong ADD COLUMN dia_chi TEXT DEFAULT '';",
  "ALTER TABLE phong ADD COLUMN khoang_cach_km REAL DEFAULT 0;",
  "ALTER TABLE phong ADD COLUMN dieu_hoa INTEGER DEFAULT 0;",
  "ALTER TABLE phong ADD COLUMN may_giat INTEGER DEFAULT 0;",
  "ALTER TABLE phong ADD COLUMN noi_that INTEGER DEFAULT 0;",
  "ALTER TABLE phong ADD COLUMN ban_cong INTEGER DEFAULT 0;"
];

db.serialize(() => {
  console.log("Starting DB update for AI columns...");
  
  columnsToAdd.forEach((query) => {
    db.run(query, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`Column already exists: ${query.split('ADD COLUMN ')[1].split(' ')[0]}`);
        } else {
          console.error("Error executing query:", query, err.message);
        }
      } else {
        console.log(`Successfully added column: ${query.split('ADD COLUMN ')[1].split(' ')[0]}`);
      }
    });
  });
});

db.close((err) => {
  if (err) {
    console.error("Error closing db:", err.message);
  } else {
    console.log("DB update finished.");
  }
});
