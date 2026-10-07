import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';
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
const sampleDate = new Date('2026-09-26T09:00:00.000Z');

// Format: scrypt:<hex salt>:<hex derived key>. Authentication is not implemented yet.
function hashPassword() {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(samplePassword, salt, 64).toString('hex')}`;
}

async function main() {
  // Commit the sample graph together, or roll back if any insert fails.
  const summary = await prisma.$transaction(async (tx) => {
    const users = [];
    for (const sample of [
      { email: 'admin@ielts.example', role: 'ADMIN', targetBand: 8 },
      { email: 'teacher@ielts.example', role: 'TEACHER', targetBand: 8.5 },
      { email: 'student.an@ielts.example', role: 'STUDENT', targetBand: 7 },
      { email: 'student.binh@ielts.example', role: 'STUDENT', targetBand: 6.5 },
    ]) {
      users.push(await tx.user.upsert({
        where: { email: sample.email },
        update: {},
        create: { ...sample, status: 'ACTIVE', passwordHash: hashPassword() },
      }));
    }
    const [, teacher, an, binh] = users;

    const courses = [];
    for (const sample of [
      { title: '[Demo] IELTS Writing Foundations', description: 'Practice Task 1 reports and Task 2 essays with sample feedback.' },
      { title: '[Demo] IELTS Reading and Listening', description: 'Build comprehension skills with short practice questions.' },
    ]) {
      courses.push(await tx.course.findFirst({ where: { title: sample.title, createdId: teacher.id } })
        ?? await tx.course.create({ data: { ...sample, createdId: teacher.id } }));
    }

    const lessons = [];
    for (const sample of [
      { title: 'Task 1: Describe a chart', type: 'WRITING', targetSkillTag: 'TASK_1', courseId: courses[0].id },
      { title: 'Task 2: Public transport essay', type: 'WRITING', targetSkillTag: 'TASK_2', courseId: courses[0].id },
      { title: 'Reading: Urban green spaces', type: 'READING', targetSkillTag: 'READING_COMPREHENSION', courseId: courses[1].id },
      { title: 'Listening: Library registration', type: 'LISTENING', targetSkillTag: 'LISTENING_DETAILS', courseId: courses[1].id },
    ]) {
      lessons.push(await tx.lesson.findFirst({ where: { title: sample.title, courseId: sample.courseId } })
        ?? await tx.lesson.create({ data: sample }));
    }

    for (const sample of [
      { userId: an.id, courseId: courses[0].id, progressPercentage: 50 },
      { userId: an.id, courseId: courses[1].id, progressPercentage: 25 },
      { userId: binh.id, courseId: courses[0].id, progressPercentage: 0 },
    ]) {
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: sample.userId, courseId: sample.courseId } },
        update: {},
        create: { ...sample, lastAccessed: sampleDate },
      });
    }

    for (const sample of [
      { lessonId: lessons[2].id, type: 'TRUE_FALSE', questionText: 'Passage: Urban parks reduce summer temperatures. Statement: Parks can help cool cities.', correctAnswer: 'TRUE' },
      { lessonId: lessons[2].id, type: 'SHORT_ANSWER', questionText: 'Passage: Residents use parks for exercise and relaxation. Name one activity mentioned.', correctAnswer: 'exercise' },
      { lessonId: lessons[3].id, type: 'SHORT_ANSWER', questionText: 'Transcript: The library opens at nine in the morning. What time does it open?', correctAnswer: '9:00' },
      { lessonId: lessons[3].id, type: 'SHORT_ANSWER', questionText: 'Transcript: Please bring your student card to register. What must you bring?', correctAnswer: 'student card' },
    ]) {
      if (!await tx.quizQuestion.findFirst({ where: { lessonId: sample.lessonId, questionText: sample.questionText } })) {
        await tx.quizQuestion.create({ data: sample });
      }
    }

    // Illustrative descriptors for demos, not official IELTS assessment text.
    const rubrics = [];
    for (const sample of [
      { criterion: 'TA', description: 'Addresses the question and supports a clear position with relevant examples.' },
      { criterion: 'CC', description: 'Organizes ideas into clear paragraphs with logical progression.' },
      { criterion: 'LR', description: 'Uses varied vocabulary with occasional imprecise word choices.' },
      { criterion: 'GRA', description: 'Uses a mix of sentence structures with generally accurate grammar.' },
    ]) {
      const where = { lessonId: lessons[1].id, criterion: sample.criterion, bandLevel: 7 };
      rubrics.push(await tx.rubricDescriptor.findFirst({ where })
        ?? await tx.rubricDescriptor.create({ data: { ...where, description: sample.description } }));
    }

    const sessions = [];
    const submissions = [];
    for (const sample of [
      {
        userId: an.id, lessonId: lessons[1].id,
        contentText: 'Governments should invest in public transport because it reduces congestion and makes travel affordable. For example, reliable buses allow commuters to leave their cars at home. However, routes must serve residential areas as well as city centres. Overall, better public transport can improve daily life when services are frequent and accessible.',
      },
      {
        userId: binh.id, lessonId: lessons[0].id,
        contentText: 'The chart shows the percentage of commuters using buses, trains and cars in two years. Car use fell from 60 percent to 45 percent, while bus use rose from 25 percent to 30 percent. Train use increased from 15 percent to 25 percent. Overall, cars remained the most popular option, although public transport became more common.',
      },
    ]) {
      const where = { userId: sample.userId, lessonId: sample.lessonId, startTime: sampleDate };
      const session = await tx.testSession.findFirst({ where })
        ?? await tx.testSession.create({ data: {
          ...where, endTime: new Date('2026-09-26T09:40:00.000Z'), status: 'COMPLETED',
        } });
      sessions.push(session);
      submissions.push(await tx.submissions.findFirst({ where: { testSessionId: session.id, type: 'WRITING' } })
        ?? await tx.submissions.create({ data: {
          testSessionId: session.id, type: 'WRITING', contentText: sample.contentText,
        } }));
    }

    for (const sample of [
      { submissionId: submissions[0].id, evaluatorType: 'AI', evaluatorId: null, scoreTa: 6, scoreCc: 6.5, scoreLr: 6.5, scoreGra: 6, overallBand: 6.5 },
      { submissionId: submissions[0].id, evaluatorType: 'TEACHER', evaluatorId: teacher.id, scoreTa: 6, scoreCc: 6, scoreLr: 6.5, scoreGra: 6, overallBand: 6 },
      { submissionId: submissions[1].id, evaluatorType: 'AI', evaluatorId: null, scoreTa: 5.5, scoreCc: 6, scoreLr: 6, scoreGra: 6, overallBand: 6 },
    ]) {
      const where = { submissionId: sample.submissionId, evaluatorType: sample.evaluatorType, evaluatorId: sample.evaluatorId };
      if (!await tx.evaluation.findFirst({ where })) {
        await tx.evaluation.create({ data: {
          ...sample,
          feedbackJson: {
            sample: true,
            summary: 'Illustrative feedback only. This short practice response needs more development to meet exam requirements.',
            strengths: ['Clear central idea', 'Relevant topic vocabulary'],
            improvements: ['Develop supporting examples', 'Practice a full response within the time limit'],
          },
          ...(sample.submissionId === submissions[0].id
            ? { rubricDescriptors: { connect: rubrics.map(({ id }) => ({ id })) } }
            : {}),
        } });
      }
    }

    return {
      users: users.map(({ email }) => email),
      courses: courses.map(({ title }) => title),
      lessons: lessons.length,
      sessions: sessions.length,
      submissions: submissions.length,
    };
  }, { maxWait: 10000, timeout: 30000 });

  console.log('Sample database ready. Existing matching records were preserved.');
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
