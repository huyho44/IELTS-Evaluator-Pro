// Local/staging test data for every LMS feature. Run after `npm run db:seed`
// on an empty database (see `npm run db:reset:test`). Everything is created
// through the application services, so grades, evidence, notifications and
// audit events come from the real workflows, never from direct inserts.
import 'dotenv/config';
import { PrismaService } from '../src/prisma.service.js';
import { AuthService, type Actor } from '../src/auth/auth.service.js';
import { AccessService } from '../src/auth/access.service.js';
import { hashPassword } from '../src/common/crypto.js';
import { CoursesService } from '../src/courses/courses.service.js';
import { CourseAuthoringService } from '../src/courses/course-authoring.service.js';
import { QuizAuthoringService } from '../src/courses/quiz-authoring.service.js';
import { NotifierService } from '../src/notifications/notifier.service.js';
import { SubmissionsService } from '../src/submissions/submissions.service.js';
import { GradingService } from '../src/grading/grading.service.js';
import { PublicationService } from '../src/grading/publication.service.js';
import { GradingWorker } from '../src/grading/grading.worker.js';
import type { GradingProvider } from '../src/grading/grading-provider.js';
import { ReviewsService } from '../src/reviews/reviews.service.js';
import { ManagementService } from '../src/management/management.service.js';
import { DiscussionsService } from '../src/discussions/discussions.service.js';
import { ModerationService } from '../src/moderation/moderation.service.js';

const password = process.env.DEMO_PASSWORD || 'IeltsDemo123!';
const READING_FOUNDATIONS = '26102026-0000-4000-8000-000000000001';
const LIBRARY_ASSIGNMENT = '26102026-0000-4000-8000-000000000070';
const LIBRARY_SHORT_ITEM = '26102026-0000-4000-8000-000000000050';
const LIBRARY_CHOICE_ITEM = '26102026-0000-4000-8000-000000000051';
const LIBRARY_CORRECT_OPTION = '26102026-0000-4000-8000-000000000041';
const HOURS = 3600000;

const ESSAYS = {
  anDiagnostic: `Public transport is a hot topic in many cities today. Some people think the government should spend more money on buses and trains, while others believe new roads are more important. In my opinion, public transport deserves more investment.

Firstly, buses and trains can carry many people at the same time. This reduces traffic jams in the city centre and people can arrive at work on time. For example, in my city the new metro line carries thousands of passengers every morning.

Secondly, public transport is better for the environment. Cars produce a lot of pollution and this is bad for our health. If more people use buses, the air will be cleaner.

However, building roads is also necessary because some people live in rural areas where there is no train. The government should not forget them.

In conclusion, I believe investing in public transport is the better choice because it helps traffic and the environment.`,
  anPractice: `Governments should prioritise public transport because a single well-planned investment can solve several urban problems at once.

The strongest argument concerns efficiency. A double-decker bus occupies roughly the same road space as three private cars, yet it can carry up to eighty passengers. When a city such as Ho Chi Minh City opens a dedicated bus lane, journey times for thousands of commuters fall, and this benefit is shared by everyone rather than only by car owners.

Furthermore, this efficiency has a direct economic effect. Workers who spend less time in traffic are more productive, and lower travel costs leave families with more money to spend in the local economy.

For these reasons, spending on buses and trains is not simply an environmental choice; it is a practical way to make cities work better.`,
  binhDiagnostic: `Nowadays transport is very important. Many people use motorbike and car so the road is very crowded. I think government must build more bus.

Bus is cheap and many people can use it. Student and worker can go to school and work easy. Also bus make less pollution than many car.

But some people dont like bus because it is slow and not comfortable. So government need to make bus better, more clean and more fast.

In conclusion public transport is good and government should spend money for it.`,
  chiDiagnostic: `Cities around the world face a difficult choice between expanding road networks and improving public transport systems. While both options have merits, I would argue that public transport should receive the larger share of funding.

To begin with, roads tend to fill up again soon after they are widened, a phenomenon known as induced demand. Consequently, building more roads often provides only temporary relief from congestion.

On the other hand, an efficient metro or bus network can move large numbers of people quickly and predictably. Moreover, it gives those who cannot drive, such as teenagers and the elderly, greater independence.

Nevertheless, rural communities still depend on roads, so governments should not abandon road maintenance entirely.

Overall, a balanced budget that clearly favours public transport would bring the greatest long-term benefits.`,
  dungTransfer: `The shift towards remote work has been one of the most significant changes in modern employment. While some organisations insist that staff return to the office, others have embraced working from home permanently. This essay will consider both approaches before explaining why a flexible model is preferable.

Supporters of office-based work argue that physical presence strengthens collaboration. Spontaneous conversations in corridors frequently generate ideas, and new employees learn faster by observing experienced colleagues. In addition, a clear boundary between home and work can protect employees' mental health.

Conversely, remote work offers undeniable advantages. Employees save hours each week that would otherwise be spent commuting, and companies can recruit talent regardless of geography. Many workers also report higher concentration when they are free from open-plan office noise.

In my view, the most effective solution is a hybrid arrangement in which teams meet in person for collaborative tasks but complete focused work at home. This approach preserves the social benefits of the office while retaining the efficiency of remote work.

In conclusion, neither extreme is ideal, and employers should design flexible policies that reflect the nature of each role.`,
};

const db = new PrismaService();
const auth = new AuthService(db);
const access = new AccessService(db);
const notifier = new NotifierService(db);
const publication = new PublicationService(db);
const grading = new GradingService(db, access, publication);
const submissions = new SubmissionsService(db, access, grading);
const reviews = new ReviewsService(db, access, grading, publication);
const courses = new CoursesService(db, access);
const author = new CourseAuthoringService(db, access, notifier);
const quizzes = new QuizAuthoringService(db, access, notifier);
const management = new ManagementService(db, access);
const discussions = new DiscussionsService(db);
const moderation = new ModerationService(db, discussions);
// Objective answers are graded from the answer key; no AI provider is called.
const worker = new GradingWorker(
  db,
  grading,
  {} as GradingProvider,
  publication,
);

async function account(
  email: string,
  displayName: string,
  roleCodes: string[],
  extra: { targetBand?: number; status?: 'ACTIVE' | 'SUSPENDED' } = {},
) {
  const roles = await db.role.findMany({ where: { code: { in: roleCodes } } });
  const user = await db.user.create({
    data: {
      email,
      displayName,
      passwordHash: hashPassword(password),
      status: extra.status ?? 'ACTIVE',
      targetBand: extra.targetBand,
      userRoles: { create: roles.map((role) => ({ roleId: role.id })) },
    },
  });
  return user;
}

const profile = (email: string) =>
  db.user
    .findUniqueOrThrow({ where: { email } })
    .then((user) => auth.getProfile(user.id));

async function gradeObjective() {
  for (let i = 0; i < 5; i++) await worker.tick();
}

// Learner submits a Writing response; the review case is returned.
async function submitWriting(
  learner: Actor,
  assignmentId: string,
  writingText: string,
) {
  const attempt = await submissions.start(assignmentId, learner);
  const receipt = await submissions.submitAssignment(
    assignmentId,
    { attemptId: attempt.id, writingText },
    learner,
  );
  const review = await db.reviewCase.findFirstOrThrow({
    where: { revisionId: receipt.revisionId },
  });
  return { revisionId: receipt.revisionId, reviewId: review.id };
}

// Teacher claims and confirms a review with criterion scores, one global and
// one anchored finding, and skill observations.
async function confirmWriting(
  teacher: Actor,
  submission: { revisionId: string; reviewId: string },
  scores: Record<string, number>,
  summary: string,
  observations: { code: string; outcome: string; rationale: string }[],
) {
  await reviews.claimSubmission(submission.reviewId, teacher);
  const review = await db.reviewCase.findUniqueOrThrow({
    where: { id: submission.reviewId },
    include: {
      revision: {
        include: {
          revisionParagraphs: { orderBy: { paragraphNo: 'asc' } },
          attempt: {
            include: {
              assignmentVersion: {
                include: {
                  rubricVersion: { include: { rubricCriterions: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const criteria =
    review.revision.attempt.assignmentVersion.rubricVersion!.rubricCriterions;
  const paragraph =
    review.revision.revisionParagraphs[1] ??
    review.revision.revisionParagraphs[0];
  const quote = paragraph.text.split(/\s+/).slice(0, 8).join(' ');
  const skills = await db.skill.findMany({
    where: { skillArea: 'WRITING', status: 'PUBLISHED' },
  });
  const skillId = (code: string) => skills.find((s) => s.code === code)!.id;
  return reviews.confirmReview(
    submission.reviewId,
    {
      lockVersion: review.lockVersion,
      reason: 'Teacher review of the submitted essay',
      summary,
      criteria: criteria.map((criterion) => ({
        code: criterion.code,
        score: scores[criterion.code] ?? 6,
        explanation: `${criterion.name}: see the summary and highlighted evidence.`,
      })),
      findings: [
        {
          kind: 'GLOBAL',
          code: criteria[0].code,
          explanation:
            'The position is clear, but each main idea needs a fuller explanation and a specific example.',
          anchors: [],
        },
        {
          kind: 'LOCAL',
          code: criteria[1]?.code ?? criteria[0].code,
          explanation:
            'This opening sentence of the paragraph could link more clearly to the previous idea.',
          anchors: [{ paragraphId: paragraph.id, exactQuote: quote }],
        },
      ],
      observations: observations.map((o) => ({
        skillId: skillId(o.code),
        outcome: o.outcome,
        rationale: o.rationale,
      })),
    },
    teacher,
  );
}

async function main() {
  await db.$connect();
  if (
    await db.user.findUnique({ where: { email: 'student.chi@ielts.example' } })
  ) {
    console.log(
      'Test data is already present. Run `npm run db:reset:test` to start again.',
    );
    return;
  }
  if (await db.gradingConfig.count())
    throw new Error(
      'An AI grading config exists. Unset DEMO_GRADING_PROVIDER/DEMO_GRADING_MODEL and reset, so Writing goes to teacher review.',
    );

  // ---- Accounts ----------------------------------------------------------
  const admin = await profile('admin@ielts.example');
  const teacher = await profile('teacher@ielts.example');
  const an = await profile('student.an@ielts.example');
  const binh = await profile('student.binh@ielts.example');
  await account('teacher.lan@ielts.example', 'Lan Nguyen', ['INSTRUCTOR']);
  await account('student.chi@ielts.example', 'Chi', ['LEARNER'], {
    targetBand: 7.5,
  });
  await account('student.dung@ielts.example', 'Dung', ['LEARNER'], {
    targetBand: 7,
  });
  await account('student.em@ielts.example', 'Em', ['LEARNER'], {
    targetBand: 6,
  });
  await account(
    'applicant.minh@ielts.example',
    'Minh (applicant)',
    ['LEARNER'],
    { targetBand: 8 },
  );
  await account('suspended@ielts.example', 'Suspended Learner', ['LEARNER'], {
    status: 'SUSPENDED',
  });
  const lan = await profile('teacher.lan@ielts.example');
  const chi = await profile('student.chi@ielts.example');
  const dung = await profile('student.dung@ielts.example');
  const em = await profile('student.em@ielts.example');
  const minh = await profile('applicant.minh@ielts.example');
  await management.apply(
    {
      profileText:
        'IELTS 8.5 (Writing 8.0). Three years teaching Writing Task 2 at a language centre in Da Nang. I would like to review essays and run Q&A for learners.',
    },
    minh,
  );

  // ---- Skills ------------------------------------------------------------
  const listeningSkill = await management.saveSkill(
    undefined,
    {
      code: 'demo.listening.numbers',
      name: 'Catching numbers and spellings',
      skillArea: 'LISTENING',
      observableDefinition:
        'Writes down numbers, dates and spelled names correctly from a recording.',
      status: 'PUBLISHED',
    },
    admin,
  );
  const readingSkill = await db.skill.findUniqueOrThrow({
    where: { code: 'demo.reading.detail' },
  });

  // ---- Reading Foundations: An completes it (prerequisite for Intermediate)
  const foundationsLessons = await db.learningItem.findMany({
    where: {
      courseId: READING_FOUNDATIONS,
      kind: 'LESSON',
      status: 'PUBLISHED',
    },
    orderBy: { position: 'asc' },
  });
  for (const lesson of foundationsLessons)
    await courses.completeLesson(READING_FOUNDATIONS, lesson.id, an);
  const library = await submissions.start(LIBRARY_ASSIGNMENT, an);
  await submissions.submitAssignment(
    LIBRARY_ASSIGNMENT,
    {
      attemptId: library.id,
      itemResponses: [
        { assessmentItemId: LIBRARY_SHORT_ITEM, textAnswer: '9 am' },
        {
          assessmentItemId: LIBRARY_CHOICE_ITEM,
          optionIds: [LIBRARY_CORRECT_OPTION],
        },
      ],
    },
    an,
  );
  await gradeObjective();
  const foundationsDone = await management.completeCourse(
    READING_FOUNDATIONS,
    an,
  );
  if (foundationsDone.status !== 'COMPLETED')
    throw new Error('An did not complete Reading Foundations');
  // Binh has started Foundations: one lesson done, nothing else.
  await courses.completeLesson(
    READING_FOUNDATIONS,
    foundationsLessons[0].id,
    binh,
  );

  // ---- Reading Intermediate: prerequisite, hidden content, quizzes ------
  const intermediate = await courses.create(
    {
      title: 'IELTS Reading Intermediate',
      description:
        'Skimming, scanning and matching headings on Academic-style passages. Requires IELTS Reading Foundations.',
      completionPolicyJson: { mode: 'ALL_REQUIRED_ITEMS' },
    },
    teacher,
  );
  const unit1 = await author.section(
    intermediate.id,
    { title: 'Unit 1: Skimming and scanning', position: 1 },
    teacher,
  );
  const unit2 = await author.section(
    intermediate.id,
    { title: 'Unit 2: Matching headings', position: 2 },
    teacher,
  );
  const skimming = await author.lesson(
    intermediate.id,
    {
      title: 'Skimming a passage in 60 seconds',
      sectionId: unit1.id,
      position: 1,
      summary:
        'Read titles, first sentences and topic words to get the gist fast.',
      contentText:
        'Skimming means reading quickly for the main idea, not for detail.\n\n1. Read the title and any subheadings.\n2. Read the first sentence of every paragraph.\n3. Underline repeated topic words.\n4. Summarise the passage in one sentence before you look at the questions.\n\nPractice: give yourself 60 seconds for a 700-word passage, then write the main idea in under 15 words.\n\nCommon mistake: stopping to look up every unknown word. Skimming works because you ignore detail on purpose.',
    },
    teacher,
  );
  const scanning = await author.lesson(
    intermediate.id,
    {
      title: 'Scanning for names, numbers and dates',
      sectionId: unit1.id,
      position: 2,
      summary: 'Move your eyes quickly to find one exact piece of information.',
      contentText:
        'Scanning is searching for a specific item: a name, a number, a date or a key term.\n\nBefore scanning, decide exactly what the answer will look like. A year has four digits; a name starts with a capital letter.\n\nThen move your eyes down the page without reading every word. When you find a match, read the whole sentence to confirm it answers the question.\n\nWatch out for distractors: passages often mention two similar numbers, such as an old price and a new price.',
    },
    teacher,
  );
  const coffeeQuiz = await quizzes.create(
    intermediate.id,
    {
      title: 'Quiz: Coffee culture',
      sectionId: unit1.id,
      position: 3,
      skillArea: 'READING',
      promptText:
        'Coffee arrived in Europe in the 17th century. The first coffee house in London opened in 1652, and by 1700 there were more than 2,000 of them. They were called "penny universities" because, for the price of a cup, customers could listen to discussions about science, politics and trade. Women, however, were not allowed to enter.',
      instructions:
        'Answer all four questions using information from the passage.',
      difficulty: 2,
      expectedMinutes: 8,
      skillIds: [readingSkill.id],
      questions: [
        {
          type: 'SINGLE_CHOICE',
          prompt: 'When did the first coffee house open in London?',
          options: [
            { text: '1562', correct: false },
            { text: '1652', correct: true },
            { text: '1700', correct: false },
          ],
        },
        {
          type: 'MULTIPLE_CHOICE',
          prompt: 'Which topics were discussed in coffee houses? Choose TWO.',
          marks: 2,
          options: [
            { text: 'Science', correct: true },
            { text: 'Sport', correct: false },
            { text: 'Trade', correct: true },
            { text: 'Fashion', correct: false },
          ],
        },
        {
          type: 'SHORT_ANSWER',
          prompt:
            'Coffee houses were nicknamed "penny ______". Write ONE word.',
          acceptedAnswers: ['universities'],
          maxWords: 1,
        },
      ],
    },
    teacher,
  );
  const museumQuiz = await quizzes.create(
    intermediate.id,
    {
      title: 'Quiz: A museum visit',
      sectionId: unit1.id,
      position: 4,
      skillArea: 'READING',
      promptText:
        'The City Museum is open from 10 a.m. to 5 p.m., Tuesday to Sunday. Entry is free for children under 12; adult tickets cost 8 pounds. Guided tours start every hour and last 45 minutes.',
      instructions:
        'Answer the questions. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.',
      difficulty: 1,
      expectedMinutes: 5,
      skillIds: [readingSkill.id],
      questions: [
        {
          type: 'SHORT_ANSWER',
          prompt: 'How much is an adult ticket (in pounds)?',
          acceptedAnswers: ['8', 'eight'],
          maxWords: 2,
        },
        {
          type: 'SHORT_ANSWER',
          prompt: 'How long does a guided tour last (minutes)?',
          acceptedAnswers: ['45', '45 minutes', 'forty-five'],
          maxWords: 2,
        },
        {
          type: 'SINGLE_CHOICE',
          prompt: 'On which day is the museum closed?',
          options: [
            { text: 'Monday', correct: true },
            { text: 'Sunday', correct: false },
          ],
        },
      ],
    },
    teacher,
  );
  await author.lesson(
    intermediate.id,
    {
      title: 'Matching headings: a strategy',
      sectionId: unit2.id,
      position: 5,
      contentText:
        'Read the headings first, then skim each paragraph for its main idea. Hidden until Unit 2 opens.',
    },
    teacher,
  );
  const tfng = await author.lesson(
    intermediate.id,
    {
      title: 'True / False / Not Given (coming soon)',
      position: 6,
      contentText:
        'Draft lesson kept hidden from learners while it is being written.',
    },
    teacher,
  );
  // A8: hidden section (hides its lesson) and a hidden lesson.
  await author.updateSection(
    intermediate.id,
    unit2.id,
    { status: 'HIDDEN' },
    teacher,
  );
  await author.updateItem(
    intermediate.id,
    tfng.id,
    { status: 'HIDDEN' },
    teacher,
  );
  const coffeeAssignment = await author.assignment(
    intermediate.id,
    {
      title: 'Quiz: Coffee culture',
      activityVersionId: coffeeQuiz.activityVersionId,
      mode: 'GRADED',
      maxAttempts: 2,
      dueAt: new Date(Date.now() + 20 * HOURS).toISOString(),
      releasePolicyJson: { releaseMode: 'IMMEDIATE' },
    },
    teacher,
  );
  const museumAssignment = await author.assignment(
    intermediate.id,
    {
      title: 'Quiz: A museum visit',
      activityVersionId: museumQuiz.activityVersionId,
      mode: 'PRACTICE',
      maxAttempts: 3,
      releasePolicyJson: { releaseMode: 'IMMEDIATE' },
    },
    teacher,
  );
  await courses.update(
    intermediate.id,
    { status: 'PUBLISHED', enrollmentOpen: true },
    teacher,
  );
  await courses.setPrerequisites(
    intermediate.id,
    { prerequisiteCourseIds: [READING_FOUNDATIONS] },
    teacher,
  );
  await courses.enrollCourse(intermediate.id, an); // allowed: Foundations completed
  // Added after An enrolled, so An receives a NEW_CONTENT notification.
  await author.lesson(
    intermediate.id,
    {
      title: 'Spotting paraphrases',
      sectionId: unit1.id,
      position: 7,
      summary: 'Questions rarely repeat the passage word for word.',
      contentText:
        'IELTS questions usually paraphrase the passage. "Expensive" may appear as "costly"; "children" as "young people".\n\nBuild a habit: for every answer you find, underline the words in the passage that match the question and write the synonym pair in a notebook.',
    },
    teacher,
  );
  // An: museum quiz submitted (3/4 marks: wrong tour length), reading position
  // saved on the scanning lesson, coffee quiz not started (due within 24 h).
  const museumAttempt = await submissions.start(
    museumAssignment.assignmentId,
    an,
  );
  const museumItems = await db.assessmentItem.findMany({
    where: { activityVersionId: museumQuiz.activityVersionId },
    include: { questionVersion: { include: { questionOptions: true } } },
    orderBy: { position: 'asc' },
  });
  await submissions.submitAssignment(
    museumAssignment.assignmentId,
    {
      attemptId: museumAttempt.id,
      itemResponses: [
        { assessmentItemId: museumItems[0].id, textAnswer: '8' },
        { assessmentItemId: museumItems[1].id, textAnswer: '60 minutes' },
        {
          assessmentItemId: museumItems[2].id,
          optionIds: [
            museumItems[2].questionVersion.questionOptions.find(
              (o) => o.optionCode === 'A',
            )!.id,
          ],
        },
      ],
    },
    an,
  );
  await gradeObjective();
  await courses.completeLesson(intermediate.id, skimming.id, an);
  await courses.touchLesson(intermediate.id, skimming.id, {}, an);
  await courses.touchLesson(
    intermediate.id,
    scanning.id,
    { position: { scrollRatio: 0.45 } },
    an,
  );
  const lessonThread = await discussions.create(an, intermediate.id, {
    title: 'Do I read the whole sentence after scanning?',
    body: 'When I find the number, should I still read the full sentence, or is that a waste of time?',
    contextItemId: scanning.id,
  });
  await discussions.reply(teacher, lessonThread.id, {
    body: 'Yes, always read the whole sentence. It takes a few seconds and protects you from distractors like an old price next to a new one.',
  });
  await moderation.report(an, {
    targetType: 'LEARNING_ITEM',
    targetId: skimming.id,
    reason:
      'Step 3 says "underline" but the practice text cannot be underlined on screen.',
  });

  // ---- IELTS Listening Starter (owned by Lan) ----------------------------
  const listening = await courses.create(
    {
      title: 'IELTS Listening Starter',
      description:
        'Form completion and numbers practice. Audio will be added later; transcripts are provided for now.',
      completionPolicyJson: { mode: 'ALL_REQUIRED_ITEMS' },
    },
    lan,
  );
  await author.lesson(
    listening.id,
    {
      title: 'Numbers, dates and spelling',
      position: 1,
      contentText:
        'In Section 1 you often hear phone numbers, dates and spelled names. Write numbers as digits and check whether the question asks for a date or a time.',
    },
    lan,
  );
  const listeningQuiz = await quizzes.create(
    listening.id,
    {
      title: 'Quiz: Booking a hotel room',
      position: 2,
      skillArea: 'LISTENING',
      promptText:
        'Transcript: "Good morning, Seaview Hotel." "Hi, I would like to book a double room for the 14th of March, please. My name is Sarah Kelly, that is K-E-L-L-Y." "Certainly. Could I have a phone number?" "Yes, it is 0412 556 873."',
      instructions:
        'Complete the booking form. Write ONE WORD AND/OR A NUMBER.',
      skillIds: [listeningSkill.id],
      questions: [
        {
          type: 'SHORT_ANSWER',
          prompt: 'Surname of the guest',
          acceptedAnswers: ['Kelly'],
          maxWords: 1,
        },
        {
          type: 'SHORT_ANSWER',
          prompt: 'Date of arrival (day of March)',
          acceptedAnswers: ['14', '14th'],
          maxWords: 1,
        },
        {
          type: 'SINGLE_CHOICE',
          prompt: 'Type of room',
          options: [
            { text: 'Single', correct: false },
            { text: 'Double', correct: true },
            { text: 'Family', correct: false },
          ],
        },
      ],
    },
    lan,
  );
  await author.assignment(
    listening.id,
    {
      title: 'Quiz: Booking a hotel room',
      activityVersionId: listeningQuiz.activityVersionId,
      mode: 'PRACTICE',
      maxAttempts: 3,
      dueAt: new Date(Date.now() + 72 * HOURS).toISOString(),
      releasePolicyJson: { releaseMode: 'IMMEDIATE' },
    },
    lan,
  );
  await courses.update(
    listening.id,
    { status: 'PUBLISHED', enrollmentOpen: true },
    lan,
  );
  await courses.enrollCourse(listening.id, chi);
  await courses.enrollCourse(listening.id, em);

  // ---- Draft course (visible to its instructor only) ---------------------
  const speaking = await courses.create(
    {
      title: 'IELTS Speaking Lab (draft)',
      description:
        'Part 2 cue cards and teacher-scored recordings. Not published yet.',
      completionPolicyJson: { mode: 'ALL_REQUIRED_ITEMS' },
    },
    teacher,
  );
  await author.section(
    speaking.id,
    { title: 'Part 2: Cue cards', position: 1 },
    teacher,
  );

  // ---- Writing Clinic: submissions, reviews, appeals ---------------------
  const writingCourse = await db.course.findFirstOrThrow({
    where: { title: '[Demo] Writing Clinic: evidence to transfer' },
  });
  await management.assign(
    writingCourse.id,
    {
      instructorId: lan.id,
      responsibility: 'REVIEWER',
      reason: 'Second reviewer for the Writing Clinic',
    },
    admin,
  );
  await courses.enrollCourse(writingCourse.id, chi);
  await courses.enrollCourse(writingCourse.id, dung);
  const writingAssignments = await db.assignment.findMany({
    where: { courseId: writingCourse.id },
  });
  const assignmentOf = (fragment: string) =>
    writingAssignments.find((a) => a.title.includes(fragment))!.id;
  const diagnostic = assignmentOf('Diagnostic');
  const developPractice = assignmentOf('develop one transport argument');
  const progressionPractice = assignmentOf('progression and clear references');
  const transfer = assignmentOf('Transfer');

  const anDiagnostic = await submitWriting(an, diagnostic, ESSAYS.anDiagnostic);
  await confirmWriting(
    teacher,
    anDiagnostic,
    { TR: 6, CC: 6, LR: 6.5, GRA: 5.5 },
    'A clear position with relevant ideas. Develop each argument with a specific example and vary sentence structures.',
    [
      {
        code: 'demo.writing.position',
        outcome: 'MET',
        rationale:
          'The opinion is stated in the introduction and repeated in the conclusion.',
      },
      {
        code: 'demo.writing.development',
        outcome: 'PARTIAL',
        rationale:
          'Ideas are relevant but each body paragraph has only one short example.',
      },
      {
        code: 'demo.writing.sentence-control',
        outcome: 'NOT_MET',
        rationale: 'Mostly simple sentences; several agreement errors.',
      },
    ],
  );
  const anPractice = await submitWriting(
    an,
    developPractice,
    ESSAYS.anPractice,
  );
  await confirmWriting(
    teacher,
    anPractice,
    { TR: 6.5, CC: 7, LR: 6.5, GRA: 6.5 },
    'Much stronger development: the bus lane example is specific and the economic effect is explained.',
    [
      {
        code: 'demo.writing.development',
        outcome: 'MET',
        rationale:
          'The argument is extended with a concrete example and a consequence.',
      },
      {
        code: 'demo.writing.progression',
        outcome: 'PARTIAL',
        rationale: 'Good linking between paragraphs; the conclusion is brief.',
      },
    ],
  );
  // An has an unfinished attempt to resume.
  await submissions.start(progressionPractice, an);

  // Binh: waiting in the review queue. Chi: claimed by the teacher.
  await submitWriting(binh, diagnostic, ESSAYS.binhDiagnostic);
  const chiDiagnostic = await submitWriting(
    chi,
    diagnostic,
    ESSAYS.chiDiagnostic,
  );
  await reviews.claimSubmission(chiDiagnostic.reviewId, teacher);

  // Dung: graded transfer task confirmed by Lan, then appealed.
  const dungTransfer = await submitWriting(dung, transfer, ESSAYS.dungTransfer);
  const dungResult = await confirmWriting(
    lan,
    dungTransfer,
    { TR: 7, CC: 7, LR: 7, GRA: 6.5 },
    'Well-organised hybrid argument with precise vocabulary. A few long sentences lose control.',
    [
      {
        code: 'demo.writing.position',
        outcome: 'MET',
        rationale: 'Balanced discussion with a clear final opinion.',
      },
      {
        code: 'demo.writing.collocation',
        outcome: 'MET',
        rationale:
          'Accurate collocations such as "embraced working from home".',
      },
    ],
  );
  await reviews.createAppeal(
    dungResult.acceptedAssessment.id,
    {
      reason:
        'I think Grammatical Range deserves 7.0: I used a range of complex structures with very few errors.',
    },
    dung,
  );

  // ---- Discussions and moderation in the Writing Clinic ------------------
  const diagnosticItem = await db.assignment.findUniqueOrThrow({
    where: { id: diagnostic },
    select: { activityId: true },
  });
  const paragraphs = await discussions.create(an, writingCourse.id, {
    title: 'How many body paragraphs should I write?',
    body: 'For the diagnostic essay, is two body paragraphs enough or should I write three?',
    contextItemId: diagnosticItem.activityId,
  });
  const teacherAnswer = await discussions.reply(teacher, paragraphs.id, {
    body: 'Two well-developed body paragraphs are usually better than three thin ones. Focus on explaining and illustrating each idea.',
  });
  const answerId = teacherAnswer.posts[1].id;
  await discussions.reply(binh, paragraphs.id, {
    body: 'Thanks! Does the same apply to the transfer task?',
    parentPostId: answerId,
  });
  await discussions.reply(lan, paragraphs.id, {
    body: 'Yes, the same principle applies to any Task 2 essay.',
    parentPostId: answerId,
  });
  const offTopic = await discussions.reply(binh, paragraphs.id, {
    body: 'Is anyone watching the football final tonight?',
  });
  const contractions = await discussions.create(chi, writingCourse.id, {
    title: 'Can I use contractions like "don\'t"?',
    body: 'Are contractions acceptable in an academic essay or will I lose marks?',
  });
  const spam = await discussions.reply(dung, contractions.id, {
    body: 'Get ready-made band 9 essays at cheap-essays.example, only 5 dollars each!',
  });
  const announcement = await discussions.create(teacher, writingCourse.id, {
    title: 'Week 1: how feedback works',
    body: 'Every essay is reviewed by a teacher before the band score is published. Use the highlighted evidence to plan your rewrite.',
  });
  await discussions.lock(teacher, announcement.id, { locked: true });

  const spamPost = spam.posts.at(-1)!.id;
  await moderation.report(an, {
    targetType: 'POST',
    targetId: spamPost,
    reason: 'Advertising essay-writing services.',
  });
  await moderation.report(binh, {
    targetType: 'POST',
    targetId: spamPost,
    reason: 'Spam link.',
  });
  const offTopicReport = await moderation.report(chi, {
    targetType: 'POST',
    targetId: offTopic.posts.at(-1)!.id,
    reason: 'Off-topic.',
  });
  await moderation.resolve(teacher, offTopicReport.id, {
    resolution: 'Hidden: please keep the course Q&A on IELTS topics.',
  });
  const wrongReport = await moderation.report(chi, {
    targetType: 'POST',
    targetId: answerId,
    reason: 'I think this advice is wrong.',
  });
  await moderation.dismiss(teacher, wrongReport.id, {
    resolution: 'The advice matches the course rubric, so the post stays.',
  });
  await moderation.report(dung, {
    targetType: 'COURSE',
    targetId: listening.id,
    reason: 'A listening course without audio is misleading.',
  });

  // ---- Deadline reminders (normally sent by the worker every 5 minutes) --
  const reminders = await notifier.deadlineSoon();

  console.log('Test data ready.');
  console.table([
    {
      email: 'admin@ielts.example',
      role: 'ADMIN',
      notes: 'Pending instructor application, course report, appeal',
    },
    {
      email: 'teacher@ielts.example',
      role: 'INSTRUCTOR',
      notes: 'Review queue (Binh pending, Chi claimed), reports to moderate',
    },
    {
      email: 'teacher.lan@ielts.example',
      role: 'INSTRUCTOR',
      notes: 'Owns Listening Starter; reviewer in Writing Clinic',
    },
    {
      email: 'student.an@ielts.example',
      role: 'LEARNER',
      notes:
        'Official results, completed Foundations, continue learning, due-soon quiz',
    },
    {
      email: 'student.binh@ielts.example',
      role: 'LEARNER',
      notes: 'Essay awaiting review; blocked by prerequisite',
    },
    {
      email: 'student.chi@ielts.example',
      role: 'LEARNER',
      notes: 'Essay claimed; Listening learner; reporter',
    },
    {
      email: 'student.dung@ielts.example',
      role: 'LEARNER',
      notes: 'Graded transfer result with a pending appeal',
    },
    {
      email: 'student.em@ielts.example',
      role: 'LEARNER',
      notes: 'New learner in Listening Starter only',
    },
    {
      email: 'applicant.minh@ielts.example',
      role: 'LEARNER',
      notes: 'Pending instructor application',
    },
    {
      email: 'suspended@ielts.example',
      role: 'LEARNER',
      notes: 'SUSPENDED: sign-in is refused',
    },
  ]);
  console.log(
    `Password for every account: the DEMO_PASSWORD value (default IeltsDemo123!). Deadline reminders sent: ${reminders}. Coffee quiz is due ${coffeeAssignment.dueAt?.toISOString()}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      'Test seed failed:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
