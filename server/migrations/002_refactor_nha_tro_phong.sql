-- Migration: Tách nha_tro và phong, thêm các trường tiện ích

CREATE TABLE IF NOT EXISTS nha_tro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ten_nha_tro TEXT NOT NULL,
    dia_chi TEXT NOT NULL,
    vi_do REAL,
    kinh_do REAL,
    mo_ta TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tạo một nhà trọ mặc định
INSERT INTO nha_tro (ten_nha_tro, dia_chi) 
SELECT 'Nhà trọ mặc định', 'Chưa xác định'
WHERE NOT EXISTS (SELECT 1 FROM nha_tro);

CREATE TABLE phong_new (
    id TEXT PRIMARY KEY,
    nha_tro_id INTEGER NOT NULL DEFAULT 1,
    so_phong TEXT NOT NULL,
    tang INTEGER NOT NULL DEFAULT 1,
    dien_tich REAL NOT NULL DEFAULT 0 CHECK (dien_tich > 0),
    gia_phong REAL NOT NULL DEFAULT 0 CHECK (gia_phong > 0),
    trang_thai TEXT NOT NULL DEFAULT 'available' CHECK (trang_thai IN ('available', 'occupied', 'maintenance')),
    mo_ta TEXT,
    so_nguoi_toi_da INTEGER NOT NULL DEFAULT 2 CHECK (so_nguoi_toi_da > 0),
    dieu_hoa INTEGER NOT NULL DEFAULT 0,
    may_giat INTEGER NOT NULL DEFAULT 0,
    noi_that INTEGER NOT NULL DEFAULT 0,
    ban_cong INTEGER NOT NULL DEFAULT 0,
    ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nha_tro_id) REFERENCES nha_tro(id),
    UNIQUE(nha_tro_id, so_phong)
);

-- Copy dữ liệu từ bảng cũ sang bảng mới
-- Chú ý: Nếu bảng cũ chưa có các cột dieu_hoa, may_giat... sqlite sẽ báo lỗi nếu ta select trực tiếp.
-- Tuy nhiên, migration script (run-migrations.js) sẽ xử lý phần copy data bằng nodejs để linh hoạt kiểm tra cột.
-- Do đó trong file SQL này, ta tạm thời không để lệnh INSERT INTO SELECT.
