CREATE TABLE IF NOT EXISTS danh_ba_ban_be (
  id TEXT PRIMARY KEY,
  nguoi_gui_id TEXT NOT NULL,
  nguoi_nhan_id TEXT NOT NULL,
  trang_thai TEXT DEFAULT 'pending' CHECK (trang_thai IN ('pending', 'accepted', 'rejected')),
  ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nguoi_gui_id) REFERENCES khach_thue(id) ON DELETE CASCADE,
  FOREIGN KEY (nguoi_nhan_id) REFERENCES khach_thue(id) ON DELETE CASCADE
);
