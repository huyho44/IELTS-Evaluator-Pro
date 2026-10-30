# IELTS Evaluator Pro

MVP luyện IELTS với ba vai trò Student, Instructor và Admin. Luồng trọng tâm: Writing Task 2 → phản hồi có dẫn chứng → giảng viên xác nhận → hồ sơ kỹ năng → bài luyện phù hợp → revision và bài mới khác chủ đề.

## Chạy local

Dùng Node.js 24 và PostgreSQL có pgvector. Có thể dùng PostgreSQL hiện có; `docker-compose.yml` cung cấp database phát triển tại cổng 5433.

```powershell
# Chỉ cần nếu chưa có PostgreSQL
docker compose up -d postgres

cd backend
npm ci
# Chỉ tạo file khi chưa có backend/.env; giữ cấu hình database đang sử dụng.
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
```

Sửa `backend/.env`: `DATABASE_URL` trỏ đúng database và `AUTH_TOKEN_SECRET` là chuỗi ngẫu nhiên ít nhất 32 byte. Sau đó:

```powershell
# backend
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

Mở terminal khác:

```powershell
cd frontend
npm ci
npm run dev
```

Giao diện: http://localhost:5173. API: http://localhost:3000. Kiểm tra database: http://localhost:3000/health. Worker chạy cùng API khi phát triển; không cần bật thêm worker.

Không chạy migration cũ lên database có dữ liệu quan trọng nếu chưa có backup. Seed dùng upsert, giữ nguyên các bản ghi trùng và không đặt lại mật khẩu đang có.

## Tài khoản demo

Sau khi seed database mới, mật khẩu chung là `IeltsDemo123!` (hoặc `DEMO_PASSWORD` tại lúc tạo tài khoản). Seed lại không đổi mật khẩu của tài khoản đã tồn tại.

| Vai trò    | Email                        | Nơi bắt đầu                                     |
| ---------- | ---------------------------- | ----------------------------------------------- |
| Student    | `student.an@ielts.example`   | Courses → Writing Clinic; Skills and next steps |
| Student    | `student.binh@ielts.example` | Cùng khóa, hồ sơ và lịch sử riêng               |
| Instructor | `teacher@ielts.example`      | Review queue; Course authoring                  |
| Admin      | `admin@ielts.example`        | Administration; AI configuration                |

Seed gồm khóa Reading và **[Demo] Writing Clinic: evidence to transfer**, 6 kỹ năng Writing và 6 hoạt động. Các mô tả rubric là tài liệu giảng dạy mẫu, chưa được hiệu chuẩn thành thang chấm IELTS chính thức. Bài làm, điểm và bằng chứng kỹ năng được tạo qua thao tác sử dụng; seed không giả kết quả học tập.

## Bật AI thật

Backend hỗ trợ `OPENAI` qua Responses API và `JSON_HTTP` cho gateway riêng. Đặt khóa **chỉ ở server**, theo `backend/.env.example`, rồi khởi động lại API/worker. Không đưa khóa vào frontend hoặc Git.

Admin mở **Course authoring → Configure AI assessment**, chọn rubric Writing Task 2, provider, model ID được tài khoản provider hỗ trợ và phiên bản prompt. Bài nộp tiếp theo sử dụng cấu hình mới; lượt chấm cũ giữ cấu hình đã ghim. Khi chưa cấu hình AI, bài vẫn được lưu và chuyển giảng viên chấm thủ công.

OpenAI adapter sử dụng [Structured Outputs của Responses API](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). Hệ thống kiểm tra lại tiêu chí, band, skill và trích dẫn chính xác; phản hồi AI không tự trở thành kết quả chính thức hoặc bằng chứng kỹ năng. Cờ chất lượng chỉ là điều kiện chuyển giảng viên kiểm tra.

## Kiểm tra và triển khai

- [Hướng dẫn demo và vận hành MVP](docs/MVP.md): các bước test từng vai trò, cấu hình, worker và giới hạn hiện tại.
- [Triển khai Docker/HTTPS](docs/deployment.md): API, worker, frontend, migration, PostgreSQL riêng và Caddy.
- [Evaluation](docs/evaluation.md): dữ liệu dev/holdout, MAE, evidence, độ trễ/token và hai baseline recommendation.
- [Proposal](docs/New%20Proposal.md).

```powershell
# backend
npm test
npm run test:integration
npm run build
npm run lint
# API local đang chạy và đã seed
npm run test:smoke

# frontend
npm run build
npm run lint
node scripts/session-check.mjs
node scripts/catalog-check.mjs
node scripts/instructor-check.mjs
node scripts/student-learning-check.mjs
node scripts/course-completion-check.mjs
```

`test:integration` tự tạo database cục bộ tên ngẫu nhiên kết thúc `_test`, áp dụng migration, seed và kiểm thử, rồi xóa đúng database tạm đó. Cần quyền tạo database; không reset database dự án. `test:smoke` đăng nhập/đăng xuất ba tài khoản demo và đọc API; hai API kỹ năng/gợi ý có thể lưu snapshot và recommendation run, không tạo bài làm hoặc dùng quota.

Mã nguồn và kiểm thử chưa thay thế việc đánh giá bằng khóa AI thật, bài chấm độc lập của chuyên gia và người học thực tế. Không có kết quả MAE hay mức tăng band thực nghiệm được khẳng định từ dữ liệu synthetic.
