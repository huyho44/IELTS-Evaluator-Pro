# Triển khai MVP bằng Docker Compose

`compose.mvp.yml` độc lập với Compose phát triển cũ. Nó dùng volume database riêng, không tự gắn vào database local đang có dữ liệu. API, worker và frontend chạy riêng; PostgreSQL không publish cổng ra host. Queue/outbox dùng PostgreSQL bền vững, không yêu cầu Redis.

## Khởi động local

Docker Desktop/Engine phải đang chạy. Tại repo root:

```powershell
if (-not (Test-Path -LiteralPath .env.mvp)) { Copy-Item .env.mvp.example .env.mvp }
# Sửa POSTGRES_PASSWORD và AUTH_TOKEN_SECRET bằng chuỗi ngẫu nhiên riêng.
# Dùng ký tự URL-safe cho POSTGRES_PASSWORD vì được ghép trong DATABASE_URL.
docker compose --env-file .env.mvp -f compose.mvp.yml config --quiet
docker compose --env-file .env.mvp -f compose.mvp.yml up -d --build
docker compose --env-file .env.mvp -f compose.mvp.yml --profile tools run --rm seed
```

Mở http://localhost:8080. Nginx phục vụ SPA và chuyển `/api/` đến API cùng origin. Migration chạy bằng service riêng, API/worker chờ migration thành công. API dùng healthcheck kết nối database; frontend chờ API sẵn sàng.

Seed là dữ liệu demo tùy chọn, không phù hợp cho tài khoản production công khai dùng chung password. Với database mới dùng demo, đặt `DEMO_PASSWORD` riêng trong `.env.mvp`. Để tạo dữ liệu mẫu có AI config, đặt `DEMO_GRADING_PROVIDER=OPENAI` và `DEMO_GRADING_MODEL=<model đã được cấp quyền>` trước seed. Chỉ đặt key ở `.env.mvp`, không ghi vào Compose hay frontend. Có thể cấu hình prompt/model bằng trang Admin thay cho tùy chọn seed.

## Bật HTTPS với domain

Trỏ DNS domain vào server và mở cổng 80/443. Đặt `SITE_DOMAIN=domain-thuc-te.example` trong `.env.mvp`. Frontend cổng 8080 mặc định chỉ bind loopback. Sau đó:

```powershell
docker compose --env-file .env.mvp -f compose.mvp.yml --profile https up -d --build
```

Caddy proxy frontend và quản lý certificate trong volume. Không dùng domain `.example` trong template để yêu cầu certificate thật. Không đưa PostgreSQL hoặc pgAdmin ra public.

## Kiểm tra và cập nhật

```powershell
docker compose --env-file .env.mvp -f compose.mvp.yml ps
docker compose --env-file .env.mvp -f compose.mvp.yml logs --tail 100 api worker migrate
curl.exe http://localhost:8080/api/health
```

Mở Grading operations từ Dashboard để kiểm tra queued/running/failed, review và provider errors theo quyền. Đổi provider keys phải recreate worker/API, không chỉ frontend. Thay model/prompt tạo config mới để giữ lịch sử.

Backup database trước migration nâng cấp. Lệnh ví dụ dưới đây ghi dump qua `cmd /c` để PowerShell cũ không chuyển đổi byte của custom-format dump:

```powershell
cmd /c "docker compose --env-file .env.mvp -f compose.mvp.yml exec -T postgres pg_dump -U ielts -d ielts_db -Fc > ielts-backup.dump"
```

Kiểm tra khả năng restore vào database riêng trước khi dùng bản backup cho vận hành. Không chạy `down -v` khi cần giữ dữ liệu. Rollback image không tự rollback schema. Đối với database đã tồn tại từ phiên bản cũ, đọc lịch sử migration và lập kế hoạch chuyển dữ liệu riêng; migration `newdatabase` trong repo có thao tác drop bảng của prototype cũ.

## Đã và chưa kiểm chứng

Đã validate Compose, build backend/frontend trên Node local và chạy integration bằng schema được migrate từ database trống. Chưa build/chạy image hoặc cấp HTTPS thật trên môi trường này vì Docker daemon không hoạt động. Không có VPS/domain được triển khai trong tác vụ này.
