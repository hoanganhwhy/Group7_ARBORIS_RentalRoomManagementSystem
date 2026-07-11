# Hướng dẫn tích hợp quét QR chuyển khoản và biến động số dư

Tài liệu này áp dụng cho dự án **HostelMate** trong thư mục hiện tại.

## 1. Giải pháp được dùng

Dự án dùng hai phần:

1. **VietQR Quick Link** để tạo ảnh QR chuyển khoản theo đúng số tài khoản, số tiền và nội dung thanh toán.
2. **SePay Webhook** để nhận giao dịch vào tài khoản ngân hàng, đối soát nội dung chuyển khoản và tự cập nhật hóa đơn.

Luồng xử lý:

```text
Chủ trọ mở hóa đơn
        ↓
Backend tạo mã thanh toán riêng cho hóa đơn
        ↓
Frontend hiển thị QR VietQR có sẵn số tiền + nội dung
        ↓
Người thuê quét QR và chuyển khoản
        ↓
Ngân hàng → SePay → POST /api/webhooks/sepay
        ↓
Backend kiểm tra API key, chống giao dịch trùng, tìm hóa đơn
        ↓
Lưu biến động số dư và tự đánh dấu hóa đơn đã thanh toán khi nhận đủ tiền
```

> Đây là cách thực tế hơn so với gọi trực tiếp API của ngân hàng. API ngân hàng trực tiếp thường yêu cầu hợp đồng doanh nghiệp/đối tác và không phù hợp cho dự án cá nhân hoặc đồ án.

## 2. Những phần đã được thêm vào dự án

### Backend

- `GET /api/invoices/:id/payment`: tạo/lấy thông tin thanh toán và đường dẫn QR.
- `GET /api/bank-transactions`: lấy danh sách biến động số dư đã nhận.
- `POST /api/webhooks/sepay`: nhận webhook giao dịch từ SePay.
- Xác thực webhook bằng header `Authorization: Apikey <key>`.
- Chống cộng tiền hai lần bằng mã giao dịch duy nhất từ SePay.
- Hỗ trợ trả thiếu, trả nhiều lần và tự cộng dồn.
- Tự chuyển hóa đơn sang `paid` khi tổng tiền nhận đủ.
- Đồng bộ khi chủ trọ bấm nút “Đánh dấu đã thanh toán” thủ công.

### Cơ sở dữ liệu

Hai bảng mới được tự tạo khi server khởi động:

- `thanh_toan_hoa_don`: mã thanh toán, số tiền cần nhận, số đã nhận, trạng thái.
- `giao_dich_ngan_hang`: lịch sử webhook/giao dịch ngân hàng.

### Frontend

Trong trang **Hóa đơn** đã có:

- Nút mở QR cho từng hóa đơn.
- QR có sẵn số tiền và nội dung thanh toán riêng.
- Hiển thị số tiền cần trả, đã nhận và còn thiếu.
- Tự kiểm tra lại trạng thái mỗi 5 giây khi cửa sổ QR đang mở.
- Bảng “Biến động số dư gần đây”.
- Danh sách các giao dịch đã khớp với hóa đơn.

## 3. Cấu hình tài khoản ngân hàng

Sao chép file mẫu:

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS/Linux

```bash
cp .env.example .env
```

Mở `.env` và sửa:

```env
VITE_API_URL=http://localhost:5000/api

# BIN ngân hàng hoặc mã ngân hàng được VietQR hỗ trợ
BANK_ID=970422
BANK_ACCOUNT_NO=0123456789
BANK_ACCOUNT_NAME=NGUYEN VAN A
VIETQR_TEMPLATE=compact2

# Tiền tố dùng để nhận diện nội dung chuyển khoản
PAYMENT_PREFIX=HM

# Chuỗi bí mật do bạn tự đặt; phải giống khóa cấu hình trên SePay
SEPAY_WEBHOOK_API_KEY=thay-bang-chuoi-bi-mat-dai-va-ngau-nhien

# Có thể nhập nhiều tài khoản, ngăn cách bằng dấu phẩy
SEPAY_ALLOWED_ACCOUNT_NUMBERS=0123456789

PORT=5000
```

### Giải thích

| Biến | Ý nghĩa |
|---|---|
| `BANK_ID` | BIN/mã ngân hàng dùng trong VietQR |
| `BANK_ACCOUNT_NO` | Số tài khoản nhận tiền |
| `BANK_ACCOUNT_NAME` | Tên chủ tài khoản, nên viết không dấu |
| `VIETQR_TEMPLATE` | Mẫu ảnh QR, mặc định `compact2` |
| `PAYMENT_PREFIX` | Tiền tố mã thanh toán, ví dụ `HM` |
| `SEPAY_WEBHOOK_API_KEY` | Khóa bí mật để bảo vệ endpoint webhook |
| `SEPAY_ALLOWED_ACCOUNT_NUMBERS` | Chỉ nhận giao dịch của các tài khoản này |

Không đưa file `.env` lên GitHub và không đặt API key ở frontend.

## 4. Cài đặt và chạy dự án

Tại thư mục gốc dự án:

```bash
npm install
npm --prefix server install
npm run dev:all
```

Sau đó mở địa chỉ Vite hiển thị trong terminal, thường là:

```text
http://localhost:5173
```

Backend mặc định chạy ở:

```text
http://localhost:5000
```

Kiểm tra endpoint backend:

```text
http://localhost:5000/api/health
```

## 5. Đăng ký và nối ngân hàng với SePay

1. Tạo tài khoản tại trang quản trị SePay.
2. Chọn gói Free nếu số giao dịch thử nghiệm ít.
3. Liên kết tài khoản ngân hàng nhận tiền theo hướng dẫn của SePay.
4. Kiểm tra rằng SePay đã nhận được biến động giao dịch của tài khoản.
5. Dùng **Test Mode** của SePay trước khi thử chuyển tiền thật.

Tài liệu chính thức:

- Bảng giá: <https://sepay.vn/bang-gia>
- Webhook ngân hàng: <https://developer.sepay.vn/vi/ngan-hang/webhooks>
- VietQR Quick Link: <https://www.vietqr.io/danh-sach-api/link-tao-ma-nhanh>

## 6. Tạo webhook trên SePay

Webhook cần trỏ tới endpoint:

```text
https://TEN-MIEN-CUA-BAN/api/webhooks/sepay
```

Cấu hình đề xuất:

| Mục | Giá trị |
|---|---|
| Sự kiện | Giao dịch tiền vào |
| Phương thức | `POST` |
| Content-Type | `application/json` |
| URL | `https://TEN-MIEN-CUA-BAN/api/webhooks/sepay` |
| Kiểu xác thực | API Key |
| API key | Giống `SEPAY_WEBHOOK_API_KEY` trong `.env` |

Server kiểm tra header:

```http
Authorization: Apikey chuoi-bi-mat-cua-ban
```

Webhook phải là địa chỉ HTTPS công khai. `localhost` không thể nhận yêu cầu từ SePay.

### Khi chạy local

Dùng một công cụ HTTPS tunnel như Cloudflare Tunnel hoặc ngrok để ánh xạ cổng `5000` ra Internet. Ví dụ URL tunnel nhận được là:

```text
https://abc-example.example-tunnel.com
```

Thì URL webhook là:

```text
https://abc-example.example-tunnel.com/api/webhooks/sepay
```

Không dùng URL tunnel miễn phí cho môi trường thật lâu dài vì địa chỉ có thể thay đổi.

## 7. Kiểm thử không cần chuyển tiền thật

### Cách 1: Test Mode của SePay

1. Mở một hóa đơn trong HostelMate.
2. Bấm nút QR và sao chép **Mã thanh toán**.
3. Trong Test Mode của SePay, tạo giao dịch tiền vào.
4. Nội dung giao dịch phải chứa đúng mã thanh toán, ví dụ:

```text
THANH TOAN HM0123456789ABCDEF01234567
```

5. Gửi giao dịch giả lập.
6. Mở lại trang Hóa đơn hoặc giữ cửa sổ QR; trạng thái tự cập nhật.

### Cách 2: Gửi webhook bằng curl

Thay các giá trị mẫu bằng thông tin của bạn:

```bash
curl -X POST http://localhost:5000/api/webhooks/sepay \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey thay-bang-khoa-trong-file-env" \
  -d '{
    "id": 10001,
    "gateway": "MB",
    "transactionDate": "2026-07-10 10:30:00",
    "accountNumber": "0123456789",
    "code": "HM0123456789ABCDEF01234567",
    "content": "THANH TOAN HM0123456789ABCDEF01234567",
    "transferType": "in",
    "transferAmount": 3000000,
    "accumulated": 10000000,
    "referenceCode": "TEST-10001"
  }'
```

Mã thanh toán trong ví dụ phải được thay bằng mã thật đang hiển thị trên hóa đơn.

## 8. Cách hệ thống đối soát

Mỗi hóa đơn có mã dạng:

```text
HM + 24 ký tự HEX
```

Ví dụ:

```text
HM8AC90E21D8F0C31E2A9D771B
```

Mã này được tạo ổn định từ ID hóa đơn. Webhook tìm mã trong các trường `code`, `content` hoặc `description`.

Quy tắc cập nhật:

- Chưa nhận tiền: `pending`.
- Nhận một phần: `partial`.
- Tổng tiền nhận lớn hơn hoặc bằng tổng hóa đơn: `paid`.
- Giao dịch có cùng ID nhà cung cấp: bỏ qua, không cộng lại.
- Giao dịch tiền ra vẫn được lưu để hiển thị biến động nhưng không cộng vào hóa đơn.

## 9. Các endpoint mới

### Lấy QR của hóa đơn

```http
GET /api/invoices/:id/payment
```

Dữ liệu trả về gồm:

```json
{
  "invoice_id": "...",
  "payment_code": "HM...",
  "required_amount": 3000000,
  "received_amount": 1000000,
  "remaining_amount": 2000000,
  "payment_status": "partial",
  "qr_url": "https://img.vietqr.io/image/...",
  "bank": {},
  "transactions": []
}
```

### Lấy biến động số dư

```http
GET /api/bank-transactions?limit=20
```

### Nhận webhook SePay

```http
POST /api/webhooks/sepay
Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
Content-Type: application/json
```

Server trả về HTTP 200 và JSON có `success: true` khi đã xử lý.

## 10. Chạy kiểm thử

### Kiểm thử riêng luồng thanh toán

```bash
npm --prefix server run test:payment
```

### Toàn bộ test backend

```bash
npm run test:server
```

### Build frontend

```bash
npm run build
```

Tại thời điểm bàn giao, kết quả là:

- 45/45 test backend đạt.
- Kiểm thử tích hợp VietQR + SePay đạt.
- Frontend production build thành công.

## 11. Đưa lên môi trường thật

1. Deploy backend lên máy chủ có HTTPS.
2. Đặt biến môi trường trên máy chủ, không commit `.env`.
3. Chỉ cho phép CORS từ domain frontend của bạn.
4. Bật xác thực đăng nhập cho trang quản trị trước khi công khai Internet.
5. Đổi `SEPAY_WEBHOOK_API_KEY` thành chuỗi dài, ngẫu nhiên.
6. Cấu hình đúng số tài khoản trong `SEPAY_ALLOWED_ACCOUNT_NUMBERS`.
7. Theo dõi log webhook và sao lưu SQLite định kỳ.
8. Với lượng truy cập lớn, cân nhắc chuyển SQLite sang PostgreSQL/MySQL.

## 12. Xử lý lỗi thường gặp

### QR không hiện

- Kiểm tra `BANK_ID`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME`.
- Mở DevTools → Network và xem request `/api/invoices/:id/payment`.
- Khởi động lại backend sau khi sửa `.env`.

### Chuyển tiền rồi nhưng hóa đơn không cập nhật

- Kiểm tra webhook URL có truy cập được từ Internet không.
- Kiểm tra API key trên SePay có giống `.env` không.
- Nội dung chuyển khoản phải còn nguyên mã `HM...`.
- Kiểm tra tài khoản có nằm trong `SEPAY_ALLOWED_ACCOUNT_NUMBERS` không.
- Kiểm tra bảng “Biến động số dư gần đây”; giao dịch có thể đã tới nhưng không khớp mã hóa đơn.

### Webhook trả 401

Sai hoặc thiếu header:

```http
Authorization: Apikey <key>
```

### Webhook nhận được nhưng bị bỏ qua

Số tài khoản trong payload không thuộc danh sách cho phép. Sửa `SEPAY_ALLOWED_ACCOUNT_NUMBERS` rồi khởi động lại server.

### Thanh toán bị cộng hai lần

Hệ thống đã có ràng buộc chống trùng theo ID giao dịch SePay. Khi tự gửi thử bằng curl, mỗi giao dịch mới phải dùng một `id` khác nhau.
