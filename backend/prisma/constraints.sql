-- Reference SQL for the domain constraints in schema.prisma (PostgreSQL).
-- Canonical installation: migrations/20261025000000_enforce_domain_constraints/migration.sql.
-- Apply migrations with prisma migrate deploy; do not execute this file again
-- on a database that has already applied that migration.
-- Retained as a readable companion to schema.prisma and SCHEMA_NOTES.md.
-- Statements below are a reference copy, not an idempotent installer.
BEGIN;

-- Row-level checks from docs/eerd/model.json. Prisma schema comments alone do not
-- create CHECK constraints. These statements also validate existing table rows.

ALTER TABLE "LESSON"
  ADD CONSTRAINT "ck_lesson_1" CHECK ("kind" = 'LESSON');

ALTER TABLE "PRACTICE_ACTIVITY"
  ADD CONSTRAINT "ck_practice_activity_1" CHECK ("kind" = 'PRACTICE');

ALTER TABLE "LESSON_MATERIAL"
  ADD CONSTRAINT "ck_lesson_material_1" CHECK (("kind" = 'TEXT' AND "content_text" IS NOT NULL AND "external_url" IS NULL AND "file_asset_id" IS NULL) OR ("kind" = 'URL' AND "external_url" IS NOT NULL AND "content_text" IS NULL AND "file_asset_id" IS NULL) OR ("kind" = 'FILE' AND "file_asset_id" IS NOT NULL AND "content_text" IS NULL AND "external_url" IS NULL));

ALTER TABLE "SUBMISSION_REVISION"
  ADD CONSTRAINT "ck_submission_revision_1" CHECK (("response_mode" = 'OBJECTIVE' AND "writing_text" IS NULL AND "audio_asset_id" IS NULL) OR ("response_mode" = 'WRITING' AND "writing_text" IS NOT NULL AND "audio_asset_id" IS NULL) OR ("response_mode" = 'SPEAKING' AND "audio_asset_id" IS NOT NULL AND "writing_text" IS NULL));

ALTER TABLE "REVISION_PARAGRAPH"
  ADD CONSTRAINT "ck_revision_paragraph_1" CHECK ("start_offset" >= 0 AND "end_offset" >= "start_offset");

ALTER TABLE "ASSESSMENT_RESULT"
  ADD CONSTRAINT "ck_assessment_result_1" CHECK (("kind" = 'ANSWER_KEY' AND "rubric_version_id" IS NULL) OR ("kind" IN ('AI','TEACHER') AND "rubric_version_id" IS NOT NULL));

ALTER TABLE "AI_RESULT"
  ADD CONSTRAINT "ck_ai_result_1" CHECK ("kind" = 'AI');

ALTER TABLE "TEACHER_RESULT"
  ADD CONSTRAINT "ck_teacher_result_1" CHECK ("kind" = 'TEACHER');

ALTER TABLE "ANSWER_KEY_RESULT"
  ADD CONSTRAINT "ck_answer_key_result_1" CHECK ("kind" = 'ANSWER_KEY');

ALTER TABLE "ANSWER_KEY_RESULT"
  ADD CONSTRAINT "ck_answer_key_result_2" CHECK ("raw_score" >= 0 AND "raw_score" <= "max_score");

ALTER TABLE "FINDING_ANCHOR"
  ADD CONSTRAINT "ck_finding_anchor_1" CHECK ("start_offset" >= 0 AND "end_offset" > "start_offset");

ALTER TABLE "ACCEPTED_ASSESSMENT"
  ADD CONSTRAINT "ck_accepted_assessment_1" CHECK ("result_kind" IN ('TEACHER','ANSWER_KEY'));

ALTER TABLE "ACCEPTED_ASSESSMENT"
  ADD CONSTRAINT "ck_accepted_assessment_2" CHECK ((NOT "is_current") OR "published_at" IS NOT NULL);

ALTER TABLE "SKILL_PREREQUISITE"
  ADD CONSTRAINT "ck_skill_prerequisite_1" CHECK ("skill_id" <> "prerequisite_skill_id");

ALTER TABLE "RECOMMENDATION_ITEM"
  ADD CONSTRAINT "ck_recommendation_item_1" CHECK ("rank" >= 1 AND "rank" <= 3);

ALTER TABLE "RECOMMENDATION_ITEM"
  ADD CONSTRAINT "ck_recommendation_item_2" CHECK (("target_activity_version_id" IS NULL) = ("target_assignment_version_id" IS NULL));

ALTER TABLE "MODERATION_REPORT"
  ADD CONSTRAINT "ck_moderation_report_1" CHECK ((CASE WHEN "course_id" IS NULL THEN 0 ELSE 1 END + CASE WHEN "learning_item_id" IS NULL THEN 0 ELSE 1 END + CASE WHEN "post_id" IS NULL THEN 0 ELSE 1 END) = 1);


-- Conditional uniqueness is not equivalent to UNIQUE(revision_id, is_current):
-- multiple historical/non-current rows must be allowed.
CREATE UNIQUE INDEX "uq_instructor_application_pending"
  ON "INSTRUCTOR_APPLICATION" ("applicant_id")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "uq_review_case_active"
  ON "REVIEW_CASE" ("revision_id")
  WHERE "status" IN ('PENDING', 'CLAIMED');

CREATE UNIQUE INDEX "uq_accepted_assessment_current"
  ON "ACCEPTED_ASSESSMENT" ("revision_id")
  WHERE "is_current" = true;


-- Total/disjoint specialization for LEARNING_ITEM. Parent and the selected
-- child must be created in the SAME transaction. Deferral permits parent first.
CREATE FUNCTION "enforce_learning_item_specialization"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  previous_id uuid;
  next_id uuid;
  entity_id uuid;
  expected_kind text;
  child_1 bigint;
  child_2 bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    previous_id := OLD."id";
  ELSIF TG_OP = 'INSERT' THEN
    next_id := NEW."id";
  ELSE
    previous_id := OLD."id";
    next_id := NEW."id";
  END IF;

  -- Check both IDs when a key changes; otherwise the old parent could be orphaned.
  FOR entity_id IN
    SELECT DISTINCT candidate
    FROM unnest(ARRAY[previous_id, next_id]) AS ids(candidate)
    WHERE candidate IS NOT NULL
  LOOP
    SELECT "kind"::text INTO expected_kind
    FROM "LEARNING_ITEM" WHERE "id" = entity_id;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    SELECT count(*) INTO child_1 FROM "LESSON" WHERE "id" = entity_id;
    SELECT count(*) INTO child_2 FROM "PRACTICE_ACTIVITY" WHERE "id" = entity_id;
    IF NOT (
        (expected_kind = 'LESSON' AND child_1 = 1 AND child_2 = 0)
        OR
        (expected_kind = 'PRACTICE' AND child_1 = 0 AND child_2 = 1)
    ) THEN
      RAISE EXCEPTION 'LEARNING_ITEM % requires exactly its declared subtype', entity_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER "ct_learning_item_specialization"
AFTER INSERT OR UPDATE OR DELETE ON "LEARNING_ITEM"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_learning_item_specialization"();

CREATE CONSTRAINT TRIGGER "ct_lesson_specialization"
AFTER INSERT OR UPDATE OR DELETE ON "LESSON"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_learning_item_specialization"();

CREATE CONSTRAINT TRIGGER "ct_practice_activity_specialization"
AFTER INSERT OR UPDATE OR DELETE ON "PRACTICE_ACTIVITY"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_learning_item_specialization"();


-- Total/disjoint specialization for ASSESSMENT_RESULT. Parent and the selected
-- child must be created in the SAME transaction. Deferral permits parent first.
CREATE FUNCTION "enforce_assessment_result_specialization"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  previous_id uuid;
  next_id uuid;
  entity_id uuid;
  expected_kind text;
  child_1 bigint;
  child_2 bigint;
  child_3 bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    previous_id := OLD."id";
  ELSIF TG_OP = 'INSERT' THEN
    next_id := NEW."id";
  ELSE
    previous_id := OLD."id";
    next_id := NEW."id";
  END IF;

  -- Check both IDs when a key changes; otherwise the old parent could be orphaned.
  FOR entity_id IN
    SELECT DISTINCT candidate
    FROM unnest(ARRAY[previous_id, next_id]) AS ids(candidate)
    WHERE candidate IS NOT NULL
  LOOP
    SELECT "kind"::text INTO expected_kind
    FROM "ASSESSMENT_RESULT" WHERE "id" = entity_id;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    SELECT count(*) INTO child_1 FROM "AI_RESULT" WHERE "id" = entity_id;
    SELECT count(*) INTO child_2 FROM "TEACHER_RESULT" WHERE "id" = entity_id;
    SELECT count(*) INTO child_3 FROM "ANSWER_KEY_RESULT" WHERE "id" = entity_id;
    IF NOT (
        (expected_kind = 'AI' AND child_1 = 1 AND child_2 = 0 AND child_3 = 0)
        OR
        (expected_kind = 'TEACHER' AND child_1 = 0 AND child_2 = 1 AND child_3 = 0)
        OR
        (expected_kind = 'ANSWER_KEY' AND child_1 = 0 AND child_2 = 0 AND child_3 = 1)
    ) THEN
      RAISE EXCEPTION 'ASSESSMENT_RESULT % requires exactly its declared subtype', entity_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER "ct_assessment_result_specialization"
AFTER INSERT OR UPDATE OR DELETE ON "ASSESSMENT_RESULT"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_assessment_result_specialization"();

CREATE CONSTRAINT TRIGGER "ct_ai_result_specialization"
AFTER INSERT OR UPDATE OR DELETE ON "AI_RESULT"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_assessment_result_specialization"();

CREATE CONSTRAINT TRIGGER "ct_teacher_result_specialization"
AFTER INSERT OR UPDATE OR DELETE ON "TEACHER_RESULT"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_assessment_result_specialization"();

CREATE CONSTRAINT TRIGGER "ct_answer_key_result_specialization"
AFTER INSERT OR UPDATE OR DELETE ON "ANSWER_KEY_RESULT"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_assessment_result_specialization"();


-- Installing triggers does not retroactively fire them. Validate pre-existing
-- parent/subtype rows now, after the migration's data backfill has completed.
DO $validation$
BEGIN

  IF EXISTS (
    SELECT 1 FROM "LEARNING_ITEM" p
    LEFT JOIN "LESSON" c1 ON c1."id" = p."id"
    LEFT JOIN "PRACTICE_ACTIVITY" c2 ON c2."id" = p."id"
    WHERE NOT (
      (p."kind" = 'LESSON' AND c1."id" IS NOT NULL AND c2."id" IS NULL)
      OR
      (p."kind" = 'PRACTICE' AND c1."id" IS NULL AND c2."id" IS NOT NULL)
    )
  ) THEN
    RAISE EXCEPTION 'Backfill invalid: LEARNING_ITEM specialization is incomplete'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "ASSESSMENT_RESULT" p
    LEFT JOIN "AI_RESULT" c1 ON c1."id" = p."id"
    LEFT JOIN "TEACHER_RESULT" c2 ON c2."id" = p."id"
    LEFT JOIN "ANSWER_KEY_RESULT" c3 ON c3."id" = p."id"
    WHERE NOT (
      (p."kind" = 'AI' AND c1."id" IS NOT NULL AND c2."id" IS NULL AND c3."id" IS NULL)
      OR
      (p."kind" = 'TEACHER' AND c1."id" IS NULL AND c2."id" IS NOT NULL AND c3."id" IS NULL)
      OR
      (p."kind" = 'ANSWER_KEY' AND c1."id" IS NULL AND c2."id" IS NULL AND c3."id" IS NOT NULL)
    )
  ) THEN
    RAISE EXCEPTION 'Backfill invalid: ASSESSMENT_RESULT specialization is incomplete'
      USING ERRCODE = '23514';
  END IF;

END;
$validation$;

COMMIT;
