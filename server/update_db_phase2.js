import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('e:/Quan Li Phong Tro/HostelMate/server/csdl_hostelmate.sqlite');

db.serialize(() => {
  db.run("PRAGMA foreign_keys=off;");
  db.run("BEGIN TRANSACTION;");

  // Update hop_dong_thue
  db.run("ALTER TABLE hop_dong_thue ADD COLUMN file_hop_dong TEXT", (err) => { if (err && !err.message.includes('duplicate')) console.error(err); });
  db.run("ALTER TABLE hop_dong_thue ADD COLUMN chu_ky_khach TEXT", (err) => { if (err && !err.message.includes('duplicate')) console.error(err); });
  db.run("ALTER TABLE hop_dong_thue ADD COLUMN trang_thai_ky TEXT DEFAULT 'Chờ ký'", (err) => { if (err && !err.message.includes('duplicate')) console.error(err); });

  // Update hoa_don (Recreate to fix CHECK constraint and add columns)
  db.run("ALTER TABLE hoa_don RENAME TO hoa_don_old;");
  
  db.run(`CREATE TABLE hoa_don (
        id TEXT PRIMARY KEY,
        ma_hoa_don TEXT UNIQUE,
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
        trang_thai TEXT NOT NULL DEFAULT 'pending' CHECK (trang_thai IN ('pending', 'paid', 'overdue', 'canceled')),
        phuong_thuc_thanh_toan TEXT,
        han_thanh_toan TEXT,
        ngay_thanh_toan TEXT,
        ghi_chu TEXT,
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(phong_id, thang_hoa_don, nam_hoa_don)
      );`);

  // We need to generate ma_hoa_don for existing records.
  db.all("SELECT * FROM hoa_don_old", (err, rows) => {
    if (err) throw err;
    const stmt = db.prepare(`INSERT INTO hoa_don 
      (id, ma_hoa_don, phong_id, khach_thue_id, chi_so_dien_nuoc_id, thang_hoa_don, nam_hoa_don, 
       tien_phong, tien_dien, tien_nuoc, chi_phi_khac, tong_tien, trang_thai, han_thanh_toan, ngay_thanh_toan, ghi_chu, ngay_tao, ngay_cap_nhat) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
    rows.forEach((row, index) => {
      const maHoaDon = `INV-${row.nam_hoa_don}-${String(index + 1).padStart(4, '0')}`;
      stmt.run(
        row.id, maHoaDon, row.phong_id, row.khach_thue_id, row.chi_so_dien_nuoc_id, row.thang_hoa_don, row.nam_hoa_don,
        row.tien_phong, row.tien_dien, row.tien_nuoc, row.chi_phi_khac, row.tong_tien, row.trang_thai,
        row.han_thanh_toan, row.ngay_thanh_toan, row.ghi_chu, row.ngay_tao, row.ngay_cap_nhat
      );
    });
    stmt.finalize();

    db.run("DROP TABLE hoa_don_old;");
    db.run("COMMIT;");
    db.run("PRAGMA foreign_keys=on;", () => {
      console.log("Database updated for Phase 2!");
      db.close();
    });
  });
});
