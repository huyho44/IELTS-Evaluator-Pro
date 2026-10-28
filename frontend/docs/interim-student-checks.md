# Student/auth interim — kiểm tra 28/10/2026

## Nguyên nhân và thay đổi

`signIn()` trước đây phát `restoring=true`, làm App unmount BrowserRouter/form.
Navigate sau login vì vậy có thể trỏ vào router cũ. Router nay nằm ổn định ở ngoài
phần loading; login dùng loading riêng của form. Login/Register đã có guard cho
người đăng nhập và giữ return URL nội bộ qua cả hai form.

Refresh giữ requestToken ổn định trong cùng phiên để các key/effect của workspace
không remount và mất answers chưa lưu. Fetch dùng access token mới nhất của phiên.
Generation chặn response cũ; refresh đồng thời được gộp theo phiên. Mạng/5xx giữ
phiên và báo lỗi; refresh token bị từ chối mới dọn phiên. Restore thất bại do mạng
có nút thử lại. Token phiên được lưu cho F5; không lưu mật khẩu hoặc progress.

Sign out đi qua route công khai `/logout`, cùng gọi hàm session, rồi về `/courses`.
Cách này tránh guard của trang cũ ghi đè điều hướng về catalog bằng redirect login.

Navbar đã có Courses, menu Practice Tests, menu account theo roles, guest sign in/up.
Ẩn các mục Student chưa có luồng thật. Auth dùng layout riêng; Account dùng dữ liệu
session thật. UI course/enrollment/lesson/practice/history/result dùng badge và
bố cục responsive; nội dung materials và điểm RAW giữ nguyên.

Figma chưa truy cập được; UI dựa trên ảnh người dùng và style Student hiện có.
`FINISHED` được giữ vì tồn tại trong enum AttemptStatus của schema hiện tại.

## Đã kiểm tra

- Frontend build, lint, `node scripts/session-check.mjs`, git diff --check.
- Session regression: login không phát restoring; safe return; storage sai;
  response 401 cũ sau đổi user; refresh đồng thời; token key ổn định; refresh mạng/
  503 không xóa phiên; refresh tới muộn sau logout; refresh bị từ chối; logout lỗi.
- Register contract được mock; không gọi API tạo tài khoản thật.
- Browser: guest catalog/detail; mở lesson rồi login Bình vào đúng lesson ngay
  không F5; F5 khôi phục phiên; chuyển Scanning và quay Skimming giữ Completed.
- Bình history → attempt đã nộp → đúng answer hiện có và Official RAW 2/2 sau F5.
- Login sai có lỗi và thử lại được; login An vào attempt Bình bị 403, không lộ
  đáp án Bình và không logout; history An có các ID khác Bình.
- Account An dùng tên/email/roles/band thật; Sign out từ Dashboard về Guest catalog.
- Desktop 1440px, mobile 390px: xem catalog/attempt/auth; menu Escape/bấm ngoài;
  không thấy tràn ngang trong những viewport đã kiểm tra.

## Chưa xác minh bằng thao tác ghi

Không mark complete lại, enroll, tạo tài khoản, lưu draft hoặc nộp attempt trong
lần kiểm tra này. Không có draft đang nhập để kiểm tra refresh thực tế giữa lúc
soạn; regression hiện kiểm tra requestToken/key ổn định bằng mock.
Không giả lập lỗi mạng backend thật hoặc token hết hạn 15 phút trong browser;
những trường hợp này được kiểm tra ở session checks.
Không mở rộng hoặc kiểm tra nghiệp vụ instructor/publish.

## Checklist demo lặp lại

1. Guest mở course, chọn lesson, login Bình: nội dung phải hiện ngay.
2. Chuyển bài/quay lại/F5: Completed theo API, không hiện thông báo vừa lưu giả.
3. Practice Tests → My practice attempts → bài đã nộp: answer và RAW 2/2 giữ sau F5.
4. Account menu → Sign out: về catalog Guest; login An rồi mở attempt Bình: 403.
5. Courses/logo luôn về catalog; menu hoạt động trên mobile, Escape và bấm ngoài.
6. Register chỉ kiểm tra validation/UI nếu không cần tạo tài khoản.

## File triển khai/polish của lượt này

- src/App.tsx, src/components/StudentNavbar.tsx, src/pages/Dashboard.tsx
- src/features/auth/session.ts; components/AuthLayout.tsx, LoginForm.tsx,
  RegisterForm.tsx; pages/LoginPage.tsx, RegisterPage.tsx; services/authApi.ts
- src/features/courses/CompletionBadge.tsx, AttemptStatusBadge.tsx,
  CourseCard.tsx, CourseDetailPage.tsx, CourseEnrollmentPanel.tsx, LessonPage.tsx,
  PracticePage.tsx, PracticeAttemptPage.tsx, PracticeHistoryPage.tsx,
  PracticeAssessmentPanel.tsx
- scripts/session-check.mjs; docs/interim-student-checks.md

Các thay đổi auth/progress/API và backend logging có từ trước được giữ nguyên.
EnrollmentDevPage.tsx đã được xóa sau khi xác nhận không còn import/route và enrollment thật dùng session chung. Không sửa proxy,
CSS global, Tailwind, dependency, schema/migration, seed; chưa stage/commit/push.

Đề xuất chia commit sau khi review: auth/session regression; navigation/account;
Student workspace UI. Giữ backend worker logging thành commit riêng nếu muốn chốt.

## Quyết định UI cuối — bổ sung

Navbar dùng link My practice attempts trực tiếp, bỏ dropdown Practice Tests/Browse
course practices. Active dùng chữ xanh và gạch chân; các mục tương lai có Coming
soon. Chuông chỉ thông báo chưa khả dụng. Account không lặp link history; Sign out
có đường ngăn cách. Mobile có menu riêng, dùng chung Escape/bấm ngoài.

Login/Register suy link quay lại course overview từ return URL nội bộ có course
UUID hợp lệ; đích sau login giữ nguyên lesson/practice/query/hash. Không suy course
từ attempt UUID; trường hợp đó fallback Back to courses. Sidebar Completed nằm
trong card bài, vẫn mở lại được.

Catalog có pagination frontend 6 khóa/trang, backend hiện trả tối đa 100 khóa.
Search/filter reset page về 1; helper clamp page trong giới hạn. catalog-check.mjs
chỉ dùng fixture trong test để kiểm tra 14 khóa, trang cuối, empty và search/filter
khi đang ở trang sau. Không seed hoặc đưa fixture vào UI thật.

Kiểm tra: build/lint, session checks (kèm back destination), catalog checks,
diff --check; browser desktop/mobile đã kiểm tra navbar, notifications, login
return qua Sign up/Sign in và lesson sau login. Không tạo dữ liệu học mới.

## Dọn code thử trước commit

Đã xóa EnrollmentDevPage.tsx (tạo tài khoản/session thử enrollment, không còn
import/route) và mockCourses.ts (mock catalog cũ, không có consumer/test/script).
Catalog thật dùng API; preview/test dùng fixture riêng scripts/fixtures/catalog.ts.
Giữ MyEnrolledCourses.tsx vì là component đọc API thật, không phải dev login;
chưa gắn route nên không tự xóa chức năng có thể dùng lại.
Giữ assets đã có trong Git; ảnh QA nằm ngoài repository, không phải output cần commit.
