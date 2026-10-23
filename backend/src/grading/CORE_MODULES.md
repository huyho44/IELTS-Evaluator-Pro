# Core backend modules: integration notes

Phạm vi thay đổi: `auth`, `courses`, `submissions`, `grading`, `reviews`, `recommendations`.
Các module dùng Prisma schema UUID hiện tại; không sửa frontend, schema, migrations, package.json hoặc lockfile.

## Điều kiện chạy

- **Migration hiện tại chưa khớp schema.prisma.** Migration `20260926132013_init` vẫn tạo model cũ dùng ID số. Nhóm database cần bổ sung migration/backfill được kiểm tra và các ràng buộc trong `prisma/constraints.sql`. Không chạy reset/db push lên database có dữ liệu.
- Schema hiện tại cần extension PostgreSQL `vector`. Đây là phụ thuộc có sẵn của schema, không do các module này thêm vào.
- Sinh lại Prisma Client sau khi cài dependencies hiện có.
- Đặt `AUTH_TOKEN_SECRET` phía server: bí mật ngẫu nhiên tối thiểu 32 byte. Không đưa vào frontend. Token Base64 cũ không được chấp nhận; đăng nhập lại để lấy JWT có chữ ký.
- Seed phải có role LEARNER/INSTRUCTOR/ADMIN. Không tự cấp quyền giáo viên/admin khi đăng ký.
- Để gọi AI, đặt `GRADING_PROVIDER_URL` (HTTPS; HTTP chỉ cho localhost) và tùy chọn `GRADING_PROVIDER_KEY`. Tạo rubric đã công bố, prompt version và grading config. Adapter hiện hỗ trợ gateway `JSON_HTTP`; không giả lập điểm khi thiếu gateway.
- `GRADING_WORKER_ENABLED=false` tắt poller; mặc định bật trong ứng dụng, tắt khi NODE_ENV=test. Poller dùng PostgreSQL/outbox và lease, không yêu cầu thêm BullMQ hay sửa bootstrap. Khi tách worker/BullMQ sau này, có thể gọi lại các service trong module.
- Tệp Speaking phải được hệ thống lưu trữ tạo thành FileAsset thuộc người nộp; module chỉ nhận ID, không nhận URL hay đường dẫn tùy ý.

## Hợp đồng HTTP

Mọi ID nghiệp vụ là UUID. API có xác thực dùng `Authorization: Bearer <accessToken>`.
Không tin `userId`, `learnerId` hoặc `teacherId` do client gửi; danh tính lấy từ session và quyền hiện tại trong DB.
ADMIN không tự có quyền chấm bài. Giáo viên phải có role INSTRUCTOR và phân công CourseInstructor.

| Nhóm | API |
| --- | --- |
| Auth | POST /auth/register, /auth/login, /auth/refresh, /auth/logout; GET /auth/me |
| Khóa học | GET /courses, /courses/:id, /courses/mine; POST /courses; PATCH /courses/:id |
| Ghi danh | POST /courses/:id/enroll, /courses/:id/leave |
| Nội dung | POST /courses/:id/chapters, /lessons, /activities; GET /courses/:id/lessons/:lessonId; POST /courses/:id/lessons/:lessonId/complete |
| Bài giao | GET/POST /courses/:id/assignments; POST /courses/:id/assignments/:assignmentId/versions |
| Lượt làm | POST /assignments/:id/attempts; GET /attempts/:id; PUT /attempts/:id/draft |
| Nộp bài | POST /assignments/:id/submissions (202); GET /submissions/:id; GET /me/submissions |
| Chấm | GET /grading-runs/:id; GET /submission-revisions/:id/assessment |
| Cấu hình | POST /grading/rubrics (instructor); POST /grading/configs (admin) |
| Chấm AI lại | POST /submission-revisions/:id/grading-runs với requestKey UUID; quyền giáo viên của khóa |
| Duyệt | GET /teacher/reviews; GET /reviews/:id; POST /reviews/:id/claim, /confirm, /resolve |
| Phúc khảo/công bố | POST /assessments/:id/appeals, /publish; id ở đây là AcceptedAssessment.id |
| Học tập | GET /me/skills; GET /me/recommendations |

Route cũ `/submission-revision/:id/assessment` được giữ làm alias. Route `/grading/simulate/:submissionId` đã bỏ vì tạo điểm cố định không phải đánh giá thật.

## Luồng frontend

1. Đăng nhập; accessToken hết hạn sau 15 phút. Refresh token được xoay mỗi lần dùng, session hết hạn sau 7 ngày. Logout thu hồi session.
2. Tạo/lấy attempt bằng POST /assignments/:id/attempts. Thời lượng tính từ thời điểm này, không từ lúc nộp.
3. GET /attempts/:id lấy đề/phiên bản đã ghim, câu hỏi không có đáp án, rubric và bản nháp.
4. Lưu nháp với `{ "lockVersion": 0, "payload": { "writingText": "..." } }`; dùng lockVersion mới trả về cho lần sau.
5. Nộp với attemptId. Gửi lại cùng payload của revision gần nhất trả về cùng revision; sửa nội dung tạo revision mới nếu còn quota.
6. Theo dõi `GET /submissions/:revisionId` qua trường processing; với AI có thể theo dõi gradingRunId riêng.
7. Lấy đánh giá qua endpoint assessment. Không lấy điểm trực tiếp từ trạng thái xử lý.

Writing:
```json
{ "attemptId": "<uuid>", "writingText": "Essay text" }
```
`contentText` được hỗ trợ như alias nhưng không được mâu thuẫn với writingText.

Objective:
```json
{ "attemptId": "<uuid>", "itemResponses": [
  { "assessmentItemId": "<uuid>", "textAnswer": "student card" },
  { "assessmentItemId": "<uuid>", "optionIds": ["<uuid>"] }
] }
```
Có thể bỏ qua câu chưa trả lời; server lưu câu bỏ trống và chấm 0. Không được gửi cả text và option cho sai loại câu hỏi.
Chấm đáp án chạy bền vững qua outbox; lỗi cấu hình không làm mất revision.
Điểm trả theo RAW và maxScore, không tự suy band khi chưa có bảng quy đổi được hỗ trợ.
Hỗ trợ TEXT_EXACT (trim, caseSensitive, collapseSpaces, maxWords) và EXACT_OPTION_SET; phương thức chưa hỗ trợ báo lỗi, không đoán điểm.

Speaking:
```json
{ "attemptId": "<uuid>", "audioAssetId": "<owned-audio-asset-uuid>" }
```

## Authoring

- POST /courses: title, description, completionPolicyJson; tạo bản nháp và phân công người tạo.
- POST /courses/:id/lessons: title, position, contentText; tùy chọn summary/chapterId.
- POST /courses/:id/activities: title, position, skillArea (WRITING/SPEAKING), promptText, instructions, difficulty (1-5), expectedMinutes (1-240), skillIds. Objective dùng kho câu hỏi/đáp án hiện có.
- POST /courses/:id/assignments: title, activityVersionId, rubricVersionId (Writing/Speaking), mode (PRACTICE/GRADED), maxAttempts, maxRevisions, opensAt, dueAt, timeLimitSeconds, allowLate, releasePolicyJson. Các trường thời hạn là ISO datetime. Endpoint versions tạo version mới, không sửa version của attempt cũ.
- POST /grading/rubrics: rubricCode, versionNo, taskType (WRITING_TASK_1/WRITING_TASK_2/SPEAKING), title, criteria gồm code/name/definition. Bộ code: TA hoặc TR + CC/LR/GRA; Speaking: FC/LR/GRA/PR.
- POST /grading/configs: rubricVersionId, modelId, promptCode, promptVersionNo, instructions, outputSchemaJson, settingsJson.
- Danh mục Skill, objective question bank và lưu trữ file thuộc dữ liệu/hệ thống ngoài các API authoring tối thiểu trên.

## AI gateway và giáo viên

Gateway nhận JSON gồm model, instructions, schema, settings, context. Context có đề, rubric, danh mục kỹ năng, paragraph IDs và untrustedSubmission. Gateway phải tách nội dung học viên khỏi system instructions khi gọi mô hình.
Gateway trả JSON trực tiếp theo hợp đồng:
```json
{
  "summary": "Feedback",
  "criteria": [
    {"code":"TR","score":6,"explanation":"..."},
    {"code":"CC","score":6,"explanation":"..."},
    {"code":"LR","score":6,"explanation":"..."},
    {"code":"GRA","score":6,"explanation":"..."}
  ],
  "findings": [{
    "code":"CC", "kind":"LOCAL", "skillId":"<optional-published-skill-uuid>",
    "explanation":"...",
    "anchors":[{"paragraphId":"<uuid-from-context>","exactQuote":"verbatim quotation"}]
  }]
}
```
GLOBAL findings có thể không có anchors. Offset do backend tính; không tin offset mô hình. Có thể trả `{"status":"REFUSED"}` hoặc `{"status":"INCOMPLETE"}`.
Gateway gọi HTTP có timeout, giới hạn kích thước và retry tối đa 3 lần cho lỗi tạm thời. Đầu ra sai lưu ProviderAttempt, không tạo AiResult.
Không gọi API AI thật trong test; test dùng provider được thay thế rõ ràng.

Giáo viên claim review để lấy lockVersion. Confirm gửi hợp đồng assessment ở trên, thêm lockVersion, reason và observations tùy chọn:
```json
{"skillId":"<uuid>","outcome":"NOT_MET","rationale":"Evidence-based rationale"}
```
Outcome: MET/PARTIAL/NOT_MET/NOT_OBSERVED. Quan sát không tự suy từ band hoặc việc thiếu finding.
Confirm tạo quyết định, result, subtype, accepted assessment và audit trong một transaction, giữ nguyên kết quả AI.
Resolve dùng lockVersion/reason để từ chối appeal và giữ điểm; với Objective thêm answerKeyVersionId để chấm lại bằng bản đáp án đã công bố đúng activity version.

## Công bố và gợi ý

releasePolicyJson hỗ trợ IMMEDIATE, AFTER_DUE_DATE, SCHEDULED với releaseAt, MANUAL. Chính sách thiếu/không nhận diện được giữ kín.
Giáo viên được phân công có thể chủ động publish; poller công bố các kết quả đến lịch.
Writing GRADED chỉ hiện kết quả chính thức đã công bố; PRACTICE có thể hiện AI provisional hợp lệ theo lịch.
Chỉ TEACHER/ANSWER_KEY tạo accepted evidence. Nguồn mới chưa công bố không thay thế nguồn đang công bố.

Projection giữ một evidence hiện hành cho mỗi Attempt-Skill, ưu tiên revisionNo mới nhất. NOT_OBSERVED không thành 0. Ba cơ hội quan sát được dùng làm ngưỡng support theo policy thử nghiệm, không phải xác suất mastery đã hiệu chuẩn.
Recommendation lưu profile, policy, ứng viên, điểm thành phần và lý do; chỉ đề xuất nội dung đã công bố trong khóa đang ghi danh, đúng prerequisite, thời hạn/quota, tối đa 3 đích. PRACTICE luôn ghim assignment/activity version.
Đây là rule-based policy v1; chưa phải kết quả chứng minh hiệu quả tăng band.

## Kiểm thử

- `npm run build`, `npm run lint`, `npm test`.
- Integration spec nằm trong grading để giữ phạm vi sửa. Mặc định bỏ qua khi thiếu CORE_TEST_DATABASE_URL.
- Muốn chạy integration: chuẩn bị **database tạm riêng** trên localhost, tên kết thúc bằng _test, áp dụng schema hiện tại + constraints + seed; đặt CORE_TEST_DATABASE_URL rồi chạy npm test. Test tạo fixtures riêng, không dùng DATABASE_URL thường.
- Không chạy integration lên dữ liệu thật. AI provider được mock; PostgreSQL, FK, constraints, transactions, các service và cạnh tranh cập nhật dùng thật.
- Chưa bao gồm UI, gửi email/reset mật khẩu, object storage, RAG, benchmark chấm AI, BullMQ hoặc migration/backfill. Các phần này không được giả là đã triển khai bởi 6 module.
