# Dữ liệu demo Courses/Lessons

Trong PowerShell, từ thư mục repository:

```powershell
cd backend
npm.cmd ci
# Cấu hình DATABASE_URL trong backend/.env và áp dụng migrations hiện có nếu cần.
npm.cmd run db:seed
npm.cmd run start:dev
```

Ở terminal khác, chạy `cd frontend`, `npm.cmd ci`, `npm.cmd run dev`.
Mở Courses → `[Demo] IELTS Reading Foundations`. Course gồm practice có sẵn
và hai chương Reading basics/Finding details, với bài Skimming/Scanning và TEXT materials.
Seed lấy nguyên nội dung hai bài đã tạo qua API trên database local.

Seed có thể chạy lại: dữ liệu gốc vẫn dùng upsert với `update: {}`.
Chương/bài mới dùng fixture ID khi chưa có; bản có ID từ API được tái sử dụng
khi course, chương, vị trí, loại, trạng thái, tiêu đề, summary và materials khớp.
Nếu nhiều ứng viên hoặc có xung đột, seed dừng và rollback toàn bộ transaction.
Không tự chọn bản ghi đầu tiên theo tiêu đề, không ghi đè nội dung và không đụng tiến độ.
Khi seed thất bại, kiểm tra dữ liệu ở vị trí chương 1/2 và lesson 10/20 trước khi thử lại;
không reset database. Không chạy đồng thời nhiều tiến trình seed.

Fixture mới: chapter 100/101, lesson 110/111, material 120/121 trong hàm `fixtureId`.
Không hardcode các ID này vào frontend: database đã có bài qua API giữ ID cũ.

Wrapper đăng nhập thử đã được bỏ. Route hiện chưa nối auth nên trang lesson hiện
thông báo cần đăng nhập. Nhóm auth cần truyền `accessToken` và `onSessionExpired`
cho `LessonPage` từ session thật; callback xử lý xóa session khi API trả 401.
Ví dụ: `<LessonPage accessToken={session.accessToken} onSessionExpired={clearSession} />`.
Learner cần enrollment ACTIVE/COMPLETED; seed chỉ tạo enrollment khi chưa có,
không kích hoạt lại enrollment đã LEFT.

GET lesson hiện chưa trả progress của learner. POST complete lưu database,
nhưng nhãn hoàn thành chỉ tồn tại trong lần mở bài hiện tại; tải lại/chuyển bài
sẽ mất nhãn cho đến khi backend trả progress và frontend đọc trường đó.
Không dùng localStorage để giả lập tiến độ.

Kiểm tra seed: `npx.cmd vitest run prisma/seed-lessons.spec.ts`.
