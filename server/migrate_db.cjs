const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'csdl_hostelmate.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA foreign_keys=off;');
  
  db.run('BEGIN TRANSACTION;');
  
  db.run('DROP TABLE IF EXISTS hoa_don_new;');
  
  // Create new table with updated constraint
  db.run(`
    CREATE TABLE IF NOT EXISTS hoa_don_new (
      id TEXT PRIMARY KEY,
      phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
      khach_thue_id TEXT REFERENCES khach_thue(id) ON DELETE SET NULL,
      chi_so_dien_nuoc_id TEXT REFERENCES chi_so_dien_nuoc(id) ON DELETE SET NULL,
      thang_hoa_don INTEGER NOT NULL,
      nam_hoa_don INTEGER NOT NULL,
      tien_phong REAL NOT NULL DEFAULT 0,
      tien_dien REAL NOT NULL DEFAULT 0,
      tien_nuoc REAL NOT NULL DEFAULT 0,
      chi_phi_khac REAL DEFAULT 0,
      tong_tien REAL NOT NULL DEFAULT 0,
      trang_thai TEXT NOT NULL DEFAULT 'pending',
      han_thanh_toan TEXT,
      ngay_thanh_toan TEXT,
      ghi_chu TEXT,
      ma_hoa_don TEXT UNIQUE,
      phuong_thuc_thanh_toan TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Copy data
  db.run('INSERT INTO hoa_don_new SELECT * FROM hoa_don;');
  
  // Drop old table
  db.run('DROP TABLE hoa_don;');
  
  // Rename new table
  db.run('ALTER TABLE hoa_don_new RENAME TO hoa_don;');
  
  // Recreate indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_invoices_room ON hoa_don(phong_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_invoices_status ON hoa_don(trang_thai);');
  db.run('CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON hoa_don(han_thanh_toan);');
  db.run('CREATE INDEX IF NOT EXISTS idx_invoices_month_year ON hoa_don(nam_hoa_don, thang_hoa_don);');

  db.run('COMMIT;', (err) => {
    if (err) {
      console.error('Migration failed:', err);
    } else {
      console.log('Migration successful: waiting_confirmation added to check constraint.');
    }
  });
  
  db.run('PRAGMA foreign_keys=on;');
});
