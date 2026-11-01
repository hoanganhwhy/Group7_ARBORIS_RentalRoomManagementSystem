# Hướng Dẫn Cài Đặt Và Chạy ARBORIS

## 1. Yêu cầu

- Node.js 20 LTS trở lên và npm.
- Git (nếu lấy mã nguồn từ GitHub).

## 2. Cài đặt

```bash
npm install
npm --prefix server install
```

Sao chép `.env.example` thành `.env` rồi điền thông tin ngân hàng. Dự án vẫn chạy được khi chưa có `.env`, nhưng sẽ không tạo được mã VietQR.

## 3. Chạy dự án

```bash
npm run dev:all
```

Trên Windows có thể bấm đúp `START_ARBORIS.bat`, file này tự cài thư viện ở lần chạy đầu.

- Giao diện: http://localhost:5173
- API: http://localhost:5000
- Kiểm tra server: http://localhost:5000/api/health
- Tài khoản mặc định: `admin` / `123456` (đổi ngay sau khi đăng nhập)

## 4. Xem cơ sở dữ liệu

Database được tạo tự động tại `server/hostelmate.sqlite` ở lần chạy đầu và không được đưa lên Git. Có thể mở bằng [DB Browser for SQLite](https://sqlitebrowser.org/dl/). Các bảng chính: `phong`, `khach_thue`, `hop_dong_thue`, `chi_so_dien_nuoc`, `hoa_don`, `yeu_cau_sua_chua`.

Để đưa dữ liệu về trạng thái sạch, chạy `npm run reset-db` hoặc `RESET_DATABASE.bat`.

## 5. Kiểm thử

```bash
npm run lint
npm run verify
npm test
npm run test:coverage
```

## 6. Webhook SePay (tùy chọn)

1. Điền `SEPAY_WEBHOOK_API_KEY` và `SEPAY_ALLOWED_ACCOUNT_NUMBERS` trong `.env`.
2. Chạy `START_CLOUDFLARED.bat` để mở tunnel tới cổng 5000.
3. Khai báo URL `https://<ten-mien-cloudflared>/api/webhooks/sepay` trên SePay.

Nếu không dùng webhook, người thuê bấm **Tôi đã chuyển khoản** và Admin xác nhận tại mục **Hóa đơn > Cần xác nhận**.
