import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { AuthService, type Actor } from '../auth/auth.service.js';
import { AccessService } from '../auth/access.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { CourseAuthoringService } from '../courses/course-authoring.service.js';
import { SubmissionsService } from '../submissions/submissions.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';
import { GradingService } from './grading.service.js';
import { GradingConfigService } from './grading-config.service.js';
import { PublicationService } from './publication.service.js';
import { GradingWorker } from './grading.worker.js';
import { GradingProvider } from './grading-provider.js';
import { hashPassword } from '../common/crypto.js';

const testUrl = process.env.CORE_TEST_DATABASE_URL;
// Opt-in integration tests never connect to the ordinary DATABASE_URL.
describe.skipIf(!testUrl)('core modules against isolated PostgreSQL', () => {
  let db: PrismaService,
    auth: AuthService,
    access: AccessService,
    courses: CoursesService,
    author: CourseAuthoringService,
    submissions: SubmissionsService,
    grading: GradingService,
    reviews: ReviewsService,
    recommendations: RecommendationsService,
    publication: PublicationService;
  let learner: Actor,
    other: Actor,
    teacher: Actor,
    teacher2: Actor,
    admin: Actor;
  let courseId: string,
    assignmentId: string,
    rubricId: string,
    skillId: string,
    revisionId: string,
    reviewId: string,
    attemptId: string,
    acceptedId: string;
  const suffix = randomUUID();
  const provider = { evaluate: vi.fn() };
  let worker: GradingWorker;
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error(
        'CORE_TEST_DATABASE_URL must be a local disposable *_test database',
      );
    vi.stubEnv('DATABASE_URL', testUrl!);
    vi.stubEnv(
      'AUTH_TOKEN_SECRET',
      'integration-test-secret-at-least-32-bytes',
    );
    db = new PrismaService();
    await db.$connect();
    auth = new AuthService(db);
    access = new AccessService(db);
    publication = new PublicationService(db);
    grading = new GradingService(db, access, publication);
    submissions = new SubmissionsService(db, access, grading);
    courses = new CoursesService(db, access);
    author = new CourseAuthoringService(db, access);
    reviews = new ReviewsService(db, access, grading, publication);
    recommendations = new RecommendationsService(db, access);
    worker = new GradingWorker(
      db,
      grading,
      provider as unknown as GradingProvider,
      publication,
    );
    const makeUser = async (name: string, roleCode: string) => {
      const role = await db.role.upsert({
        where: { code: roleCode },
        update: {},
        create: { code: roleCode, name: roleCode },
      });
      const user = await db.user.create({
        data: {
          email: name + suffix + '@test.example',
          displayName: name,
          passwordHash: hashPassword('TestPassword123'),
          userRoles: { create: { roleId: role.id } },
        },
      });
      return auth.getProfile(user.id);
    };
    learner = await makeUser('learner', 'LEARNER');
    other = await makeUser('other', 'LEARNER');
    teacher = await makeUser('teacher', 'INSTRUCTOR');
    teacher2 = await makeUser('teacher2', 'INSTRUCTOR');
    admin = await makeUser('admin', 'ADMIN');
    const course = await courses.create(
      {
        title: 'Core test',
        description: 'Integration fixture',
        completionPolicyJson: { mode: 'ALL_REQUIRED_ITEMS' },
      },
      teacher,
    );
    courseId = course.id;
    await db.courseInstructor.create({
      data: { courseId, instructorId: teacher2.id, responsibility: 'REVIEWER' },
    });
    const skill = await db.skill.create({
      data: {
        code: 'TEST_' + suffix,
        name: 'Idea development',
        skillArea: 'WRITING',
        observableDefinition: 'Test skill definition',
        status: 'PUBLISHED',
      },
    });
    skillId = skill.id;
    const config = new GradingConfigService(db, access);
    const rubric = await config.rubric(
      {
        rubricCode: 'TEST_' + suffix,
        versionNo: 1,
        title: 'Test rubric',
        taskType: 'WRITING_TASK_2',
        criteria: ['TR', 'CC', 'LR', 'GRA'].map((code) => ({
          code,
          name: code,
          definition: 'Test definition',
        })),
      },
      teacher,
    );
    rubricId = rubric.id;
    await config.config(
      {
        rubricVersionId: rubric.id,
        modelId: 'test-model',
        promptCode: 'TEST_' + suffix,
        promptVersionNo: 1,
        instructions: 'Test only',
        outputSchemaJson: {},
      },
      admin,
    );
    const activity = await author.activity(
      courseId,
      {
        title: 'Writing fixture',
        skillArea: 'WRITING',
        position: 1,
        promptText: 'Discuss urban transport.',
        instructions: 'Write an essay.',
        difficulty: 2,
        expectedMinutes: 30,
        skillIds: [skillId],
      },
      teacher,
    );
    const activityVersionId = activity.practiceActivity!.activityVersions[0].id;
    const assignment = await author.assignment(
      courseId,
      {
        title: 'Writing test',
        activityVersionId,
        rubricVersionId: rubric.id,
        mode: 'GRADED',
        maxAttempts: 2,
        maxRevisions: 3,
        releasePolicyJson: { releaseMode: 'IMMEDIATE' },
      },
      teacher,
    );
    assignmentId = assignment.assignmentId;
    await author.assignment(
      courseId,
      {
        title: 'Targeted writing practice',
        activityVersionId,
        rubricVersionId: rubric.id,
        mode: 'PRACTICE',
        maxAttempts: 5,
        maxRevisions: 2,
        releasePolicyJson: { releaseMode: 'IMMEDIATE' },
      },
      teacher,
    );
    await courses.update(
      courseId,
      { status: 'PUBLISHED', enrollmentOpen: true },
      teacher,
    );
    await courses.enrollCourse(courseId, learner);
    await courses.enrollCourse(courseId, other);
  }, 30000);
  afterAll(async () => {
    // Leave fixtures inspectable, but do not leave work from this suite queued
    // for the next run's worker. Only this suite's learners are affected.
    if (db && learner && other) {
      const runs = await db.gradingRun.findMany({
        where: {
          revision: { attempt: { learnerId: { in: [learner.id, other.id] } } },
          status: { in: ['QUEUED', 'RUNNING'] },
        },
        select: { id: true },
      });
      await db.gradingRun.updateMany({
        where: { id: { in: runs.map((r) => r.id) } },
        data: {
          status: 'FAILED',
          errorCode: 'TEST_FINISHED',
          processingToken: null,
          leaseUntil: null,
        },
      });
      await db.outboxEvent.updateMany({
        where: {
          aggregateId: { in: runs.map((r) => r.id) },
          eventType: 'GradeRequested',
        },
        data: { status: 'DISPATCHED' },
      });
    }
    await db?.$disconnect();
    vi.unstubAllEnvs();
  });

  it('rotates refresh tokens, rejects tampering, and revokes access on logout', async () => {
    const login = await auth.login({
      email: learner.email,
      password: 'TestPassword123',
    });
    expect((await auth.authenticate('Bearer ' + login.accessToken)).id).toBe(
      learner.id,
    );
    const parts = login.accessToken.split('.');
    parts[1] = Buffer.from(
      JSON.stringify({ sub: admin.id, sid: randomUUID(), exp: Date.now() }),
    ).toString('base64url');
    await expect(auth.getProfileFromToken(parts.join('.'))).rejects.toThrow();
    const refreshed = await auth.refresh({ refreshToken: login.refreshToken });
    await expect(
      auth.refresh({ refreshToken: login.refreshToken }),
    ).rejects.toThrow();
    await auth.logout('Bearer ' + refreshed.accessToken);
    await expect(
      auth.getProfileFromToken(refreshed.accessToken),
    ).rejects.toThrow();
  });

  it('starts one attempt under a concurrent double click and protects draft versions', async () => {
    const starts = await Promise.all([
      submissions.start(assignmentId, learner),
      submissions.start(assignmentId, learner),
    ]);
    expect(starts[0].id).toBe(starts[1].id);
    attemptId = starts[0].id;
    const draft = await submissions.draft(
      attemptId,
      { lockVersion: 0, payload: { writingText: 'draft' } },
      learner,
    );
    expect(draft!.lockVersion).toBe(1);
    await expect(
      submissions.draft(attemptId, { lockVersion: 0, payload: {} }, learner),
    ).rejects.toThrow();
    await expect(
      submissions.draft(attemptId, { lockVersion: 1, payload: {} }, other),
    ).rejects.toThrow();
  });

  it('atomically creates one revision and run for concurrent repeated submissions', async () => {
    const body = {
      attemptId,
      writingText:
        'Cities need better public transport.\n\nInvestment reduces congestion.',
    };
    const results = await Promise.all([
      submissions.submitAssignment(assignmentId, body, learner),
      submissions.submitAssignment(assignmentId, body, learner),
    ]);
    expect(results[0].revisionId).toBe(results[1].revisionId);
    revisionId = results[0].revisionId;
    reviewId = results[0].reviewCaseId!;
    expect(await db.submissionRevision.count({ where: { attemptId } })).toBe(1);
    expect(await db.gradingRun.count({ where: { revisionId } })).toBe(1);
    expect(
      await db.outboxEvent.count({
        where: { aggregateId: results[0].gradingRunId! },
      }),
    ).toBe(1);
    await expect(
      submissions.getSubmissionById(revisionId, other),
    ).rejects.toThrow();
    await expect(
      grading.getGradingRunStatus(results[0].gradingRunId!, other),
    ).rejects.toThrow();
  });

  it('persists valid AI output but does not publish a graded assignment or update skills', async () => {
    provider.evaluate.mockResolvedValue({
      summary: 'AI test output',
      criteria: ['TR', 'CC', 'LR', 'GRA'].map((code) => ({
        code,
        score: 6,
        explanation: 'Test rationale',
      })),
      findings: [],
    });
    await worker.tick();
    expect(await db.aiResult.count({ where: { revisionId } })).toBe(1);
    expect(
      (await grading.getAssessmentSubmission(revisionId, learner)).assessments,
    ).toHaveLength(0);
    const profile = await recommendations.getLearnerSkills(learner);
    expect(
      profile.skills.find((s) => s.skillId === skillId)?.strength,
    ).toBeNull();
  });

  it('allows only one reviewer to claim, refuses admin grading and rejects stale confirmations', async () => {
    await expect(reviews.claimSubmission(reviewId, admin)).rejects.toThrow();
    const claims = await Promise.allSettled([
      reviews.claimSubmission(reviewId, teacher),
      reviews.claimSubmission(reviewId, teacher2),
    ]);
    expect(claims.filter((c) => c.status === 'fulfilled')).toHaveLength(1);
    const claimed = await db.reviewCase.findUniqueOrThrow({
      where: { id: reviewId },
    });
    const winner = claimed.assigneeId === teacher.id ? teacher : teacher2;
    const body = {
      lockVersion: claimed.lockVersion,
      reason: 'Teacher verified',
      summary: 'Official test feedback',
      criteria: ['TR', 'CC', 'LR', 'GRA'].map((code) => ({
        code,
        score: 5,
        explanation: 'Teacher rationale',
      })),
      observations: [
        {
          skillId,
          outcome: 'NOT_MET',
          rationale: 'Insufficient development in this response',
        },
      ],
    };
    await expect(
      reviews.confirmReview(reviewId, { ...body, lockVersion: 0 }, winner),
    ).rejects.toThrow();
    const result = await reviews.confirmReview(reviewId, body, winner);
    acceptedId = result.acceptedAssessment.id;
    expect(result.acceptedAssessment.isCurrent).toBe(true);
    expect(
      (await grading.getAssessmentSubmission(revisionId, learner)).isOfficial,
    ).toBe(true);
    expect(await db.aiResult.count({ where: { revisionId } })).toBe(1);
    await expect(
      reviews.confirmReview(reviewId, body, winner),
    ).rejects.toThrow();
  });

  it('uses only accepted observations and persists explainable recommendations', async () => {
    const profile = await recommendations.getLearnerSkills(learner);
    expect(profile.skills.find((s) => s.skillId === skillId)).toMatchObject({
      strength: 0,
      evidenceCount: 1,
    });
    const result = await recommendations.getRecommendations(learner);
    expect(result.recommendedActivities.length).toBeGreaterThan(0);
    expect(result.recommendedActivities[0].reasonCode).toBe(
      'ACCEPTED_EVIDENCE_GAP',
    );
    expect(
      await db.recommendationRun.count({ where: { id: result.runId } }),
    ).toBe(1);
    const unknown = await recommendations.getLearnerSkills(other);
    expect(
      unknown.skills.find((s) => s.skillId === skillId)?.strength,
    ).toBeNull();
  });

  it('persists appeals, enforces ownership and retains the current score while pending', async () => {
    await expect(
      reviews.createAppeal(acceptedId, { reason: 'Not my result' }, other),
    ).rejects.toThrow();
    const appeal = await reviews.createAppeal(
      acceptedId,
      { reason: 'Please recheck the examples' },
      learner,
    );
    expect(appeal.status).toBe('PENDING');
    await expect(
      reviews.createAppeal(acceptedId, { reason: 'Again' }, learner),
    ).rejects.toThrow();
    expect(
      (
        await db.acceptedAssessment.findUniqueOrThrow({
          where: { id: acceptedId },
        })
      ).isCurrent,
    ).toBe(true);
  });

  it('rejects fabricated evidence without creating an assessment result', async () => {
    const appeal = await db.appeal.findFirstOrThrow({ where: { acceptedId } });
    const claimed = await reviews.claimSubmission(
      appeal.reviewCaseId!,
      teacher,
    );
    const before = await db.assessmentResult.count({ where: { revisionId } });
    await expect(
      reviews.confirmReview(
        claimed!.id,
        {
          lockVersion: claimed!.lockVersion,
          reason: 'Test',
          summary: 'Test',
          criteria: ['TR', 'CC', 'LR', 'GRA'].map((code) => ({
            code,
            score: 6,
            explanation: 'Test',
          })),
          findings: [
            {
              code: 'CC',
              kind: 'LOCAL',
              explanation: 'Test',
              anchors: [
                { paragraphId: randomUUID(), exactQuote: 'not present' },
              ],
            },
          ],
        },
        teacher,
      ),
    ).rejects.toThrow();
    expect(await db.assessmentResult.count({ where: { revisionId } })).toBe(
      before,
    );
  });

  it('preserves old publication until a replacement is published and prevents revision double counting', async () => {
    const pending = await db.appeal.findFirstOrThrow({ where: { acceptedId } });
    const claimed = await db.reviewCase.findUniqueOrThrow({
      where: { id: pending.reviewCaseId! },
    });
    const confirmed = await reviews.confirmReview(
      claimed.id,
      {
        lockVersion: claimed.lockVersion,
        reason: 'Accepted appeal',
        summary: 'Updated',
        criteria: ['TR', 'CC', 'LR', 'GRA'].map((code) => ({
          code,
          score: 6,
          explanation: 'Updated rationale',
        })),
        observations: [
          { skillId, outcome: 'MET', rationale: 'Examples are sufficient' },
        ],
      },
      teacher,
    );
    expect(confirmed.acceptedAssessment.supersedesId).toBe(acceptedId);
    expect(
      (
        await db.acceptedAssessment.findUniqueOrThrow({
          where: { id: acceptedId },
        })
      ).isCurrent,
    ).toBe(false);
    const profile = await recommendations.getLearnerSkills(learner);
    expect(profile.skills.find((s) => s.skillId === skillId)).toMatchObject({
      strength: 1,
      evidenceCount: 1,
    });
  });

  it('grades objective responses from the pinned answer key, including unanswered questions', async () => {
    const fixtureCourse = '26102026-0000-4000-8000-000000000001';
    const fixtureAssignment = '26102026-0000-4000-8000-000000000070';
    await courses.enrollCourse(fixtureCourse, learner);
    const attempt = await submissions.start(fixtureAssignment, learner);
    const receipt = await submissions.submitAssignment(
      fixtureAssignment,
      { attemptId: attempt.id, itemResponses: [] },
      learner,
    );
    expect(receipt.status).toBe('QUEUED');
    await worker.tick();
    const response = await grading.getAssessmentSubmission(
      receipt.revisionId,
      learner,
    );
    expect(response.isOfficial).toBe(true);
    expect(response.assessments[0].overallScore?.toNumber()).toBe(0);
    expect(response.assessments[0].answerKeyResult?.questionMarks).toHaveLength(
      2,
    );
    await worker.tick();
    expect(
      await db.assessmentResult.count({
        where: { revisionId: receipt.revisionId },
      }),
    ).toBe(1);
  });

  it('rejects cross-question option IDs without creating a revision', async () => {
    const fixtureAssignment = '26102026-0000-4000-8000-000000000070';
    const attempt = await submissions.start(fixtureAssignment, learner);
    const item = await db.assessmentItem.findFirstOrThrow({
      where: { activityVersionId: attempt.activityVersionId },
    });
    await expect(
      submissions.submitAssignment(
        fixtureAssignment,
        {
          attemptId: attempt.id,
          itemResponses: [
            { assessmentItemId: item.id, optionIds: [randomUUID()] },
          ],
        },
        learner,
      ),
    ).rejects.toThrow();
    expect(
      await db.submissionRevision.count({ where: { attemptId: attempt.id } }),
    ).toBe(0);
  });

  it('persists invalid AI attempts without fabricated results and does not overwrite teacher decisions', async () => {
    const requestKey = randomUUID();
    const first = await grading.requestRegrade(
      revisionId,
      { requestKey },
      teacher,
    );
    expect(
      (await grading.requestRegrade(revisionId, { requestKey }, teacher)).id,
    ).toBe(first.id);
    provider.evaluate.mockResolvedValue({
      summary: 'Incomplete schema',
      criteria: [],
    });
    await worker.tick();
    expect(
      (await db.gradingRun.findUniqueOrThrow({ where: { id: first.id } }))
        .status,
    ).toBe('FAILED');
    expect(await db.aiResult.count({ where: { gradingRunId: first.id } })).toBe(
      0,
    );
    expect(
      (
        await db.providerAttempt.findFirstOrThrow({
          where: { gradingRunId: first.id },
        })
      ).status,
    ).toBe('INVALID');
    const profile = await recommendations.getLearnerSkills(learner);
    expect(profile.skills.find((s) => s.skillId === skillId)).toMatchObject({
      strength: 1,
      evidenceCount: 1,
    });
  });

  it('keeps scheduled grades private until publication, then exposes evidence', async () => {
    const original = await db.assignmentVersion.findFirstOrThrow({
      where: { assignmentId },
    });
    const scheduled = await author.assignment(
      courseId,
      {
        title: 'Scheduled writing',
        activityVersionId: original.activityVersionId,
        rubricVersionId: rubricId,
        mode: 'GRADED',
        maxRevisions: 1,
        releasePolicyJson: {
          releaseMode: 'SCHEDULED',
          releaseAt: new Date(Date.now() + 86400000).toISOString(),
        },
      },
      teacher,
    );
    const attempt = await submissions.start(scheduled.assignmentId, other);
    const receipt = await submissions.submitAssignment(
      scheduled.assignmentId,
      { attemptId: attempt.id, writingText: 'A scheduled response.' },
      other,
    );
    const claim = await reviews.claimSubmission(receipt.reviewCaseId!, teacher);
    const confirmed = await reviews.confirmReview(
      claim!.id,
      {
        lockVersion: claim!.lockVersion,
        reason: 'Test publication',
        summary: 'Test',
        criteria: ['TR', 'CC', 'LR', 'GRA'].map((code) => ({
          code,
          score: 7,
          explanation: 'Test',
        })),
        observations: [{ skillId, outcome: 'MET', rationale: 'Test' }],
      },
      teacher,
    );
    expect(confirmed.acceptedAssessment.isCurrent).toBe(false);
    expect(
      (await grading.getAssessmentSubmission(receipt.revisionId, other))
        .assessments,
    ).toHaveLength(0);
    expect(
      (await recommendations.getLearnerSkills(other)).skills.find(
        (s) => s.skillId === skillId,
      )?.strength,
    ).toBeNull();
    await db.acceptedAssessment.update({
      where: { id: confirmed.acceptedAssessment.id },
      data: { releaseAfter: new Date(Date.now() - 1000) },
    });
    await publication.publishDue();
    expect(
      (await grading.getAssessmentSubmission(receipt.revisionId, other))
        .isOfficial,
    ).toBe(true);
    expect(
      (await recommendations.getLearnerSkills(other)).skills.find(
        (s) => s.skillId === skillId,
      )?.strength,
    ).toBe(1);
  });

  it('routes Speaking to teacher review and refuses an audio asset owned by somebody else', async () => {
    const speakingSkill = await db.skill.create({
      data: {
        code: 'SPEAK_' + suffix,
        name: 'Fluency',
        skillArea: 'SPEAKING',
        observableDefinition: 'Test',
        status: 'PUBLISHED',
      },
    });
    const config = new GradingConfigService(db, access);
    const rubric = await config.rubric(
      {
        rubricCode: 'SPEAK_' + suffix,
        versionNo: 1,
        title: 'Speaking',
        taskType: 'SPEAKING',
        criteria: ['FC', 'LR', 'GRA', 'PR'].map((code) => ({
          code,
          name: code,
          definition: 'Test',
        })),
      },
      teacher,
    );
    const activity = await author.activity(
      courseId,
      {
        title: 'Speaking',
        skillArea: 'SPEAKING',
        promptText: 'Describe a place.',
        instructions: 'Speak.',
        difficulty: 1,
        expectedMinutes: 3,
        position: 2,
        skillIds: [speakingSkill.id],
      },
      teacher,
    );
    const assignment = await author.assignment(
      courseId,
      {
        title: 'Speaking',
        activityVersionId: activity.practiceActivity!.activityVersions[0].id,
        rubricVersionId: rubric.id,
        mode: 'GRADED',
        releasePolicyJson: { releaseMode: 'IMMEDIATE' },
      },
      teacher,
    );
    const attempt = await submissions.start(assignment.assignmentId, learner);
    const asset = await db.fileAsset.create({
      data: {
        ownerId: other.id,
        storageKey: 'test/' + suffix,
        originalName: 'test.wav',
        mimeType: 'audio/wav',
        byteSize: 100,
        contentHash: 'test',
      },
    });
    await expect(
      submissions.submitAssignment(
        assignment.assignmentId,
        { attemptId: attempt.id, audioAssetId: asset.id },
        learner,
      ),
    ).rejects.toThrow();
    const owned = await db.fileAsset.create({
      data: {
        ownerId: learner.id,
        storageKey: 'test/owned/' + suffix,
        originalName: 'test.wav',
        mimeType: 'audio/wav',
        byteSize: 100,
        contentHash: 'test',
      },
    });
    const receipt = await submissions.submitAssignment(
      assignment.assignmentId,
      { attemptId: attempt.id, audioAssetId: owned.id },
      learner,
    );
    expect(receipt.status).toBe('AWAITING_REVIEW');
    expect(receipt.gradingRunId).toBeNull();
    expect(
      await db.gradingRun.count({ where: { revisionId: receipt.revisionId } }),
    ).toBe(0);
  });
});
