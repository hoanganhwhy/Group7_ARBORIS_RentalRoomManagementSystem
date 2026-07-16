# Báo Cáo Tổng Quan Dự Án & Quy Trình Phát Triển (SDLC)

> [!NOTE]
> Tài liệu này cung cấp cái nhìn tổng quan về kiến trúc phần mềm, ngăn xếp công nghệ (Tech Stack) và chi tiết các quy trình phát triển được áp dụng trong dự án (SDLC, CI/CD, Testing) phục vụ cho việc báo cáo.

## 1. Tổng quan dự án
**ARBORIS HostelMate** là một hệ thống phần mềm quản lý phòng trọ toàn diện, được thiết kế để giải quyết bài toán quản lý vận hành khu trọ giữa Chủ nhà (Admin) và Người thuê (Tenant). 
Hệ thống số hóa các quy trình thủ công như: quản lý hợp đồng, tính toán điện nước, lập hóa đơn, theo dõi yêu cầu sửa chữa và đặc biệt là tích hợp Trợ lý ảo AI cùng hệ thống thanh toán tự động VietQR.

## 2. Kiến trúc & Công nghệ (Tech Stack)
Dự án áp dụng mô hình Client-Server hiện đại:
- **Frontend (Client):** Xây dựng bằng thư viện **React** (thông qua Vite) kết hợp với **TailwindCSS** để tạo giao diện người dùng (UI) tương tác, chuẩn Glassmorphism.
- **Backend (Server):** Xây dựng hệ thống **RESTful API** bằng **Node.js** kết hợp với framework **Express.js**, đảm nhiệm xử lý logic nghiệp vụ, xác thực (JWT) và tương tác với AI.
- **Cơ sở dữ liệu (Database):** Sử dụng **SQLite**, cấu trúc dữ liệu quan hệ nhẹ nhàng, tốc độ cao, phù hợp với quy mô dự án và dễ dàng triển khai.
- **Tích hợp bên thứ ba:** Google Gemini AI (Chatbot), SePay (Webhook tự động xác nhận thanh toán).

---

## 3. Quy trình phát triển phần mềm (SDLC)
Dự án áp dụng vòng đời phát triển phần mềm lặp lại (Iterative) kết hợp tinh thần Agile nhằm đảm bảo tiến độ và linh hoạt với thay đổi.

### 3.1. Git Workflow rõ ràng
Áp dụng mô hình **Feature Branch Workflow** (dựa trên Git Flow cơ bản):
- `main`: Nhánh chứa mã nguồn ổn định, luôn sẵn sàng để deploy lên production.
- `develop`: Nhánh tích hợp chính. Mọi tính năng mới đều được gộp (merge) vào đây để kiểm thử trước khi đưa lên `main`.
- `feature/*`: Các nhánh phát triển tính năng mới (ví dụ: `feature/ai-chatbot`, `feature/vietqr-payment`). Khi hoàn thành sẽ tạo Pull Request (PR) để gộp vào `develop`.
- `hotfix/*`: Nhánh sửa lỗi khẩn cấp trực tiếp từ `main`.

### 3.2. Commit Convention (Chuẩn mực commit)
Sử dụng **Conventional Commits** để lịch sử git rõ ràng và dễ tự động hóa việc tạo changelog:
- `feat:` Thêm tính năng mới (vd: *feat: add jwt authentication*)
- `fix:` Sửa lỗi (vd: *fix: resolve address not showing in chatbot*)
- `refactor:` Tái cấu trúc code nhưng không làm thay đổi logic (vd: *refactor: clean up unused variables*)
- `test:` Thêm hoặc sửa Unit test
- `docs:` Cập nhật tài liệu
- `chore:` Các thay đổi về cấu hình, công cụ build (vd: *chore: setup eslint*)

---

## 4. Đảm bảo chất lượng (Quality Assurance & CI/CD)

### 4.1. Unit Test bằng Jest
- Mọi logic nghiệp vụ cốt lõi ở Backend (ví dụ: tính toán tiền điện nước, xử lý JWT, logic phân quyền) đều được viết **Unit Test bằng Jest**.
- **Mục tiêu độ phủ mã (Code Coverage):** Đạt tối thiểu **70%**. Các bài test phải cover được cả luồng thành công (happy path) và luồng lỗi (edge cases/error handling).

### 4.2. Kiểm tra chất lượng Code (Code Quality)
- Cấu hình **ESLint** để tự động kiểm tra cú pháp, phát hiện sớm các lỗi tiềm ẩn (code smells) và ép chuẩn coding style chung cho toàn bộ thành viên dự án (ví dụ: không dùng biến chưa khai báo, bắt buộc có type ở những nơi cần thiết).

### 4.3. Tự động hóa CI/CD với GitHub Actions
- Thiết lập một Pipeline CI cơ bản bằng **GitHub Actions**.
- **Trigger:** Mỗi khi có mã nguồn được `push` hoặc có **Pull Request** trỏ vào nhánh `develop` hoặc `main`.
- **Jobs thực thi:** 
  1. Cài đặt dependencies (`npm install`).
  2. Chạy ESLint (`npm run lint`).
  3. Chạy Unit Test (`npm run test`) và kiểm tra báo cáo Coverage.
- Nhờ vậy, code bị lỗi hoặc không đạt 70% coverage sẽ bị chặn (Block) không cho phép merge.

---

## 5. Tiêu chuẩn hoàn thành (Definition of Done - DoD)
Một task/chức năng chỉ được coi là "Hoàn thành" khi thỏa mãn tất cả các điều kiện sau:
1. Code đã được push lên nhánh feature tương ứng và tạo Pull Request.
2. Code tuân thủ coding style và **vượt qua kiểm tra của ESLint** mà không có lỗi (Error).
3. Viết đầy đủ Unit Test cho logic mới và **vượt qua toàn bộ Test cases**.
4. Báo cáo **Coverage đạt tối thiểu 70%**.
5. Pass toàn bộ Pipeline CI trên **GitHub Actions**.
6. Được Review và Approve bởi ít nhất 1 thành viên khác trong nhóm.
7. Chức năng hoạt động đúng mô tả trên môi trường Staging/Dev.

## 6. Đo lường ban đầu (Initial Metrics)
Để đánh giá hiệu quả của quy trình, dự án tiến hành đo lường các chỉ số sau trong giai đoạn đầu:
- **Velocity:** Số lượng task/chức năng hoàn thành trong mỗi chu kỳ (Sprint/Tuần).
- **Test Coverage:** Theo dõi tỷ lệ phần trăm code được test (luôn giữ >= 70%).
- **Build Success Rate:** Tỷ lệ số lần CI/CD Pipeline chạy thành công so với thất bại, giúp đánh giá độ ổn định của mã nguồn.
- **Bugs reported:** Số lượng lỗi phát sinh sau khi merge vào nhánh chính. Mức độ nghiêm trọng của lỗi.
