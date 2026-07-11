const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_transaction_id TEXT NOT NULL UNIQUE,
      account_number TEXT,
      transfer_amount REAL NOT NULL,
      transfer_content TEXT,
      reference_code TEXT,
      raw_payload TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating bank_transactions table:', err);
    } else {
      console.log('Created bank_transactions table successfully');
    }
  });
});

db.close();
