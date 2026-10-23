import 'dotenv/config';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required. Configure backend/.env before seeding.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
});
const samplePassword = 'IeltsDemo123!';
const sampleDate = new Date('2026-10-20T09:00:00.000Z');

// Stable fixture IDs let reruns preserve the same authoring graph without deleting data.
function fixtureId(sequence: number): string {
  return `26102026-0000-4000-8000-${sequence.toString().padStart(12, '0')}`;
}

// Format: scrypt:<hex salt>:<hex derived key>. Authentication is not implemented yet.
function hashPassword(): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(samplePassword, salt, 64).toString('hex')}`;
}

async function main() {
  // Publish parent/subtype records and their children atomically.
  const summary = await prisma.$transaction(async (tx) => {
    const roles = new Map<string, string>();
    for (const sample of [
      { code: 'ADMIN', name: 'Administrator' },
      { code: 'INSTRUCTOR', name: 'Instructor' },
      { code: 'LEARNER', name: 'Learner' },
    ]) {
      const role = await tx.role.upsert({
        where: { code: sample.code }, update: {}, create: sample,
      });
      roles.set(role.code, role.id);
    }

    const users = [];
    for (const sample of [
      { email: 'admin@ielts.example', displayName: 'Demo Admin', roleCode: 'ADMIN', targetBand: 8 },
      { email: 'teacher@ielts.example', displayName: 'Demo Instructor', roleCode: 'INSTRUCTOR', targetBand: 8.5 },
      { email: 'student.an@ielts.example', displayName: 'An', roleCode: 'LEARNER', targetBand: 7 },
      { email: 'student.binh@ielts.example', displayName: 'Binh', roleCode: 'LEARNER', targetBand: 6.5 },
    ]) {
      const { roleCode, ...account } = sample;
      const user = await tx.user.upsert({
        where: { email: account.email },
        update: {},
        create: { ...account, status: 'ACTIVE', passwordHash: hashPassword() },
      });
      const roleId = roles.get(roleCode);
      if (!roleId) throw new Error('Missing seed role');
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
      users.push(user);
    }
    const [, teacher, an, binh] = users;

    const course = await tx.course.upsert({
      where: { id: fixtureId(1) },
      update: {},
      create: {
        id: fixtureId(1), creatorId: teacher.id,
        title: '[Demo] IELTS Reading Foundations',
        description: 'A two-question reading exercise for exploring the versioned data model.',
        status: 'PUBLISHED', enrollmentOpen: true,
        completionPolicyJson: { mode: 'ALL_REQUIRED_ITEMS' },
      },
    });
    await tx.courseInstructor.upsert({
      where: { courseId_instructorId: { courseId: course.id, instructorId: teacher.id } },
      update: {},
      create: { courseId: course.id, instructorId: teacher.id, responsibility: 'OWNER' },
    });
    for (const learner of [an, binh]) {
      await tx.enrollment.upsert({
        where: { learnerId_courseId: { learnerId: learner.id, courseId: course.id } },
        update: {},
        create: { learnerId: learner.id, courseId: course.id, status: 'ACTIVE' },
      });
    }

    const activityId = fixtureId(10);
    await tx.learningItem.upsert({
      where: { id: activityId }, update: {},
      create: {
        id: activityId, courseId: course.id, kind: 'PRACTICE',
        title: '[Demo] Library information', status: 'PUBLISHED', position: 1,
      },
    });
    await tx.practiceActivity.upsert({
      where: { id: activityId }, update: {},
      create: {
        id: activityId, kind: 'PRACTICE', creatorId: teacher.id,
        skillArea: 'READING', responseMode: 'OBJECTIVE',
      },
    });
    const passage = 'The library opens at 9 a.m. on weekdays. Visitors must bring a student card.';
    const instructions = 'Answer both questions. For question 1, write no more than two words and/or a number.';
    const activityVersion = await tx.activityVersion.upsert({
      where: { activityId_versionNo: { activityId, versionNo: 1 } },
      update: {},
      create: {
        id: fixtureId(11), activityId, versionNo: 1,
        promptText: passage, instructions, difficulty: 1, expectedMinutes: 5,
        publishedAt: sampleDate,
        contentHash: createHash('sha256').update(JSON.stringify({ passage, instructions })).digest('hex'),
      },
    });

    const questionVersions = [];
    for (const [index, sample] of [
      { title: 'Library opening time', promptText: 'What time does the library open?', questionType: 'SHORT_ANSWER' as const },
      { title: 'Required document', promptText: 'What must visitors bring?', questionType: 'SINGLE_CHOICE' as const },
    ].entries()) {
      const question = await tx.question.upsert({
        where: { id: fixtureId(20 + index) }, update: {},
        create: { id: fixtureId(20 + index), authorId: teacher.id, skillArea: 'READING', title: sample.title },
      });
      questionVersions.push(await tx.questionVersion.upsert({
        where: { questionId_versionNo: { questionId: question.id, versionNo: 1 } },
        update: {},
        create: {
          id: fixtureId(30 + index), questionId: question.id, versionNo: 1,
          questionType: sample.questionType, promptText: sample.promptText, publishedAt: sampleDate,
        },
      }));
    }

    const options = [];
    for (const [index, sample] of [
      { optionCode: 'A', contentText: 'A passport' },
      { optionCode: 'B', contentText: 'A student card' },
      { optionCode: 'C', contentText: 'A train ticket' },
    ].entries()) {
      options.push(await tx.questionOption.upsert({
        where: {
          questionVersionId_optionCode: { questionVersionId: questionVersions[1].id, optionCode: sample.optionCode },
        },
        update: {},
        create: {
          id: fixtureId(40 + index), questionVersionId: questionVersions[1].id,
          ...sample, position: index + 1,
        },
      }));
    }
    const items = [];
    for (const [index, questionVersion] of questionVersions.entries()) {
      items.push(await tx.assessmentItem.upsert({
        where: { activityVersionId_position: { activityVersionId: activityVersion.id, position: index + 1 } },
        update: {},
        create: {
          id: fixtureId(50 + index), activityVersionId: activityVersion.id,
          questionVersionId: questionVersion.id, position: index + 1, maxMarks: 1,
        },
      }));
    }

    const answerKey = await tx.answerKeyVersion.upsert({
      where: { activityVersionId_versionNo: { activityVersionId: activityVersion.id, versionNo: 1 } },
      update: {},
      create: { id: fixtureId(60), activityVersionId: activityVersion.id, versionNo: 1, publishedAt: sampleDate },
    });
    await tx.answerKeyEntry.upsert({
      where: {
        answerKeyVersionId_assessmentItemId: { answerKeyVersionId: answerKey.id, assessmentItemId: items[0].id },
      },
      update: {},
      create: {
        id: fixtureId(61), answerKeyVersionId: answerKey.id, assessmentItemId: items[0].id,
        acceptedTextsJson: ['9 a.m.', '9 am', '9:00', '9'],
        gradingRuleJson: { method: 'TEXT_EXACT', trim: true, caseSensitive: false, collapseSpaces: true, maxWords: 2 },
      },
    });
    const choiceKey = await tx.answerKeyEntry.upsert({
      where: {
        answerKeyVersionId_assessmentItemId: { answerKeyVersionId: answerKey.id, assessmentItemId: items[1].id },
      },
      update: {},
      create: {
        id: fixtureId(62), answerKeyVersionId: answerKey.id, assessmentItemId: items[1].id,
        gradingRuleJson: { method: 'EXACT_OPTION_SET', partialCredit: false },
      },
    });
    await tx.answerKeyOption.upsert({
      where: { entryId_optionId: { entryId: choiceKey.id, optionId: options[1].id } },
      update: {},
      create: { entryId: choiceKey.id, optionId: options[1].id },
    });

    const assignment = await tx.assignment.upsert({
      where: { id: fixtureId(70) }, update: {},
      create: {
        id: fixtureId(70), courseId: course.id, activityId, creatorId: teacher.id,
        title: '[Demo] Library reading practice',
      },
    });
    await tx.assignmentVersion.upsert({
      where: { assignmentId_versionNo: { assignmentId: assignment.id, versionNo: 1 } },
      update: {},
      create: {
        id: fixtureId(71), assignmentId: assignment.id, activityId, activityVersionId: activityVersion.id,
        versionNo: 1, mode: 'PRACTICE', timeLimitSeconds: 300, maxAttempts: 2, maxRevisions: 1,
        allowLate: false, releasePolicyJson: { releaseMode: 'IMMEDIATE' }, publishedAt: sampleDate,
      },
    });

    // One unpublished demo rubric illustrates versioning; it contains no official band descriptors.
    const rubric = await tx.rubricVersion.upsert({
      where: { rubricCode_versionNo: { rubricCode: 'WRITING_TASK_2_DEMO', versionNo: 1 } },
      update: {},
      create: {
        id: fixtureId(80), rubricCode: 'WRITING_TASK_2_DEMO', versionNo: 1,
        taskType: 'WRITING_TASK_2', title: '[Demo] Writing Task 2 rubric structure',
      },
    });
    for (const [index, sample] of [
      { code: 'TR', name: 'Task Response', definition: 'Demo summary: addresses the task and develops relevant ideas.' },
      { code: 'CC', name: 'Coherence and Cohesion', definition: 'Demo summary: organizes ideas with a clear progression.' },
      { code: 'LR', name: 'Lexical Resource', definition: 'Demo summary: uses vocabulary appropriately and accurately.' },
      { code: 'GRA', name: 'Grammatical Range and Accuracy', definition: 'Demo summary: uses varied grammatical structures accurately.' },
    ].entries()) {
      await tx.rubricCriterion.upsert({
        where: { rubricVersionId_code: { rubricVersionId: rubric.id, code: sample.code } },
        update: {},
        create: { id: fixtureId(81 + index), rubricVersionId: rubric.id, ...sample, weight: 0.25, maxScore: 9 },
      });
    }

    // Learner attempts, grades, evidence and recommendations must come from actual workflows.
    return {
      users: users.map(({ email }) => email), course: course.title,
      readingQuestions: items.length, answerKeyVersion: answerKey.versionNo,
      assignmentId: assignment.id, unpublishedDemoRubricVersion: rubric.versionNo,
    };
  }, { maxWait: 10000, timeout: 30000 });

  console.log('Sample authoring data ready. Existing matching records were preserved.');
  console.log(summary);
}

main()
  .catch((error: unknown) => {
    // Avoid printing connection details or credentials from driver errors.
    console.error('Seed failed. Check PostgreSQL, DATABASE_URL, and applied migrations.');
    console.error(error instanceof Error ? error.name : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
