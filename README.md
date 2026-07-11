# HostelMate - Hệ Thống Quản Lý Phòng Trọ Chuyên Nghiệp

HostelMate là giải pháp phần mềm quản lý phòng trọ, căn hộ dịch vụ và nhà cho thuê toàn diện, được xây dựng trên nền tảng **React (Frontend)** và **Node.js Express + SQLite (Backend)**. 

Dự án có kiến trúc Module phân quyền (RBAC) rõ ràng giữa **Chủ trọ (Admin)** và **Khách thuê (Tenant)**, tích hợp luồng nghiệp vụ thực tế, giao diện tự động làm mới (Polling) và webhook thanh toán trực tuyến.

---

## 1. Các Phân Hệ & Tính Năng Chính

* **🔒 Phân hệ Xác thực & Tài khoản (Auth & Users)**: Đăng nhập phân quyền (Admin / Tenant). Tự động chặn truy cập trái phép bằng JWT. Khả năng cấp tài khoản kèm Số điện thoại cho khách thuê trực tiếp từ giao diện Admin.
* **🏠 Phân hệ Quản lý Phòng trọ (Rooms)**: Theo dõi thông tin chi tiết các phòng trọ, số tầng, diện tích, giá phòng, trạng thái phòng (`Trống`, `Đang thuê`, `Bảo trì`). Chặn xóa phòng nếu đang có người thuê.
* **👥 Phân hệ Quản lý Khách thuê (Tenants)**: Lưu trữ hồ sơ thông tin cá nhân khách thuê (Họ tên, SĐT, CCCD, Email). Admin có thể chọn nhanh khách đã có tài khoản để gán vào phòng trọ.
* **⚡ Phân hệ Chỉ số Điện nước (Meter Readings)**: Ghi nhận lịch sử điện nước tiêu thụ thực tế hàng tháng của từng phòng. Hệ thống tự động ràng buộc chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ để tránh số âm.
* **🧾 Phân hệ Quản lý Hóa đơn (Invoices)**: Lập phiếu thu tự động. Hỗ trợ **xuất mã qr** (chuẩn UTF-8 không lỗi font). Tích hợp **Webhook SePay** tự động xác nhận đã thanh toán khi khách chuyển khoản.
* **💬 Trung tâm Thông báo (Notification & Feedback Center)**: Admin gửi thông báo cho Tất cả hoặc 1 Khách thuê cụ thể. Khách thuê nhận tin nhắn tự động theo thời gian thực (Polling 10s) và có thể Chat / Phản hồi 2 chiều với Admin.
* **🛠️ Phân hệ Báo hỏng & Sửa chữa (Repair Requests)**: Tiếp nhận sự cố dịch vụ từ khách thuê. Admin có thể cập nhật trạng thái xử lý (Mới -> Đang xử lý -> Hoàn thành) và phản hồi lại cho khách.

---

## 2. Công Nghệ Áp Dụng (Tech Stack)

* **Client**: ReactJS v18+, Vite, TypeScript, TailwindCSS, Lucide Icons.
* **Server**: Node.js v20+, Express framework, JWT Authentication.
* **Database**: SQLite3 (lưu trữ nhẹ nhàng tại `server/csdl_hostelmate.sqlite`).
* **Tính năng Realtime**: Sử dụng Long-polling/Interval polling 10s đảm bảo cập nhật thông báo và hóa đơn cho Khách thuê không bị trễ.

---

## 3. Cấu Trúc Thư Mục Dự Án

Cấu trúc thư mục được chia thành hai phần chính biệt lập: **Frontend (React/Vite)** và **Backend (Node.js/Express)**.

### A. Phân Tích Backend (`/server`)

Thư mục `server` chứa toàn bộ mã nguồn xử lý logic nghiệp vụ, kết nối cơ sở dữ liệu và cung cấp RESTful APIs. 

```text
server/
├── migrations/                # Thư mục chứa các kịch bản cập nhật CSDL (001_initial_schema.sql, 005_notifications.sql...)
├── src/                       # Chứa các Module mở rộng (Ví dụ: tính năng AI - ai.routes.js, controllers, services...)
├── csdl_hostelmate.sqlite     # File cơ sở dữ liệu SQLite chính của hệ thống. 
├── db.js                      # Cấu hình kết nối Database và tự động chạy file migrations.
├── server.js                  # FILE CỐT LÕI (Core Entry). Định nghĩa toàn bộ Router (Express App), JWT, Cronjobs.
├── package.json               # Khai báo dependencies của Backend.
├── tests/                     # Chứa bộ Unit Test chạy trên bộ nhớ ảo.
└── (Các file kịch bản JS)     # fix_admin.js, migrate_ids.js, update_db_ai.cjs... (Dùng cho bảo trì CSDL)
```

### B. Phân Tích Frontend (`/src`)

Thư mục `src` chứa mã nguồn giao diện người dùng, sử dụng **React (TypeScript)**, giao diện **TailwindCSS**, và bundled bằng **Vite**.

```text
src/
├── App.tsx                    # File Root Component định tuyến (Routing) và quản lý State phân quyền.
├── main.tsx                   # Điểm khởi chạy của React DOM.
├── lib/                       # Chứa thư viện & cấu hình tiện ích
│   └── api.ts                 # Định nghĩa toàn bộ hàm gọi API kết nối tới Backend.
├── context/                   # Chứa React Context (Quản lý State toàn cục)
│   └── AuthContext.tsx        # Cung cấp trạng thái Đăng nhập, thông tin User.
├── components/                # Chứa các UI Components có thể tái sử dụng
│   ├── RoommateRequestModal.tsx
│   └── ui/                    # (AiChatbot, Button, Input, Modal, Sidebar, ProfileModal...)
├── pages/                     # Chứa giao diện (Views) của từng trang (Phân chia Admin và Tenant)
│   ├── (Admin Pages)
│   │   ├── Dashboard, Rooms, Tenants, UserManagement, Invoices, MeterReadings, Repairs, NotificationsAdmin
│   ├── (Tenant Pages)
│   │   ├── TenantDashboard, NotificationsTenant
│   └── (Chung)
│       └── Login, MockPaymentGateway
└── types/                     # Định nghĩa TypeScript Interfaces (Models: Room, Tenant, Invoice...)
```

---

## 4. Hướng Dẫn Cài Đặt & Khởi Chạy Cục Bộ

### Bước 1: Khai báo Node.js Portable vào PATH (Dành cho máy chạy Windows)
Mở PowerShell tại thư mục `HostelMate` và thiết lập biến môi trường để sử dụng đúng bộ Node chạy di động được tích hợp (nếu máy chưa có cài Node):

```powershell
$env:PATH = "e:\Quan Li Phong Tro\HostelMate\.node-portable;" + $env:PATH
```

### Bước 2: Cài đặt Dependencies
```powershell
# Cài đặt thư viện của Root (chứa React)
npm install

# Cài đặt thư viện của Backend Server
npm --prefix server install
```

### Bước 3: Khởi chạy Ứng dụng
```powershell
npm run dev:all
```
Lệnh trên sẽ chạy song song cả client và server:
* **Giao diện Web**: [http://localhost:5174](http://localhost:5174)
* **Backend API**: [http://localhost:5000](http://localhost:5000)

*Lưu ý: Nếu port 5174 bị chiếm, Vite có thể tự nhảy sang 5175, hãy xem log Terminal.*

---

## 5. Tài khoản Đăng nhập Test

Lần đầu chạy hệ thống chưa có Admin, bạn hãy bấm vào **"Chưa có tài khoản? Khởi tạo Admin đầu tiên"** ngoài màn hình Login để tạo Admin.

Sau đó, truy cập bằng Admin vào mục **Tài khoản** để cấp phát Account cho Khách thuê.

---

**Đọc thêm tài liệu API:**
Xem file `API.md` để lấy danh sách đầy đủ toàn bộ Web Endpoints của hệ thống!


## Cấu Trúc Mã Nguồn (Refactored)
- **Frontend**: Component được chia nhỏ (ví dụ: src/components/rooms/RoomDetailModal.tsx). Các API calls được gom chung vào src/lib/api.ts để DRY.
- **Backend**: Sử dụng Global Error Handler tại src/middleware/errorHandler.js kết hợp với catchAsync.js. Dữ liệu được xử lý qua Repository/Service Pattern thay vì gộp chung trong server.js.
