/*
  Warnings:

  - A unique constraint covering the columns `[dedupe_key]` on the table `NOTIFICATION` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CHAPTER" ADD COLUMN     "status" "publication_status" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "NOTIFICATION" ADD COLUMN     "dedupe_key" VARCHAR(200);

-- CreateTable
CREATE TABLE "PASSWORD_RESET_TOKEN" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PASSWORD_RESET_TOKEN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COURSE_PREREQUISITE" (
    "course_id" UUID NOT NULL,
    "prerequisite_course_id" UUID NOT NULL,

    CONSTRAINT "COURSE_PREREQUISITE_pkey" PRIMARY KEY ("course_id","prerequisite_course_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_password_reset_token_token_hash" ON "PASSWORD_RESET_TOKEN"("token_hash");

-- CreateIndex
CREATE INDEX "ix_password_reset_token_user_id" ON "PASSWORD_RESET_TOKEN"("user_id");

-- CreateIndex
CREATE INDEX "ix_course_prerequisite_prerequisite_course_id" ON "COURSE_PREREQUISITE"("prerequisite_course_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_notification_dedupe_key" ON "NOTIFICATION"("dedupe_key");

-- AddForeignKey
ALTER TABLE "PASSWORD_RESET_TOKEN" ADD CONSTRAINT "fk_password_reset_token_user_id" FOREIGN KEY ("user_id") REFERENCES "APP_USER"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "COURSE_PREREQUISITE" ADD CONSTRAINT "fk_course_prerequisite_course_id" FOREIGN KEY ("course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "COURSE_PREREQUISITE" ADD CONSTRAINT "fk_course_prerequisite_prerequisite_course_id" FOREIGN KEY ("prerequisite_course_id") REFERENCES "COURSE"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "COURSE_PREREQUISITE"
  ADD CONSTRAINT "ck_course_prerequisite_1" CHECK ("course_id" <> "prerequisite_course_id");                    