<<<<<<< HEAD
# HostelMate - Hệ Thống Quản Lý Phòng Trọ Chuyên Nghiệp

HostelMate là giải pháp phần mềm quản lý phòng trọ, căn hộ dịch vụ và nhà cho thuê toàn diện, được xây dựng trên nền tảng **React (Frontend)** và **Node.js Express + SQLite (Backend)**. 

Dự án tích hợp đầy đủ quy trình kiểm thử tự động (Unit Test), kiểm tra tĩnh code style (ESLint), tài liệu phát triển (SDLC), và luồng tích hợp liên tục (GitHub Actions CI) đảm bảo chất lượng vận hành cao nhất.

---

## 1. Các Phân Hệ & Tính Năng Chính

* **🏠 Phân hệ Quản lý Phòng trọ (Rooms API)**: Theo dõi thông tin chi tiết các phòng trọ, số tầng, diện tích, giá phòng, trạng thái phòng (`available`, `occupied`, `maintenance`) và sức chứa tối đa. Chặn xóa phòng nếu đang có người thuê.
* **👥 Phân hệ Quản lý Khách thuê (Tenants API)**: Lưu trữ hồ sơ thông tin cá nhân khách thuê, tích hợp mã số điện thoại quốc gia định dạng chuẩn E.164 (mặc định Việt Nam `+84` và hỗ trợ nhiều quốc gia khác).
* **📄 Phân hệ Hợp đồng & Thuê phòng (Room Assignments API)**: Thực hiện nghiệp vụ check-in nhận phòng, gán khách thuê đại diện (chịu trách nhiệm chính), gia hạn thời hạn hợp đồng và thanh lý hợp đồng (check-out) tự động cập nhật trạng thái phòng.
* **⚡ Phân hệ Chỉ số Điện nước (Meter Readings API)**: Ghi nhận lịch sử tiêu thụ số điện, số nước tiêu thụ thực tế hàng tháng của từng phòng. Hệ thống tự động ràng buộc chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ để tránh số âm.
* **🧾 Phân hệ Quản lý Hóa đơn (Invoices API)**: Tự động hóa việc lập phiếu thu tiền phòng trọ và dịch vụ (tiền phòng + điện + nước + chi phí khác). Cho phép chọn linh hoạt **Tháng/Năm** qua dropdown tránh nhầm lẫn và tích hợp tính năng **xuất hóa đơn Excel/CSV** chuẩn UTF-8 BOM hiển thị đầy đủ tiếng Việt không lỗi font.
* **🛠️ Phân hệ Báo hỏng & Sửa chữa (Repair Requests API)**: Tiếp nhận sự cố dịch vụ từ khách thuê (thiết bị hỏng hóc trong phòng). Nghiệp vụ ràng buộc người báo hỏng phải là khách thuê đang ở thực tế trong phòng đó.

---

## 2. Công Nghệ Áp Dụng (Tech Stack)

* **Client**: ReactJS v18+, Vite, TypeScript, Lucide Icons, Vanilla CSS.
* **Server**: Node.js v20+, Express framework.
* **Database**: SQLite3 (sử dụng thư viện `sqlite3` kết nối trực tiếp nhẹ nhàng, lưu trữ tại `server/csdl_hostelmate.sqlite`).
* **Quality Assurance / Testing**:
  - **Jest & Supertest**: Chạy 40 unit tests kiểm thử API tự động trên bộ nhớ (:memory:), cô lập hoàn toàn.
  - **ESLint**: Quét tĩnh toàn bộ dự án, đồng bộ hóa quy tắc viết code trên cả frontend và backend.
* **DevOps**: GitHub Actions (Tự động chạy CI kiểm thử và rà soát độ phủ mã nguồn tối thiểu 70% mỗi khi Push hoặc PR).

---

## 3. Cấu Trúc Thư Mục Dự Án

```text
HostelMate/
├── .github/
│   └── workflows/
│       └── ci.yml               # Cấu hình GitHub Actions CI chạy tự động
├── server/
│   ├── tests/
│   │   └── server.test.js       # Bộ 40 unit test cases backend
│   ├── csdl_hostelmate.sqlite   # Cơ sở dữ liệu SQLite chính của ứng dụng
│   ├── db.js                    # Kết nối database, tạo bảng và seed dữ liệu mẫu
│   ├── eslint.config.js         # Cấu hình quy tắc kiểm tra code style backend
│   ├── jest.config.js           # Cấu hình Jest test và ngưỡng coverage tối thiểu 70%
│   ├── package.json             # Khai báo thư viện phụ thuộc và script test backend
│   └── server.js                # Khởi tạo API server Express
├── src/                         # Mã nguồn giao diện người dùng (React Frontend)
│   ├── components/              # Các UI components dùng chung
│   ├── pages/                   # Các trang giao diện (Rooms, Tenants, Invoices...)
│   └── App.tsx                  # Khởi chạy giao diện chính
├── package.json                 # Cấu hình package và script khởi chạy toàn hệ thống
├── eslint.config.js             # Cấu hình quy tắc linter của root và frontend
├── SDLC.md                      # Tài liệu quy trình DoD, Git workflow, commit convention
├── mau_import_phong.csv         # File mẫu Excel/CSV danh sách phòng trọ
├── mau_import_khach_thue.csv    # File mẫu Excel/CSV danh sách khách thuê
├── tong_hop_excel_test_backend.csv  # Báo cáo Excel kết quả kiểm thử backend
├── file_test_case_nghiep_vu.csv # Bảng thiết kế Test Case nghiệp vụ điện nước chuẩn mẫu
└── README.md                    # Tài liệu hướng dẫn sử dụng và giới thiệu tổng quan
```

---

## 4. Hướng Dẫn Cài Đặt & Khởi Chạy Cục Bộ

### Bước 1: Khai báo Node.js Portable vào PATH (Dành cho máy chạy Windows)
Mở PowerShell tại thư mục `HostelMate` và thiết lập biến môi trường để sử dụng đúng bộ Node chạy di động được tích hợp:

```powershell
$env:PATH = "e:\Quan Li Phong Tro\HostelMate\.node-portable;" + $env:PATH
```

### Bước 2: Cài đặt Dependencies
```powershell
# Cài đặt thư viện của root và frontend
npm install

# Cài đặt thư viện của backend server
npm --prefix server install
```

### Bước 3: Khởi chạy Ứng dụng
```powershell
npm run dev:all
```
Lệnh trên sẽ chạy song song cả client và server:
* **Giao diện Client**: [http://localhost:5174](http://localhost:5174)
* **Backend API**: [http://localhost:5000](http://localhost:5000)

---

## 5. Hướng Dẫn Chạy Kiểm Thử & Kiểm Code Style

Đảm bảo mã nguồn của bạn sạch đẹp và vượt qua tất cả các bài test trước khi đẩy lên GitHub:

### A. Kiểm tra Code Style (Linter)
```powershell
npm run lint
```
*Yêu cầu nghiệm thu: Trả về thành công, không phát hiện lỗi cú pháp.*

### B. Chạy Unit Test Backend & In Báo Cáo Coverage
```powershell
npm run test:server
```
*Yêu cầu nghiệm thu: Vượt qua đầy đủ 40/40 test cases, độ phủ code (Coverage) hiển thị trên console phải đạt tối thiểu **70%** (Hiện tại đang đạt **84.81%**).*

---

## 6. Tiêu Chuẩn Phát Triển (SDLC)
Chi tiết xem tại tài liệu **[SDLC.md](file:///e:/Quan%20Li%20Phong%20Tro/HostelMate/SDLC.md)**, lưu ý 3 điểm chính:
1. **Git Workflow**: Chỉ merge code qua Pull Request vào các nhánh `develop` và `main` sau khi CI báo xanh.
2. **Commit Convention**: Commit bắt buộc theo chuẩn Angular (ví dụ: `feat(rooms): ...`, `fix(invoices): ...`).
3. **Definition of Done**: Một tính năng chỉ hoàn thành khi code sạch linter, test pass, coverage >= 70%, và chạy CI thành công.

