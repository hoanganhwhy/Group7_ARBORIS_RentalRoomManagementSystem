# HostelMate - Hệ Thống Quản Lý Phòng Trọ Chuyên Nghiệp

HostelMate là giải pháp phần mềm quản lý phòng trọ, căn hộ dịch vụ và nhà cho thuê toàn diện, được xây dựng trên nền tảng **React (Frontend)** và **Node.js Express + SQLite (Backend)**. 

Dự án có kiến trúc Module phân quyền (RBAC) rõ ràng giữa **Chủ trọ (Admin)** và **Khách thuê (Tenant)**, tích hợp luồng nghiệp vụ thực tế, tính năng trò chuyện, gửi thông báo theo thời gian thực và webhook thanh toán trực tuyến.

---

## 1. Các Phân Hệ & Tính Năng Chính

* **🔒 Phân hệ Xác thực & Quản lý Tài khoản (Auth & Users)**: 
  * Đăng nhập phân quyền (Admin / Manager / Tenant / Guest).
  * Chặn truy cập trái phép bằng JWT. 
  * Quản lý tài khoản khách thuê (Tenant Accounts) độc lập với thông tin khách lưu trú.
* **🏠 Phân hệ Quản lý Phòng trọ (Rooms)**: 
  * Quản lý thông tin chi tiết phòng trọ (Tầng, Diện tích, Giá phòng, Tiện ích).
  * Trạng thái phòng (`Trống`, `Đang thuê`, `Bảo trì`).
  * Khả năng upload và hiển thị ảnh thực tế cho từng phòng.
* **👥 Phân hệ Quản lý Khách thuê (Tenants & Contracts)**: 
  * Lưu trữ hồ sơ thông tin cá nhân khách thuê (Họ tên, SĐT, CCCD, Email). 
  * Quản lý hợp đồng (Tenancy) và ghi nhận người đứng tên chính, người ở ghép.
* **⚡ Phân hệ Chỉ số Điện nước (Meter Readings)**: 
  * Ghi nhận lịch sử điện nước tiêu thụ thực tế hàng tháng của từng phòng. 
  * Tự động ràng buộc chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ để tránh số âm.
* **🧾 Phân hệ Quản lý Hóa đơn (Invoices)**: 
  * Lập phiếu thu tự động cho từng phòng. 
  * Hỗ trợ **xuất mã QR** (chuẩn UTF-8 không lỗi font). 
  * Tích hợp **Webhook SePay** tự động xác nhận đã thanh toán khi khách chuyển khoản.
* **💬 Hệ thống Nhắn tin & AI Chatbot (Chat & AI)**:
  * Trò chuyện 2 chiều giữa Khách thuê và Chủ nhà (Real-time).
  * Tích hợp AI Chatbot hỗ trợ tự động trả lời và tư vấn thông tin dựa trên AI.
* **🔔 Trung tâm Thông báo (Notification & Feedback Center)**: 
  * Gửi thông báo từ Admin tới Tất cả hoặc 1 Khách thuê cụ thể. 
  * Có hệ thống Lưu trữ (Archive) và Đánh dấu Đã đọc (Read/Unread) riêng biệt cho Admin và Tenant.
* **🛠️ Phân hệ Báo hỏng & Sửa chữa (Repair Requests)**: 
  * Tiếp nhận sự cố dịch vụ từ khách thuê. 
  * Admin có thể cập nhật trạng thái xử lý (Mới -> Đang xử lý -> Hoàn thành).

---

## 2. Sơ đồ Cấu trúc & Tài liệu

* **Sơ đồ Thực thể Liên kết (ERD)**: Xem chi tiết cấu trúc bảng và CSDL tại file [ERD.md](./ERD.md).
* **Tài liệu API**: Danh sách toàn bộ Endpoints của Backend xem tại file [API.md](./API.md).
* **Workflow CI**: Tự động kiểm tra lỗi (Linting) và Chạy Unit Test qua Github Actions tại `.github/workflows/ci.yml`.

---

## 3. Công Nghệ Áp Dụng (Tech Stack)

* **Client (Frontend)**: ReactJS v18+, Vite, TypeScript, TailwindCSS, Lucide Icons.
* **Server (Backend)**: Node.js v20+, Express framework, JWT Authentication, Multer (Upload ảnh).
* **Database**: SQLite3 (Lưu trữ dữ liệu tại `server/csdl_hostelmate.sqlite`).
* **Tính năng Realtime**: Long-polling đảm bảo cập nhật thông báo và tin nhắn cho Khách thuê không bị trễ.
* **CI/CD**: Tích hợp GitHub Actions cho test và lint.

---

## 4. Cấu Trúc Thư Mục Dự Án

Cấu trúc thư mục được chia thành hai phần chính biệt lập: **Frontend (React/Vite)** và **Backend (Node.js/Express)**.

### A. Phân Tích Backend (`/server`)

Thư mục `server` chứa toàn bộ mã nguồn xử lý logic nghiệp vụ, kết nối cơ sở dữ liệu và cung cấp RESTful APIs. 

```text
server/
├── migrations/                # Kịch bản cập nhật CSDL (001_initial_schema.sql, 005_notifications.sql...)
├── uploads/                   # Nơi lưu trữ ảnh đại diện, tệp tin tải lên.
├── csdl_hostelmate.sqlite     # File cơ sở dữ liệu SQLite chính của hệ thống. 
├── db.js                      # Cấu hình kết nối Database và tự động chạy file migrations.
├── server.js                  # FILE CỐT LÕI (Core Entry). Định nghĩa toàn bộ Router (Express App), JWT.
├── package.json               # Khai báo dependencies của Backend.
└── tests/                     # Chứa bộ Unit Test cho API.
```

### B. Phân Tích Frontend (`/src`)

Thư mục `src` chứa mã nguồn giao diện người dùng, sử dụng **React (TypeScript)**, giao diện **TailwindCSS**, và bundled bằng **Vite**.

```text
src/
├── App.tsx                    # File Root Component định tuyến (Routing) và quản lý State phân quyền.
├── main.tsx                   # Điểm khởi chạy của React DOM.
├── lib/                       # Chứa thư viện & cấu hình tiện ích
│   └── api.ts                 # Định nghĩa toàn bộ hàm gọi API kết nối tới Backend.
├── context/                   # Chứa React Context (Quản lý State toàn cục, AuthContext)
├── components/                # Chứa các UI Components (AiChatbot, Sidebar, Modal, RoomCard...)
├── pages/                     # Giao diện của từng trang (Phân chia Admin và Tenant)
│   ├── (Admin Pages)
│   │   ├── Dashboard, Rooms, Tenants, TenantAccounts, Invoices, MeterReadings, Repairs
│   │   ├── NotificationsAdmin, ChatAdmin, UserManagement
│   ├── (Tenant Pages)
│   │   ├── TenantDashboard, NotificationsTenant, ChatTenant
│   └── (Chung)
│       └── Login, MockPaymentGateway
└── types/                     # Định nghĩa TypeScript Interfaces (Models: Room, Tenant, Invoice...)
```

---

## 5. Hướng Dẫn Cài Đặt & Khởi Chạy Cục Bộ

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
* **Giao diện Web**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:5000](http://localhost:5000)

*Lưu ý: Nếu port 5173 bị chiếm, Vite có thể tự nhảy sang 5174, hãy xem log Terminal.*

---

## 6. Tài khoản Đăng nhập Test

* Lần đầu chạy hệ thống chưa có Admin, bạn hãy bấm vào **"Chưa có tài khoản? Khởi tạo Admin đầu tiên"** ngoài màn hình Login để tạo Admin.
* Khách thuê mới sẽ cần được Admin cấp quyền và gán vào một phòng cụ thể trong mục **Khách Thuê** và **Tài Khoản**.
