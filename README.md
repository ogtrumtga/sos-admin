# SOS Rescue Admin

Web quản trị React + Vite, kết nối FastAPI/PostgreSQL của dự án trong `../JavaBackend/SOS_Android/backend`.

## Chức năng

- Đăng nhập bằng số điện thoại và OTP Telegram. Chỉ tài khoản `ACTIVE` có thành viên đội với `role = 'ADMIN'` được vào trang quản trị.
- Bản đồ Leaflet/OpenStreetMap: SOS công khai và riêng tư, tọa độ chính xác, bộ lọc trạng thái, tìm kiếm, chọn điểm xem chi tiết/liên hệ, tự cập nhật mỗi 15 giây. SOS thiếu tọa độ vẫn xuất hiện trong danh sách.
- CRUD rescuer theo thành viên đội, gán đội và vai trò `ADMIN/LEADER/MEMBER/DRIVER/MEDIC`. Xóa rescuer gỡ thành viên, giữ tài khoản.
- CRUD đội cứu hộ; xem danh sách đội viên; trạng thái BUSY được quản lý theo ca SOS.
- CRUD người dùng, khóa/mở khóa, tìm kiếm và phân trang. Giữ lịch sử SOS bằng ràng buộc xóa của database.
- Kiểm tra quyền ở backend cho mọi API `/api/admin/*`. Thu hồi ADMIN hoặc khóa tài khoản có hiệu lực với token đang dùng; tự khóa/xóa quyền ADMIN cuối cùng bị chặn. LEADER Android không được sửa/xóa ADMIN.

## Chuẩn bị backend và cấp ADMIN đầu tiên

Chạy PowerShell trong thư mục backend:

```powershell
cd D:\FinalJava\JavaBackend\SOS_Android\backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe database/migrate_admin.py
```

Migration chỉ mở rộng CHECK role, không reset database và không tự cấp quyền cho bất kỳ tài khoản nào. Migration đã được áp dụng trong workspace này.

Cấp quyền cho **một rescuer đã tồn tại** (thay số điện thoại bằng số cần dùng):

```powershell
.\.venv\Scripts\python.exe database/migrate_admin.py --phone 09xxxxxxxx
```

Nếu rescuer thuộc nhiều đội, thêm `--team-id UUID_CUA_DOI`. Lệnh chuyển vai trò thành viên đã chọn sang `ADMIN`; không tạo tài khoản. ADMIN vẫn có thể đăng nhập Android bằng vai trò RESCUER và giữ quyền quản lý đội viên trong đội mình. API Android không cho phép chỉnh sửa hoặc xóa thành viên ADMIN; dùng trang quản trị cho các thao tác này.

File `.env` backend tiếp tục dùng các cấu hình PostgreSQL, JWT và Telegram hiện có. Khi dùng OTP thật, đặt `DEV_MOCK_OTP=false`, cấu hình `TELEGRAM_BOT_TOKEN` và liên kết Telegram cho số điện thoại. Chế độ phát triển `DEV_MOCK_OTP=true` trả `dev_otp`, UI hiển thị mã để thử luồng đăng nhập; không dùng cấu hình này cho triển khai thật. OTP nằm trong RAM nên chạy một worker backend cho cơ chế OTP hiện tại.

## Chạy phát triển

Terminal 1, trong thư mục backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2:

```powershell
cd D:\FinalJava\Admin
npm install
npm run dev
```

Mở **http://127.0.0.1:5173/**. Vite proxy `/api` sang `http://127.0.0.1:8000`.

Nếu backend ở địa chỉ khác, sao chép `.env.example` thành `.env`, sửa `API_PROXY_TARGET` và khởi động lại Vite. `VITE_API_BASE_URL` chỉ cần khi frontend gọi trực tiếp một backend khác origin; đây là biến build công khai, không chứa secret.

## Chạy bản build với một server

```powershell
cd D:\FinalJava\Admin
npm run build
cd D:\FinalJava\JavaBackend\SOS_Android\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Mở **http://127.0.0.1:8000/admin/**. FastAPI tự phục vụ `Admin/dist` khi thư mục build có sẵn lúc khởi động. Nếu chuyển vị trí thư mục, cấu hình `ADMIN_DIST_DIR` trong `.env` backend thành đường dẫn tuyệt đối đến `dist`. API Android và `/docs` tiếp tục ở địa chỉ cũ. Dùng HTTPS khi triển khai bên ngoài máy phát triển.

## Kiểm tra

```powershell
cd D:\FinalJava\Admin
npm run build
cd D:\FinalJava\JavaBackend\SOS_Android\backend
.\.venv\Scripts\python.exe -m unittest test_admin test_team_members test_rescuer_map -v
```

Các kiểm thử trên tạo schema PostgreSQL riêng, mô phỏng gửi Telegram, rồi dọn schema; không sửa dữ liệu ứng dụng. Cần quyền `CREATE SCHEMA` với kết nối database hiện tại.

Nền bản đồ OpenStreetMap và font Google cần Internet; lỗi tải nền bản đồ có thông báo và danh sách SOS vẫn sử dụng được.

## API quản trị

| Endpoint | Phương thức | Chức năng |
| --- | --- | --- |
| `/api/auth/request-otp` | POST | Gửi `{phone, role: "ADMIN"}` |
| `/api/auth/verify-otp` | POST | Gửi `{phone, otp, role: "ADMIN"}`; vai trò phải trùng lúc xin OTP |
| `/api/admin/me` | GET | Xác thực phiên quản trị |
| `/api/admin/overview` | GET | Số liệu tổng quan |
| `/api/admin/sos` | GET | SOS và vị trí hiện tại; `q`, `status` |
| `/api/admin/users` | GET, POST | Tìm kiếm/phân trang, thêm tài khoản |
| `/api/admin/users/{id}` | PUT, DELETE | Sửa/xóa tài khoản |
| `/api/admin/rescuers` | GET, POST | Tìm kiếm/phân trang, thêm thành viên đội |
| `/api/admin/rescuers/{member_id}` | PUT, DELETE | Sửa/xóa thành viên đội |
| `/api/admin/teams` | GET, POST | Tìm kiếm/phân trang, thêm đội |
| `/api/admin/teams/{team_id}` | PUT, DELETE | Sửa/xóa đội |

Các API danh sách quản lý nhận `q`, `page`, `page_size` (tối đa 200), thêm `status` cho users/teams, `role` và `team_id` cho rescuers. Chi tiết schema request nằm trong Swagger tại `/docs`.
