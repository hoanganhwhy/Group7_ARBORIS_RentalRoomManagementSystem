# Báo cáo kiểm tra

Ngày kiểm tra: 02/11/2026. Môi trường: Windows 11, Node.js 25.4.0.

## Kết quả tự động

| Lệnh | Kết quả |
| :--- | :--- |
| `npm run typecheck` | Đạt, không có lỗi TypeScript |
| `npm run build` | Đạt |
| `npm run lint` | 0 lỗi, còn cảnh báo về biến chưa dùng và dependency của hook |
| `npm test` | 105/105 test đạt (4 bộ test) |
| `npm run test:coverage` | Độ phủ dòng 85,86%, nhánh 71,11%, hàm 93,29% |

Độ phủ được đo trên toàn bộ backend, gồm cả `server.js`, `integrated-routes.js`, `contracts.js` và chatbot. Giao diện React chưa có test tự động.

## Kiểm tra thủ công trên trình duyệt

- Tạo phòng, người thuê, hợp đồng, chỉ số điện nước và hóa đơn; các trang Admin đều hiển thị đúng.
- Cấp tài khoản cho người thuê tên có chữ "Đ"; người thuê bị buộc đổi mật khẩu ở lần đăng nhập đầu.
- Trang thanh toán tạo được mã VietQR; bấm "Tôi đã chuyển khoản", Admin xác nhận ở mục "Cần xác nhận", hóa đơn chuyển sang đã thanh toán.
- Ký hợp đồng bằng chữ ký vẽ tay và tải được file PDF.
- Giao diện ở khổ màn hình 375px: menu dạng ngăn kéo hoạt động, trang không bị tràn ngang.
- Socket.IO từ chối kết nối không có cookie hợp lệ; CORS không chấp nhận domain lạ; đăng nhập sai lần thứ 21 bị trả về 429.
- Database định dạng cũ được nâng cấp khi khởi động mà không mất hợp đồng; mật khẩu dạng chữ thường được băm.

## Chưa kiểm tra được

- Webhook SePay với giao dịch thật, do token SePay đã hết hạn. Xử lý webhook chỉ được kiểm tra bằng test tự động với request giả lập; mã webhook không thay đổi trong đợt sửa này.
- Chatbot với Gemini thật, do không có API key. Luồng gọi công cụ được kiểm tra bằng test với model giả lập.
- Đăng nhập Google, do chưa cấu hình `GOOGLE_CLIENT_ID`.
