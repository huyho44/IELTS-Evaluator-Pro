/*
  Warnings:

  - You are about to drop the `Course` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Enrollment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Evaluation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Lesson` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuizQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RubricDescriptor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Submissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TestSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_EvaluationToRubricDescriptor` table. If the table is not empty, all the data it contains will be lost.

*/
-- Enable pgvector before creating vector columns, including during shadow database replay.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "publication_status" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "learning_item_kind" AS ENUM ('LESSON', 'PRACTICE');

-- CreateEnum
CREATE TYPE "skill_area" AS ENUM ('READING', 'LISTENING', 'WRITING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "response_mode" AS ENUM ('OBJECTIVE', 'WRITING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "assignment_mode" AS ENUM ('PRACTICE', 'GRADED');

-- CreateEnum
CREATE TYPE "attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "provider_attempt_status" AS ENUM ('SUCCESS', 'REFUSED', 'INCOMPLETE', 'INVALID', 'ERROR');

-- CreateEnum
CREATE TYPE "result_kind" AS ENUM ('AI', 'TEACHER', 'ANSWER_KEY');

-- CreateEnum
CREATE TYPE "score_scale" AS ENUM ('BAND', 'RAW');

-- CreateEnum
CREATE TYPE "quality_status" AS ENUM ('PASSED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'CLAIMED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "appeal_status" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "observation_outcome" AS ENUM ('MET', 'PARTIAL', 'NOT_MET', 'NOT_OBSERVED');

-- CreateEnum
CREATE TYPE "observation_status" AS ENUM ('UNKNOWN', 'INSUFFICIENT', 'OBSERVED');

-- CreateEnum
CREATE TYPE "material_kind" AS ENUM ('TEXT', 'URL', 'FILE');

-- CreateEnum
CREATE TYPE "question_type" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "moderation_status" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_createdId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_evaluatorId_fkey";

-- DropForeignKey
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_courseId_fkey";

-- DropForeignKey
ALTER TABLE "QuizQuestion" DROP CONSTRAINT "QuizQuestion_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "RubricDescriptor" DROP CONSTRAINT "RubricDescriptor_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "Submissions" DROP CONSTRAINT "Submissions_testSessionId_fkey";

-- DropForeignKey
ALTER TABLE "TestSession" DROP CONSTRAINT "TestSession_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "TestSession" DROP CONSTRAINT "TestSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "_EvaluationToRubricDescriptor" DROP CONSTRAINT "_EvaluationToRubricDescriptor_A_fkey";

-- DropForeignKey
ALTER TABLE "_EvaluationToRubricDescriptor" DROP CONSTRAINT "_EvaluationToRubricDescriptor_B_fkey";

-- DropTable
DROP TABLE "Course";

-- DropTable
DROP TABLE "Enrollment";

-- DropTable
DROP TABLE "Evaluation";

-- DropTable
DROP TABLE "Lesson";

-- DropTable
DROP TABLE "QuizQuestion";

-- DropTable
DROP TABLE "RubricDescriptor";

-- DropTable
DROP TABLE "Submissions";

-- DropTable
DROP TABLE "TestSession";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "_EvaluationToRubricDescriptor";

-- CreateTable
CREATE TABLE "APP_USER" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "target_band" DECIMAL(3,1),
    "target_exam_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APP_USER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ROLE" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(80) NOT NULL,

    CONSTRAINT "ROLE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "USER_ROLE" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "USER_ROLE_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "AUTH_SESSION" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "AUTH_SESSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "INSTRUCTOR_APPLICATION" (
    "id" UUID NOT NULL,
    "applicant_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "profile_text" TEXT NOT NULL,
    "decision_reason" TEXT,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),

    CONSTRAINT "INSTRUCTOR_APPLICATION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FILE_ASSET" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FILE_ASSET_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COURSE" (
    "id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "publication_status" NOT NULL DEFAULT 'DRAFT',
    "enrollment_open" BOOLEAN NOT NULL DEFAULT false,
    "completion_policy_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "COURSE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COURSE_INSTRUCTOR" (
    "course_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "responsibility" VARCHAR(30) NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "COURSE_INSTRUCTOR_pkey" PRIMARY KEY ("course_id","instructor_id")
);

-- CreateTable
CREATE TABLE "CHAPTER" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CHAPTER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LEARNING_ITEM" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "chapter_id" UUID,
    "kind" "learning_item_kind" NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "status" "publication_status" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL,

    CONSTRAINT "LEARNING_ITEM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LESSON" (
    "id" UUID NOT NULL,
    "kind" "learning_item_kind" NOT NULL DEFAULT 'LESSON',
    "summary" TEXT,

    CONSTRAINT "LESSON_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRACTICE_ACTIVITY" (
    "id" UUID NOT NULL,
    "kind" "learning_item_kind" NOT NULL DEFAULT 'PRACTICE',
    "creator_id" UUID NOT NULL,
    "skill_area" "skill_area" NOT NULL,
    "response_mode" "response_mode" NOT NULL,

    CONSTRAINT "PRACTICE_ACTIVITY_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LESSON_MATERIAL" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "kind" "material_kind" NOT NULL,
    "position" INTEGER NOT NULL,
    "content_text" TEXT,
    "external_url" TEXT,
    "file_asset_id" UUID,

    CONSTRAINT "LESSON_MATERIAL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ENROLLMENT" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "ENROLLMENT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LESSON_PROGRESS" (
    "enrollment_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'NOT_STARTED',
    "last_position_json" JSONB,
    "last_accessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "LESSON_PROGRESS_pkey" PRIMARY KEY ("enrollment_id","lesson_id")
);

-- CreateTable
CREATE TABLE "ACTIVITY_VERSION" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "prompt_text" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "expected_minutes" INTEGER NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "content_hash" VARCHAR(128) NOT NULL,

    CONSTRAINT "ACTIVITY_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ASSIGNMENT" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "context_lesson_id" UUID,
    "creator_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,

    CONSTRAINT "ASSIGNMENT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ASSIGNMENT_VERSION" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "activity_version_id" UUID NOT NULL,
    "rubric_version_id" UUID,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "mode" "assignment_mode" NOT NULL,
    "opens_at" TIMESTAMPTZ(3),
    "due_at" TIMESTAMPTZ(3),
    "time_limit_seconds" INTEGER,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "max_revisions" INTEGER NOT NULL DEFAULT 1,
    "allow_late" BOOLEAN NOT NULL DEFAULT false,
    "release_policy_json" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "ASSIGNMENT_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ATTEMPT" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "assignment_version_id" UUID NOT NULL,
    "activity_version_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" "attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "recommendation_item_id" UUID,

    CONSTRAINT "ATTEMPT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ATTEMPT_DRAFT" (
    "attempt_id" UUID NOT NULL,
    "payload_json" JSONB NOT NULL,
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ATTEMPT_DRAFT_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "SUBMISSION_REVISION" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "response_mode" "response_mode" NOT NULL,
    "writing_text" TEXT,
    "audio_asset_id" UUID,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" VARCHAR(128) NOT NULL,

    CONSTRAINT "SUBMISSION_REVISION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "REVISION_PARAGRAPH" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "paragraph_no" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,

    CONSTRAINT "REVISION_PARAGRAPH_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QUESTION" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "skill_area" "skill_area" NOT NULL,
    "title" VARCHAR(240) NOT NULL,

    CONSTRAINT "QUESTION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QUESTION_VERSION" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "question_type" "question_type" NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "stimulus_text" TEXT,
    "stimulus_asset_id" UUID,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "QUESTION_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QUESTION_OPTION" (
    "id" UUID NOT NULL,
    "question_version_id" UUID NOT NULL,
    "option_code" VARCHAR(12) NOT NULL,
    "content_text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "QUESTION_OPTION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ASSESSMENT_ITEM" (
    "id" UUID NOT NULL,
    "activity_version_id" UUID NOT NULL,
    "question_version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "section_label" VARCHAR(120),
    "max_marks" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "ASSESSMENT_ITEM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ANSWER_KEY_VERSION" (
    "id" UUID NOT NULL,
    "activity_version_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "score_mapping_json" JSONB,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "ANSWER_KEY_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ANSWER_KEY_ENTRY" (
    "id" UUID NOT NULL,
    "answer_key_version_id" UUID NOT NULL,
    "assessment_item_id" UUID NOT NULL,
    "accepted_texts_json" JSONB,
    "grading_rule_json" JSONB NOT NULL,

    CONSTRAINT "ANSWER_KEY_ENTRY_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ANSWER_KEY_OPTION" (
    "entry_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,

    CONSTRAINT "ANSWER_KEY_OPTION_pkey" PRIMARY KEY ("entry_id","option_id")
);

-- CreateTable
CREATE TABLE "ITEM_RESPONSE" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "assessment_item_id" UUID NOT NULL,
    "text_answer" TEXT,

    CONSTRAINT "ITEM_RESPONSE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RESPONSE_SELECTION" (
    "response_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,

    CONSTRAINT "RESPONSE_SELECTION_pkey" PRIMARY KEY ("response_id","option_id")
);

-- CreateTable
CREATE TABLE "RUBRIC_VERSION" (
    "id" UUID NOT NULL,
    "rubric_code" VARCHAR(60) NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "task_type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "source_url" TEXT,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "RUBRIC_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RUBRIC_CRITERION" (
    "id" UUID NOT NULL,
    "rubric_version_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "definition" TEXT NOT NULL,
    "weight" DECIMAL(6,3) NOT NULL,
    "max_score" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "RUBRIC_CRITERION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BAND_DESCRIPTOR" (
    "id" UUID NOT NULL,
    "criterion_id" UUID NOT NULL,
    "band_value" DECIMAL(3,1) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "BAND_DESCRIPTOR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PROMPT_VERSION" (
    "id" UUID NOT NULL,
    "prompt_code" VARCHAR(60) NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "instructions" TEXT NOT NULL,
    "output_schema_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PROMPT_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRADING_CONFIG" (
    "id" UUID NOT NULL,
    "rubric_version_id" UUID NOT NULL,
    "prompt_version_id" UUID NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "model_id" VARCHAR(120) NOT NULL,
    "settings_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GRADING_CONFIG_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRADING_RUN" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "config_id" UUID NOT NULL,
    "request_key" VARCHAR(160) NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processing_token" UUID,
    "lease_until" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "error_code" VARCHAR(80),

    CONSTRAINT "GRADING_RUN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PROVIDER_ATTEMPT" (
    "id" UUID NOT NULL,
    "grading_run_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" "provider_attempt_status" NOT NULL,
    "provider_request_id" TEXT,
    "raw_response_json" JSONB,
    "error_json" JSONB,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PROVIDER_ATTEMPT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ASSESSMENT_RESULT" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "kind" "result_kind" NOT NULL,
    "rubric_version_id" UUID,
    "overall_score" DECIMAL(6,2),
    "score_scale" "score_scale" NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ASSESSMENT_RESULT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AI_RESULT" (
    "id" UUID NOT NULL,
    "kind" "result_kind" NOT NULL DEFAULT 'AI',
    "revision_id" UUID NOT NULL,
    "grading_run_id" UUID NOT NULL,
    "quality_status" "quality_status" NOT NULL,
    "validation_json" JSONB NOT NULL,

    CONSTRAINT "AI_RESULT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TEACHER_RESULT" (
    "id" UUID NOT NULL,
    "kind" "result_kind" NOT NULL DEFAULT 'TEACHER',
    "revision_id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,

    CONSTRAINT "TEACHER_RESULT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ANSWER_KEY_RESULT" (
    "id" UUID NOT NULL,
    "kind" "result_kind" NOT NULL DEFAULT 'ANSWER_KEY',
    "revision_id" UUID NOT NULL,
    "answer_key_version_id" UUID NOT NULL,
    "raw_score" DECIMAL(6,2) NOT NULL,
    "max_score" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "ANSWER_KEY_RESULT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRITERION_SCORE" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "rubric_version_id" UUID NOT NULL,
    "criterion_id" UUID NOT NULL,
    "score" DECIMAL(6,2) NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "CRITERION_SCORE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QUESTION_MARK" (
    "id" UUID NOT NULL,
    "answer_key_result_id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "key_entry_id" UUID NOT NULL,
    "awarded_marks" DECIMAL(6,2) NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "QUESTION_MARK_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FINDING" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "criterion_score_id" UUID,
    "skill_id" UUID,
    "finding_kind" VARCHAR(30) NOT NULL,
    "explanation" TEXT NOT NULL,
    "validation_json" JSONB,

    CONSTRAINT "FINDING_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FINDING_ANCHOR" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "paragraph_id" UUID NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,
    "exact_quote" TEXT NOT NULL,

    CONSTRAINT "FINDING_ANCHOR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "REVIEW_CASE" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "target_run_id" UUID,
    "assignee_id" UUID,
    "status" "review_status" NOT NULL DEFAULT 'PENDING',
    "reason_code" VARCHAR(60) NOT NULL,
    "priority" INTEGER NOT NULL,
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ(3),

    CONSTRAINT "REVIEW_CASE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "REVIEW_DECISION" (
    "id" UUID NOT NULL,
    "review_case_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "decision_no" INTEGER NOT NULL,
    "supersedes_id" UUID,
    "reason" TEXT NOT NULL,
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "REVIEW_DECISION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ACCEPTED_ASSESSMENT" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "result_kind" "result_kind" NOT NULL,
    "revision_id" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "release_after" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "supersedes_id" UUID,

    CONSTRAINT "ACCEPTED_ASSESSMENT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPEAL" (
    "id" UUID NOT NULL,
    "accepted_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "review_case_id" UUID,
    "status" "appeal_status" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "APPEAL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKILL" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "skill_area" "skill_area" NOT NULL,
    "observable_definition" TEXT NOT NULL,
    "status" "publication_status" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "SKILL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKILL_PREREQUISITE" (
    "skill_id" UUID NOT NULL,
    "prerequisite_skill_id" UUID NOT NULL,
    "min_strength" DECIMAL(5,4),
    "min_support" DECIMAL(5,4),

    CONSTRAINT "SKILL_PREREQUISITE_pkey" PRIMARY KEY ("skill_id","prerequisite_skill_id")
);

-- CreateTable
CREATE TABLE "LEARNING_ITEM_SKILL" (
    "learning_item_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "purpose" VARCHAR(24) NOT NULL,
    "coverage_weight" DECIMAL(5,4) NOT NULL DEFAULT 1,

    CONSTRAINT "LEARNING_ITEM_SKILL_pkey" PRIMARY KEY ("learning_item_id","skill_id")
);

-- CreateTable
CREATE TABLE "ITEM_SKILL" (
    "assessment_item_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "observation_weight" DECIMAL(5,4) NOT NULL DEFAULT 1,

    CONSTRAINT "ITEM_SKILL_pkey" PRIMARY KEY ("assessment_item_id","skill_id")
);

-- CreateTable
CREATE TABLE "SKILL_OBSERVATION" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "outcome" "observation_outcome" NOT NULL,
    "rationale" TEXT NOT NULL,

    CONSTRAINT "SKILL_OBSERVATION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKILL_EVIDENCE" (
    "id" UUID NOT NULL,
    "accepted_id" UUID NOT NULL,
    "observation_id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "evidence_policy_version" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SKILL_EVIDENCE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POLICY_VERSION" (
    "id" UUID NOT NULL,
    "policy_code" VARCHAR(80) NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "policy_kind" VARCHAR(30) NOT NULL,
    "config_json" JSONB NOT NULL,
    "code_version" VARCHAR(120) NOT NULL,

    CONSTRAINT "POLICY_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LEARNER_PROFILE_VERSION" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "projection_policy_id" UUID NOT NULL,
    "goal_snapshot_json" JSONB NOT NULL,
    "evidence_watermark" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LEARNER_PROFILE_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LEARNER_SKILL_STATE" (
    "profile_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "strength" DECIMAL(5,4),
    "support" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "observation_status" "observation_status" NOT NULL,

    CONSTRAINT "LEARNER_SKILL_STATE_pkey" PRIMARY KEY ("profile_id","skill_id")
);

-- CreateTable
CREATE TABLE "PROFILE_CONTRIBUTION" (
    "profile_id" UUID NOT NULL,
    "evidence_id" UUID NOT NULL,
    "effective_weight" DECIMAL(7,4) NOT NULL DEFAULT 1,

    CONSTRAINT "PROFILE_CONTRIBUTION_pkey" PRIMARY KEY ("profile_id","evidence_id")
);

-- CreateTable
CREATE TABLE "RECOMMENDATION_RUN" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "context_snapshot_json" JSONB NOT NULL,
    "candidate_snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RECOMMENDATION_RUN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RECOMMENDATION_ITEM" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "learning_item_id" UUID NOT NULL,
    "target_activity_version_id" UUID,
    "target_assignment_version_id" UUID,
    "rank" INTEGER NOT NULL,
    "total_score" DECIMAL(9,5) NOT NULL,
    "score_components_json" JSONB NOT NULL,
    "reason_code" VARCHAR(60) NOT NULL,
    "reason_text" TEXT NOT NULL,
    "target_snapshot_json" JSONB NOT NULL,

    CONSTRAINT "RECOMMENDATION_ITEM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DISCUSSION_THREAD" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "context_item_id" UUID,
    "creator_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DISCUSSION_THREAD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DISCUSSION_POST" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_post_id" UUID,
    "body" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'VISIBLE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),

    CONSTRAINT "DISCUSSION_POST_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NOTIFICATION" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "notification_type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "body" TEXT NOT NULL,
    "navigation_path" TEXT,
    "context_snapshot_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "NOTIFICATION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MODERATION_REPORT" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "resolver_id" UUID,
    "course_id" UUID,
    "learning_item_id" UUID,
    "post_id" UUID,
    "reason" TEXT NOT NULL,
    "status" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "MODERATION_REPORT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OUTBOX_EVENT" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "aggregate_version" INTEGER,
    "payload_json" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(3),

    CONSTRAINT "OUTBOX_EVENT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AUDIT_EVENT" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_key" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AUDIT_EVENT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KNOWLEDGE_DOCUMENT" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "source_item_id" UUID,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "status" "publication_status" NOT NULL DEFAULT 'DRAFT',
    "visibility" VARCHAR(30) NOT NULL,

    CONSTRAINT "KNOWLEDGE_DOCUMENT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KNOWLEDGE_DOCUMENT_VERSION" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "file_asset_id" UUID,
    "text_snapshot" TEXT NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "KNOWLEDGE_DOCUMENT_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KNOWLEDGE_CHUNK" (
    "id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "chunk_no" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector,
    "embedding_model" VARCHAR(120),
    "embedding_config_json" JSONB,

    CONSTRAINT "KNOWLEDGE_CHUNK_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FEEDBACK_EXPLANATION" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "revision_id" UUID,
    "finding_id" UUID,
    "prompt_version_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "model_id" VARCHAR(120) NOT NULL,
    "retrieval_snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FEEDBACK_EXPLANATION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EXPLANATION_CITATION" (
    "explanation_id" UUID NOT NULL,
    "citation_no" INTEGER NOT NULL,
    "chunk_id" UUID NOT NULL,
    "exact_quote" TEXT NOT NULL,

    CONSTRAINT "EXPLANATION_CITATION_pkey" PRIMARY KEY ("explanation_id","citation_no")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_app_user_email" ON "APP_USER"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_role_code" ON "ROLE"("code");

-- CreateIndex
CREATE INDEX "ix_user_role_role_id" ON "USER_ROLE"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_auth_session_refresh_token_hash" ON "AUTH_SESSION"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "ix_auth_session_user_id" ON "AUTH_SESSION"("user_id");

-- CreateIndex
CREATE INDEX "ix_instructor_application_applicant_id" ON "INSTRUCTOR_APPLICATION"("applicant_id");

-- CreateIndex
CREATE INDEX "ix_instructor_application_reviewer_id" ON "INSTRUCTOR_APPLICATION"("reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_file_asset_storage_key" ON "FILE_ASSET"("storage_key");

-- CreateIndex
CREATE INDEX "ix_file_asset_owner_id" ON "FILE_ASSET"("owner_id");

-- CreateIndex
CREATE INDEX "ix_course_creator_id" ON "COURSE"("creator_id");

-- CreateIndex
CREATE INDEX "ix_course_instructor_instructor_id" ON "COURSE_INSTRUCTOR"("instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_chapter_course_id_position" ON "CHAPTER"("course_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_chapter_id_course_id" ON "CHAPTER"("id", "course_id");

-- CreateIndex
CREATE INDEX "ix_learning_item_course_id" ON "LEARNING_ITEM"("course_id");

-- CreateIndex
CREATE INDEX "ix_learning_item_chapter_id_course_id" ON "LEARNING_ITEM"("chapter_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_learning_item_id_kind" ON "LEARNING_ITEM"("id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lesson_id_kind" ON "LESSON"("id", "kind");

-- CreateIndex
CREATE INDEX "ix_practice_activity_creator_id" ON "PRACTICE_ACTIVITY"("creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_practice_activity_id_kind" ON "PRACTICE_ACTIVITY"("id", "kind");

-- CreateIndex
CREATE INDEX "ix_lesson_material_file_asset_id" ON "LESSON_MATERIAL"("file_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lesson_material_lesson_id_position" ON "LESSON_MATERIAL"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "ix_enrollment_course_id" ON "ENROLLMENT"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_learner_id_course_id" ON "ENROLLMENT"("learner_id", "course_id");

-- CreateIndex
CREATE INDEX "ix_lesson_progress_lesson_id" ON "LESSON_PROGRESS"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_activity_version_activity_id_version_no" ON "ACTIVITY_VERSION"("activity_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_activity_version_id_activity_id" ON "ACTIVITY_VERSION"("id", "activity_id");

-- CreateIndex
CREATE INDEX "ix_assignment_course_id" ON "ASSIGNMENT"("course_id");

-- CreateIndex
CREATE INDEX "ix_assignment_activity_id" ON "ASSIGNMENT"("activity_id");

-- CreateIndex
CREATE INDEX "ix_assignment_context_lesson_id" ON "ASSIGNMENT"("context_lesson_id");

-- CreateIndex
CREATE INDEX "ix_assignment_creator_id" ON "ASSIGNMENT"("creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assignment_id_activity_id" ON "ASSIGNMENT"("id", "activity_id");

-- CreateIndex
CREATE INDEX "ix_assignment_version_assignment_id_activity_id" ON "ASSIGNMENT_VERSION"("assignment_id", "activity_id");

-- CreateIndex
CREATE INDEX "ix_assignment_version_activity_version_id_activity_id" ON "ASSIGNMENT_VERSION"("activity_version_id", "activity_id");

-- CreateIndex
CREATE INDEX "ix_assignment_version_rubric_version_id" ON "ASSIGNMENT_VERSION"("rubric_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assignment_version_assignment_id_version_no" ON "ASSIGNMENT_VERSION"("assignment_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assignment_version_id_assignment_id_activity_version_id" ON "ASSIGNMENT_VERSION"("id", "assignment_id", "activity_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assignment_version_id_activity_version_id_activity_id" ON "ASSIGNMENT_VERSION"("id", "activity_version_id", "activity_id");

-- CreateIndex
CREATE INDEX "ix_attempt_assignment_version_id_assignment_id_a_c9178d26c0" ON "ATTEMPT"("assignment_version_id", "assignment_id", "activity_version_id");

-- CreateIndex
CREATE INDEX "ix_attempt_recommendation_item_id_assignment_ver_292a408155" ON "ATTEMPT"("recommendation_item_id", "assignment_version_id", "activity_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attempt_learner_id_assignment_id_attempt_no" ON "ATTEMPT"("learner_id", "assignment_id", "attempt_no");

-- CreateIndex
CREATE INDEX "ix_submission_revision_audio_asset_id" ON "SUBMISSION_REVISION"("audio_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_submission_revision_attempt_id_revision_no" ON "SUBMISSION_REVISION"("attempt_id", "revision_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_revision_paragraph_revision_id_paragraph_no" ON "REVISION_PARAGRAPH"("revision_id", "paragraph_no");

-- CreateIndex
CREATE INDEX "ix_question_author_id" ON "QUESTION"("author_id");

-- CreateIndex
CREATE INDEX "ix_question_version_stimulus_asset_id" ON "QUESTION_VERSION"("stimulus_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_version_question_id_version_no" ON "QUESTION_VERSION"("question_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_option_question_version_id_option_code" ON "QUESTION_OPTION"("question_version_id", "option_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_option_question_version_id_position" ON "QUESTION_OPTION"("question_version_id", "position");

-- CreateIndex
CREATE INDEX "ix_assessment_item_question_version_id" ON "ASSESSMENT_ITEM"("question_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assessment_item_activity_version_id_position" ON "ASSESSMENT_ITEM"("activity_version_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_answer_key_version_activity_version_id_version_no" ON "ANSWER_KEY_VERSION"("activity_version_id", "version_no");

-- CreateIndex
CREATE INDEX "ix_answer_key_entry_assessment_item_id" ON "ANSWER_KEY_ENTRY"("assessment_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_answer_key_entry_answer_key_version_id_assessment_item_id" ON "ANSWER_KEY_ENTRY"("answer_key_version_id", "assessment_item_id");

-- CreateIndex
CREATE INDEX "ix_answer_key_option_option_id" ON "ANSWER_KEY_OPTION"("option_id");

-- CreateIndex
CREATE INDEX "ix_item_response_assessment_item_id" ON "ITEM_RESPONSE"("assessment_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_item_response_revision_id_assessment_item_id" ON "ITEM_RESPONSE"("revision_id", "assessment_item_id");

-- CreateIndex
CREATE INDEX "ix_response_selection_option_id" ON "RESPONSE_SELECTION"("option_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rubric_version_rubric_code_version_no" ON "RUBRIC_VERSION"("rubric_code", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rubric_criterion_rubric_version_id_code" ON "RUBRIC_CRITERION"("rubric_version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rubric_criterion_id_rubric_version_id" ON "RUBRIC_CRITERION"("id", "rubric_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_band_descriptor_criterion_id_band_value" ON "BAND_DESCRIPTOR"("criterion_id", "band_value");

-- CreateIndex
CREATE UNIQUE INDEX "uq_prompt_version_prompt_code_version_no" ON "PROMPT_VERSION"("prompt_code", "version_no");

-- CreateIndex
CREATE INDEX "ix_grading_config_rubric_version_id" ON "GRADING_CONFIG"("rubric_version_id");

-- CreateIndex
CREATE INDEX "ix_grading_config_prompt_version_id" ON "GRADING_CONFIG"("prompt_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_grading_run_request_key" ON "GRADING_RUN"("request_key");

-- CreateIndex
CREATE INDEX "ix_grading_run_revision_id" ON "GRADING_RUN"("revision_id");

-- CreateIndex
CREATE INDEX "ix_grading_run_config_id" ON "GRADING_RUN"("config_id");

-- CreateIndex
CREATE INDEX "ix_grading_run_status_lease_until" ON "GRADING_RUN"("status", "lease_until");

-- CreateIndex
CREATE UNIQUE INDEX "uq_grading_run_id_revision_id" ON "GRADING_RUN"("id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_provider_attempt_grading_run_id_attempt_no" ON "PROVIDER_ATTEMPT"("grading_run_id", "attempt_no");

-- CreateIndex
CREATE INDEX "ix_assessment_result_revision_id" ON "ASSESSMENT_RESULT"("revision_id");

-- CreateIndex
CREATE INDEX "ix_assessment_result_rubric_version_id" ON "ASSESSMENT_RESULT"("rubric_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assessment_result_id_kind_revision_id" ON "ASSESSMENT_RESULT"("id", "kind", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assessment_result_id_rubric_version_id" ON "ASSESSMENT_RESULT"("id", "rubric_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_result_grading_run_id" ON "AI_RESULT"("grading_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_result_id_kind_revision_id" ON "AI_RESULT"("id", "kind", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_result_grading_run_id_revision_id" ON "AI_RESULT"("grading_run_id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_result_decision_id" ON "TEACHER_RESULT"("decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_result_id_kind_revision_id" ON "TEACHER_RESULT"("id", "kind", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_result_decision_id_revision_id" ON "TEACHER_RESULT"("decision_id", "revision_id");

-- CreateIndex
CREATE INDEX "ix_answer_key_result_answer_key_version_id" ON "ANSWER_KEY_RESULT"("answer_key_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_answer_key_result_id_kind_revision_id" ON "ANSWER_KEY_RESULT"("id", "kind", "revision_id");

-- CreateIndex
CREATE INDEX "ix_criterion_score_result_id_rubric_version_id" ON "CRITERION_SCORE"("result_id", "rubric_version_id");

-- CreateIndex
CREATE INDEX "ix_criterion_score_criterion_id_rubric_version_id" ON "CRITERION_SCORE"("criterion_id", "rubric_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_criterion_score_result_id_criterion_id" ON "CRITERION_SCORE"("result_id", "criterion_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_criterion_score_id_result_id" ON "CRITERION_SCORE"("id", "result_id");

-- CreateIndex
CREATE INDEX "ix_question_mark_response_id" ON "QUESTION_MARK"("response_id");

-- CreateIndex
CREATE INDEX "ix_question_mark_key_entry_id" ON "QUESTION_MARK"("key_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_mark_answer_key_result_id_response_id" ON "QUESTION_MARK"("answer_key_result_id", "response_id");

-- CreateIndex
CREATE INDEX "ix_finding_result_id" ON "FINDING"("result_id");

-- CreateIndex
CREATE INDEX "ix_finding_criterion_score_id_result_id" ON "FINDING"("criterion_score_id", "result_id");

-- CreateIndex
CREATE INDEX "ix_finding_skill_id" ON "FINDING"("skill_id");

-- CreateIndex
CREATE INDEX "ix_finding_anchor_finding_id" ON "FINDING_ANCHOR"("finding_id");

-- CreateIndex
CREATE INDEX "ix_finding_anchor_paragraph_id" ON "FINDING_ANCHOR"("paragraph_id");

-- CreateIndex
CREATE INDEX "ix_review_case_revision_id" ON "REVIEW_CASE"("revision_id");

-- CreateIndex
CREATE INDEX "ix_review_case_target_run_id_revision_id" ON "REVIEW_CASE"("target_run_id", "revision_id");

-- CreateIndex
CREATE INDEX "ix_review_case_assignee_id" ON "REVIEW_CASE"("assignee_id");

-- CreateIndex
CREATE INDEX "ix_review_case_status_priority_created_at" ON "REVIEW_CASE"("status", "priority", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_review_case_id_revision_id" ON "REVIEW_CASE"("id", "revision_id");

-- CreateIndex
CREATE INDEX "ix_review_decision_review_case_id_revision_id" ON "REVIEW_DECISION"("review_case_id", "revision_id");

-- CreateIndex
CREATE INDEX "ix_review_decision_teacher_id" ON "REVIEW_DECISION"("teacher_id");

-- CreateIndex
CREATE INDEX "ix_review_decision_supersedes_id" ON "REVIEW_DECISION"("supersedes_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_review_decision_review_case_id_decision_no" ON "REVIEW_DECISION"("review_case_id", "decision_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_review_decision_id_revision_id" ON "REVIEW_DECISION"("id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_accepted_assessment_result_id" ON "ACCEPTED_ASSESSMENT"("result_id");

-- CreateIndex
CREATE INDEX "ix_accepted_assessment_supersedes_id" ON "ACCEPTED_ASSESSMENT"("supersedes_id");

-- CreateIndex
CREATE INDEX "ix_accepted_assessment_revision_id_is_current" ON "ACCEPTED_ASSESSMENT"("revision_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "uq_accepted_assessment_id_revision_id" ON "ACCEPTED_ASSESSMENT"("id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_accepted_assessment_id_result_id" ON "ACCEPTED_ASSESSMENT"("id", "result_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_accepted_assessment_result_id_result_kind_revision_id" ON "ACCEPTED_ASSESSMENT"("result_id", "result_kind", "revision_id");

-- CreateIndex
CREATE INDEX "ix_appeal_accepted_id_revision_id" ON "APPEAL"("accepted_id", "revision_id");

-- CreateIndex
CREATE INDEX "ix_appeal_requester_id" ON "APPEAL"("requester_id");

-- CreateIndex
CREATE INDEX "ix_appeal_review_case_id_revision_id" ON "APPEAL"("review_case_id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_skill_code" ON "SKILL"("code");

-- CreateIndex
CREATE INDEX "ix_skill_prerequisite_prerequisite_skill_id" ON "SKILL_PREREQUISITE"("prerequisite_skill_id");

-- CreateIndex
CREATE INDEX "ix_learning_item_skill_skill_id" ON "LEARNING_ITEM_SKILL"("skill_id");

-- CreateIndex
CREATE INDEX "ix_item_skill_skill_id" ON "ITEM_SKILL"("skill_id");

-- CreateIndex
CREATE INDEX "ix_skill_observation_skill_id" ON "SKILL_OBSERVATION"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_skill_observation_result_id_skill_id" ON "SKILL_OBSERVATION"("result_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_skill_observation_id_result_id" ON "SKILL_OBSERVATION"("id", "result_id");

-- CreateIndex
CREATE INDEX "ix_skill_evidence_accepted_id_result_id" ON "SKILL_EVIDENCE"("accepted_id", "result_id");

-- CreateIndex
CREATE INDEX "ix_skill_evidence_observation_id_result_id" ON "SKILL_EVIDENCE"("observation_id", "result_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_skill_evidence_accepted_id_observation_id" ON "SKILL_EVIDENCE"("accepted_id", "observation_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_policy_version_policy_code_version_no" ON "POLICY_VERSION"("policy_code", "version_no");

-- CreateIndex
CREATE INDEX "ix_learner_profile_version_projection_policy_id" ON "LEARNER_PROFILE_VERSION"("projection_policy_id");

-- CreateIndex
CREATE INDEX "ix_learner_profile_version_learner_id_created_at" ON "LEARNER_PROFILE_VERSION"("learner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_learner_profile_version_learner_id_version_no" ON "LEARNER_PROFILE_VERSION"("learner_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_learner_profile_version_id_learner_id" ON "LEARNER_PROFILE_VERSION"("id", "learner_id");

-- CreateIndex
CREATE INDEX "ix_learner_skill_state_skill_id" ON "LEARNER_SKILL_STATE"("skill_id");

-- CreateIndex
CREATE INDEX "ix_profile_contribution_evidence_id" ON "PROFILE_CONTRIBUTION"("evidence_id");

-- CreateIndex
CREATE INDEX "ix_recommendation_run_profile_id_learner_id" ON "RECOMMENDATION_RUN"("profile_id", "learner_id");

-- CreateIndex
CREATE INDEX "ix_recommendation_run_policy_id" ON "RECOMMENDATION_RUN"("policy_id");

-- CreateIndex
CREATE INDEX "ix_recommendation_run_learner_id_created_at" ON "RECOMMENDATION_RUN"("learner_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_recommendation_item_learning_item_id" ON "RECOMMENDATION_ITEM"("learning_item_id");

-- CreateIndex
CREATE INDEX "ix_recommendation_item_target_activity_version_i_46f2ac183a" ON "RECOMMENDATION_ITEM"("target_activity_version_id", "learning_item_id");

-- CreateIndex
CREATE INDEX "ix_recommendation_item_target_assignment_version_c1eae1573f" ON "RECOMMENDATION_ITEM"("target_assignment_version_id", "target_activity_version_id", "learning_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_recommendation_item_run_id_rank" ON "RECOMMENDATION_ITEM"("run_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "uq_recommendation_item_run_id_learning_item_id" ON "RECOMMENDATION_ITEM"("run_id", "learning_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_recommendation_item_id_target_assignment_vers_b59b36f30f" ON "RECOMMENDATION_ITEM"("id", "target_assignment_version_id", "target_activity_version_id");

-- CreateIndex
CREATE INDEX "ix_discussion_thread_course_id" ON "DISCUSSION_THREAD"("course_id");

-- CreateIndex
CREATE INDEX "ix_discussion_thread_context_item_id" ON "DISCUSSION_THREAD"("context_item_id");

-- CreateIndex
CREATE INDEX "ix_discussion_thread_creator_id" ON "DISCUSSION_THREAD"("creator_id");

-- CreateIndex
CREATE INDEX "ix_discussion_post_thread_id" ON "DISCUSSION_POST"("thread_id");

-- CreateIndex
CREATE INDEX "ix_discussion_post_author_id" ON "DISCUSSION_POST"("author_id");

-- CreateIndex
CREATE INDEX "ix_discussion_post_parent_post_id" ON "DISCUSSION_POST"("parent_post_id");

-- CreateIndex
CREATE INDEX "ix_notification_recipient_id" ON "NOTIFICATION"("recipient_id");

-- CreateIndex
CREATE INDEX "ix_notification_recipient_id_read_at_created_at" ON "NOTIFICATION"("recipient_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "ix_moderation_report_reporter_id" ON "MODERATION_REPORT"("reporter_id");

-- CreateIndex
CREATE INDEX "ix_moderation_report_resolver_id" ON "MODERATION_REPORT"("resolver_id");

-- CreateIndex
CREATE INDEX "ix_moderation_report_course_id" ON "MODERATION_REPORT"("course_id");

-- CreateIndex
CREATE INDEX "ix_moderation_report_learning_item_id" ON "MODERATION_REPORT"("learning_item_id");

-- CreateIndex
CREATE INDEX "ix_moderation_report_post_id" ON "MODERATION_REPORT"("post_id");

-- CreateIndex
CREATE INDEX "ix_outbox_event_status_created_at" ON "OUTBOX_EVENT"("status", "created_at");

-- CreateIndex
CREATE INDEX "ix_audit_event_actor_id" ON "AUDIT_EVENT"("actor_id");

-- CreateIndex
CREATE INDEX "ix_knowledge_document_course_id" ON "KNOWLEDGE_DOCUMENT"("course_id");

-- CreateIndex
CREATE INDEX "ix_knowledge_document_source_item_id" ON "KNOWLEDGE_DOCUMENT"("source_item_id");

-- CreateIndex
CREATE INDEX "ix_knowledge_document_owner_id" ON "KNOWLEDGE_DOCUMENT"("owner_id");

-- CreateIndex
CREATE INDEX "ix_knowledge_document_version_file_asset_id" ON "KNOWLEDGE_DOCUMENT_VERSION"("file_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_knowledge_document_version_document_id_version_no" ON "KNOWLEDGE_DOCUMENT_VERSION"("document_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_knowledge_chunk_document_version_id_chunk_no" ON "KNOWLEDGE_CHUNK"("document_version_id", "chunk_no");

-- CreateIndex
CREATE INDEX "ix_feedback_explanation_learner_id" ON "FEEDBACK_EXPLANATION"("learner_id");

-- CreateIndex
CREATE INDEX "ix_feedback_explanation_revision_id" ON "FEEDBACK_EXPLANATION"("revision_id");

-- CreateIndex
CREATE INDEX "ix_feedback_explanation_finding_id" ON "FEEDBACK_EXPLANATION"("finding_id");

-- CreateIndex
CREATE INDEX "ix_feedback_explanation_prompt_version_id" ON "FEEDBACK_EXPLANATION"("prompt_version_id");

-- CreateIndex
CREATE INDEX "ix_explanation_citation_chunk_id" ON "EXPLANATION_CITATION"("chunk_id");

-- AddForeignKey
ALTER TABLE "USER_ROLE" ADD CONSTRAINT "fk_user_role_user_id" FOREIGN KEY ("user_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "USER_ROLE" ADD CONSTRAINT "fk_user_role_role_id" FOREIGN KEY ("role_id") REFERENCES "ROLE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AUTH_SESSION" ADD CONSTRAINT "fk_auth_session_user_id" FOREIGN KEY ("user_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "INSTRUCTOR_APPLICATION" ADD CONSTRAINT "fk_instructor_application_applicant_id" FOREIGN KEY ("applicant_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "INSTRUCTOR_APPLICATION" ADD CONSTRAINT "fk_instructor_application_reviewer_id" FOREIGN KEY ("reviewer_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FILE_ASSET" ADD CONSTRAINT "fk_file_asset_owner_id" FOREIGN KEY ("owner_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "COURSE" ADD CONSTRAINT "fk_course_creator_id" FOREIGN KEY ("creator_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "COURSE_INSTRUCTOR" ADD CONSTRAINT "fk_course_instructor_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "COURSE_INSTRUCTOR" ADD CONSTRAINT "fk_course_instructor_instructor_id" FOREIGN KEY ("instructor_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CHAPTER" ADD CONSTRAINT "fk_chapter_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LEARNING_ITEM" ADD CONSTRAINT "fk_learning_item_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LEARNING_ITEM" ADD CONSTRAINT "fk_learning_item_chapter_id_course_id" FOREIGN KEY ("chapter_id", "course_id") REFERENCES "CHAPTER"("id", "course_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LESSON" ADD CONSTRAINT "fk_lesson_id_kind" FOREIGN KEY ("id", "kind") REFERENCES "LEARNING_ITEM"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PRACTICE_ACTIVITY" ADD CONSTRAINT "fk_practice_activity_id_kind" FOREIGN KEY ("id", "kind") REFERENCES "LEARNING_ITEM"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PRACTICE_ACTIVITY" ADD CONSTRAINT "fk_practice_activity_creator_id" FOREIGN KEY ("creator_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LESSON_MATERIAL" ADD CONSTRAINT "fk_lesson_material_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "LESSON"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LESSON_MATERIAL" ADD CONSTRAINT "fk_lesson_material_file_asset_id" FOREIGN KEY ("file_asset_id") REFERENCES "FILE_ASSET"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ENROLLMENT" ADD CONSTRAINT "fk_enrollment_learner_id" FOREIGN KEY ("learner_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ENROLLMENT" ADD CONSTRAINT "fk_enrollment_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LESSON_PROGRESS" ADD CONSTRAINT "fk_lesson_progress_enrollment_id" FOREIGN KEY ("enrollment_id") REFERENCES "ENROLLMENT"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LESSON_PROGRESS" ADD CONSTRAINT "fk_lesson_progress_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "LESSON"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ACTIVITY_VERSION" ADD CONSTRAINT "fk_activity_version_activity_id" FOREIGN KEY ("activity_id") REFERENCES "PRACTICE_ACTIVITY"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSIGNMENT" ADD CONSTRAINT "fk_assignment_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSIGNMENT" ADD CONSTRAINT "fk_assignment_activity_id" FOREIGN KEY ("activity_id") REFERENCES "PRACTICE_ACTIVITY"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSIGNMENT" ADD CONSTRAINT "fk_assignment_context_lesson_id" FOREIGN KEY ("context_lesson_id") REFERENCES "LESSON"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSIGNMENT" ADD CONSTRAINT "fk_assignment_creator_id" FOREIGN KEY ("creator_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSIGNMENT_VERSION" ADD CONSTRAINT "fk_assignment_version_assignment_id_activity_id" FOREIGN KEY ("assignment_id", "activity_id") REFERENCES "ASSIGNMENT"("id", "activity_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSIGNMENT_VERSION" ADD CONSTRAINT "fk_assignment_version_activity_version_id_activity_id" FOREIGN KEY ("activity_version_id", "activity_id") REFERENCES "ACTIVITY_VERSION"("id", "activity_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSIGNMENT_VERSION" ADD CONSTRAINT "fk_assignment_version_rubric_version_id" FOREIGN KEY ("rubric_version_id") REFERENCES "RUBRIC_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ATTEMPT" ADD CONSTRAINT "fk_attempt_learner_id" FOREIGN KEY ("learner_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ATTEMPT" ADD CONSTRAINT "fk_attempt_assignment_version_id_assignment_id_a_a328be50f6" FOREIGN KEY ("assignment_version_id", "assignment_id", "activity_version_id") REFERENCES "ASSIGNMENT_VERSION"("id", "assignment_id", "activity_version_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ATTEMPT" ADD CONSTRAINT "fk_attempt_recommendation_item_id_assignment_ver_7ecffb77ab" FOREIGN KEY ("recommendation_item_id", "assignment_version_id", "activity_version_id") REFERENCES "RECOMMENDATION_ITEM"("id", "target_assignment_version_id", "target_activity_version_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ATTEMPT_DRAFT" ADD CONSTRAINT "fk_attempt_draft_attempt_id" FOREIGN KEY ("attempt_id") REFERENCES "ATTEMPT"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SUBMISSION_REVISION" ADD CONSTRAINT "fk_submission_revision_attempt_id" FOREIGN KEY ("attempt_id") REFERENCES "ATTEMPT"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SUBMISSION_REVISION" ADD CONSTRAINT "fk_submission_revision_audio_asset_id" FOREIGN KEY ("audio_asset_id") REFERENCES "FILE_ASSET"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "REVISION_PARAGRAPH" ADD CONSTRAINT "fk_revision_paragraph_revision_id" FOREIGN KEY ("revision_id") REFERENCES "SUBMISSION_REVISION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QUESTION" ADD CONSTRAINT "fk_question_author_id" FOREIGN KEY ("author_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QUESTION_VERSION" ADD CONSTRAINT "fk_question_version_question_id" FOREIGN KEY ("question_id") REFERENCES "QUESTION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QUESTION_VERSION" ADD CONSTRAINT "fk_question_version_stimulus_asset_id" FOREIGN KEY ("stimulus_asset_id") REFERENCES "FILE_ASSET"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QUESTION_OPTION" ADD CONSTRAINT "fk_question_option_question_version_id" FOREIGN KEY ("question_version_id") REFERENCES "QUESTION_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSESSMENT_ITEM" ADD CONSTRAINT "fk_assessment_item_activity_version_id" FOREIGN KEY ("activity_version_id") REFERENCES "ACTIVITY_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSESSMENT_ITEM" ADD CONSTRAINT "fk_assessment_item_question_version_id" FOREIGN KEY ("question_version_id") REFERENCES "QUESTION_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ANSWER_KEY_VERSION" ADD CONSTRAINT "fk_answer_key_version_activity_version_id" FOREIGN KEY ("activity_version_id") REFERENCES "ACTIVITY_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ANSWER_KEY_ENTRY" ADD CONSTRAINT "fk_answer_key_entry_answer_key_version_id" FOREIGN KEY ("answer_key_version_id") REFERENCES "ANSWER_KEY_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ANSWER_KEY_ENTRY" ADD CONSTRAINT "fk_answer_key_entry_assessment_item_id" FOREIGN KEY ("assessment_item_id") REFERENCES "ASSESSMENT_ITEM"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ANSWER_KEY_OPTION" ADD CONSTRAINT "fk_answer_key_option_entry_id" FOREIGN KEY ("entry_id") REFERENCES "ANSWER_KEY_ENTRY"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ANSWER_KEY_OPTION" ADD CONSTRAINT "fk_answer_key_option_option_id" FOREIGN KEY ("option_id") REFERENCES "QUESTION_OPTION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ITEM_RESPONSE" ADD CONSTRAINT "fk_item_response_revision_id" FOREIGN KEY ("revision_id") REFERENCES "SUBMISSION_REVISION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ITEM_RESPONSE" ADD CONSTRAINT "fk_item_response_assessment_item_id" FOREIGN KEY ("assessment_item_id") REFERENCES "ASSESSMENT_ITEM"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RESPONSE_SELECTION" ADD CONSTRAINT "fk_response_selection_response_id" FOREIGN KEY ("response_id") REFERENCES "ITEM_RESPONSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RESPONSE_SELECTION" ADD CONSTRAINT "fk_response_selection_option_id" FOREIGN KEY ("option_id") REFERENCES "QUESTION_OPTION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RUBRIC_CRITERION" ADD CONSTRAINT "fk_rubric_criterion_rubric_version_id" FOREIGN KEY ("rubric_version_id") REFERENCES "RUBRIC_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BAND_DESCRIPTOR" ADD CONSTRAINT "fk_band_descriptor_criterion_id" FOREIGN KEY ("criterion_id") REFERENCES "RUBRIC_CRITERION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GRADING_CONFIG" ADD CONSTRAINT "fk_grading_config_rubric_version_id" FOREIGN KEY ("rubric_version_id") REFERENCES "RUBRIC_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GRADING_CONFIG" ADD CONSTRAINT "fk_grading_config_prompt_version_id" FOREIGN KEY ("prompt_version_id") REFERENCES "PROMPT_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GRADING_RUN" ADD CONSTRAINT "fk_grading_run_revision_id" FOREIGN KEY ("revision_id") REFERENCES "SUBMISSION_REVISION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GRADING_RUN" ADD CONSTRAINT "fk_grading_run_config_id" FOREIGN KEY ("config_id") REFERENCES "GRADING_CONFIG"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PROVIDER_ATTEMPT" ADD CONSTRAINT "fk_provider_attempt_grading_run_id" FOREIGN KEY ("grading_run_id") REFERENCES "GRADING_RUN"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSESSMENT_RESULT" ADD CONSTRAINT "fk_assessment_result_revision_id" FOREIGN KEY ("revision_id") REFERENCES "SUBMISSION_REVISION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ASSESSMENT_RESULT" ADD CONSTRAINT "fk_assessment_result_rubric_version_id" FOREIGN KEY ("rubric_version_id") REFERENCES "RUBRIC_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AI_RESULT" ADD CONSTRAINT "fk_ai_result_id_kind_revision_id" FOREIGN KEY ("id", "kind", "revision_id") REFERENCES "ASSESSMENT_RESULT"("id", "kind", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AI_RESULT" ADD CONSTRAINT "fk_ai_result_grading_run_id_revision_id" FOREIGN KEY ("grading_run_id", "revision_id") REFERENCES "GRADING_RUN"("id", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TEACHER_RESULT" ADD CONSTRAINT "fk_teacher_result_id_kind_revision_id" FOREIGN KEY ("id", "kind", "revision_id") REFERENCES "ASSESSMENT_RESULT"("id", "kind", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TEACHER_RESULT" ADD CONSTRAINT "fk_teacher_result_decision_id_revision_id" FOREIGN KEY ("decision_id", "revision_id") REFERENCES "REVIEW_DECISION"("id", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ANSWER_KEY_RESULT" ADD CONSTRAINT "fk_answer_key_result_id_kind_revision_id" FOREIGN KEY ("id", "kind", "revision_id") REFERENCES "ASSESSMENT_RESULT"("id", "kind", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ANSWER_KEY_RESULT" ADD CONSTRAINT "fk_answer_key_result_answer_key_version_id" FOREIGN KEY ("answer_key_version_id") REFERENCES "ANSWER_KEY_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CRITERION_SCORE" ADD CONSTRAINT "fk_criterion_score_result_id_rubric_version_id" FOREIGN KEY ("result_id", "rubric_version_id") REFERENCES "ASSESSMENT_RESULT"("id", "rubric_version_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CRITERION_SCORE" ADD CONSTRAINT "fk_criterion_score_criterion_id_rubric_version_id" FOREIGN KEY ("criterion_id", "rubric_version_id") REFERENCES "RUBRIC_CRITERION"("id", "rubric_version_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QUESTION_MARK" ADD CONSTRAINT "fk_question_mark_answer_key_result_id" FOREIGN KEY ("answer_key_result_id") REFERENCES "ANSWER_KEY_RESULT"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QUESTION_MARK" ADD CONSTRAINT "fk_question_mark_response_id" FOREIGN KEY ("response_id") REFERENCES "ITEM_RESPONSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QUESTION_MARK" ADD CONSTRAINT "fk_question_mark_key_entry_id" FOREIGN KEY ("key_entry_id") REFERENCES "ANSWER_KEY_ENTRY"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FINDING" ADD CONSTRAINT "fk_finding_result_id" FOREIGN KEY ("result_id") REFERENCES "ASSESSMENT_RESULT"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FINDING" ADD CONSTRAINT "fk_finding_criterion_score_id_result_id" FOREIGN KEY ("criterion_score_id", "result_id") REFERENCES "CRITERION_SCORE"("id", "result_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FINDING" ADD CONSTRAINT "fk_finding_skill_id" FOREIGN KEY ("skill_id") REFERENCES "SKILL"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FINDING_ANCHOR" ADD CONSTRAINT "fk_finding_anchor_finding_id" FOREIGN KEY ("finding_id") REFERENCES "FINDING"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FINDING_ANCHOR" ADD CONSTRAINT "fk_finding_anchor_paragraph_id" FOREIGN KEY ("paragraph_id") REFERENCES "REVISION_PARAGRAPH"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "REVIEW_CASE" ADD CONSTRAINT "fk_review_case_revision_id" FOREIGN KEY ("revision_id") REFERENCES "SUBMISSION_REVISION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "REVIEW_CASE" ADD CONSTRAINT "fk_review_case_target_run_id_revision_id" FOREIGN KEY ("target_run_id", "revision_id") REFERENCES "GRADING_RUN"("id", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "REVIEW_CASE" ADD CONSTRAINT "fk_review_case_assignee_id" FOREIGN KEY ("assignee_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "REVIEW_DECISION" ADD CONSTRAINT "fk_review_decision_review_case_id_revision_id" FOREIGN KEY ("review_case_id", "revision_id") REFERENCES "REVIEW_CASE"("id", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "REVIEW_DECISION" ADD CONSTRAINT "fk_review_decision_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "REVIEW_DECISION" ADD CONSTRAINT "fk_review_decision_supersedes_id" FOREIGN KEY ("supersedes_id") REFERENCES "REVIEW_DECISION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ACCEPTED_ASSESSMENT" ADD CONSTRAINT "fk_accepted_assessment_result_id_result_kind_revision_id" FOREIGN KEY ("result_id", "result_kind", "revision_id") REFERENCES "ASSESSMENT_RESULT"("id", "kind", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ACCEPTED_ASSESSMENT" ADD CONSTRAINT "fk_accepted_assessment_supersedes_id" FOREIGN KEY ("supersedes_id") REFERENCES "ACCEPTED_ASSESSMENT"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "APPEAL" ADD CONSTRAINT "fk_appeal_accepted_id_revision_id" FOREIGN KEY ("accepted_id", "revision_id") REFERENCES "ACCEPTED_ASSESSMENT"("id", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "APPEAL" ADD CONSTRAINT "fk_appeal_requester_id" FOREIGN KEY ("requester_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "APPEAL" ADD CONSTRAINT "fk_appeal_review_case_id_revision_id" FOREIGN KEY ("review_case_id", "revision_id") REFERENCES "REVIEW_CASE"("id", "revision_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SKILL_PREREQUISITE" ADD CONSTRAINT "fk_skill_prerequisite_skill_id" FOREIGN KEY ("skill_id") REFERENCES "SKILL"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SKILL_PREREQUISITE" ADD CONSTRAINT "fk_skill_prerequisite_prerequisite_skill_id" FOREIGN KEY ("prerequisite_skill_id") REFERENCES "SKILL"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LEARNING_ITEM_SKILL" ADD CONSTRAINT "fk_learning_item_skill_learning_item_id" FOREIGN KEY ("learning_item_id") REFERENCES "LEARNING_ITEM"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LEARNING_ITEM_SKILL" ADD CONSTRAINT "fk_learning_item_skill_skill_id" FOREIGN KEY ("skill_id") REFERENCES "SKILL"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ITEM_SKILL" ADD CONSTRAINT "fk_item_skill_assessment_item_id" FOREIGN KEY ("assessment_item_id") REFERENCES "ASSESSMENT_ITEM"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ITEM_SKILL" ADD CONSTRAINT "fk_item_skill_skill_id" FOREIGN KEY ("skill_id") REFERENCES "SKILL"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SKILL_OBSERVATION" ADD CONSTRAINT "fk_skill_observation_result_id" FOREIGN KEY ("result_id") REFERENCES "ASSESSMENT_RESULT"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SKILL_OBSERVATION" ADD CONSTRAINT "fk_skill_observation_skill_id" FOREIGN KEY ("skill_id") REFERENCES "SKILL"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SKILL_EVIDENCE" ADD CONSTRAINT "fk_skill_evidence_accepted_id_result_id" FOREIGN KEY ("accepted_id", "result_id") REFERENCES "ACCEPTED_ASSESSMENT"("id", "result_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SKILL_EVIDENCE" ADD CONSTRAINT "fk_skill_evidence_observation_id_result_id" FOREIGN KEY ("observation_id", "result_id") REFERENCES "SKILL_OBSERVATION"("id", "result_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LEARNER_PROFILE_VERSION" ADD CONSTRAINT "fk_learner_profile_version_learner_id" FOREIGN KEY ("learner_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LEARNER_PROFILE_VERSION" ADD CONSTRAINT "fk_learner_profile_version_projection_policy_id" FOREIGN KEY ("projection_policy_id") REFERENCES "POLICY_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LEARNER_SKILL_STATE" ADD CONSTRAINT "fk_learner_skill_state_profile_id" FOREIGN KEY ("profile_id") REFERENCES "LEARNER_PROFILE_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LEARNER_SKILL_STATE" ADD CONSTRAINT "fk_learner_skill_state_skill_id" FOREIGN KEY ("skill_id") REFERENCES "SKILL"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PROFILE_CONTRIBUTION" ADD CONSTRAINT "fk_profile_contribution_profile_id" FOREIGN KEY ("profile_id") REFERENCES "LEARNER_PROFILE_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PROFILE_CONTRIBUTION" ADD CONSTRAINT "fk_profile_contribution_evidence_id" FOREIGN KEY ("evidence_id") REFERENCES "SKILL_EVIDENCE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RECOMMENDATION_RUN" ADD CONSTRAINT "fk_recommendation_run_profile_id_learner_id" FOREIGN KEY ("profile_id", "learner_id") REFERENCES "LEARNER_PROFILE_VERSION"("id", "learner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RECOMMENDATION_RUN" ADD CONSTRAINT "fk_recommendation_run_policy_id" FOREIGN KEY ("policy_id") REFERENCES "POLICY_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RECOMMENDATION_ITEM" ADD CONSTRAINT "fk_recommendation_item_run_id" FOREIGN KEY ("run_id") REFERENCES "RECOMMENDATION_RUN"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RECOMMENDATION_ITEM" ADD CONSTRAINT "fk_recommendation_item_learning_item_id" FOREIGN KEY ("learning_item_id") REFERENCES "LEARNING_ITEM"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RECOMMENDATION_ITEM" ADD CONSTRAINT "fk_recommendation_item_target_activity_version_i_68eec8d129" FOREIGN KEY ("target_activity_version_id", "learning_item_id") REFERENCES "ACTIVITY_VERSION"("id", "activity_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RECOMMENDATION_ITEM" ADD CONSTRAINT "fk_recommendation_item_target_assignment_version_3391d3702b" FOREIGN KEY ("target_assignment_version_id", "target_activity_version_id", "learning_item_id") REFERENCES "ASSIGNMENT_VERSION"("id", "activity_version_id", "activity_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DISCUSSION_THREAD" ADD CONSTRAINT "fk_discussion_thread_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DISCUSSION_THREAD" ADD CONSTRAINT "fk_discussion_thread_context_item_id" FOREIGN KEY ("context_item_id") REFERENCES "LEARNING_ITEM"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DISCUSSION_THREAD" ADD CONSTRAINT "fk_discussion_thread_creator_id" FOREIGN KEY ("creator_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DISCUSSION_POST" ADD CONSTRAINT "fk_discussion_post_thread_id" FOREIGN KEY ("thread_id") REFERENCES "DISCUSSION_THREAD"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DISCUSSION_POST" ADD CONSTRAINT "fk_discussion_post_author_id" FOREIGN KEY ("author_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DISCUSSION_POST" ADD CONSTRAINT "fk_discussion_post_parent_post_id" FOREIGN KEY ("parent_post_id") REFERENCES "DISCUSSION_POST"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NOTIFICATION" ADD CONSTRAINT "fk_notification_recipient_id" FOREIGN KEY ("recipient_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MODERATION_REPORT" ADD CONSTRAINT "fk_moderation_report_reporter_id" FOREIGN KEY ("reporter_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MODERATION_REPORT" ADD CONSTRAINT "fk_moderation_report_resolver_id" FOREIGN KEY ("resolver_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MODERATION_REPORT" ADD CONSTRAINT "fk_moderation_report_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MODERATION_REPORT" ADD CONSTRAINT "fk_moderation_report_learning_item_id" FOREIGN KEY ("learning_item_id") REFERENCES "LEARNING_ITEM"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MODERATION_REPORT" ADD CONSTRAINT "fk_moderation_report_post_id" FOREIGN KEY ("post_id") REFERENCES "DISCUSSION_POST"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AUDIT_EVENT" ADD CONSTRAINT "fk_audit_event_actor_id" FOREIGN KEY ("actor_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "KNOWLEDGE_DOCUMENT" ADD CONSTRAINT "fk_knowledge_document_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "KNOWLEDGE_DOCUMENT" ADD CONSTRAINT "fk_knowledge_document_source_item_id" FOREIGN KEY ("source_item_id") REFERENCES "LEARNING_ITEM"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "KNOWLEDGE_DOCUMENT" ADD CONSTRAINT "fk_knowledge_document_owner_id" FOREIGN KEY ("owner_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "KNOWLEDGE_DOCUMENT_VERSION" ADD CONSTRAINT "fk_knowledge_document_version_document_id" FOREIGN KEY ("document_id") REFERENCES "KNOWLEDGE_DOCUMENT"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "KNOWLEDGE_DOCUMENT_VERSION" ADD CONSTRAINT "fk_knowledge_document_version_file_asset_id" FOREIGN KEY ("file_asset_id") REFERENCES "FILE_ASSET"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "KNOWLEDGE_CHUNK" ADD CONSTRAINT "fk_knowledge_chunk_document_version_id" FOREIGN KEY ("document_version_id") REFERENCES "KNOWLEDGE_DOCUMENT_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FEEDBACK_EXPLANATION" ADD CONSTRAINT "fk_feedback_explanation_learner_id" FOREIGN KEY ("learner_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FEEDBACK_EXPLANATION" ADD CONSTRAINT "fk_feedback_explanation_revision_id" FOREIGN KEY ("revision_id") REFERENCES "SUBMISSION_REVISION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FEEDBACK_EXPLANATION" ADD CONSTRAINT "fk_feedback_explanation_finding_id" FOREIGN KEY ("finding_id") REFERENCES "FINDING"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FEEDBACK_EXPLANATION" ADD CONSTRAINT "fk_feedback_explanation_prompt_version_id" FOREIGN KEY ("prompt_version_id") REFERENCES "PROMPT_VERSION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EXPLANATION_CITATION" ADD CONSTRAINT "fk_explanation_citation_explanation_id" FOREIGN KEY ("explanation_id") REFERENCES "FEEDBACK_EXPLANATION"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EXPLANATION_CITATION" ADD CONSTRAINT "fk_explanation_citation_chunk_id" FOREIGN KEY ("chunk_id") REFERENCES "KNOWLEDGE_CHUNK"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
