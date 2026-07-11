# Quy trình Phát triển Phần mềm (SDLC) - HostelMate

Tài liệu này định nghĩa quy trình phát triển (SDLC), tiêu chuẩn chất lượng (Definition of Done), quy định commit (Commit Convention) và luồng làm việc với Git (Git Workflow) của dự án HostelMate.

---

## 1. Git Branching Workflow

Dự án áp dụng luồng làm việc **Git Flow** rút gọn để quản lý mã nguồn hiệu quả:

* **`main`**: Nhánh chứa mã nguồn ổn định nhất, sẵn sàng triển khai lên môi trường Production. Mọi commit trên `main` đều phải được gắn tag phiên bản (e.g. `v1.0.0`).
* **`develop`**: Nhánh phát triển chính. Tất cả mã nguồn mới từ các tính năng sẽ được tích hợp tại đây trước khi kiểm thử nghiệm thu.
* **`feature/*`**: Các nhánh tính năng riêng biệt (e.g. `feature/country-code-phone`, `feature/year-picker`). Được tách ra từ `develop` và merge lại vào `develop` qua Pull Request sau khi hoàn thành.
* **`bugfix/*` / `hotfix/*`**: Nhánh sửa lỗi khẩn cấp.
  - `bugfix/*` dùng để sửa lỗi trên `develop`.
  - `hotfix/*` tách trực tiếp từ `main` để sửa lỗi khẩn cấp trên Production, sau đó merge đồng thời vào `main` và `develop`.

---

## 2. Commit Convention

Chúng tôi áp dụng chuẩn **Angular Commit Convention** để viết mô tả commit ngắn gọn, dễ tra cứu lịch sử thay đổi:

### Định dạng thông điệp commit:
```text
<type>(<scope>): <subject>
```

* **`type`** (Bắt buộc):
  - `feat`: Tính năng mới (Feature).
  - `fix`: Sửa lỗi (Bug fix).
  - `docs`: Tài liệu hướng dẫn (Documentation).
  - `style`: Định dạng code (whitespace, formatting, missing semi-colons, v.v. - không đổi logic).
  - `refactor`: Tái cấu trúc mã nguồn (không thêm tính năng hay sửa lỗi).
  - `test`: Thêm hoặc chỉnh sửa unit test (Testing).
  - `chore`: Thay đổi quy trình build, package config, hoặc cấu hình CI (CI/CD, build tools).
* **`scope`** (Tùy chọn): Phạm vi thay đổi (e.g. `backend`, `frontend`, `invoices`, `rooms`).
* **`subject`** (Bắt buộc): Mô tả ngắn bằng tiếng Việt hoặc tiếng Anh (viết thường, không có dấu chấm ở cuối).

### Ví dụ:
* `feat(tenants): thêm bộ chọn mã quốc gia cho số điện thoại`
* `fix(rooms): ngăn xóa phòng khi có khách thuê đang ở`
* `test(backend): viết test case cho api chỉ số điện nước`
* `chore(ci): thiết lập github actions chạy lint và jest test`

---

## 3. Definition of Done (DoD) - Định nghĩa Hoàn thành

Một tính năng hoặc nhiệm vụ (Task/Feature) chỉ được coi là **Đã hoàn thành (Done)** và sẵn sàng bàn giao khi đáp ứng đủ các tiêu chí sau:

1. **Mã nguồn (Coding)**: Code được viết sạch sẽ, tuân thủ kiến trúc dự án và không chứa các biến dư thừa.
2. **Kiểm tra tĩnh (Linting)**: Code chạy lệnh `npm run lint` thành công, không có bất kỳ lỗi (0 errors) cảnh báo nghiêm trọng nào.
3. **Kiểm thử đơn vị (Unit Test)**: 
   - Có đầy đủ các ca kiểm thử (test cases) bao phủ các luồng xử lý chính và các trường hợp biên/ngoại lệ.
   - Lệnh chạy thử nghiệm `npm test` vượt qua 100% (All tests passed).
4. **Độ phủ mã nguồn (Code Coverage)**: Độ phủ dòng lệnh (Line coverage) của backend API đạt tối thiểu **70%** (khuyến khích trên 80%).
5. **Tích hợp liên tục (CI)**: Mã nguồn đẩy lên GitHub phải chạy thành công luồng CI (GitHub Actions báo xanh).
6. **Tài liệu (Documentation)**: Cập nhật đầy đủ tài liệu hướng dẫn vận hành (`walkthrough.md`, `INSTALL_GUIDE.md`) nếu có thay đổi về thiết lập.

---

## 4. Đo lường & Giám sát Chất lượng

* **Kiểm tra cục bộ trước khi commit**:
  ```powershell
  # Chạy kiểm tra code style
  npm run lint
  
  # Chạy test suite và in báo cáo coverage
  npm run test:server
  ```
* **Chạy tự động qua GitHub Actions**: 
  - Mọi Pull Request muốn merge vào `develop` hoặc `main` đều phải được chạy kiểm tra tự động qua luồng CI trên đám mây.
  - Kết quả kiểm thử và độ phủ mã nguồn sẽ được hiển thị trực tiếp trên giao diện GitHub PR để người quản lý phê duyệt.
