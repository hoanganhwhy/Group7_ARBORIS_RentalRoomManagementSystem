CREATE TABLE IF NOT EXISTS phong (
  id TEXT PRIMARY KEY,
  khu_vuc TEXT NOT NULL DEFAULT 'Khu A',
  so_phong TEXT NOT NULL,
  tang INTEGER NOT NULL DEFAULT 1,
  dien_tich REAL NOT NULL DEFAULT 0 CHECK (dien_tich > 0),
  gia_phong REAL NOT NULL DEFAULT 0 CHECK (gia_phong > 0),
  trang_thai TEXT NOT NULL DEFAULT 'available' CHECK (trang_thai IN ('available', 'occupied', 'maintenance')),
  mo_ta TEXT,
  so_nguoi_toi_da INTEGER NOT NULL DEFAULT 2 CHECK (so_nguoi_toi_da > 0),
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(khu_vuc, so_phong)
);

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
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hop_dong_thue (
  id TEXT PRIMARY KEY,
  phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
  khach_thue_id TEXT NOT NULL REFERENCES khach_thue(id) ON DELETE CASCADE,
  ngay_bat_dau TEXT NOT NULL,
  ngay_ket_thuc TEXT,
  dang_hoat_dong INTEGER DEFAULT 1,
  tien_dat_coc REAL DEFAULT 0,
  la_nguoi_dai_dien INTEGER DEFAULT 0,
  ngay_het_han_hop_dong TEXT,
  ghi_chu TEXT,
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
);

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
);

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
  trang_thai TEXT NOT NULL DEFAULT 'pending',
  han_thanh_toan TEXT,
  ngay_thanh_toan TEXT,
  ghi_chu TEXT,
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(phong_id, thang_hoa_don, nam_hoa_don)
);

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
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MANAGER', 'TENANT', 'GUEST')),
  tenant_id TEXT REFERENCES khach_thue(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  cccd TEXT,
  date_of_birth TEXT,
  address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cai_dat_he_thong (
  id TEXT PRIMARY KEY,
  momo_number TEXT,
  momo_name TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_owner TEXT,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON phong(trang_thai);
CREATE INDEX IF NOT EXISTS idx_room_assignments_room ON hop_dong_thue(phong_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_tenant ON hop_dong_thue(khach_thue_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_room ON chi_so_dien_nuoc(phong_id);
CREATE INDEX IF NOT EXISTS idx_invoices_room ON hoa_don(phong_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON hoa_don(trang_thai);
CREATE INDEX IF NOT EXISTS idx_repair_requests_room ON yeu_cau_sua_chua(phong_id);
CREATE INDEX IF NOT EXISTS idx_repair_requests_status ON yeu_cau_sua_chua(trang_thai);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON hoa_don(han_thanh_toan);
CREATE INDEX IF NOT EXISTS idx_invoices_month_year ON hoa_don(nam_hoa_don, thang_hoa_don);
CREATE INDEX IF NOT EXISTS idx_room_assignments_contract_end ON hop_dong_thue(ngay_het_han_hop_dong);
