# Từ điển dữ liệu EERD

Ngày 20/10/2026. Khóa được tạo bởi ứng dụng hoặc DB khi triển khai; các kiểu uuid/timestamptz/decimal/jsonb là lựa chọn logic cho PostgreSQL. Mọi tham chiếu trong DBML đều đã được kiểm tra tồn tại, tương thích kiểu và khóa duy nhất phía được tham chiếu. Các invariant xuyên bảng vẫn cần triển khai riêng.

## Tài khoản và phân quyền

### APP_USER

Tài khoản chung. Vai trò là quan hệ N:M; không ép một tài khoản chỉ học hoặc chỉ dạy.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| email | varchar(320) | UQ | Không |  |
| password_hash | text |  | Không |  |
| display_name | varchar(120) |  | Không |  |
| status | account_status |  | Không |  |
| target_band | decimal(3,1) |  | Có |  |
| target_exam_date | date |  | Có |  |
| created_at | timestamptz |  | Không |  |

### ROLE

Ba vai trò ban đầu LEARNER, INSTRUCTOR, ADMIN.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| code | varchar(30) | UQ | Không |  |
| name | varchar(80) |  | Không |  |

### USER_ROLE

Bảng nối người dùng–vai trò.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| user_id | uuid | PK, FK | Không | APP_USER(id) |
| role_id | uuid | PK, FK | Không | ROLE(id) |
| granted_at | timestamptz |  | Không |  |

### AUTH_SESSION

Phiên đăng nhập; không lưu refresh token dạng rõ.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| user_id | uuid | FK | Không | APP_USER(id) |
| refresh_token_hash | text | UQ | Không |  |
| expires_at | timestamptz |  | Không |  |
| revoked_at | timestamptz |  | Có |  |

### INSTRUCTOR_APPLICATION

Hồ sơ xin quyền giáo viên. Một người có lịch sử nhiều hồ sơ, tối đa một hồ sơ chờ xử lý.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| applicant_id | uuid | FK | Không | APP_USER(id) |
| reviewer_id | uuid | FK | Có | APP_USER(id) |
| status | approval_status |  | Không |  |
| profile_text | text |  | Không |  |
| decision_reason | text |  | Có |  |
| submitted_at | timestamptz |  | Không |  |
| reviewed_at | timestamptz |  | Có |  |

### FILE_ASSET

Metadata tệp; nội dung ở object storage. Không lưu URL tạm thời làm định danh.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| owner_id | uuid | FK | Không | APP_USER(id) |
| storage_key | text | UQ | Không |  |
| original_name | text |  | Không |  |
| mime_type | varchar(120) |  | Không |  |
| byte_size | bigint |  | Không |  |
| content_hash | varchar(128) |  | Không |  |
| created_at | timestamptz |  | Không |  |

## Khóa học và học liệu

### COURSE

Khóa học; điều kiện hoàn thành được công bố trước.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| creator_id | uuid | FK | Không | APP_USER(id) |
| title | varchar(240) |  | Không |  |
| description | text |  | Không |  |
| status | publication_status |  | Không |  |
| enrollment_open | boolean |  | Không |  |
| completion_policy_json | jsonb |  | Không |  |
| created_at | timestamptz |  | Không |  |

### COURSE_INSTRUCTOR

Phân công theo khóa; không đồng nhất với vai trò INSTRUCTOR toàn hệ thống.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| course_id | uuid | PK, FK | Không | COURSE(id) |
| instructor_id | uuid | PK, FK | Không | APP_USER(id) |
| responsibility | varchar(30) |  | Không |  |
| assigned_at | timestamptz |  | Không |  |

### CHAPTER

Chương thuộc một khóa.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| course_id | uuid | FK | Không | COURSE(id) |
| title | varchar(240) |  | Không |  |
| position | int |  | Không |  |

**UQ ghép:** (course_id, position); (id, course_id).

### LEARNING_ITEM

Supertype của LESSON và PRACTICE_ACTIVITY: total, disjoint. Recommendation và tag kỹ năng trỏ vào một đích có FK thật.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| course_id | uuid | FK | Không | COURSE(id); CHAPTER(id, course_id) |
| chapter_id | uuid | FK | Có | CHAPTER(id, course_id) |
| kind | learning_item_kind |  | Không |  |
| title | varchar(240) |  | Không |  |
| status | publication_status |  | Không |  |
| position | int |  | Không |  |

**UQ ghép:** (id, kind).

### LESSON

Subtype học liệu; kind cố định LESSON.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK, FK | Không | LEARNING_ITEM(id, kind) |
| kind | learning_item_kind | FK | Không | LEARNING_ITEM(id, kind) |
| summary | text |  | Có |  |

**CHECK:**

- `kind = 'LESSON'`

### PRACTICE_ACTIVITY

Subtype bài luyện/đánh giá; kind cố định PRACTICE. Nội dung đề có phiên bản riêng.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK, FK | Không | LEARNING_ITEM(id, kind) |
| kind | learning_item_kind | FK | Không | LEARNING_ITEM(id, kind) |
| creator_id | uuid | FK | Không | APP_USER(id) |
| skill_area | skill_area |  | Không |  |
| response_mode | response_mode |  | Không |  |

**CHECK:**

- `kind = 'PRACTICE'`

### LESSON_MATERIAL

Một bài học có nhiều học liệu. Đúng một payload theo kind; có thể gồm văn bản và video/tệp.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| lesson_id | uuid | FK | Không | LESSON(id) |
| kind | material_kind |  | Không |  |
| position | int |  | Không |  |
| content_text | text |  | Có |  |
| external_url | text |  | Có |  |
| file_asset_id | uuid | FK | Có | FILE_ASSET(id) |

**UQ ghép:** (lesson_id, position).

**CHECK:**

- `(kind = 'TEXT' AND content_text IS NOT NULL AND external_url IS NULL AND file_asset_id IS NULL) OR (kind = 'URL' AND external_url IS NOT NULL AND content_text IS NULL AND file_asset_id IS NULL) OR (kind = 'FILE' AND file_asset_id IS NOT NULL AND content_text IS NULL AND external_url IS NULL)`

### ENROLLMENT

Một enrollment cho mỗi học viên–khóa; rời rồi học lại cập nhật cùng hồ sơ theo chính sách.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| learner_id | uuid | FK | Không | APP_USER(id) |
| course_id | uuid | FK | Không | COURSE(id) |
| status | varchar(24) |  | Không |  |
| enrolled_at | timestamptz |  | Không |  |
| left_at | timestamptz |  | Có |  |
| completed_at | timestamptz |  | Có |  |

**UQ ghép:** (learner_id, course_id).

### LESSON_PROGRESS

Tiến độ nội dung, tách khỏi năng lực. Lesson phải thuộc khóa của enrollment.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| enrollment_id | uuid | PK, FK | Không | ENROLLMENT(id) |
| lesson_id | uuid | PK, FK | Không | LESSON(id) |
| status | varchar(24) |  | Không |  |
| last_position_json | jsonb |  | Có |  |
| last_accessed_at | timestamptz |  | Không |  |
| completed_at | timestamptz |  | Có |  |

## Bài giao và bài làm

### ACTIVITY_VERSION

Đề/hoạt động bất biến sau công bố. Response mode và skill area lấy từ activity; không đổi mode khi đã có phiên bản sử dụng.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| activity_id | uuid | FK | Không | PRACTICE_ACTIVITY(id) |
| version_no | int |  | Không |  |
| prompt_text | text |  | Không |  |
| instructions | text |  | Không |  |
| difficulty | int |  | Không |  |
| expected_minutes | int |  | Không |  |
| published_at | timestamptz |  | Có |  |
| content_hash | varchar(128) |  | Không |  |

**UQ ghép:** (activity_id, version_no); (id, activity_id).

### ASSIGNMENT

Lần giao một hoạt động trong khóa. Phân biệt đề tái sử dụng với hạn và quy tắc của lần giao.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| course_id | uuid | FK | Không | COURSE(id) |
| activity_id | uuid | FK | Không | PRACTICE_ACTIVITY(id) |
| context_lesson_id | uuid | FK | Có | LESSON(id) |
| creator_id | uuid | FK | Không | APP_USER(id) |
| title | varchar(240) |  | Không |  |

**UQ ghép:** (id, activity_id).

### ASSIGNMENT_VERSION

Ghim đề và chính sách: sửa hạn/quy tắc tạo version mới; attempt giữ version cũ trừ khi có gia hạn ghi nhận.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| assignment_id | uuid | FK | Không | ASSIGNMENT(id, activity_id) |
| activity_id | uuid | FK | Không | ASSIGNMENT(id, activity_id); ACTIVITY_VERSION(id, activity_id) |
| activity_version_id | uuid | FK | Không | ACTIVITY_VERSION(id, activity_id) |
| rubric_version_id | uuid | FK | Có | RUBRIC_VERSION(id) |
| version_no | int |  | Không |  |
| mode | assignment_mode |  | Không |  |
| opens_at | timestamptz |  | Có |  |
| due_at | timestamptz |  | Có |  |
| time_limit_seconds | int |  | Có |  |
| max_attempts | int |  | Không |  |
| max_revisions | int |  | Không |  |
| allow_late | boolean |  | Không |  |
| release_policy_json | jsonb |  | Không |  |
| published_at | timestamptz |  | Có |  |

**UQ ghép:** (assignment_id, version_no); (id, assignment_id, activity_version_id); (id, activity_version_id, activity_id).

### ATTEMPT

Một cơ hội làm/luyện. Số thứ tự và quota tính theo assignment ổn định qua các phiên bản chính sách. Đây cũng là gốc nhóm evidence của chuỗi revisions.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| learner_id | uuid | FK | Không | APP_USER(id) |
| assignment_id | uuid | FK | Không | ASSIGNMENT_VERSION(id, assignment_id, activity_version_id) |
| assignment_version_id | uuid | FK | Không | ASSIGNMENT_VERSION(id, assignment_id, activity_version_id); RECOMMENDATION_ITEM(id, target_assignment_version_id, target_activity_version_id) |
| activity_version_id | uuid | FK | Không | ASSIGNMENT_VERSION(id, assignment_id, activity_version_id); RECOMMENDATION_ITEM(id, target_assignment_version_id, target_activity_version_id) |
| attempt_no | int |  | Không |  |
| status | attempt_status |  | Không |  |
| started_at | timestamptz |  | Không |  |
| expires_at | timestamptz |  | Có |  |
| finished_at | timestamptz |  | Có |  |
| recommendation_item_id | uuid | FK | Có | RECOMMENDATION_ITEM(id, target_assignment_version_id, target_activity_version_id) |

**UQ ghép:** (learner_id, assignment_id, attempt_no).

### ATTEMPT_DRAFT

Bản nháp mutable; autosave không tạo bản nộp hay lượt chấm.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| attempt_id | uuid | PK, FK | Không | ATTEMPT(id) |
| payload_json | jsonb |  | Không |  |
| lock_version | int |  | Không |  |
| updated_at | timestamptz |  | Không |  |

### SUBMISSION_REVISION

Bản đã nộp bất biến. OBJECTIVE dùng ITEM_RESPONSE; WRITING dùng text; SPEAKING dùng audio. Sửa lại cùng cơ hội tạo revision mới.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| attempt_id | uuid | FK | Không | ATTEMPT(id) |
| revision_no | int |  | Không |  |
| response_mode | response_mode |  | Không |  |
| writing_text | text |  | Có |  |
| audio_asset_id | uuid | FK | Có | FILE_ASSET(id) |
| submitted_at | timestamptz |  | Không |  |
| content_hash | varchar(128) |  | Không |  |

**UQ ghép:** (attempt_id, revision_no).

**CHECK:**

- `(response_mode = 'OBJECTIVE' AND writing_text IS NULL AND audio_asset_id IS NULL) OR (response_mode = 'WRITING' AND writing_text IS NOT NULL AND audio_asset_id IS NULL) OR (response_mode = 'SPEAKING' AND audio_asset_id IS NOT NULL AND writing_text IS NULL)`

### REVISION_PARAGRAPH

Đoạn văn đã chuẩn hóa và cố định của Writing revision; dùng để kiểm tra trích dẫn.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| revision_id | uuid | FK | Không | SUBMISSION_REVISION(id) |
| paragraph_no | int |  | Không |  |
| text | text |  | Không |  |
| start_offset | int |  | Không |  |
| end_offset | int |  | Không |  |

**UQ ghép:** (revision_id, paragraph_no).

**CHECK:**

- `start_offset >= 0 AND end_offset >= start_offset`

### QUESTION

Định danh câu hỏi trong ngân hàng.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| author_id | uuid | FK | Không | APP_USER(id) |
| skill_area | skill_area |  | Không |  |
| title | varchar(240) |  | Không |  |

### QUESTION_VERSION

Nội dung câu hỏi và lựa chọn bất biến; đáp án được lưu riêng theo key version.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| question_id | uuid | FK | Không | QUESTION(id) |
| version_no | int |  | Không |  |
| question_type | question_type |  | Không |  |
| prompt_text | text |  | Không |  |
| stimulus_text | text |  | Có |  |
| stimulus_asset_id | uuid | FK | Có | FILE_ASSET(id) |
| published_at | timestamptz |  | Có |  |

**UQ ghép:** (question_id, version_no).

### QUESTION_OPTION

Lựa chọn của câu hỏi trắc nghiệm; không mặc định chỉ chọn một.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| question_version_id | uuid | FK | Không | QUESTION_VERSION(id) |
| option_code | varchar(12) |  | Không |  |
| content_text | text |  | Không |  |
| position | int |  | Không |  |

**UQ ghép:** (question_version_id, option_code); (question_version_id, position).

### ASSESSMENT_ITEM

Bảng nối đề–phiên bản câu hỏi. Reading/Listening và micro-quiz dùng cùng cấu trúc.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| activity_version_id | uuid | FK | Không | ACTIVITY_VERSION(id) |
| question_version_id | uuid | FK | Không | QUESTION_VERSION(id) |
| position | int |  | Không |  |
| section_label | varchar(120) |  | Có |  |
| max_marks | decimal(6,2) |  | Không |  |

**UQ ghép:** (activity_version_id, position).

### ANSWER_KEY_VERSION

Đáp án theo phiên bản đề; sửa đáp án không làm mất kết quả cũ. Bảng quy đổi điểm nếu có được lưu cùng version.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| activity_version_id | uuid | FK | Không | ACTIVITY_VERSION(id) |
| version_no | int |  | Không |  |
| score_mapping_json | jsonb |  | Có |  |
| published_at | timestamptz |  | Có |  |

**UQ ghép:** (activity_version_id, version_no).

### ANSWER_KEY_ENTRY

Đáp án/cách chấp nhận cho một item; cùng activity version với key.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| answer_key_version_id | uuid | FK | Không | ANSWER_KEY_VERSION(id) |
| assessment_item_id | uuid | FK | Không | ASSESSMENT_ITEM(id) |
| accepted_texts_json | jsonb |  | Có |  |
| grading_rule_json | jsonb |  | Không |  |

**UQ ghép:** (answer_key_version_id, assessment_item_id).

### ANSWER_KEY_OPTION

Tập đáp án lựa chọn đúng; option phải thuộc QuestionVersion của item trong key entry.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| entry_id | uuid | PK, FK | Không | ANSWER_KEY_ENTRY(id) |
| option_id | uuid | PK, FK | Không | QUESTION_OPTION(id) |

### ITEM_RESPONSE

Câu trả lời được nộp. Nhiều lựa chọn được biểu diễn qua RESPONSE_SELECTION.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| revision_id | uuid | FK | Không | SUBMISSION_REVISION(id) |
| assessment_item_id | uuid | FK | Không | ASSESSMENT_ITEM(id) |
| text_answer | text |  | Có |  |

**UQ ghép:** (revision_id, assessment_item_id).

### RESPONSE_SELECTION

Bảng nối cho câu trả lời một hoặc nhiều lựa chọn. Option phải thuộc câu hỏi của response.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| response_id | uuid | PK, FK | Không | ITEM_RESPONSE(id) |
| option_id | uuid | PK, FK | Không | QUESTION_OPTION(id) |

## Rubric, AI và kết quả

### RUBRIC_VERSION

Rubric định danh bằng code+version. Task 2, Task 1 và Speaking có bộ tiêu chí tương ứng, không hard-code bốn cột cho mọi bài.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| rubric_code | varchar(60) |  | Không |  |
| version_no | int |  | Không |  |
| task_type | varchar(60) |  | Không |  |
| title | varchar(240) |  | Không |  |
| source_url | text |  | Có |  |
| published_at | timestamptz |  | Có |  |

**UQ ghép:** (rubric_code, version_no).

### RUBRIC_CRITERION

Tiêu chí thuộc đúng một rubric version: TR/CC/LR/GRA hoặc bộ Speaking.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| rubric_version_id | uuid | FK | Không | RUBRIC_VERSION(id) |
| code | varchar(30) |  | Không |  |
| name | varchar(140) |  | Không |  |
| definition | text |  | Không |  |
| weight | decimal(6,3) |  | Không |  |
| max_score | decimal(6,2) |  | Không |  |

**UQ ghép:** (rubric_version_id, code); (id, rubric_version_id).

### BAND_DESCRIPTOR

Mô tả mức chất lượng cho tiêu chí; không phải một embedding của cả rubric.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| criterion_id | uuid | FK | Không | RUBRIC_CRITERION(id) |
| band_value | decimal(3,1) |  | Không |  |
| description | text |  | Không |  |

**UQ ghép:** (criterion_id, band_value).

### PROMPT_VERSION

Prompt được quản lý độc lập với rubric.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| prompt_code | varchar(60) |  | Không |  |
| version_no | int |  | Không |  |
| instructions | text |  | Không |  |
| output_schema_json | jsonb |  | Không |  |
| created_at | timestamptz |  | Không |  |

**UQ ghép:** (prompt_code, version_no).

### GRADING_CONFIG

Cấu hình chấm bất biến sau sử dụng; có thể bắt đầu với một config.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| rubric_version_id | uuid | FK | Không | RUBRIC_VERSION(id) |
| prompt_version_id | uuid | FK | Không | PROMPT_VERSION(id) |
| provider | varchar(60) |  | Không |  |
| model_id | varchar(120) |  | Không |  |
| settings_json | jsonb |  | Không |  |
| created_at | timestamptz |  | Không |  |

### GRADING_RUN

Một yêu cầu chấm AI. Có thể không sinh AI_RESULT khi lỗi/refusal/invalid; chấm lại chủ ý tạo run mới.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| revision_id | uuid | FK | Không | SUBMISSION_REVISION(id) |
| config_id | uuid | FK | Không | GRADING_CONFIG(id) |
| request_key | varchar(160) | UQ | Không |  |
| status | run_status |  | Không |  |
| attempts | int |  | Không |  |
| processing_token | uuid |  | Có |  |
| lease_until | timestamptz |  | Có |  |
| started_at | timestamptz |  | Có |  |
| completed_at | timestamptz |  | Có |  |
| error_code | varchar(80) |  | Có |  |

**UQ ghép:** (id, revision_id).

### PROVIDER_ATTEMPT

Lưu lần gọi thật, kể cả thất bại; không ép dữ liệu lỗi thành điểm hợp lệ.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| grading_run_id | uuid | FK | Không | GRADING_RUN(id) |
| attempt_no | int |  | Không |  |
| status | provider_attempt_status |  | Không |  |
| provider_request_id | text |  | Có |  |
| raw_response_json | jsonb |  | Có |  |
| error_json | jsonb |  | Có |  |
| input_tokens | int |  | Có |  |
| output_tokens | int |  | Có |  |
| latency_ms | int |  | Có |  |
| created_at | timestamptz |  | Không |  |

**UQ ghép:** (grading_run_id, attempt_no).

### ASSESSMENT_RESULT

Supertype kết quả bất biến: total, disjoint AI/TEACHER/ANSWER_KEY. Điểm dự kiến không tự là accepted evidence.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| revision_id | uuid | FK | Không | SUBMISSION_REVISION(id) |
| kind | result_kind |  | Không |  |
| rubric_version_id | uuid | FK | Có | RUBRIC_VERSION(id) |
| overall_score | decimal(6,2) |  | Có |  |
| score_scale | score_scale |  | Không |  |
| summary | text |  | Có |  |
| created_at | timestamptz |  | Không |  |

**UQ ghép:** (id, kind, revision_id); (id, rubric_version_id).

**CHECK:**

- `(kind = 'ANSWER_KEY' AND rubric_version_id IS NULL) OR (kind IN ('AI','TEACHER') AND rubric_version_id IS NOT NULL)`

### AI_RESULT

Subtype AI; kết quả chuẩn hóa hợp lệ. Refusal/invalid ở PROVIDER_ATTEMPT. Nhận xét vẫn là dự kiến.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK, FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| kind | result_kind | FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| revision_id | uuid | FK | Không | ASSESSMENT_RESULT(id, kind, revision_id); GRADING_RUN(id, revision_id) |
| grading_run_id | uuid | UQ, FK | Không | GRADING_RUN(id, revision_id) |
| quality_status | quality_status |  | Không |  |
| validation_json | jsonb |  | Không |  |

**CHECK:**

- `kind = 'AI'`

### TEACHER_RESULT

Subtype giáo viên; được tạo cùng quyết định xác nhận trong transaction.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK, FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| kind | result_kind | FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| revision_id | uuid | FK | Không | ASSESSMENT_RESULT(id, kind, revision_id); REVIEW_DECISION(id, revision_id) |
| decision_id | uuid | UQ, FK | Không | REVIEW_DECISION(id, revision_id) |

**CHECK:**

- `kind = 'TEACHER'`

### ANSWER_KEY_RESULT

Subtype chấm đáp án; không cần GRADING_RUN hoặc giáo viên để chấp nhận tự động theo quy tắc.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK, FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| kind | result_kind | FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| revision_id | uuid | FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| answer_key_version_id | uuid | FK | Không | ANSWER_KEY_VERSION(id) |
| raw_score | decimal(6,2) |  | Không |  |
| max_score | decimal(6,2) |  | Không |  |

**CHECK:**

- `kind = 'ANSWER_KEY'`
- `raw_score >= 0 AND raw_score <= max_score`

### CRITERION_SCORE

Điểm tiêu chí chung cho AI và giáo viên; cùng rubric của result.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| result_id | uuid | FK | Không | ASSESSMENT_RESULT(id, rubric_version_id) |
| rubric_version_id | uuid | FK | Không | ASSESSMENT_RESULT(id, rubric_version_id); RUBRIC_CRITERION(id, rubric_version_id) |
| criterion_id | uuid | FK | Không | RUBRIC_CRITERION(id, rubric_version_id) |
| score | decimal(6,2) |  | Không |  |
| explanation | text |  | Có |  |

**UQ ghép:** (result_id, criterion_id); (id, result_id).

### QUESTION_MARK

Chấm từng câu; response/key phải cùng revision, item và version phù hợp.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| answer_key_result_id | uuid | FK | Không | ANSWER_KEY_RESULT(id) |
| response_id | uuid | FK | Không | ITEM_RESPONSE(id) |
| key_entry_id | uuid | FK | Không | ANSWER_KEY_ENTRY(id) |
| awarded_marks | decimal(6,2) |  | Không |  |
| explanation | text |  | Có |  |

**UQ ghép:** (answer_key_result_id, response_id).

### FINDING

Nhận xét cục bộ hoặc toàn bài. Finding thuộc kết quả AI không được tự dùng làm SkillEvidence.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| result_id | uuid | FK | Không | ASSESSMENT_RESULT(id); CRITERION_SCORE(id, result_id) |
| criterion_score_id | uuid | FK | Có | CRITERION_SCORE(id, result_id) |
| skill_id | uuid | FK | Có | SKILL(id) |
| finding_kind | varchar(30) |  | Không |  |
| explanation | text |  | Không |  |
| validation_json | jsonb |  | Có |  |

### FINDING_ANCHOR

Một finding có thể viện dẫn nhiều đoạn. Đoạn phải cùng revision của result; trích dẫn được kiểm tra.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| finding_id | uuid | FK | Không | FINDING(id) |
| paragraph_id | uuid | FK | Không | REVISION_PARAGRAPH(id) |
| start_offset | int |  | Không |  |
| end_offset | int |  | Không |  |
| exact_quote | text |  | Không |  |

**CHECK:**

- `start_offset >= 0 AND end_offset > start_offset`

## Kiểm duyệt và công bố

### REVIEW_CASE

Review luôn trỏ revision. Run tùy chọn: Speaking/manual hoặc AI lỗi vẫn được review. Tối đa một case hoạt động cho một revision.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| revision_id | uuid | FK | Không | SUBMISSION_REVISION(id); GRADING_RUN(id, revision_id) |
| target_run_id | uuid | FK | Có | GRADING_RUN(id, revision_id) |
| assignee_id | uuid | FK | Có | APP_USER(id) |
| status | review_status |  | Không |  |
| reason_code | varchar(60) |  | Không |  |
| priority | int |  | Không |  |
| lock_version | int |  | Không |  |
| created_at | timestamptz |  | Không |  |
| claimed_at | timestamptz |  | Có |  |

**UQ ghép:** (id, revision_id).

### REVIEW_DECISION

Quyết định bất biến; sửa sau duyệt tạo quyết định mới. Không trỏ ngược TeacherResult bằng FK bắt buộc.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| review_case_id | uuid | FK | Không | REVIEW_CASE(id, revision_id) |
| revision_id | uuid | FK | Không | REVIEW_CASE(id, revision_id) |
| teacher_id | uuid | FK | Không | APP_USER(id) |
| decision_no | int |  | Không |  |
| supersedes_id | uuid | FK | Có | REVIEW_DECISION(id) |
| reason | text |  | Không |  |
| decided_at | timestamptz |  | Không |  |

**UQ ghép:** (review_case_id, decision_no); (id, revision_id).

### ACCEPTED_ASSESSMENT

Nguồn được chấp nhận: chỉ TEACHER hoặc ANSWER_KEY, có FK thật đến result. Một nguồn hiện hành đã công bố mỗi revision.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| result_id | uuid | UQ, FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| result_kind | result_kind | FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| revision_id | uuid | FK | Không | ASSESSMENT_RESULT(id, kind, revision_id) |
| accepted_at | timestamptz |  | Không |  |
| release_after | timestamptz |  | Có |  |
| published_at | timestamptz |  | Có |  |
| is_current | boolean |  | Không |  |
| supersedes_id | uuid | FK | Có | ACCEPTED_ASSESSMENT(id) |

**UQ ghép:** (id, revision_id); (id, result_id).

**CHECK:**

- `result_kind IN ('TEACHER','ANSWER_KEY')`
- `(NOT is_current) OR published_at IS NOT NULL`

### APPEAL

Yêu cầu xem lại kết quả đã chấp nhận. Composite FK buộc accepted và review case cùng revision; kiểm tra quyền của requester. ReviewCase có thể được tạo sau khi tiếp nhận.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| accepted_id | uuid | FK | Không | ACCEPTED_ASSESSMENT(id, revision_id) |
| revision_id | uuid | FK | Không | ACCEPTED_ASSESSMENT(id, revision_id); REVIEW_CASE(id, revision_id) |
| requester_id | uuid | FK | Không | APP_USER(id) |
| review_case_id | uuid | FK | Có | REVIEW_CASE(id, revision_id) |
| status | appeal_status |  | Không |  |
| reason | text |  | Không |  |
| resolution | text |  | Có |  |
| requested_at | timestamptz |  | Không |  |
| resolved_at | timestamptz |  | Có |  |

## Kỹ năng và gợi ý

### SKILL

Kỹ năng nội bộ do giáo viên xác nhận, không đồng nhất với band criterion.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| code | varchar(80) | UQ | Không |  |
| name | varchar(160) |  | Không |  |
| skill_area | skill_area |  | Không |  |
| observable_definition | text |  | Không |  |
| status | publication_status |  | Không |  |

### SKILL_PREREQUISITE

Đồ thị tiên quyết: không tự trỏ và không chu trình. Ngưỡng là policy, chưa phải xác suất mastery.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| skill_id | uuid | PK, FK | Không | SKILL(id) |
| prerequisite_skill_id | uuid | PK, FK | Không | SKILL(id) |
| min_strength | decimal(5,4) |  | Có |  |
| min_support | decimal(5,4) |  | Có |  |

**CHECK:**

- `skill_id <> prerequisite_skill_id`

### LEARNING_ITEM_SKILL

Tag dùng để chọn lesson hoặc practice; purpose phân biệt TEACH/PRACTISE/ASSESS. Một mapping tổng hợp cho mỗi item–skill.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| learning_item_id | uuid | PK, FK | Không | LEARNING_ITEM(id) |
| skill_id | uuid | PK, FK | Không | SKILL(id) |
| purpose | varchar(24) |  | Không |  |
| coverage_weight | decimal(5,4) |  | Không |  |

### ITEM_SKILL

Một câu hỏi cung cấp cơ hội quan sát kỹ năng nào. Khác với tag hoạt động phục vụ gợi ý.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| assessment_item_id | uuid | PK, FK | Không | ASSESSMENT_ITEM(id) |
| skill_id | uuid | PK, FK | Không | SKILL(id) |
| observation_weight | decimal(5,4) |  | Không |  |

### SKILL_OBSERVATION

Quan sát rõ MET/PARTIAL/NOT_MET/NOT_OBSERVED. AI có thể đề xuất; giáo viên hoặc đáp án tạo quan sát được chấp nhận. Không có lỗi không đồng nghĩa đạt.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| result_id | uuid | FK | Không | ASSESSMENT_RESULT(id) |
| skill_id | uuid | FK | Không | SKILL(id) |
| outcome | observation_outcome |  | Không |  |
| rationale | text |  | Không |  |

**UQ ghép:** (result_id, skill_id); (id, result_id).

### SKILL_EVIDENCE

Hai composite FK bắt buộc observation và accepted cùng result. Chỉ dùng nguồn đã công bố; NOT_OBSERVED không ánh xạ thành 0.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| accepted_id | uuid | FK | Không | ACCEPTED_ASSESSMENT(id, result_id) |
| observation_id | uuid | FK | Không | SKILL_OBSERVATION(id, result_id) |
| result_id | uuid | FK | Không | ACCEPTED_ASSESSMENT(id, result_id); SKILL_OBSERVATION(id, result_id) |
| evidence_policy_version | varchar(60) |  | Không |  |
| created_at | timestamptz |  | Không |  |

**UQ ghép:** (accepted_id, observation_id).

### POLICY_VERSION

Chính sách projection và recommendation bất biến theo phiên bản.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| policy_code | varchar(80) |  | Không |  |
| version_no | int |  | Không |  |
| policy_kind | varchar(30) |  | Không |  |
| config_json | jsonb |  | Không |  |
| code_version | varchar(120) |  | Không |  |

**UQ ghép:** (policy_code, version_no).

### LEARNER_PROFILE_VERSION

Snapshot hồ sơ để lưu lịch sử và gắn với recommendation.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| learner_id | uuid | FK | Không | APP_USER(id) |
| version_no | int |  | Không |  |
| projection_policy_id | uuid | FK | Không | POLICY_VERSION(id) |
| goal_snapshot_json | jsonb |  | Không |  |
| evidence_watermark | text |  | Không |  |
| created_at | timestamptz |  | Không |  |

**UQ ghép:** (learner_id, version_no); (id, learner_id).

### LEARNER_SKILL_STATE

Projection theo kỹ năng; UNKNOWN dùng strength NULL. Support là mức đầy đủ bằng chứng, không là độ tự tin của LLM.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| profile_id | uuid | PK, FK | Không | LEARNER_PROFILE_VERSION(id) |
| skill_id | uuid | PK, FK | Không | SKILL(id) |
| strength | decimal(5,4) |  | Có |  |
| support | decimal(5,4) |  | Không |  |
| evidence_count | int |  | Không |  |
| observation_status | observation_status |  | Không |  |

### PROFILE_CONTRIBUTION

Lineage evidence dùng dựng profile, phải cùng learner. Mỗi Attempt–Skill chỉ một contribution hiện hành; chọn revision_no cao nhất đã đủ điều kiện và quyết định hiện hành, không xếp chỉ theo ngày công bố và không cộng mọi revision.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| profile_id | uuid | PK, FK | Không | LEARNER_PROFILE_VERSION(id) |
| evidence_id | uuid | PK, FK | Không | SKILL_EVIDENCE(id) |
| effective_weight | decimal(7,4) |  | Không |  |

### RECOMMENDATION_RUN

Giữ snapshot ứng viên, điều kiện lọc, metadata và policy để giải thích quyết định cũ.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| learner_id | uuid | FK | Không | LEARNER_PROFILE_VERSION(id, learner_id) |
| profile_id | uuid | FK | Không | LEARNER_PROFILE_VERSION(id, learner_id) |
| policy_id | uuid | FK | Không | POLICY_VERSION(id) |
| context_snapshot_json | jsonb |  | Không |  |
| candidate_snapshot_json | jsonb |  | Không |  |
| created_at | timestamptz |  | Không |  |

### RECOMMENDATION_ITEM

Đích có FK là lesson hoặc practice. Practice phải ghim cả activity version và assignment version đúng mode/quyền; lesson để hai trường này NULL. Metadata giữ snapshot để giải thích khi nội dung đổi.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| run_id | uuid | FK | Không | RECOMMENDATION_RUN(id) |
| learning_item_id | uuid | FK | Không | LEARNING_ITEM(id); ACTIVITY_VERSION(id, activity_id); ASSIGNMENT_VERSION(id, activity_version_id, activity_id) |
| target_activity_version_id | uuid | FK | Có | ACTIVITY_VERSION(id, activity_id); ASSIGNMENT_VERSION(id, activity_version_id, activity_id) |
| target_assignment_version_id | uuid | FK | Có | ASSIGNMENT_VERSION(id, activity_version_id, activity_id) |
| rank | int |  | Không |  |
| total_score | decimal(9,5) |  | Không |  |
| score_components_json | jsonb |  | Không |  |
| reason_code | varchar(60) |  | Không |  |
| reason_text | text |  | Không |  |
| target_snapshot_json | jsonb |  | Không |  |

**UQ ghép:** (run_id, rank); (run_id, learning_item_id); (id, target_assignment_version_id, target_activity_version_id).

**CHECK:**

- `rank >= 1 AND rank <= 3`
- `(target_activity_version_id IS NULL) = (target_assignment_version_id IS NULL)`

## Tương tác và vận hành

### DISCUSSION_THREAD

Thảo luận theo khóa hoặc learning item cùng khóa.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| course_id | uuid | FK | Không | COURSE(id) |
| context_item_id | uuid | FK | Có | LEARNING_ITEM(id) |
| creator_id | uuid | FK | Không | APP_USER(id) |
| title | varchar(240) |  | Không |  |
| status | varchar(24) |  | Không |  |
| created_at | timestamptz |  | Không |  |

### DISCUSSION_POST

Reply phải cùng thread, không tự trỏ/chu trình.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| thread_id | uuid | FK | Không | DISCUSSION_THREAD(id) |
| author_id | uuid | FK | Không | APP_USER(id) |
| parent_post_id | uuid | FK | Có | DISCUSSION_POST(id) |
| body | text |  | Không |  |
| status | varchar(24) |  | Không |  |
| created_at | timestamptz |  | Không |  |
| edited_at | timestamptz |  | Có |  |

### NOTIFICATION

Thông báo cho một người; link điều hướng không cấp quyền truy cập.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| recipient_id | uuid | FK | Không | APP_USER(id) |
| notification_type | varchar(60) |  | Không |  |
| title | varchar(240) |  | Không |  |
| body | text |  | Không |  |
| navigation_path | text |  | Có |  |
| context_snapshot_json | jsonb |  | Có |  |
| created_at | timestamptz |  | Không |  |
| read_at | timestamptz |  | Có |  |

### MODERATION_REPORT

Đúng một target có FK: course, learning item hoặc post.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| reporter_id | uuid | FK | Không | APP_USER(id) |
| resolver_id | uuid | FK | Có | APP_USER(id) |
| course_id | uuid | FK | Có | COURSE(id) |
| learning_item_id | uuid | FK | Có | LEARNING_ITEM(id) |
| post_id | uuid | FK | Có | DISCUSSION_POST(id) |
| reason | text |  | Không |  |
| status | moderation_status |  | Không |  |
| resolution | text |  | Có |  |
| created_at | timestamptz |  | Không |  |
| resolved_at | timestamptz |  | Có |  |

**CHECK:**

- `(CASE WHEN course_id IS NULL THEN 0 ELSE 1 END + CASE WHEN learning_item_id IS NULL THEN 0 ELSE 1 END + CASE WHEN post_id IS NULL THEN 0 ELSE 1 END) = 1`

### OUTBOX_EVENT

Sự kiện hạ tầng bền vững. Aggregate locator là dữ liệu routing lịch sử, không giả làm FK nghiệp vụ.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| event_type | varchar(80) |  | Không |  |
| aggregate_type | varchar(80) |  | Không |  |
| aggregate_id | text |  | Không |  |
| aggregate_version | int |  | Có |  |
| payload_json | jsonb |  | Không |  |
| status | outbox_status |  | Không |  |
| attempts | int |  | Không |  |
| created_at | timestamptz |  | Không |  |
| dispatched_at | timestamptz |  | Có |  |

### AUDIT_EVENT

Append-only ở ứng dụng. Entity locator là snapshot audit, không bắt cascade theo đối tượng bị xóa.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| actor_id | uuid | FK | Có | APP_USER(id) |
| action | varchar(100) |  | Không |  |
| entity_type | varchar(100) |  | Không |  |
| entity_key | text |  | Không |  |
| before_json | jsonb |  | Có |  |
| after_json | jsonb |  | Có |  |
| occurred_at | timestamptz |  | Không |  |

## RAG — phần mở rộng

### KNOWLEDGE_DOCUMENT

EXTENSION: nguồn học liệu có kiểm soát truy cập.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| course_id | uuid | FK | Không | COURSE(id) |
| source_item_id | uuid | FK | Có | LEARNING_ITEM(id) |
| owner_id | uuid | FK | Không | APP_USER(id) |
| title | varchar(240) |  | Không |  |
| status | publication_status |  | Không |  |
| visibility | varchar(30) |  | Không |  |

### KNOWLEDGE_DOCUMENT_VERSION

EXTENSION: snapshot nội dung nguồn bất biến.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| document_id | uuid | FK | Không | KNOWLEDGE_DOCUMENT(id) |
| version_no | int |  | Không |  |
| file_asset_id | uuid | FK | Có | FILE_ASSET(id) |
| text_snapshot | text |  | Không |  |
| content_hash | varchar(128) |  | Không |  |
| published_at | timestamptz |  | Có |  |

**UQ ghép:** (document_id, version_no).

### KNOWLEDGE_CHUNK

EXTENSION: vector có dimension tùy model, cần pgvector migration riêng khi triển khai.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| document_version_id | uuid | FK | Không | KNOWLEDGE_DOCUMENT_VERSION(id) |
| chunk_no | int |  | Không |  |
| text | text |  | Không |  |
| embedding | vector |  | Có |  |
| embedding_model | varchar(120) |  | Có |  |
| embedding_config_json | jsonb |  | Có |  |

**UQ ghép:** (document_version_id, chunk_no).

### FEEDBACK_EXPLANATION

EXTENSION: giải thích có nguồn; kết quả này không phải assessment result hay accepted evidence.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| id | uuid | PK | Không |  |
| learner_id | uuid | FK | Không | APP_USER(id) |
| revision_id | uuid | FK | Có | SUBMISSION_REVISION(id) |
| finding_id | uuid | FK | Có | FINDING(id) |
| prompt_version_id | uuid | FK | Không | PROMPT_VERSION(id) |
| question | text |  | Không |  |
| answer | text |  | Không |  |
| provider | varchar(60) |  | Không |  |
| model_id | varchar(120) |  | Không |  |
| retrieval_snapshot_json | jsonb |  | Không |  |
| created_at | timestamptz |  | Không |  |

### EXPLANATION_CITATION

EXTENSION: trích dẫn vào chunk thuộc document version bất biến.

| Thuộc tính | Kiểu | Khóa | Null | Tham chiếu |
|---|---|---|---|---|
| explanation_id | uuid | PK, FK | Không | FEEDBACK_EXPLANATION(id) |
| citation_no | int | PK | Không |  |
| chunk_id | uuid | FK | Không | KNOWLEDGE_CHUNK(id) |
| exact_quote | text |  | Không |  |

