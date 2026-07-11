import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isTest = process.env.NODE_ENV === 'test';
const dbPath = isTest ? ':memory:' : join(__dirname, 'csdl_hostelmate.sqlite');

export let dbReady;
let resolveDbReady, rejectDbReady;
dbReady = new Promise((resolve, reject) => {
  resolveDbReady = resolve;
  rejectDbReady = reject;
});

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    rejectDbReady(err);
  } else {
    if (!isTest) {
      console.log('Connected to SQLite database at:', dbPath);
    }
    initDatabase().then(resolveDbReady).catch(rejectDbReady);
  }
});

export const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Helper wrapper functions for async/await
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const queryOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const serialize = (fn) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      fn()
        .then(resolve)
        .catch(reject);
    });
  });
};

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Enable Foreign Keys
      db.run('PRAGMA foreign_keys = ON;');

    // 1. phong Table (Phòng trọ)
    db.run(`
      CREATE TABLE IF NOT EXISTS phong (
        id TEXT PRIMARY KEY,
        so_phong TEXT NOT NULL UNIQUE,
        tang INTEGER NOT NULL DEFAULT 1,
        dien_tich REAL NOT NULL DEFAULT 0 CHECK (dien_tich > 0),
        gia_phong REAL NOT NULL DEFAULT 0 CHECK (gia_phong > 0),
        trang_thai TEXT NOT NULL DEFAULT 'available' CHECK (trang_thai IN ('available', 'occupied', 'maintenance')),
        mo_ta TEXT,
        so_nguoi_toi_da INTEGER NOT NULL DEFAULT 2 CHECK (so_nguoi_toi_da > 0),
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. khach_thue Table (Khách thuê)
    db.run(`
      CREATE TABLE IF NOT EXISTS khach_thue (
        id TEXT PRIMARY KEY,
        ho_ten TEXT NOT NULL,
        so_dien_thoai TEXT,
        email TEXT,
        so_cccd TEXT,
        ngay_sinh TEXT,
        dia_chi TEXT,
        lien_he_khan_cap TEXT,
        ghi_chu TEXT,
        username TEXT,
        password TEXT,
        google_email TEXT,
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. hop_dong_thue Table (Hợp đồng thuê)
    db.run(`
      CREATE TABLE IF NOT EXISTS hop_dong_thue (
        id TEXT PRIMARY KEY,
        phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
        khach_thue_id TEXT NOT NULL REFERENCES khach_thue(id) ON DELETE CASCADE,
        ngay_bat_dau TEXT NOT NULL,
        ngay_ket_thuc TEXT,
        dang_hoat_dong INTEGER DEFAULT 1, -- 1 = true, 0 = false
        tien_dat_coc REAL DEFAULT 0,
        la_nguoi_dai_dien INTEGER DEFAULT 0, -- 1 = true, 0 = false
        ngay_het_han_hop_dong TEXT,
        ghi_chu TEXT,
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. chi_so_dien_nuoc Table (Chỉ số điện nước)
    db.run(`
      CREATE TABLE IF NOT EXISTS chi_so_dien_nuoc (
        id TEXT PRIMARY KEY,
        phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
        ngay_ghi_so TEXT NOT NULL,
        so_dien_cu REAL NOT NULL DEFAULT 0,
        so_dien_moi REAL NOT NULL DEFAULT 0 CHECK (so_dien_moi >= so_dien_cu),
        so_nuoc_cu REAL NOT NULL DEFAULT 0,
        so_nuoc_moi REAL NOT NULL DEFAULT 0 CHECK (so_nuoc_moi >= so_nuoc_cu),
        don_gia_dien REAL NOT NULL DEFAULT 3500,
        don_gia_nuoc REAL NOT NULL DEFAULT 15000,
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. hoa_don Table (Hóa đơn)
    db.run(`
      CREATE TABLE IF NOT EXISTS hoa_don (
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
        trang_thai TEXT NOT NULL DEFAULT 'pending' CHECK (trang_thai IN ('pending', 'paid', 'overdue')),
        han_thanh_toan TEXT,
        ngay_thanh_toan TEXT,
        ghi_chu TEXT,
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(phong_id, thang_hoa_don, nam_hoa_don)
      )
    `);

    // 6. yeu_cau_sua_chua Table (Yêu cầu sửa chữa)
    db.run(`
      CREATE TABLE IF NOT EXISTS yeu_cau_sua_chua (
        id TEXT PRIMARY KEY,
        phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
        khach_thue_id TEXT REFERENCES khach_thue(id) ON DELETE SET NULL,
        tieu_de TEXT NOT NULL,
        mo_ta TEXT,
        muc_do_uu_tien TEXT NOT NULL DEFAULT 'medium' CHECK (muc_do_uu_tien IN ('low', 'medium', 'high', 'urgent')),
        trang_thai TEXT NOT NULL DEFAULT 'new' CHECK (trang_thai IN ('new', 'in_progress', 'resolved', 'closed')),
        ngay_bao TEXT DEFAULT CURRENT_TIMESTAMP,
        ngay_xu_ly_xong TEXT,
        nguoi_xu_ly TEXT,
        ghi_chu_giai_quyet TEXT,
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes (Chỉ mục tối ưu)
    db.run(`CREATE INDEX IF NOT EXISTS idx_rooms_status ON phong(trang_thai);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_room_assignments_room ON hop_dong_thue(phong_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_room_assignments_tenant ON hop_dong_thue(khach_thue_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_meter_readings_room ON chi_so_dien_nuoc(phong_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_room ON hoa_don(phong_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON hoa_don(trang_thai);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_repair_requests_room ON yeu_cau_sua_chua(phong_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_repair_requests_status ON yeu_cau_sua_chua(trang_thai);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON hoa_don(han_thanh_toan);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_month_year ON hoa_don(nam_hoa_don, thang_hoa_don);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_room_assignments_contract_end ON hop_dong_thue(ngay_het_han_hop_dong);`);

      // Seed sample data if phong table is empty
      db.get("SELECT COUNT(*) as count FROM phong", (err, row) => {
        if (err) {
          reject(err);
        } else if (row && row.count === 0) {
          seedSampleData().then(resolve).catch(reject);
        } else {
          resolve();
        }
      });
    });
  });
}

function seedSampleData() {
  return new Promise((resolve, reject) => {
    if (!isTest) {
      console.log('Seeding sample data (Vietnamese tables schema) into database...');
    }
  const rooms = [
    { id: 'r1', so_phong: '101', tang: 1, dien_tich: 25, gia_phong: 2500000, trang_thai: 'occupied', so_nguoi_toi_da: 2 },
    { id: 'r2', so_phong: '102', tang: 1, dien_tich: 25, gia_phong: 2500000, trang_thai: 'available', so_nguoi_toi_da: 2 },
    { id: 'r3', so_phong: '201', tang: 2, dien_tich: 30, gia_phong: 3000000, trang_thai: 'occupied', so_nguoi_toi_da: 3 },
    { id: 'r4', so_phong: '202', tang: 2, dien_tich: 30, gia_phong: 3000000, trang_thai: 'maintenance', so_nguoi_toi_da: 3 },
  ];

  const tenants = [
    { id: 't1', ho_ten: 'Nguyễn Văn A', so_dien_thoai: '0987654321', email: 'vana@example.com', so_cccd: '123456789', ngay_sinh: '1995-05-15', dia_chi: 'Hà Nội', lien_he_khan_cap: 'Bố - 0987654322' },
    { id: 't2', ho_ten: 'Trần Thị B', so_dien_thoai: '0912345678', email: 'thib@example.com', so_cccd: '987654321', ngay_sinh: '1998-09-20', dia_chi: 'Hải Phòng', lien_he_khan_cap: 'Mẹ - 0912345679' },
    { id: 't3', ho_ten: 'Lê Hoàng C', so_dien_thoai: '0905123456', email: 'hoangc@example.com', so_cccd: '456789123', ngay_sinh: '2000-01-10', dia_chi: 'Đà Nẵng', lien_he_khan_cap: 'Anh trai - 0905123457' },
  ];

  const assignments = [
    { id: 'a1', phong_id: 'r1', khach_thue_id: 't1', ngay_bat_dau: '2026-01-01', dang_hoat_dong: 1, tien_dat_coc: 2500000, la_nguoi_dai_dien: 1, ngay_het_han_hop_dong: '2026-12-31' },
    { id: 'a2', phong_id: 'r3', khach_thue_id: 't2', ngay_bat_dau: '2026-02-15', dang_hoat_dong: 1, tien_dat_coc: 3000000, la_nguoi_dai_dien: 1, ngay_het_han_hop_dong: '2027-02-14' },
    { id: 'a3', phong_id: 'r3', khach_thue_id: 't3', ngay_bat_dau: '2026-03-01', dang_hoat_dong: 1, tien_dat_coc: 0, la_nguoi_dai_dien: 0, ngay_het_han_hop_dong: '2027-02-14' },
  ];

  const readings = [
    { id: 'mr1', phong_id: 'r1', ngay_ghi_so: '2026-06-30', so_dien_cu: 100, so_dien_moi: 220, so_nuoc_cu: 50, so_nuoc_moi: 65, don_gia_dien: 3500, don_gia_nuoc: 15000 },
    { id: 'mr2', phong_id: 'r3', ngay_ghi_so: '2026-06-30', so_dien_cu: 200, so_dien_moi: 350, so_nuoc_cu: 80, so_nuoc_moi: 105, don_gia_dien: 3500, don_gia_nuoc: 15000 },
  ];

  const invoices = [
    { id: 'i1', phong_id: 'r1', khach_thue_id: 't1', chi_so_dien_nuoc_id: 'mr1', thang_hoa_don: 6, nam_hoa_don: 2026, tien_phong: 2500000, tien_dien: 420000, tien_nuoc: 225000, chi_phi_khac: 50000, tong_tien: 3195000, trang_thai: 'paid', han_thanh_toan: '2026-07-05', ngay_thanh_toan: '2026-07-04', ghi_chu: 'Đã đóng đủ' },
    { id: 'i2', phong_id: 'r3', khach_thue_id: 't2', chi_so_dien_nuoc_id: 'mr2', thang_hoa_don: 6, nam_hoa_don: 2026, tien_phong: 3000000, tien_dien: 525000, tien_nuoc: 375000, chi_phi_khac: 100000, tong_tien: 4000000, trang_thai: 'pending', han_thanh_toan: '2026-07-05', ngay_thanh_toan: null, ghi_chu: 'Chưa thanh toán' },
  ];

  const repairs = [
    { id: 'rep1', phong_id: 'r1', khach_thue_id: 't1', tieu_de: 'Hỏng vòi nước', mo_ta: 'Vòi hoa sen nhà vệ sinh bị rò rỉ nước liên tục', muc_do_uu_tien: 'medium', trang_thai: 'new', ngay_bao: '2026-07-01T08:00:00Z', ngay_xu_ly_xong: null, nguoi_xu_ly: null, ghi_chu_giai_quyet: null },
    { id: 'rep2', phong_id: 'r3', khach_thue_id: 't2', tieu_de: 'Bóng đèn cháy', mo_ta: 'Bóng đèn huỳnh quang phòng khách bị cháy', muc_do_uu_tien: 'low', trang_thai: 'resolved', ngay_bao: '2026-06-10T09:00:00Z', ngay_xu_ly_xong: '2026-06-11T10:00:00Z', nguoi_xu_ly: 'Thợ sửa điện', ghi_chu_giai_quyet: 'Đã thay bóng đèn LED mới' },
  ];

  db.serialize(() => {
    const stmtRoom = db.prepare("INSERT INTO phong (id, so_phong, tang, dien_tich, gia_phong, trang_thai, so_nguoi_toi_da) VALUES (?, ?, ?, ?, ?, ?, ?)");
    rooms.forEach(r => stmtRoom.run(r.id, r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai, r.so_nguoi_toi_da));
    stmtRoom.finalize();

    const stmtTenant = db.prepare("INSERT INTO khach_thue (id, ho_ten, so_dien_thoai, email, so_cccd, ngay_sinh, dia_chi, lien_he_khan_cap, ghi_chu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    tenants.forEach(t => stmtTenant.run(t.id, t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu));
    stmtTenant.finalize();

    const stmtAssignment = db.prepare("INSERT INTO hop_dong_thue (id, phong_id, khach_thue_id, ngay_bat_dau, dang_hoat_dong, tien_dat_coc, la_nguoi_dai_dien, ngay_het_han_hop_dong) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    assignments.forEach(a => stmtAssignment.run(a.id, a.phong_id, a.khach_thue_id, a.ngay_bat_dau, a.dang_hoat_dong, a.tien_dat_coc, a.la_nguoi_dai_dien, a.ngay_het_han_hop_dong));
    stmtAssignment.finalize();

    const stmtReading = db.prepare("INSERT INTO chi_so_dien_nuoc (id, phong_id, ngay_ghi_so, so_dien_cu, so_dien_moi, so_nuoc_cu, so_nuoc_moi, don_gia_dien, don_gia_nuoc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    readings.forEach(rd => stmtReading.run(rd.id, rd.phong_id, rd.ngay_ghi_so, rd.so_dien_cu, rd.so_dien_moi, rd.so_nuoc_cu, rd.so_nuoc_moi, rd.don_gia_dien, rd.don_gia_nuoc));
    stmtReading.finalize();

    const stmtInvoice = db.prepare("INSERT INTO hoa_don (id, phong_id, khach_thue_id, chi_so_dien_nuoc_id, thang_hoa_don, nam_hoa_don, tien_phong, tien_dien, tien_nuoc, chi_phi_khac, tong_tien, trang_thai, han_thanh_toan, ngay_thanh_toan, ghi_chu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    invoices.forEach(i => stmtInvoice.run(i.id, i.phong_id, i.khach_thue_id, i.chi_so_dien_nuoc_id, i.thang_hoa_don, i.nam_hoa_don, i.tien_phong, i.tien_dien, i.tien_nuoc, i.chi_phi_khac, i.tong_tien, i.trang_thai, i.han_thanh_toan, i.ngay_thanh_toan, i.ghi_chu));
    stmtInvoice.finalize();

    const stmtRepair = db.prepare("INSERT INTO yeu_cau_sua_chua (id, phong_id, khach_thue_id, tieu_de, mo_ta, muc_do_uu_tien, trang_thai, ngay_bao, ngay_xu_ly_xong, nguoi_xu_ly, ghi_chu_giai_quyet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    repairs.forEach(rep => stmtRepair.run(rep.id, rep.phong_id, rep.khach_thue_id, rep.tieu_de, rep.mo_ta, rep.muc_do_uu_tien, rep.trang_thai, rep.ngay_bao, rep.ngay_xu_ly_xong, rep.nguoi_xu_ly, rep.ghi_chu_giai_quyet));
    stmtRepair.finalize();

    db.get("SELECT 1", (err) => {
      if (err) {
        reject(err);
      } else {
        if (!isTest) {
          console.log('Sample data (Vietnamese tables schema) seeded successfully.');
        }
        resolve();
      }
    });
  });
});
}

export default db;
