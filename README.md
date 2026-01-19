# 🕒 TÍN VIỆT TIMESHEET MANAGEMENT SYSTEM

> Hệ thống quản lý chấm công, phân công công việc và báo cáo tự động dành cho doanh nghiệp nội bộ.

![NodeJS](https://img.shields.io/badge/Node.js-18.x-green)
![SQLite](https://img.shields.io/badge/Database-SQLite3-blue)
![Status](https://img.shields.io/badge/Status-Completed-brightgreen)

## 🌟 Tính năng nổi bật

### 1. Dành cho Nhân viên
* **Khai báo công việc (Timesheet):** Giao diện timeline trực quan, kéo thả dễ dàng.
* **Validation thông minh:** Chặn nhập liệu sai giờ, chặn nhập ngoài khung giờ cho phép (23h - 6h).
* **Gợi ý thông minh:** Tự động nhắc các Job Code đã làm trong ngày.

### 2. Dành cho Quản trị viên (Admin)
* **Quản lý Đa cấp:**
    * **Admin Tổng:** Quản lý toàn bộ hệ thống, tạo phòng ban động.
    * **Admin Phòng ban:** Chỉ quản lý nhân sự và Job thuộc phòng mình.
* **Quản lý Job Code:** Tạo/Xóa/Ẩn mã công việc theo từng phòng ban.
* **Xuất Báo cáo Excel (Advanced):**
    * Báo cáo chấm công nhân viên (Tự động gộp dòng mô tả).
    * Báo cáo tổng hợp Job (Tự động sinh Sheet theo phòng ban).

## 🚀 Hướng dẫn Cài đặt & Chạy

### Yêu cầu
* Node.js (v14 trở lên)
* Git

### Bước 1: Clone dự án
git clone [https://github.com/TYLERfromvn21/TQD_Timesheet_management_app.git](https://github.com/TYLERfromvn21/TQD_Timesheet_management_app.git)

### Bước 2: Cài đặt thư viện
Bash

npm install
### Bước 3: Chạy ứng dụng
# Chạy trực tiếp
node app.js

# Hoặc chạy với PM2 (Khuyên dùng)
pm2 start app.js
Truy cập: http://localhost:3000

##🔐 Tài khoản Mặc định (Demo)
Nếu hệ thống chạy lần đầu (First Run), bạn truy cập trang chủ sẽ được chuyển hướng để tạo Admin Tổng đầu tiên.

##🛡️ Bảo mật & Tiện ích
Rate Limiting: Chống spam request (Max 200 req/15p).

##Session Timeout: Tự động đăng xuất sau 24h.

Data Validation: Kiểm tra dữ liệu chặt chẽ ở cả Frontend và Backend.
