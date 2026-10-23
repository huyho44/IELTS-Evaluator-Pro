# Ghi chú triển khai schema IELTS Evaluator Pro

Schema mục tiêu chuyển mô hình EERD trong `docs/eerd/model.json` sang Prisma/PostgreSQL. Đây là thay đổi cấu trúc lớn so với schema CRUD ban đầu, gồm tài khoản và LMS, đề và bài giao, lượt làm và bản nộp, chấm điểm, review, bằng chứng kỹ năng, hồ sơ, gợi ý và phần mở rộng RAG.

`schema.prisma` mô tả cấu trúc mục tiêu; việc sửa file hoặc generate Prisma Client không chuyển dữ liệu trong database. Các migration cũ vẫn được giữ. File `constraints.sql` là SQL bổ sung **chưa được thực thi**, đặt ngoài thư mục migrations để tránh tự áp dụng. Chưa thể coi database đang chạy đã có các ràng buộc mới.

## 1. Quy ước và cách đọc

- Model và trường trong Prisma dùng PascalCase/camelCase; `@@map`/`@map` giữ tên bảng UPPER_SNAKE và cột snake_case của EERD. `User` ánh xạ sang `APP_USER`.
- ID nghiệp vụ dùng `String` với native PostgreSQL UUID. Các ID ngắn như `ATT-R1` trong tài liệu chỉ để minh họa, không phải UUID hợp lệ để seed trực tiếp.
- Nếu trường dùng `@default(uuid())`, UUID do Prisma Client sinh; script SQL nhập trực tiếp phải tự cấp UUID. [Prisma v7 — native defaults](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/unsupported-database-features)
- Điểm, trọng số và ngưỡng dùng `Decimal`; API phải quyết định cách serialize thay vì chuyển qua `Float` tùy tiện. `strength` là chỉ số nội bộ, không phải IELTS band.
- Thời gian dùng `timestamptz`; giao diện chuyển múi giờ để hiển thị.
- Các quan hệ lịch sử được khai báo `onDelete: Restrict, onUpdate: Restrict` để bảo vệ đường truy vết. Trạng thái khóa/ẩn/thu hồi là lựa chọn nghiệp vụ phù hợp hơn việc xóa chuỗi kết quả đã công bố. Referent chưa có con vẫn có thể bị xóa: `Restrict` không phải cơ chế append-only. [Prisma v7 — referential actions](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/referential-actions)

Các khóa unique tổng hợp như `(id, kind, revisionId)` có vẻ lặp ID nhưng giúp FK ở bảng con buộc đúng nguồn và ngữ cảnh. Ví dụ `SkillEvidence` cùng lúc tham chiếu `(acceptedId, resultId)` và `(observationId, resultId)` để không ghép quan sát của kết quả A với nguồn được chấp nhận của kết quả B.

## 2. Những gì schema và SQL bổ sung bảo vệ

| Lớp | Có thể bảo vệ | Giới hạn |
|---|---|---|
| Prisma scalar, enum, PK, unique, FK | Kiểu, bắt buộc/null, định danh, quan hệ và các composite context được khai báo | Chỉ có hiệu lực ở database khi migration tương ứng đã áp dụng |
| `constraints.sql`: 17 CHECK theo EERD | Payload theo loại bài/học liệu, discriminator subtype, loại nguồn được chấp nhận, giới hạn điểm thô, offset cơ bản, thứ hạng, một target báo cáo | Không kiểm tra quan hệ xuyên nhiều bảng hoặc chất lượng nội dung |
| `constraints.sql`: ba partial unique index | Một hồ sơ giáo viên PENDING/người; một review PENDING hoặc CLAIMED/revision; một accepted hiện hành/revision | Không thay thế kiểm tra quyền, workflow và transaction |
| `constraints.sql`: hai nhóm deferred constraint trigger | Mỗi LearningItem có đúng một Lesson hoặc PracticeActivity đúng kind; mỗi AssessmentResult có đúng một AIResult, TeacherResult hoặc AnswerKeyResult đúng kind | Parent và subtype phải được ghi trong cùng transaction; không tự xác minh điểm hay nguồn bằng chứng |
| Service và worker | Quyền, điều kiện công bố, nội dung đáp án, quota, chọn evidence, tính hồ sơ và recommendation | Các quy tắc phải được implement và kiểm chứng trong luồng nghiệp vụ |

Prisma v7 có hỗ trợ partial index tùy phiên bản/tính năng. Bản schema này giữ cách biểu diễn ổn định và đặt ba index trên vào SQL bổ sung. Một comment `CHECK` trong schema không tạo constraint trong PostgreSQL. Với phần ngoài khả năng biểu diễn đã chọn, cần đưa SQL vào migration được review. [Prisma v7 — features](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/unsupported-database-features), [custom migrations](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations)

File SQL bổ sung cũng kiểm tra dữ liệu parent/subtype đã có tại thời điểm cài trigger. SQL được thiết kế áp dụng một lần trong migration; không phải script cài đặt lặp an toàn. Không chạy lại nguyên file trên một database đã có constraint/index/function cùng tên.

## 3. Các quy tắc service/transaction vẫn phải thực hiện

### Đề, bài giao và bài nộp

- `Assignment` trỏ hoạt động được phép dùng trong khóa; lesson/ngữ cảnh, chapter, enrollment và tiến độ phải thuộc đúng khóa. FK tồn tại không thay thế quyền đọc/ghi.
- `ActivityVersion`, `QuestionVersion`, options, rubric, prompt, grading config và đáp án đã sử dụng phải bất biến theo chính sách. Thay nội dung tạo version mới. Mỗi dạng Task 2 không tạo một rubric riêng; `rubricCode + versionNo` tách loại rubric với lịch sử sửa bộ tiêu chí.
- Quota lượt làm được tính theo `(learnerId, assignmentId)`, không reset khi đổi `AssignmentVersion`. Sử dụng transaction/locking phù hợp khi cấp `attemptNo` và kiểm tra `maxAttempts`, tránh hai request đồng thời vượt quota.
- Autosave cập nhật `AttemptDraft` với `lockVersion`; nộp bài tạo revision bất biến và các response trong cùng transaction. Kiểm tra `maxRevisions`, hạn, thời lượng và đúng `responseMode` của hoạt động.
- Mỗi `ItemResponse` phải thuộc một item trong đúng phiên bản đề của Attempt. Selection phải thuộc QuestionVersion của item; không nhận option của câu khác.
- `AnswerKeyEntry` phải thuộc đúng activity version của bộ đáp án; option đúng phải thuộc đúng câu. Khi chấm, response, key entry và result phải cùng revision, item và key version. FK đơn lẻ chưa chứng minh toàn bộ chuỗi này.
- Kiểm tra số từ, chuẩn hóa và tập đáp án theo grading rule đã ghim; backend tự chấm, không nhận điểm tính sẵn từ frontend. Tổng điểm và các QuestionMark phải nhất quán.

### AI, giáo viên và công bố

- Provider response phải được kiểm tra cấu trúc, phạm vi điểm và các criterion bắt buộc. Refusal/error/invalid nằm ở `ProviderAttempt`, không tạo AIResult giả.
- AIResult vẫn được lưu và có thể hiển thị dự kiến. Chỉ nguồn TEACHER hoặc ANSWER_KEY qua `AcceptedAssessment`; SQL CHECK bổ sung mới khóa loại này ở database.
- `FindingAnchor` phải chỉ vào đoạn cùng revision của finding/result, nằm trong giới hạn đoạn và trích đúng nguyên văn. CHECK offset không kiểm tra được nội dung này.
- Claim/review cần kiểm tra giáo viên được phân công, `lockVersion` và trạng thái hiện hành. `ReviewDecision`, AssessmentResult và TeacherResult được tạo cùng transaction.
- `ReviewDecision.supersedes` và `AcceptedAssessment.supersedes` phải cùng ngữ cảnh revision; không tự trỏ hoặc tạo chu trình.
- Thay accepted hiện hành: khóa revision, bỏ `isCurrent` của nguồn cũ, công bố nguồn mới và ghi outbox trong một transaction. Nguồn mới đang chờ công bố không thay thế nguồn cũ đã công bố.
- Appeal phải do người có quyền tạo. Hoạt động đọc provisional feedback và kết quả chính thức phải tôn trọng release policy của bài giao.

### Evidence, hồ sơ và recommendation

- Evidence chỉ được sử dụng nếu accepted đã công bố, có hiệu lực và thuộc đúng người học. Hai composite FK bảo vệ cùng result nhưng không tự kiểm tra đủ điều kiện công bố.
- Ghi quan sát rõ MET/PARTIAL/NOT_MET/NOT_OBSERVED; không có finding lỗi chưa đủ để suy ra MET. NOT_OBSERVED và UNKNOWN không được đổi thành điểm 0.
- Với một phiên bản hồ sơ, evidence phải thuộc cùng learner. Mỗi `(Attempt, Skill)` chỉ chọn một nguồn theo policy: revision phù hợp cao nhất đã đủ điều kiện, với accepted hiện hành; không cộng tất cả bản sửa hoặc chỉ chọn theo ngày công bố.
- `ProfileContribution` ghi lineage. Kết quả bị sửa/thu hồi cần dựng phiên bản hồ sơ mới từ nguồn đủ điều kiện; giữ snapshot cũ để giải thích lịch sử.
- Kiểm tra miền `strength`, `support`, trọng số, ngưỡng và số evidence theo policy. Kiểu Decimal không tự bảo đảm phạm vi 0–1.
- Graph `SkillPrerequisite` không được có chu trình. CHECK chỉ ngăn cạnh tự trỏ, không phát hiện chu trình nhiều nút.
- Practice recommendation phải ghim cả activity version và assignment version phù hợp với learning item, mode và quyền của learner; lesson để các đích version null. CHECK cặp null chỉ bảo vệ một phần điều kiện này.
- Khi người học mở một gợi ý, kiểm tra lại quyền, tình trạng nội dung, quota và tiên quyết. Snapshot recommendation không cấp quyền vĩnh viễn.
- Attempt bắt đầu từ recommendation phải có đúng learner và đúng đích gợi ý; không tự đánh dấu thành công khi chỉ nhấn mở. Hoàn tất LessonProgress chưa tự tạo bằng chứng đạt kỹ năng.
- Worker nhận sự kiện ít nhất một lần có thể gặp bản tin lặp. Dùng transaction, idempotency key/unique đã có và trạng thái xử lý để không nhân đôi evidence, contribution hoặc lần chấm.

### Tương tác và RAG

- Reply phải cùng discussion thread; không tự trỏ hoặc tạo chu trình. Nội dung thảo luận phải cùng khóa với context của thread.
- Audit và các bảng lịch sử cần quy tắc append-only ở service/quyền database phù hợp; schema có FK không tự cấm UPDATE.
- Retrieval phải lọc tài liệu theo quyền và trạng thái công bố trước khi đưa vào prompt. Citation trỏ đúng document version/chunk; RAG explanation không được tự trở thành điểm hoặc accepted evidence.

## 4. Kế hoạch migration dữ liệu cũ

Schema cũ có `User.id` kiểu Int, một chuỗi role, Lesson/QuizQuestion/TestSession/Submissions/Evaluation/RubricDescriptor. Schema mới dùng UUID, bảng vai trò và nhiều version/source riêng. Vì vậy **không chạy `db push`, reset hoặc migration sinh tự động chưa review lên database có dữ liệu cần giữ**.

Quy trình cần thực hiện khi bắt đầu triển khai database:

1. Sao lưu, thống kê dữ liệu và xác định cách chuyển từng bảng. Giữ nguyên migration đã áp dụng; tạo migration kế tiếp, không sửa lịch sử để giả lập schema mới đã tồn tại.
2. Tạo bảng/cột đích và bảng ánh xạ ID cũ–UUID mới theo từng loại thực thể. Chuyển User, Role/UserRole, Course, Enrollment và các parent trước bảng con.
3. Phân loại Lesson cũ thành Lesson học liệu hoặc PracticeActivity; chuyển câu hỏi thành QuestionVersion/options/đáp án có kiểm chứng. Không suy ra đầy đủ cấu trúc đáp án chỉ từ một chuỗi `correctAnswer` nếu dữ liệu cũ thiếu thông tin.
4. Chuyển TestSession/Submissions thành Attempt và SubmissionRevision theo ngữ cảnh thật. Chỉ chuyển Evaluation thành loại nguồn AI/TEACHER khi xác định được provenance; không tự công bố hoặc tạo SkillEvidence cho đánh giá cũ thiếu nguồn xác nhận.
5. Kiểm tra số lượng và FK, backfill phiên bản và subtype; chạy dữ liệu thử cho Reading/Listening và Writing. Đưa `constraints.sql` đã review vào phần migration sau khi target table/backfill đã có.
6. Chuyển service/seed sang Prisma Client mới, xác minh ứng dụng trên database thử nghiệm, sau đó mới lên lịch áp dụng cho database dùng thật. Chỉ loại bỏ bảng legacy sau khi hoàn tất đối chiếu và kế hoạch rollback.

Nếu chỉ có dữ liệu demo, có thể chọn cách khởi tạo database phát triển riêng. Đó vẫn là quyết định triển khai riêng, không được suy ra rằng thay file schema đã cho phép xóa database hiện tại.

## 5. RAG và pgvector

Nếu `KnowledgeChunk.embedding` được khai báo `Unsupported("vector")?`, database cần extension pgvector **trước khi tạo cột vector**. Cài extension ở đầu migration tạo bảng, không chờ chạy SQL ràng buộc sau cùng. Extension phải sẵn có cả ở môi trường thử/shadow nếu workflow migration sử dụng shadow database.

Dimension, embedding model và quy tắc chunking phải được quyết định khi triển khai retrieval. Field Unsupported không được Prisma Client truy cập như scalar thông thường; phần vector cần truy vấn SQL có tham số hoặc integration phù hợp. [Prisma v7 — unsupported types](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/unsupported-database-features)

Năm bảng RAG là phần mở rộng; luồng chấm theo đáp án, giáo viên xác nhận, evidence và recommendation theo quy tắc không đòi hỏi chạy embedding trước.
