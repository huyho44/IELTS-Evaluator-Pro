# Kế hoạch hoàn thiện IELTS Evaluator Pro (23/11 → 13/12/2026)

## Context

Kế hoạch này đối chiếu đề bài CO3103 (`proposal_EN (1).pdf`, mục 4, 6, 8.4 và 13) với code hiện tại (HEAD `40c8a0d`).

**Đã có:**
- MVP Writing Clinic: LMS 3 vai trò, chấm AI qua outbox worker (hiện chỉ test bằng mock), giảng viên review/appeal/publish, kỹ năng và gợi ý (Direction 4 + 2).
- UI 3 workspace hoàn toàn bằng tiếng Anh.

**Đề bài bắt buộc nhưng còn thiếu:**
- Một số chức năng LMS.
- Deploy mà giảng viên truy cập được.
- E2E test cho một luồng chính.
- CI.
- Bằng chứng định lượng cho phần nâng cao.

**Hạn nộp:** 23:59 Chủ nhật 13/12/2026. Trễ mỗi ngày bị trừ 20%. Báo cáo, slide và demo bằng tiếng Anh.

### Quyết định đã chốt với bạn

- Kế hoạch chia việc cho cả 6 thành viên.
- **Deploy:** VPS + Docker Compose, dùng lại `compose.mvp.yml` và Caddy.
- **CI:** GitHub Actions chạy lint, build, test. Không làm auto-deploy.
- **Key AI:** mua key OpenAI.
- **Email:** Gmail SMTP để reset mật khẩu.
- **Tài khoản dịch vụ:** cả OpenAI và Gmail đăng ký bằng **tài khoản chung của nhóm**. Hệ thống vẫn chạy được ở chế độ chấm tay khi không có key.
- **Đo MAE:** dùng dataset công khai.
- **Lưu file:** MinIO.
- **Speaking:** giáo viên chấm tay.
- **Thứ tự cắt khi trễ:** Bắt buộc > File > RAG > Speaking/Listening. Nghĩa là S/L cắt đầu tiên.

## Phân công tổng quát

| Thành viên | Vai trò chính |
|---|---|
| Hồ Quốc Huy | Leader, review PR, sửa lỗi, deploy VPS, chạy AI live và evaluation, RAG backend |
| Nguyễn Gia Hùng | API auth/thông báo/tổng quan học/quiz, MinIO, chuẩn bị dataset |
| Phạm Hoàng Hải | **Người duy nhất tạo migration**; API thảo luận/kiểm duyệt/tiên quyết/analytics/audit, Speaking |
| Phạm Quang Huy | FE cho instructor/admin: kiểm duyệt, thông báo, analytics/audit, soạn nội dung và quiz, UI RAG |
| Lê Đoàn Hoàn Hải | FE cho học viên: thảo luận, tiên quyết, dashboard, trang khóa học, Speaking/Listening |
| Đào Nguyên Hưng | FE quên mật khẩu, UI file/video, GitHub Actions CI, E2E Playwright |

**Quy trình:**
- Mỗi việc ứng với **một GitHub issue gán đúng người**. Làm trên nhánh `feat/<module>-<việc>`, mở PR có link issue. Commit theo Conventional Commits.
- Quốc Huy review PR. Cần CI xanh trước khi merge.
- Cập nhật Google Doc tiến độ **mỗi tuần**, kèm link issue/PR. Đề bài dùng nguồn này để chấm đóng góp cá nhân.

## A. Gap bắt buộc của LMS

> **Cập nhật 25/11:** toàn bộ phần A (A0–A11) do **Hồ Quốc Huy** tự code, Claude hỗ trợ giải thích, gợi ý và review. Mỗi mục làm trên một nhánh `feat/...` riêng và có một PR riêng. Các thành viên khác không còn việc nào trong phần A, chỉ làm B, C, D; nhóm sẽ chốt phân công lại. Migration A0 do Quốc Huy tạo; các migration sau đó (C1, C3) phải phối hợp để mỗi lúc chỉ có một người tạo.

**A0. Migration `lms_gaps`** (Quốc Huy, làm trước tất cả)
- Bảng `PasswordResetToken`: `userId`, `tokenHash`, `expiresAt`, `usedAt`.
- Bảng `CoursePrerequisite`: unique, kèm check không tự tham chiếu.
- Cột hoặc trạng thái ẩn cho Chapter/LearningItem nếu schema chưa có (xem `PublicationStatus`).
- Cách chống trùng cho thông báo hạn nộp.
- Không sửa các migration cũ.

**A1. Quên/đổi mật khẩu (mục 4.1)** (Quốc Huy)
- Backend:
  - Gửi mail bằng `nodemailer` qua Gmail App Password của tài khoản nhóm. Cấu hình `SMTP_*` và `APP_BASE_URL` trong `.env`, cập nhật `.env.example` và `.env.mvp.example`.
  - `POST auth/forgot-password`: luôn trả 202 để không lộ email có tồn tại hay không; có rate limit.
  - `POST auth/reset-password`: token dùng một lần, hết hạn sau 30 phút, chỉ lưu hash. Đặt lại xong thì thu hồi mọi `AuthSession`.
  - `POST me/password`: đổi mật khẩu khi đã đăng nhập.
  - Ghi `AuditEvent` cho các thao tác này.
  - Dùng lại hàm scrypt trong `backend/src/auth/auth.service.ts`.
- Frontend: thêm `ForgotPasswordPage` và `ResetPasswordPage`, link "Forgot password?" trên `LoginPage`, form đổi mật khẩu trong `ProfilePage`.

**A2. Kênh thảo luận/Q&A (mục 4.5)** (Quốc Huy)
- Backend: module mới `backend/src/discussions/`, dùng các bảng có sẵn `DiscussionThread` và `DiscussionPost` (schema.prisma:1716).
- Endpoint:
  - `GET/POST courses/:id/threads`, có lọc theo `contextItemId`
  - `GET threads/:id`
  - `POST threads/:id/posts`, cho phép reply
  - `PATCH posts/:id`
  - `POST threads/:id/lock`
- Quyền kiểm tra bằng `AccessService`. Khi có reply thì gửi thông báo.
- Frontend: tab Discussion trong `CourseDetailPage`, khối Q&A theo bài trong `LessonPage`.

**A3. Báo cáo nội dung không phù hợp (mục 4.5, 3)** (Quốc Huy)
- Dùng bảng `ModerationReport`.
- `POST moderation/reports`: mỗi báo cáo nhắm đúng một đích (course, item hoặc post).
- `GET moderation/reports`: admin xem toàn bộ, instructor chỉ thấy khóa được phân công.
- `POST moderation/reports/:id/resolve`: ẩn post hoặc bác báo cáo, bắt buộc có lý do và audit.
- Frontend: nút Report, trang `/admin/moderation`.

**A4. Thông báo nội dung mới và hạn nộp (mục 4.5)** (Quốc Huy)
- Khi publish trong `course-authoring.service.ts`, tạo `NEW_CONTENT` bằng `createMany` cho học viên đã ghi danh.
- Thêm poller `DEADLINE_SOON` trong worker: báo hạn trong 24 giờ, chỉ học viên chưa nộp, mỗi bài một lần.
- Thêm `POST notifications/read-all`.
- Frontend: icon và nhãn theo loại thông báo, nút "Mark all as read".

**A5. Tiên quyết cấp khóa học (mục 4.2)** (Quốc Huy)
- API soạn tiên quyết có kiểm tra vòng lặp, dùng lại logic cycle-check của skill prerequisite trong `management.service.ts`.
- `enrollCourse` (courses.service.ts:162) trả 409 nếu chưa hoàn thành khóa tiên quyết.
- Frontend: hiển thị trên `CourseDetailPage`/`CourseEnrollmentPanel`, cho phép chọn trong `AuthoringPage`.

**A6. Học tiếp và khóa đang học/đã xong (mục 4.3)** (Quốc Huy)
- Khi mở bài học, ghi `LessonProgress.lastAccessedAt` và `lastPositionJson`.
- `GET me/learning-overview`: khóa đang học và đã xong, % tiến độ, bài tiếp theo, attempt còn dở.
- Frontend: làm lại Dashboard học viên, có thẻ "Continue learning". (`MyEnrolledCourses.tsx` cũ, không còn dùng, đã được xóa ngày 23/11.)

**A7. Số liệu và audit log cho admin (mục 4.6)** (Quốc Huy)
- `GET admin/analytics`, gồm:
  - số ghi danh theo khóa;
  - tỉ lệ hoàn thành;
  - số học viên hoạt động;
  - số bài nộp;
  - band chính thức trung bình theo tiêu chí;
  - tồn đọng review.
- Instructor dùng cùng API nhưng chỉ thấy khóa của mình.
- `GET admin/audit-events`: lọc theo actor, action, entity, thời gian; có phân trang.
- Frontend: trang `/admin/analytics` và `/admin/audit`.

**A8. Sửa và ẩn nội dung (mục 4.2)** (Quốc Huy)
- Hiện chỉ có POST để tạo section/lesson/activity.
- Thêm `PATCH` cho chapter/lesson/activity: sửa tiêu đề, nội dung, thứ tự, và publish/hide.
- Nội dung bị ẩn không hiện với học viên. Bài làm và bằng chứng cũ vẫn giữ.
- Frontend: nút sửa và ẩn/hiện trong `AuthoringPage`.

**A9. Giảng viên tự tạo quiz chấm tự động (mục 4.4)** (Quốc Huy)
- API soạn câu hỏi trắc nghiệm/điền từ, dùng các bảng có sẵn `Question`, `QuestionVersion`, `QuestionOption`, `AnswerKeyVersion/Entry`.
- Gắn câu hỏi vào assignment version. Chấm theo đáp án bằng luồng Reading hiện có.
- Phần này là nền cho Listening ở C3.

**A10. Trang khóa học hiển thị giảng viên (mục 4.2)** (Quốc Huy)
- `CourseDetailPage` hiện chưa hiển thị giảng viên.
- Nếu `GET courses/:id` chưa trả về danh sách giảng viên thì Quốc Huy bổ sung ở backend.

**A11. Dọn lỗi** (Quốc Huy)
- `Promise.all` chạy trong transaction ở `backend/src/management/management.service.ts:273` (nguồn cảnh báo node-postgres): đổi sang chạy tuần tự.
- Sửa loading ở `PrivateRoute.tsx:15`.
- Xóa các file `.pyc` đã commit và thêm vào `.gitignore`.
- Sửa thụt lề trong `LessonPage.tsx`.

## B. Phần nâng cao: Direction 4 + 2, đánh giá (Quốc Huy, Gia Hùng)

**B1. Chạy AI live**
- Dùng key OpenAI của tài khoản nhóm, đặt trên server, có hạn mức chi tiêu.
- Chọn model hỗ trợ Responses Structured Outputs. **Model cụ thể nhóm chốt khi mua key.**
- Tạo config qua Admin, chạy kịch bản trong `docs/MVP.md` trên bản deploy.

**B2. Dataset công khai** (Gia Hùng, xong trước 29/11)
- Chọn bộ bài Task 2 có band, kiểm tra giấy phép và ghi nguồn.
- Chuyển sang JSONL theo `docs/evaluation.md` với `labelSource: "public-dataset"` (không ghi "expert").
- Chia dev/holdout theo nhóm đề.
- Viết `rater-rubric.json` diễn đạt lại band descriptors công khai.
- Dữ liệu để trong `backend/private/`, không đưa lên Git.

**B3. Đo chấm** (W49)
- So sánh baseline structured prompt với pipeline đề xuất, cùng model, trên tập holdout.
- Chạy bằng `scripts/evaluate-writing.ts --live --max-items 30`.
- Báo cáo các số đo: MAE, sai lệch lớn, coverage, anchor validity, latency, token.

**B4. Đo gợi ý** (W49)
- Xuất `proposedIds` thật cho ít nhất 2 hồ sơ học viên, so với 2 baseline có sẵn (fixed-path và lowest-criterion).
- Một thành viên đóng vai giảng viên chấm relevance độc lập, có ghi giới hạn.

**B5. Báo cáo** (đề bài Direction 4 yêu cầu)
- Nêu giới hạn và cách xử lý khi chấm sai: quality gate, giảng viên xác nhận, appeal, correction review.
- Công khai việc dùng OpenAI và dataset bên thứ ba.

## C. Mở rộng (theo thứ tự ưu tiên)

**C1. File/video bài học bằng MinIO** (BE: Gia Hùng, FE: Nguyên Hưng; W48–W49)
- Thêm `minio` vào `docker-compose.yml` và `compose.mvp.yml`. Dùng `@aws-sdk/client-s3` và `s3-request-presigner`.
- `POST files`: upload qua `FileInterceptor`, giới hạn kích thước và MIME, tạo `FileAsset`.
- `GET files/:id/url`: kiểm tra quyền rồi trả presigned URL ngắn hạn.
- Khi soạn bài cho chọn TEXT, URL hoặc FILE.
- `LessonPage` nhúng YouTube/`<video>` và cho tải file. Phần này củng cố yêu cầu "≥2 loại học liệu".

**C2. RAG giải thích feedback** (BE: Quốc Huy, FE: Quang Huy; W49)
- Worker ingest học liệu đã publish vào `KnowledgeDocumentVersion`/`KnowledgeChunk`: tạo embedding bằng OpenAI, ghi bằng `$executeRaw` vì cột là `vector`. Cần kiểm tra số chiều trong migration `20261023031857_newdatabase`.
- `POST findings/:id/explanations`:
  - truy hồi top-k, lọc theo khóa, trạng thái publish và quyền;
  - lời giải thích có trích nguồn, lưu vào `FeedbackExplanation`/`ExplanationCitation`;
  - nếu không có nguồn phù hợp thì nói rõ giới hạn.
- Đánh giá truy hồi trên một bộ câu hỏi nhỏ.
- Frontend: nút "Explain" trong `WritingFeedbackPanel`.

**C3. Speaking/Listening** (BE: Hoàng Hải, FE: Hoàn Hải; W50; cắt đầu tiên nếu trễ; cần C1 và A9 xong trước)
- Speaking:
  - Học viên thu âm bằng `MediaRecorder`, upload lên `FileAsset`, rồi nộp bằng `audioAssetId` (phần kiểm tra này đã có).
  - Bài nộp đi vào review `SPEAKING_MANUAL`. Trang review phát audio để giảng viên chấm 4 tiêu chí Speaking.
- Listening: quiz ở A9, cộng audio đề bài.

## D. Chất lượng, deploy, bàn giao

**D1. CI bằng GitHub Actions** (Nguyên Hưng, W48)
- Mỗi PR và push lên main chạy backend lint/build/`npm test`, `test:integration` với service `pgvector/pgvector`, frontend lint/build và các script `scripts/*-check.mjs`.

**D2. E2E cho luồng chính** (Nguyên Hưng, W49)
- Dùng Playwright, công cụ E2E phổ biến cho React.
- Luồng test: học viên nộp Writing → giảng viên claim/confirm/publish → học viên xem kết quả và gợi ý.
- Chạy trên stack local đã seed và đưa vào CI.

**D3. Deploy VPS** (Quốc Huy)
- **Đến 29/11:** deploy sớm bản hiện tại để có URL.
- Thuê VPS bằng tài khoản nhóm, tối thiểu 2 vCPU/4GB vì có MinIO và worker.
- Chạy `compose.mvp.yml` với profile `https`.
- Tên miền: nhóm chọn tên miền mua hoặc subdomain miễn phí để Caddy cấp chứng chỉ.
- Seed tài khoản thử cho cả 3 vai trò, đổi `DEMO_PASSWORD`.
- Kiểm tra backup và restore.
- Sau đó cập nhật lại mỗi khi merge.

**D4. Logging và observability**
- Kiểm tra và bổ sung nếu còn thiếu: requestId trong log, global exception filter cho lỗi thống nhất, không log toàn văn bài viết.
- Các metric vận hành đã có sẵn ở `/grading/report`.

**D5. Kiểm thử và nghiệm thu** (W50, 9–11/12)
- Mỗi service mới có `*.spec.ts`. Mở rộng integration test cho reset mật khẩu, tiên quyết, kiểm duyệt, quiz.
- Kiểm tra bảo mật: thử IDOR/sai vai trò trên các API mới.
- Kiểm tra giao diện mobile.
- Nghiệm thu trên trình duyệt đủ 3 vai trò, trên bản deploy.

**D6. Gói bàn giao** (W50; nội dung theo mục 8.4 của đề, viết bằng tiếng Anh)
- Báo cáo cuối kèm bảng truy vết yêu cầu → thiết kế → code → test.
- Tài liệu API và kiến trúc/data model.
- Test plan và kết quả, biên bản trong `docs/validation/`.
- Kết quả evaluation.
- README, deployment guide, tài khoản demo.
- Slide, demo script, video dự phòng.
- Link Google Doc, issue, PR.
- Email nộp theo mẫu ở mục 10.7 của đề.

## Mốc thời gian

| Thời gian | Mục tiêu và tiêu chí xong |
|---|---|
| 23–24/11 | A0 migration merge; tạo đủ issue cho 6 người; mua key, VPS, tạo tài khoản Gmail nhóm |
| 25–29/11 (W48) | A1–A11 merge; D1 CI xanh; D3 có URL public; B2 dataset sẵn sàng; khởi động C1 |
| 30/11–6/12 (W49) | C1 và C2 xong; D2 E2E; B1, B3, B4 có số liệu; bản deploy cập nhật |
| 7–8/12 | C3 nếu kịp; **feature freeze 23:59 8/12** |
| 9–11/12 | D5 nghiệm thu, sửa lỗi blocking, tập demo (đề bài mục 9: W49 tập demo) |
| 11–13/12 | D6 báo cáo, slide, video; kiểm tra mọi link và tài khoản; **nộp trước 23:59 13/12** |

## Verification

**Mỗi PR:** CI xanh, gồm lint, build, unit test, integration test, frontend checks.

**Trước khi nộp:**
- Backend:
  - `npm test`
  - `npm run test:integration`
  - `npm run test:smoke` chạy với URL deploy
  - `npx playwright test`
- Kiểm tra thủ công:
  - email reset đến Gmail và link không dùng lại được;
  - ghi danh bị chặn khi chưa đủ tiên quyết;
  - post bị báo cáo thì bị ẩn sau khi resolve;
  - thông báo NEW_CONTENT/DEADLINE_SOON không trùng;
  - presigned URL hết hạn và trả 403 khi không có quyền;
  - quiz do giảng viên tạo được chấm tự động;
  - RAG trả lời có nguồn hoặc nói rõ giới hạn.
- Tiêu chí tối thiểu ở mục 13 của đề:
  - đăng nhập được 3 tài khoản thử trên URL public;
  - luồng chính của 3 vai trò hoàn chỉnh;
  - phần nâng cao có kịch bản demo và kết quả đánh giá;
  - không có lỗi mất dữ liệu hoặc vượt quyền;
  - đã bàn giao source, seed, tài liệu, test report;
  - Google Doc cập nhật.
