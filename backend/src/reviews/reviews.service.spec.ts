import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, type ResponseMode } from '@prisma/client';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import type { GradingService } from '../grading/grading.service.js';
import type { PublicationService } from '../grading/publication.service.js';
import type { PrismaService } from '../prisma.service.js';
import { ReviewsService } from './reviews.service.js';

const reviewId = 'review';
const courseId = 'course';
const teacher: Actor = {
  id: 'teacher',
  displayName: 'Assigned teacher',
  email: 'teacher@test.example',
  roles: ['INSTRUCTOR'],
  status: 'ACTIVE',
  targetBand: null,
  targetExamDate: null,
};

function fixture(mode: ResponseMode = 'WRITING') {
  const checked = {
    id: reviewId,
    revision: {
      responseMode: mode,
      attempt: {
        learnerId: 'learner',
        assignmentVersion: { assignment: { courseId } },
      },
    },
  };
  const detail = {
    id: reviewId,
    status: 'CLAIMED',
    assigneeId: teacher.id,
    lockVersion: 3,
    targetRunId: 'target-run',
    targetRun: { id: 'target-run', status: 'COMPLETED' },
    revision: {
      id: 'revision',
      responseMode: mode,
      writingText: 'The exact submitted essay.',
      submittedAt: new Date('2026-10-20T10:00:00.000Z'),
      revisionParagraphs: [
        { id: 'paragraph', paragraphNo: 1, text: 'The exact submitted essay.' },
      ],
      attempt: {
        id: 'attempt',
        learner: { id: 'learner', displayName: 'Learner name' },
        assignmentVersion: {
          id: 'pinned-assignment-version',
          versionNo: 1,
          mode: 'GRADED',
          dueAt: null,
          releasePolicyJson: { releaseMode: 'MANUAL' },
          assignment: {
            id: 'assignment',
            title: 'Pinned assignment',
            courseId,
          },
          activityVersion: {
            id: 'pinned-activity-version',
            versionNo: 1,
            promptText: 'The prompt attached to this attempt.',
            instructions: 'Discuss both views.',
          },
          rubricVersion: {
            id: 'pinned-rubric',
            rubricCode: 'WRITING_TASK_2',
            versionNo: 1,
            taskType: 'WRITING_TASK_2',
            rubricCriterions: [
              {
                id: 'criterion',
                code: 'TR',
                name: 'Task Response',
                weight: new Prisma.Decimal('0.25'),
                maxScore: new Prisma.Decimal(9),
              },
            ],
          },
        },
      },
      assessmentResults: [
        {
          id: 'teacher-result',
          kind: 'TEACHER',
          overallScore: new Prisma.Decimal('6.5'),
          criterionScores: [
            {
              id: 'criterion-score',
              score: new Prisma.Decimal('6.5'),
              explanation: 'Teacher rationale',
              criterion: { id: 'criterion', code: 'TR', name: 'Task Response' },
            },
          ],
          findings: [
            {
              criterionScoreId: 'criterion-score',
              findingKind: 'LOCAL',
              explanation: 'Develop this argument.',
              findingAnchors: [
                {
                  paragraphId: 'paragraph',
                  exactQuote: 'exact submitted essay',
                },
              ],
            },
          ],
          aiResult: null,
          teacherResult: { decisionId: 'decision' },
          acceptedAssessment: { id: 'accepted', publishedAt: null },
          skillObservations: [
            {
              skillId: 'skill',
              outcome: 'PARTIAL',
              rationale: 'The example supports only part of the argument.',
            },
          ],
        },
        {
          id: 'ai-result',
          kind: 'AI',
          aiResult: {
            gradingRunId: 'target-run',
            qualityStatus: 'PASSED',
            validationJson: { valid: true },
          },
        },
      ],
    },
    reviewDecisions: [{ id: 'decision', reason: 'Teacher verified evidence' }],
    appeals: [],
  };
  const prisma = {
    auditEvent: { findMany: vi.fn().mockResolvedValue([]) },
    reviewCase: {
      findUnique: vi
        .fn<(args: Prisma.ReviewCaseFindUniqueArgs) => Promise<unknown>>()
        .mockResolvedValueOnce(checked)
        .mockResolvedValue(detail),
    },
    courseInstructor: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ courseId, instructorId: teacher.id }),
    },
    skill: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'skill',
          code: 'writing.argument.development',
          name: 'Argument development',
          observableDefinition:
            'Support the central claim with a relevant example.',
        },
      ]),
    },
  };
  const db = prisma as unknown as PrismaService;
  const grading = { saveAssessment: vi.fn() };
  const publication = { accept: vi.fn(), publish: vi.fn() };
  const service = new ReviewsService(
    db,
    new AccessService(db),
    grading as unknown as GradingService,
    publication as unknown as PublicationService,
  );
  return { prisma, service, checked, detail, grading, publication };
}

describe('ReviewsService details contract', () => {
  it('returns the pinned prompt, rubric, learner and complete assessment history for the editor', async () => {
    const { service, prisma, publication, grading } = fixture();
    const result = await service.details(reviewId, teacher);

    expect(result).toMatchObject({
      id: reviewId,
      status: 'CLAIMED',
      assigneeId: teacher.id,
      lockVersion: 3,
      targetRunId: 'target-run',
      revision: {
        writingText: 'The exact submitted essay.',
        attempt: {
          learner: { id: 'learner', displayName: 'Learner name' },
          assignmentVersion: {
            id: 'pinned-assignment-version',
            activityVersion: {
              promptText: 'The prompt attached to this attempt.',
            },
            rubricVersion: { id: 'pinned-rubric' },
          },
        },
      },
      availableSkills: [
        {
          id: 'skill',
          code: 'writing.argument.development',
          name: 'Argument development',
          description: 'Support the central claim with a relevant example.',
        },
      ],
    });
    expect(result.revision.assessmentResults[0]).toMatchObject({
      teacherResult: { decisionId: 'decision' },
      acceptedAssessment: { publishedAt: null },
      skillObservations: [{ skillId: 'skill', outcome: 'PARTIAL' }],
      criterionScores: [{ criterion: { code: 'TR', name: 'Task Response' } }],
      findings: [{ criterionScoreId: 'criterion-score', findingKind: 'LOCAL' }],
    });
    expect(result.revision.assessmentResults[1]).toMatchObject({
      aiResult: { gradingRunId: result.targetRunId, qualityStatus: 'PASSED' },
    });
    expect(prisma.courseInstructor.findUnique).toHaveBeenCalledWith({
      where: {
        courseId_instructorId: { courseId, instructorId: teacher.id },
      },
    });
    expect(grading.saveAssessment).not.toHaveBeenCalled();
    expect(publication.accept).not.toHaveBeenCalled();
    expect(publication.publish).not.toHaveBeenCalled();
  });

  it('selects only public learner fields and queries stable history ordering', async () => {
    const { service, prisma } = fixture();
    await service.details(reviewId, teacher);

    expect(prisma.reviewCase.findUnique.mock.calls[1][0]).toMatchObject({
      where: { id: reviewId },
      include: {
        revision: {
          include: {
            revisionParagraphs: { orderBy: { paragraphNo: 'asc' } },
            attempt: {
              select: {
                learner: { select: { id: true, displayName: true } },
                assignmentVersion: {
                  select: {
                    activityVersion: {
                      select: { promptText: true, instructions: true },
                    },
                    rubricVersion: {
                      include: {
                        rubricCriterions: { orderBy: { code: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
            assessmentResults: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                teacherResult: { select: { decisionId: true } },
                skillObservations: true,
              },
            },
          },
        },
        reviewDecisions: {
          orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
    const query = JSON.stringify(prisma.reviewCase.findUnique.mock.calls[1][0]);
    expect(query).not.toContain('passwordHash');
    expect(query).not.toContain('authSession');
    expect(query).not.toContain('providerAttempts');
  });

  it.each(['WRITING', 'SPEAKING'] as const)(
    'offers only published %s skills for explicit teacher observations',
    async (mode) => {
      const { service, prisma } = fixture(mode);
      await service.details(reviewId, teacher);
      expect(prisma.skill.findMany).toHaveBeenCalledWith({
        where: { status: 'PUBLISHED', skillArea: mode },
        select: {
          id: true,
          code: true,
          name: true,
          observableDefinition: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
    },
  );

  it('keeps objective reviews readable without offering writing observations', async () => {
    const { service, prisma } = fixture('OBJECTIVE');
    const result = await service.details(reviewId, teacher);
    expect(result.availableSkills).toEqual([]);
    expect(prisma.skill.findMany).not.toHaveBeenCalled();
  });

  it('preserves JSON decimal strings and ISO dates expected by the HTTP consumer', async () => {
    const { service } = fixture();
    const wire = JSON.parse(
      JSON.stringify(await service.details(reviewId, teacher)),
    );
    expect(wire.revision.submittedAt).toBe('2026-10-20T10:00:00.000Z');
    expect(wire.revision.assessmentResults[0].overallScore).toBe('6.5');
    expect(wire.revision.assessmentResults[0].criterionScores[0].score).toBe(
      '6.5',
    );
    expect(wire.revision.attempt.learner).toEqual({
      id: 'learner',
      displayName: 'Learner name',
    });
  });

  it.each([
    { label: 'a learner', actor: { ...teacher, roles: ['LEARNER'] } },
    {
      label: 'an admin without instructor access',
      actor: { ...teacher, roles: ['ADMIN'] },
    },
  ])(
    'denies $label before fetching editor data or skills',
    async ({ actor }) => {
      const { service, prisma } = fixture();
      await expect(service.details(reviewId, actor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.reviewCase.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.skill.findMany).not.toHaveBeenCalled();
    },
  );

  it('denies an instructor from a different course before fetching editor data or skills', async () => {
    const { service, prisma } = fixture();
    prisma.courseInstructor.findUnique.mockResolvedValue(null);
    await expect(service.details(reviewId, teacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.reviewCase.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.skill.findMany).not.toHaveBeenCalled();
  });

  it('denies reviewing an owned submission even with a course instructor assignment', async () => {
    const { service, prisma, checked } = fixture();
    checked.revision.attempt.learnerId = teacher.id;
    await expect(service.details(reviewId, teacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.reviewCase.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.skill.findMany).not.toHaveBeenCalled();
  });

  it('returns not found without exposing skills for a missing review', async () => {
    const { service, prisma } = fixture();
    prisma.reviewCase.findUnique.mockReset().mockResolvedValue(null);
    await expect(service.details(reviewId, teacher)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.courseInstructor.findUnique).not.toHaveBeenCalled();
    expect(prisma.skill.findMany).not.toHaveBeenCalled();
  });
});
