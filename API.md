# Tài liệu Danh sách REST API - HostelMate

Tài liệu này tổng hợp toàn bộ các API Endpoints được xây dựng bằng **Node.js + Express** và kết nối cơ sở dữ liệu **SQLite** của hệ thống HostelMate.

* **Base URL**: `http://localhost:5000`
* **Định dạng dữ liệu gửi nhận**: `JSON`
* **Xác thực**: Một số API yêu cầu JWT Header (`Authorization: Bearer <token>`).

---

## 1. Phân hệ Xác thực & Người dùng (Auth API)

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Đăng nhập hệ thống (Admin/Tenant) | `{ username, password }` |
| `POST` | `/api/auth/logout` | Đăng xuất (xóa cookie nếu có) | Không |
| `GET` | `/api/auth/me` | Lấy thông tin phiên đăng nhập hiện tại | Yêu cầu `Bearer Token` |
| `PUT` | `/api/auth/me` | Đổi mật khẩu hoặc cập nhật thông tin cá nhân | `{ currentPassword, newPassword, fullName }` |
| `GET` | `/api/admin/users` | (Admin) Lấy danh sách tài khoản hệ thống | Không |
| `POST` | `/api/admin/users` | (Admin) Tạo tài khoản mới (cấp cho Khách thuê) | `{ username, password, full_name, phone }` |

---

## 2. Phân hệ Quản lý Phòng trọ (Rooms API)

Quản lý thông tin chi tiết các phòng trọ, trạng thái thuê và sức chứa của phòng.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/rooms` | Lấy danh sách tất cả phòng trọ kèm thông tin khách thuê | Không |
| `GET` | `/api/rooms/:id` | Lấy thông tin chi tiết một phòng trọ cụ thể | `id` của phòng |
| `POST` | `/api/rooms` | Thêm phòng trọ mới | `{ room_number, floor, area_sqm, monthly_rent, status, description, max_occupants }` |
| `PUT` | `/api/rooms/:id` | Cập nhật thông tin phòng trọ | Các trường cần sửa đổi |
| `DELETE` | `/api/rooms/:id` | Xóa phòng trọ (kiểm tra ràng buộc hợp đồng) | `id` của phòng |

---

## 3. Phân hệ Quản lý Khách thuê (Tenants API)

Lưu trữ hồ sơ cá nhân khách thuê và tự động liên kết với tài khoản hệ thống.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tenants` | Lấy danh sách tất cả khách thuê trọ | Không |
| `GET` | `/api/tenants/:id` | Lấy chi tiết thông tin một khách thuê | `id` khách thuê |
| `POST` | `/api/tenants` | Thêm mới khách thuê (Tự động cấp mã KT) | `{ ho_ten, so_dien_thoai, email, cccd, ngay_sinh, que_quan, nguoi_lien_he_khan_cap, ghi_chu }` |
| `PUT` | `/api/tenants/:id` | Chỉnh sửa thông tin khách thuê | Các trường cần sửa đổi |
| `DELETE` | `/api/tenants/:id` | Xóa hồ sơ khách thuê | `id` khách thuê |

---

## 4. Phân hệ Hợp đồng & Thuê phòng (Assignments API)

Xử lý nghiệp vụ nhận phòng, trả phòng, đại diện phòng.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/room_assignments` | **Gán phòng** (Tạo hợp đồng thuê mới) | `{ room_id, tenant_id, start_date, deposit_amount, is_primary, notes, contract_end_date }` |
| `PUT` | `/api/room_assignments/:id/primary` | Thay đổi người đại diện phòng (trưởng phòng) | `{ room_id }` |
| `POST` | `/api/room_assignments/:id/end` | **Thanh lý hợp đồng** (Khách rời đi) | Không |
| `PUT` | `/api/room_assignments/:id/extend` | Gia hạn thời gian thuê phòng | `{ contract_end_date }` |
| `GET` | `/api/room_assignments/expiring` | Lấy danh sách hợp đồng sắp hết hạn | Query `?withinDays=30` |

---

## 5. Phân hệ Chỉ số Điện nước (Meter Readings API)

Theo dõi mức tiêu thụ hàng tháng của từng phòng.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/meter_readings` | Toàn bộ lịch sử chỉ số | Không |
| `GET` | `/api/meter_readings/room/:roomId` | Lịch sử chỉ số của 1 phòng | `roomId` |
| `GET` | `/api/meter_readings/latest/:roomId` | Chỉ số mới nhất của 1 phòng | `roomId` |
| `POST` | `/api/meter_readings` | **Nhập chỉ số mới** (Có kiểm tra số âm) | `{ room_id, reading_date, electricity_new, water_new, ... }` |
| `PUT` | `/api/meter_readings/:id` | Sửa chỉ số | Các trường cần đổi |
| `DELETE` | `/api/meter_readings/:id` | Xóa bản ghi chỉ số | `id` bản ghi |

---

## 6. Phân hệ Quản lý Hóa đơn & Thanh toán (Invoices API)

Tự động lập phiếu thu, hỗ trợ báo cáo thanh toán và Webhook tự động (SePay).

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/invoices` | Lấy tất cả hóa đơn | Không |
| `GET` | `/api/invoices/export` | **Xuất Excel/CSV** danh sách hóa đơn | Không |
| `GET` | `/api/invoices/:id` | Chi tiết hóa đơn | `id` hóa đơn |
| `POST` | `/api/invoices` | **Lập hóa đơn tháng mới** | `{ room_id, tenant_id, invoice_month, invoice_year, total_amount, ... }` |
| `PUT` | `/api/invoices/:id` | Sửa hóa đơn | Các trường cần đổi |
| `DELETE` | `/api/invoices/:id` | Xóa hóa đơn | `id` hóa đơn |
| `POST` | `/api/invoices/mark-overdue` | (Cronjob) Đánh dấu quá hạn các hóa đơn chưa trả | Không |
| `PUT` | `/api/invoices/:id/paid` | Đánh dấu thủ công đã thanh toán | Không |
| `POST` | `/api/invoices/:id/report-payment` | Khách thuê báo cáo đã chuyển khoản | Không |
| `PATCH` | `/api/admin/invoices/:id/confirm-payment`| Admin xác nhận đã nhận tiền | Không |
| `POST` | `/api/webhooks/sepay` | **Webhook tự động gạch nợ** (Kết nối SePay) | Payload chuẩn SePay |

---

## 7. Phân hệ Báo hỏng & Sửa chữa (Repair Requests API)

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/repair_requests` | Danh sách các yêu cầu sửa chữa | Không |
| `GET` | `/api/repair_requests/:id` | Chi tiết yêu cầu | `id` yêu cầu |
| `POST` | `/api/repair_requests` | Tạo yêu cầu báo hỏng mới | `{ room_id, tenant_id, title, description, priority }` |
| `PUT` | `/api/repair_requests/:id` | Cập nhật tiến độ (Đang xử lý / Đã xong) | `{ status, resolution_notes }` |
| `DELETE` | `/api/repair_requests/:id` | Xóa yêu cầu | `id` yêu cầu |

---

## 8. Phân hệ Trung tâm Thông báo (Notifications API)

Luồng thông báo và phản hồi 2 chiều giữa Admin và Khách thuê.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/notifications` | (Admin) Gửi thông báo cho Tất cả hoặc Cá nhân | `{ title, content, targetType, targetTenantId }` |
| `GET` | `/api/notifications/my` | Lấy danh sách thông báo (tự phân quyền Admin/Tenant) | Không |
| `GET` | `/api/notifications/:id` | Lấy chi tiết thông báo và luồng phản hồi | `id` thông báo |
| `PATCH` | `/api/notifications/:id/read` | (Tenant) Đánh dấu đã đọc thông báo | Không |
| `POST` | `/api/notifications/:id/replies`| Gửi phản hồi vào luồng thông báo | `{ content }` |

---

## 9. Phân hệ Cài đặt Hệ thống (Settings API)

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/settings` | Lấy các thiết lập hệ thống (Giá điện, Giá nước mặc định, TT Thanh toán) | Không |
| `PUT` | `/api/settings` | Lưu thay đổi thiết lập hệ thống | `JSON key-value` |
| `GET` | `/api/landlord/contact` | Lấy thông tin liên hệ của chủ trọ | Không |
