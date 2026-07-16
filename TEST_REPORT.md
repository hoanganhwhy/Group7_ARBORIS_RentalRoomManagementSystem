# Báo cáo kiểm tra bản bàn giao

Ngày kiểm tra: 15/07/2026

## Kết quả

- `npm run typecheck`: đạt, không có lỗi TypeScript.
- `npm run build`: đạt, Vite tạo bản production thành công.
- `npm run lint`: hoàn tất, không có lỗi; còn cảnh báo từ mã giao diện gốc nhưng không chặn build.
- `npm --prefix server test`: 6/6 bài kiểm thử đạt.
- `node --check` cho `server.js`, `db.js`, `integrated-routes.js`: đạt.
- API chạy tại cổng 5000, `/api/health` phản hồi thành công.
- Đăng nhập Admin mặc định `admin / 123456`: đạt.
- `/api/settings` trả đúng cấu hình ngân hàng, mẫu VietQR `compact2` và tiền tố `HM`.
- Database bàn giao: chỉ có một tài khoản Admin; các bảng nghiệp vụ không có dữ liệu mẫu.
- Kiểm thử webhook trong database bộ nhớ: xác thực API key, đối chiếu tài khoản, khớp hóa đơn, cập nhật đã thanh toán và chống xử lý trùng đều đạt.

## Phạm vi giao diện

- Admin dùng các component/page gốc từ dự án `Quan Li Phong Tro`.
- Không còn mục Thông báo hoặc Tin nhắn trong điều hướng Admin/khách thuê.
- Khách thuê còn ba mục: Tổng quan, Hóa đơn và Sửa chữa.
- Trang VietQR không còn bị sidebar che và tự kiểm tra trạng thái hóa đơn mỗi 3 giây.

## Kiểm tra bổ sung – Sửa chữa

- Sidebar Admin không còn `overflow-y-auto`, khung điều hướng không tạo thanh cuộn dọc.
- Người thuê đăng nhập và tạo yêu cầu qua API có xác thực `/api/tenant/repair_requests`: đạt.
- API tự gắn đúng người thuê từ cookie đăng nhập và kiểm tra hợp đồng phòng đang hoạt động: đạt.
- Admin nhận danh sách yêu cầu chung và có thể cập nhật trạng thái xử lý: đạt.
- Socket.IO phát sự kiện `repair_updated` khi tạo, sửa, xóa hoặc đổi trạng thái: đạt.
