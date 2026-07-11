-- Tạo bảng Yêu cầu ở ghép (Roommate Requests)
CREATE TABLE IF NOT EXISTS yeu_cau_o_ghep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    khach_thue_id INTEGER NOT NULL,
    phong_id INTEGER NOT NULL,
    tieu_de TEXT NOT NULL,
    mo_ta TEXT,
    gia_chia_se REAL NOT NULL,
    trang_thai TEXT DEFAULT 'open' CHECK(trang_thai IN ('open', 'closed')),
    ngay_dang DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(khach_thue_id) REFERENCES khach_thue(id) ON DELETE CASCADE,
    FOREIGN KEY(phong_id) REFERENCES phong(id) ON DELETE CASCADE
);

-- Index để truy vấn nhanh danh sách phòng đang tìm người ở ghép
CREATE INDEX IF NOT EXISTS idx_yeu_cau_o_ghep_trang_thai ON yeu_cau_o_ghep(trang_thai);
CREATE INDEX IF NOT EXISTS idx_yeu_cau_o_ghep_phong_id ON yeu_cau_o_ghep(phong_id);
CREATE INDEX IF NOT EXISTS idx_yeu_cau_o_ghep_khach_thue_id ON yeu_cau_o_ghep(khach_thue_id);
