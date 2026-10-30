# Hướng dẫn kiểm tra MVP

## Phạm vi đã triển khai

| Luồng               | Mã và giao diện                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LMS và 3 vai trò    | Đăng nhập/refresh/logout, khóa công khai, ghi danh, bài học, lưu tiến độ, kiểm tra hoàn thành khóa                                                         |
| Quản trị            | Danh sách tài khoản, vai trò/trạng thái có lý do và audit, bảo vệ admin cuối cùng, duyệt hồ sơ giảng viên, phân công khóa                                  |
| Nội dung            | Tạo/công bố khóa, chương, bài học văn bản, bài Writing và phiên bản giao bài; rubric, prompt và cấu hình AI                                                |
| Writing             | Đề đã ghim phiên bản, draft với lockVersion, hạn giờ/hạn nộp, nộp revision bất biến, lịch sử và viết lại trong cùng attempt                                |
| Feedback            | Theo dõi xử lý, phản hồi AI tạm thời theo chính sách, điểm chính thức, dẫn chứng theo paragraph, yêu cầu giảng viên và khiếu nại                           |
| Giảng viên          | Queue theo trạng thái và lịch sử, claim/release, kiểm tra evidence, quyết định và skill observations, công bố, sửa quyết định qua review mới               |
| Kỹ năng/gợi ý       | Chỉ dùng kết quả accepted đã công bố, phân biệt chưa quan sát với yếu, không đếm revision thành cơ hội độc lập, prerequisite, pin mục tiêu khi bắt đầu bài |
| Xử lý nền           | Database queue/outbox, lease và CAS, retry giới hạn/backoff, phục hồi từ trạng thái bền vững, không tạo kết quả giả khi provider lỗi                       |
| Theo dõi/evaluation | Báo cáo theo quyền, token/latency/error, runner offline/live, MAE/coverage/anchors, baseline fixed-path và lowest-criterion                                |
| Đóng gói            | Docker API/worker/frontend, migration một lần, database private, HTTPS qua Caddy                                                                           |

Luồng tập trung là **Writing Task 2**. UI thu âm Speaking, authoring ngân hàng câu hỏi Listening/Reading đầy đủ và RAG nằm ngoài bản MVP này. Reading demo vẫn làm và chấm theo answer key. Runtime hàng đợi dùng PostgreSQL làm nguồn công việc bền vững; Redis trong Compose phát triển cũ chưa được dùng để điều phối chấm.

## Kịch bản demo từ đầu đến cuối

1. Đăng nhập Student `student.an@ielts.example`. Vào Courses, mở **[Demo] Writing Clinic: evidence to transfer**. Tài khoản An và Binh đã được seed ghi danh; tài khoản mới ghi danh từ trang khóa.
2. Mở **Diagnostic: public transport**, bắt đầu attempt, soạn bài và Save draft. Tải lại kiểm tra bản lưu. Submit essay tạo revision riêng, không ghi đè bản nộp cũ.
3. Có provider: theo dõi trạng thái tự cập nhật. AI hợp lệ và không bị flag chỉ hiện tạm thời ở PRACTICE theo release policy. GRADED và kết quả bị flag chờ giảng viên. Không có cấu hình AI: bài chuyển queue `AI_NOT_CONFIGURED`, không sinh điểm AI giả.
4. Đăng nhập Instructor `teacher@ielts.example` ở một phiên khác. Mở Review queue, claim bài của An. Đọc bài, rubric, phản hồi AI nếu có. Nhập đầy đủ bốn band theo bước 0.5, lý do, tóm tắt; tự chọn/xác nhận finding và skill observation. Điểm AI không tự điền thành quyết định giảng viên.
5. Với nhận xét cục bộ, chọn đúng paragraph và trích đúng câu. Server từ chối quote hoặc skill không hợp lệ. Xác nhận để tạo kết quả teacher; chính sách MANUAL yêu cầu nút Publish, SCHEDULED/AFTER_DUE_DATE đợi worker đến hạn.
6. Trở lại Student, mở feedback hoặc notification. Chỉ kết quả chính thức đã công bố mới cập nhật Skills and next steps. Chưa có cơ hội quan sát đủ thì hồ sơ ghi thiếu dữ liệu; không tự suy ra band từ skill strength.
7. Mở bài được gợi ý. Server kiểm tra lại enrollment, phiên bản ghim, quota, cửa sổ thời gian và prerequisite; diagnostic được phép thu thập bằng chứng ban đầu. Quay lại attempt gốc → Write a new revision để sửa bài theo feedback. Revision giữ cùng opportunity và không tăng số cơ hội độc lập.
8. Làm **Transfer: remote work on a new topic** từ danh sách khóa. Bài GRADED này là một cơ hội mới để giảng viên đánh giá việc áp dụng kỹ năng.
9. Student gửi appeal với lý do từ kết quả chính thức. Instructor xem lý do, claim, xác nhận đánh giá mới hoặc Reject appeal with reason. Điểm đang công bố được giữ trong lúc chờ; replacement chỉ có hiệu lực khi được công bố.
10. Instructor chọn CONFIRMED để xem lịch sử. Open a correction review tạo review mới; quyết định cũ vẫn còn. Release claim trả bài về queue. Không được tự chấm bài của chính mình.

Để minh họa cá nhân hóa, cho An và Binh nộp bài riêng, giảng viên xác nhận các observation khác nhau, rồi so sánh đề xuất và reason. Không dùng việc hai fixture giả khác ID để tuyên bố hệ thống đã cải thiện kết quả học.

## Quản trị và biên soạn

Admin → Administration: quản lý account/roles, hồ sơ giảng viên, phân công course, tạo/publish/archive skill và prerequisite. Hồ sơ giảng viên không cho tự duyệt. Chuỗi prerequisite tạo vòng bị từ chối.

Instructor → Course authoring: tạo course, thêm chapter và text lesson/Writing activity, xuất bản assignment có rubric. Để publish khóa cần ít nhất một item đã publish. Giao diện nội dung chỉ mở chỉnh sửa khi instructor thực sự được phân công. Admin có thể xem catalog và cấu hình AI; admin không tự có quyền chấm bài.

Tạo cấu hình mới thay vì sửa cấu hình lịch sử. Model/key do tài khoản provider quyết định; giao diện chỉ cần model ID và prompt, key nằm ở môi trường API và worker. Provider `OPENAI` cần model hỗ trợ Responses Structured Outputs. `JSON_HTTP` nhận payload `{provider,model,instructions,schema,settings,context}` và trả assessment theo schema hoặc `{assessment,usage:{input_tokens,output_tokens}}`.

Khóa mẫu có 6 hoạt động, mỗi bài tối đa 5 attempts và 4 revisions. Bộ rubric là ví dụ giảng dạy, cần thay bằng đặc tả được chuyên gia duyệt trước đánh giá chất lượng chấm.

## Chạy production trên máy local

```powershell
cd backend
npm run build
# Terminal API: khi dùng worker riêng
$env:GRADING_WORKER_ENABLED='false'
npm run start:prod
# Terminal worker khác, cùng .env
npm run start:worker
```

Entrypoint sau build: `dist/main.js` và `dist/worker.js`. `/health` kiểm tra kết nối database. `/grading-report` hiển thị thống kê theo toàn bộ khóa với admin hoặc khóa được phân công với instructor. Số run/review bao phủ scope; latency/token/error chỉ lấy 500 provider calls gần nhất và thể hiện số call thiếu metadata.

Worker poll mỗi 3 giây, lease 120 giây, timeout provider 45 giây, tối đa 3 attempts với backoff. Không chạy worker trên bản build cũ sau khi đổi mã nguồn. Khóa AI phải có ở tiến trình worker; chỉ cấu hình API sẽ không cấp key cho terminal worker đang chạy.

## Phần cần đầu vào bên ngoài

- Chưa có khóa/provider/model được người dùng cấu hình để chạy và kiểm chứng AI thật; đường chấm tay hoạt động.
- Cần bộ bài có nhãn độc lập, rubric được chuyên gia duyệt và dev/holdout để đo MAE, chất lượng feedback và đề xuất. Tooling sẵn ở [evaluation.md](evaluation.md); fixture synthetic không chứng minh accuracy.
- Cấu hình Compose/HTTPS đã được kiểm tra cú pháp; build image, cấp certificate và triển khai VPS cần Docker đang chạy và domain trỏ đúng máy. Xem [deployment.md](deployment.md).
- Kiểm tra bằng trình duyệt tương tác và pilot với người học/giảng viên vẫn cần trước khi nghiệm thu trải nghiệm. Các kiểm tra code, API và integration không xác nhận thay cho nghiên cứu thực nghiệm.
