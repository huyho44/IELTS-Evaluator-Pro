import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import type { GradingService } from '../grading/grading.service.js';
import type { PrismaService } from '../prisma.service.js';
import { SubmissionsService } from './submissions.service.js';

const learner: Actor = {
  id: 'learner',
  email: 'learner@example.test',
  displayName: 'Learner',
  roles: ['LEARNER'],
  status: 'ACTIVE',
  targetBand: 7,
  targetExamDate: null,
};
const recommendationId = 'f913f835-5bfc-4565-875c-05ad603d1be4';

function fixture() {
  const version = {
    id: 'pinned-version',
    assignmentId: 'assignment',
    activityId: 'activity',
    activityVersionId: 'pinned-activity',
    opensAt: null as Date | null,
    dueAt: null as Date | null,
    allowLate: false,
    timeLimitSeconds: 300,
    maxAttempts: 4,
    maxRevisions: 3,
    assignment: {
      courseId: 'course',
      course: { status: 'PUBLISHED' },
      activity: {
        responseMode: 'WRITING',
        learningItem: { status: 'PUBLISHED' },
      },
    },
  };
  const attempt = {
    id: 'attempt',
    learnerId: learner.id,
    assignmentId: 'assignment',
    assignmentVersionId: version.id,
    activityVersionId: version.activityVersionId,
    recommendationItemId: recommendationId,
    status: 'SUBMITTED',
    expiresAt: new Date('2020-01-01'),
    assignmentVersion: version,
  };
  const recommendation = {
    id: recommendationId,
    learningItemId: 'activity',
    targetAssignmentVersionId: version.id as string | null,
    targetActivityVersionId: version.activityVersionId as string | null,
    run: { learnerId: learner.id },
  };
  const latest = {
    id: 'revision-one',
    revisionNo: 1,
    writingText: 'Latest submitted text.',
  };
  const enrollment = { status: 'ACTIVE' };
  const db = {
    recommendationItem: {
      findUnique: vi.fn().mockResolvedValue(recommendation),
    },
    assignmentVersion: { findFirst: vi.fn().mockResolvedValue(version) },
    enrollment: { findUnique: vi.fn().mockResolvedValue(enrollment) },
    learningItemSkill: { findMany: vi.fn().mockResolvedValue([]) },
    skillEvidence: { findMany: vi.fn().mockResolvedValue([]) },
    attempt: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(attempt),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ ...attempt, status: 'IN_PROGRESS' }),
      create: vi
        .fn()
        .mockImplementation(async ({ data }: { data: object }) => ({
          id: 'new-attempt',
          ...data,
        })),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    submissionRevision: { findFirst: vi.fn().mockResolvedValue(latest) },
    attemptDraft: { upsert: vi.fn() },
    auditEvent: { create: vi.fn() },
  };
  const transaction = vi.fn(async (work: (tx: typeof db) => Promise<unknown>) =>
    work(db),
  );
  const prisma = {
    ...db,
    $transaction: transaction,
  } as unknown as PrismaService;
  const grading = { queueRevision: vi.fn() };
  return {
    db,
    version,
    attempt,
    recommendation,
    latest,
    enrollment,
    transaction,
    grading,
    service: new SubmissionsService(
      prisma,
      new AccessService(prisma),
      grading as unknown as GradingService,
    ),
  };
}

describe('Recommendation-attributed attempt start', () => {
  it('pins both recommended versions and records attribution rather than selecting the latest assignment version', async () => {
    const { service, db, version } = fixture();
    const created = await service.start('assignment', learner, {
      recommendationItemId: recommendationId,
    });
    expect(db.assignmentVersion.findFirst.mock.calls[0][0].where).toMatchObject(
      { assignmentId: 'assignment', id: version.id },
    );
    expect(created).toMatchObject({
      recommendationItemId: recommendationId,
      assignmentVersionId: version.id,
      activityVersionId: version.activityVersionId,
      learnerId: learner.id,
    });
    expect(db.attempt.create.mock.calls[0][0]).toMatchObject({
      data: { attemptNo: 1 },
    });
  });

  it('rejects another learner recommendation before querying the target or creating an attempt', async () => {
    const { service, db, recommendation } = fixture();
    recommendation.run.learnerId = 'other';
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.assignmentVersion.findFirst).not.toHaveBeenCalled();
    expect(db.attempt.create).not.toHaveBeenCalled();
  });

  it('rejects lesson recommendations and targets whose pinned activity changed', async () => {
    const { service, db, recommendation } = fixture();
    recommendation.targetAssignmentVersionId = null;
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    recommendation.targetAssignmentVersionId = 'pinned-version';
    recommendation.targetActivityVersionId = 'different-activity';
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.attempt.create).not.toHaveBeenCalled();
  });

  it('requires current enrollment and published content even for a saved recommendation', async () => {
    const { service, db, version, enrollment } = fixture();
    enrollment.status = 'LEFT';
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    enrollment.status = 'ACTIVE';
    version.assignment.activity.learningItem.status = 'HIDDEN';
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.attempt.create).not.toHaveBeenCalled();
  });

  it('rechecks the assignment deadline and quota before creating an attributed attempt', async () => {
    const { service, db, version } = fixture();
    version.dueAt = new Date('2020-01-01');
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    version.dueAt = null;
    db.attempt.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ attemptNo: version.maxAttempts });
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.attempt.create).not.toHaveBeenCalled();
  });

  it('refuses stale prerequisites but allows diagnostic observation without presuming mastery', async () => {
    const { service, db } = fixture();
    const tag = {
      purpose: 'PRACTISE',
      skill: {
        skillPrerequisites: [
          {
            prerequisiteSkillId: 'root-skill',
            minStrength: new Prisma.Decimal('0.5'),
            minSupport: new Prisma.Decimal('0.33'),
          },
        ],
      },
    };
    db.learningItemSkill.findMany.mockResolvedValue([tag]);
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.attempt.create).not.toHaveBeenCalled();
    tag.purpose = 'DIAGNOSTIC';
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).resolves.toMatchObject({ recommendationItemId: recommendationId });
  });

  it('does not relabel an unrelated in-progress attempt with a new recommendation', async () => {
    const { service, db, attempt } = fixture();
    db.attempt.findFirst.mockResolvedValue({
      ...attempt,
      status: 'IN_PROGRESS',
      assignmentVersionId: 'another-version',
      expiresAt: null,
    });
    await expect(
      service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.attempt.update).not.toHaveBeenCalled();
    expect(db.attempt.create).not.toHaveBeenCalled();
  });

  it('retires an expired older recommendation before starting a fresh pinned attempt', async () => {
    const { service, db, attempt } = fixture();
    db.attempt.findFirst
      .mockResolvedValueOnce({
        ...attempt,
        status: 'IN_PROGRESS',
        assignmentVersionId: 'older-version',
        recommendationItemId: 'older-recommendation',
        expiresAt: new Date('2020-01-01'),
      })
      .mockResolvedValueOnce({ attemptNo: 1 });

    expect(
      await service.start('assignment', learner, {
        recommendationItemId: recommendationId,
      }),
    ).toMatchObject({
      attemptNo: 2,
      assignmentVersionId: 'pinned-version',
      recommendationItemId: recommendationId,
    });
    expect(db.attempt.update).toHaveBeenCalledWith({
      where: { id: attempt.id },
      data: { status: 'CANCELLED', finishedAt: expect.any(Date) },
    });
    expect(db.attempt.create).toHaveBeenCalledTimes(1);
  });
});

describe('Explicit Writing revision editing', () => {
  it('copies the latest immutable essay into a new editing draft and renews the configured timer', async () => {
    const { service, db, version, latest, grading } = fixture();
    const before = Date.now();
    const result = await service.revise('attempt', learner);
    expect(result.status).toBe('IN_PROGRESS');
    const update = db.attempt.updateMany.mock.calls[0][0];
    expect(update.where).toMatchObject({ id: 'attempt', status: 'SUBMITTED' });
    expect(update.data.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + version.timeLimitSeconds * 1000,
    );
    expect(db.attemptDraft.upsert).toHaveBeenCalledWith({
      where: { attemptId: 'attempt' },
      create: {
        attemptId: 'attempt',
        payloadJson: { writingText: latest.writingText },
        lockVersion: 1,
      },
      update: {
        payloadJson: { writingText: latest.writingText },
        lockVersion: { increment: 1 },
      },
    });
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: learner.id,
        action: 'REVISION_EDITING_STARTED',
        afterJson: { previousRevisionId: latest.id, nextRevisionNo: 2 },
      }),
    });
    expect(grading.queueRevision).not.toHaveBeenCalled();
    expect(latest.writingText).toBe('Latest submitted text.');
  });

  it('does not reopen another learner attempt or allow a teacher to rewrite for a learner', async () => {
    const { service, db, attempt, transaction } = fixture();
    attempt.learnerId = 'other';
    await expect(service.revise('attempt', learner)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    transaction.mockClear();
    await expect(
      service.revise('attempt', { ...learner, roles: ['INSTRUCTOR'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
    expect(db.attempt.updateMany).not.toHaveBeenCalled();
    expect(db.attemptDraft.upsert).not.toHaveBeenCalled();
  });

  it('rejects objective mode, expired assignment deadlines and exhausted revisions', async () => {
    const { service, db, version, latest } = fixture();
    version.assignment.activity.responseMode = 'OBJECTIVE';
    await expect(service.revise('attempt', learner)).rejects.toBeInstanceOf(
      ConflictException,
    );
    version.assignment.activity.responseMode = 'WRITING';
    version.dueAt = new Date('2020-01-01');
    await expect(service.revise('attempt', learner)).rejects.toBeInstanceOf(
      ConflictException,
    );
    version.dueAt = null;
    latest.revisionNo = version.maxRevisions;
    await expect(service.revise('attempt', learner)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.attemptDraft.upsert).not.toHaveBeenCalled();
  });

  it('does not reset an already active draft or extend its timer when retried', async () => {
    const { service, db, attempt } = fixture();
    attempt.status = 'IN_PROGRESS';
    expect(await service.revise('attempt', learner)).toBe(attempt);
    expect(db.attempt.updateMany).not.toHaveBeenCalled();
    expect(db.attemptDraft.upsert).not.toHaveBeenCalled();
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });

  it('does not replace the draft after losing the SUBMITTED-to-editing compare-and-set', async () => {
    const { service, db } = fixture();
    db.attempt.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revise('attempt', learner)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.attemptDraft.upsert).not.toHaveBeenCalled();
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
});
