# Hướng Dẫn Cài Đặt, Khởi Chạy Dự Án & Cài Đặt Trình Xem SQLite

Tài liệu này hướng dẫn chi tiết cách cài đặt môi trường, khởi chạy hệ thống HostelMate và cài đặt công cụ quản trị giao diện để quản lý cơ sở dữ liệu SQLite (`csdl_hostelmate.sqlite`).

---

## 1. Hướng Dẫn Cài Đặt Trình Xem Cơ Sở Dữ Liệu SQLite (DB Browser for SQLite)

Do SQLite là hệ quản trị cơ sở dữ liệu dạng file (không chạy dạng dịch vụ ngầm như MySQL hay SQL Server), bạn cần một ứng dụng giao diện (GUI) để mở và xem dữ liệu bên trong các bảng.

Công cụ tốt nhất, hoàn toàn miễn phí và phổ biến nhất là **DB Browser for SQLite**.

### 🛠️ Các bước tải và sử dụng:

1. **Bước 1: Tải ứng dụng**
   Truy cập trang chủ chính thức hoặc tải trực tiếp theo các liên kết dưới đây:
   * **Trang chủ**: [https://sqlitebrowser.org/dl/](https://sqlitebrowser.org/dl/)
   * **Bản cài đặt thông thường (Standard 64-bit Windows)**: [Tải File .msi](https://github.com/sqlitebrowser/sqlitebrowser/releases/download/v3.12.2/DB.Browser.for.SQLite-3.12.2-win64.msi)
   * **Bản chạy ngay không cần cài đặt (Portable 64-bit Windows)**: [Tải File .zip](https://github.com/sqlitebrowser/sqlitebrowser/releases/download/v3.12.2/DB.Browser.for.SQLite-3.12.2-win64.zip) *(Khuyên dùng: Giải nén ra là chạy được ngay, không cần cài đặt vào hệ thống)*.

2. **Bước 2: Mở file Cơ sở dữ liệu của dự án**
   * Mở ứng dụng **DB Browser for SQLite** vừa tải về.
   * Nhấn nút **Open Database** (Mở cơ sở dữ liệu) ở góc trên bên trái màn hình.
   * Tìm đến đường dẫn file SQLite của dự án tại:
     `e:\Quan Li Phong Tro\HostelMate\server\csdl_hostelmate.sqlite`
   * Chọn file và nhấn **Open**.

3. **Bước 3: Xem và truy vấn dữ liệu**
   * **Database Structure (Cấu trúc DB)**: Xem danh sách các bảng bằng tiếng Việt như: `phong`, `khach_thue`, `hop_dong_thue`, `chi_so_dien_nuoc`, `hoa_don`, `yeu_cau_sua_chua`.
   * **Browse Data (Duyệt dữ liệu)**: Chọn bảng mong muốn để xem trực tiếp các dòng dữ liệu dạng bảng Excel.
   * **Execute SQL (Thực thi SQL)**: Gõ các câu lệnh SQL truy vấn thủ công theo nhu cầu của bạn.

---

## 2. Hướng Dẫn Cài Đặt & Khởi Chạy Dự Án Cục Bộ

### Bước 1: Khai báo Node.js Portable vào biến môi trường PATH
Mở PowerShell tại thư mục gốc dự án `HostelMate` và thực hiện lệnh:
```powershell
$env:PATH = "e:\Quan Li Phong Tro\HostelMate\.node-portable;" + $env:PATH
```

### Bước 2: Cài đặt thư viện (Dependencies)
```powershell
# Cài đặt thư viện của root và frontend
npm install

# Cài đặt thư viện của backend server
npm --prefix server install
```

### Bước 3: Khởi chạy dự án
```powershell
npm run dev:all
```
* **Frontend React (HostelMate)**: Mở trình duyệt truy cập [http://localhost:5174/](http://localhost:5174/)
* **Backend API Express**: Chạy ngầm tại [http://localhost:5000/](http://localhost:5000/)

---

## 3. Hướng Dẫn Chạy Kiểm Thử (Unit Test & Lint)

Mở PowerShell tại thư mục `HostelMate` (đã nạp PATH ở bước 2):

* **Chạy kiểm tra code style (Linter)**:
  ```powershell
  npm run lint
  ```
* **Chạy 40 bài Unit Test backend & in báo cáo độ phủ mã nguồn (Coverage)**:
  ```powershell
  npm run test:server
  ```
  *(Độ phủ dòng code hiện tại đạt **84.81%**, vượt tiêu chuẩn tối thiểu **70%**).*
