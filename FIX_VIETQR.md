# VietQR fix

Bản này không còn phụ thuộc hoàn toàn vào ảnh từ `img.vietqr.io`.

Thứ tự tạo mã QR:

1. Tạo VietQR trực tiếp trong trình duyệt từ mã BIN, số tài khoản, số tiền và nội dung hóa đơn.
2. Nếu không tạo được cục bộ, frontend gọi API proxy của server.
3. Nếu proxy lỗi, hệ thống thử các đường dẫn ảnh `.jpg` và `.png` của VietQR.

Sau khi thay bản cũ:

1. Tắt toàn bộ cửa sổ chạy dự án bằng `Ctrl + C`.
2. Xóa thư mục bản cũ hoặc giải nén bản mới sang thư mục khác.
3. Chạy `START_ARBORIS.bat`.
4. Nhấn `Ctrl + Shift + R` trong trình duyệt để xóa cache giao diện cũ.
