# Báo cáo tích hợp ARBORIS

## Nguồn được hợp nhất

- Admin: `Quan Li Phong Tro (1).rar`.
- Khách thuê: `Group7_ARBORIS_RentalRoomManagementSystem-cao-le-tuan-anh.rar`.

## Kết quả

- Một frontend React/Vite dùng chung.
- Một backend Express/Socket.IO dùng chung tại cổng 5000.
- Một database SQLite tại `server/hostelmate.sqlite`.
- Phân giao diện theo role `ADMIN` và `TENANT` sau khi đăng nhập.
- Admin mặc định duy nhất: `admin / 123456`.
- Database bàn giao không có dữ liệu mẫu.
- Sửa tên mục khách thuê từ “chữa lành” thành “Sửa chữa”.
- Tích hợp VietQR, webhook SePay, chatbot Gemini, hợp đồng PDF.

## Kiểm tra đã chạy

- TypeScript typecheck: đạt.
- Vite production build: đạt.
- Backend API tests: 6/6 đạt.
- Smoke test thủ công:
  - Đăng nhập Admin và khách thuê;
  - Tạo phòng, người thuê, xếp phòng và cấp tài khoản;
  - Điện nước, hóa đơn và yêu cầu sửa chữa;
  - Tenant portal;
  - Webhook SePay tự động cập nhật hóa đơn và chống giao dịch trùng;

## Cấu hình ngoài hệ thống

- VietQR và webhook SePay đã được điền trong `.env` theo thông tin người dùng cung cấp.
- `GEMINI_API_KEY` và Google OAuth vẫn để trống vì chưa có khóa tương ứng.
- Không đưa `.env` lên GitHub và nên thay khóa webhook nếu khóa đã từng bị chia sẻ công khai.

## Điều chỉnh theo yêu cầu mới

- Giữ nguyên giao diện Admin từ dự án Quan Li Phong Tro.
- Đã loại bỏ mô-đun Thông báo và Tin nhắn khỏi giao diện và API đang hoạt động.
- Đã cấu hình VietQR và webhook SePay cho tài khoản ngân hàng trong `.env`.
