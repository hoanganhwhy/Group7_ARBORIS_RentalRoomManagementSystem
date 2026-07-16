# Bản sửa Admin UI + VietQR/SePay

- Admin dùng đúng bộ giao diện trong thư mục `src/admin`, gồm: Tổng quan, Phòng trọ, Người thuê, Tài khoản, Điện nước, Hóa đơn, Sửa chữa.
- Đã bỏ mục Thông báo và Tin nhắn khỏi điều hướng.
- Đã cấu hình MB Bank, VietQR template `compact2`, tiền tố thanh toán `HM`.
- `.env` được đồng bộ vào bảng `cai_dat` mỗi lần server khởi động, không còn lỗi database giữ giá trị trống cũ.
- Webhook SePay kiểm tra API key, tài khoản nhận, giao dịch tiền vào, chống trùng và trả đúng `{"success": true}` khi xử lý thành công.
- Database bàn giao sạch, chỉ còn tài khoản `admin / 123456`.

## VietQR offline fallback

- Tạo payload VietQR chuẩn QRIBFTTA và CRC16 trực tiếp tại frontend.
- Render QR cục bộ, không cần tải ảnh từ miền bên ngoài.
- Thêm API proxy và nhiều URL ảnh dự phòng nếu trình duyệt không tạo được QR cục bộ.
- Giữ nguyên luồng SePay webhook; chỉ thay cách hiển thị mã QR.

## Sửa yêu cầu bảo trì và thanh điều hướng Admin

- Đã bỏ thanh cuộn dọc trong sidebar Admin; toàn bộ 7 mục quản lý và ô tài khoản nằm cố định trong cùng một khung.
- Admin không còn nút hoặc biểu mẫu tự tạo/xóa yêu cầu sửa chữa.
- Trang Sửa chữa của Admin chỉ tiếp nhận yêu cầu do người thuê gửi, xem chi tiết và cập nhật tiến độ, người phụ trách, phản hồi xử lý.
- Thêm API riêng có xác thực cho người thuê: `GET/POST/PUT/DELETE /api/tenant/repair_requests`.
- Backend tự lấy `tenant_id` từ phiên đăng nhập, kiểm tra hợp đồng phòng đang hoạt động và không còn phụ thuộc `tenant_id` do frontend gửi lên.
- Yêu cầu mới và thay đổi trạng thái được đồng bộ tới hai giao diện qua Socket.IO; Admin cũng tự làm mới danh sách định kỳ.
- Đã kiểm tra lại TypeScript, production build và 6/6 bài kiểm thử backend.
