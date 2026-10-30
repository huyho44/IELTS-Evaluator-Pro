import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import type { GradingService } from '../grading/grading.service.js';
import type { PublicationService } from '../grading/publication.service.js';
import type { PrismaService } from '../prisma.service.js';
import { ReviewsService } from './reviews.service.js';

const actor = (name: string, roles: string[]): Actor => ({
  id: name,
  email: `${name}@example.test`,
  displayName: name,
  roles,
  status: 'ACTIVE',
  targetBand: null,
  targetExamDate: null,
});
const teacher = actor('teacher', ['INSTRUCTOR']);
const owner = actor('owner', ['INSTRUCTOR']);
const learner = actor('learner', ['LEARNER']);

function fixture() {
  const revision = {
    id: 'revision',
    responseMode: 'WRITING',
    attempt: {
      learnerId: learner.id,
      assignmentVersion: { assignment: { courseId: 'course' } },
    },
  };
  const review = {
    id: 'review',
    revisionId: revision.id,
    assigneeId: teacher.id,
    targetRunId: 'target-run',
    lockVersion: 4,
    status: 'CLAIMED',
    revision,
  };
  const db = {
    reviewCase: {
      findUnique: vi.fn().mockResolvedValue(review),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        ...review,
        status: 'PENDING',
        assigneeId: null,
        lockVersion: 5,
      }),
    },
    submissionRevision: { findUnique: vi.fn().mockResolvedValue(revision) },
    courseInstructor: {
      findUnique: vi.fn(
        async (query: {
          where: { courseId_instructorId: { instructorId: string } };
        }) => {
          const name = query.where.courseId_instructorId.instructorId;
          return name === teacher.id
            ? { responsibility: 'REVIEWER' }
            : name === owner.id
              ? { responsibility: 'OWNER' }
              : null;
        },
      ),
    },
    enrollment: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) },
    acceptedAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
    aiResult: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'ai-result', gradingRunId: 'target-run' }),
    },
    auditEvent: { create: vi.fn() },
  };
  const transaction = vi.fn(async (work: (tx: typeof db) => Promise<unknown>) =>
    work(db),
  );
  const prisma = {
    ...db,
    $transaction: transaction,
  } as unknown as PrismaService;
  const grading = {
    review: vi.fn().mockResolvedValue({
      id: 'next-review',
      revisionId: revision.id,
      status: 'PENDING',
    }),
  };
  const publication = { accept: vi.fn(), publish: vi.fn() };
  const service = new ReviewsService(
    prisma,
    new AccessService(prisma),
    grading as unknown as GradingService,
    publication as unknown as PublicationService,
  );
  return { service, db, transaction, revision, review, grading, publication };
}

describe('Review claim release', () => {
  it('lets the current assignee release only the expected claim and records a reason', async () => {
    const { service, db, review } = fixture();
    expect(
      await service.release(
        review.id,
        { lockVersion: 4, reason: 'Unavailable today' },
        teacher,
      ),
    ).toMatchObject({ status: 'PENDING', assigneeId: null, lockVersion: 5 });
    expect(db.reviewCase.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: review.id,
        status: 'CLAIMED',
        lockVersion: 4,
        assigneeId: teacher.id,
      }),
      data: {
        status: 'PENDING',
        assigneeId: null,
        claimedAt: null,
        lockVersion: { increment: 1 },
      },
    });
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: teacher.id,
        action: 'REVIEW_RELEASED',
        afterJson: { reason: 'Unavailable today' },
      }),
    });
  });

  it('lets the course owner recover a claim without making an official assessment', async () => {
    const { service, db, review, publication } = fixture();
    await service.release(
      review.id,
      { lockVersion: 4, reason: 'Assigned teacher absent' },
      owner,
    );
    expect(db.reviewCase.updateMany.mock.calls[0][0].where.assigneeId).toBe(
      teacher.id,
    );
    expect(publication.accept).not.toHaveBeenCalled();
    expect(publication.publish).not.toHaveBeenCalled();
  });

  it('denies a course reviewer releasing someone else claim and an instructor outside the course', async () => {
    const { service, db, review } = fixture();
    review.assigneeId = 'other-assignee';
    await expect(
      service.release(review.id, { lockVersion: 4, reason: 'Test' }, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.release(
        review.id,
        { lockVersion: 4, reason: 'Test' },
        actor('stranger', ['INSTRUCTOR']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.reviewCase.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a stale/changed claim without adding a misleading release audit event', async () => {
    const { service, db, review } = fixture();
    db.reviewCase.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.release(
        review.id,
        { lockVersion: 3, reason: 'Stale tab' },
        teacher,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
});

describe('Teacher correction review', () => {
  it('creates a separately audited review while retaining the previous accepted publication', async () => {
    const { service, db, review, grading, publication } = fixture();
    review.status = 'CONFIRMED';
    const result = await service.reopen(
      review.id,
      { reason: 'Correct the criterion rationale' },
      teacher,
    );
    expect(result).toMatchObject({ id: 'next-review', status: 'PENDING' });
    expect(grading.review).toHaveBeenCalledWith(
      expect.anything(),
      review.revisionId,
      'TEACHER_CORRECTION',
      review.targetRunId,
    );
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'REVIEW_CORRECTION_OPENED',
        afterJson: {
          reason: 'Correct the criterion rationale',
          previousReviewId: review.id,
        },
      }),
    });
    expect(publication.accept).not.toHaveBeenCalled();
    expect(publication.publish).not.toHaveBeenCalled();
  });

  it('rejects reopening an active case or a case from another course', async () => {
    const { service, review, grading } = fixture();
    await expect(
      service.reopen(review.id, { reason: 'Test' }, teacher),
    ).rejects.toBeInstanceOf(ConflictException);
    review.status = 'CONFIRMED';
    await expect(
      service.reopen(
        review.id,
        { reason: 'Test' },
        actor('stranger', ['INSTRUCTOR']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(grading.review).not.toHaveBeenCalled();
  });

  it('retains the self-review prohibition when reopening corrections', async () => {
    const { service, review, revision, grading } = fixture();
    review.status = 'CONFIRMED';
    revision.attempt.learnerId = teacher.id;
    await expect(
      service.reopen(review.id, { reason: 'My own work' }, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(grading.review).not.toHaveBeenCalled();
  });
});

describe('Learner provisional review requests', () => {
  it('opens a reasoned provisional review for an enrolled owner without accepting AI evidence', async () => {
    const { service, db, revision, grading, publication } = fixture();
    expect(
      await service.requestReview(
        revision.id,
        { reason: 'Please check the quoted evidence' },
        learner,
      ),
    ).toMatchObject({ id: 'next-review' });
    expect(grading.review).toHaveBeenCalledWith(
      expect.anything(),
      revision.id,
      'LEARNER_REQUEST',
      'target-run',
    );
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: learner.id,
        action: 'LEARNER_REVIEW_REQUESTED',
        entityKey: 'next-review',
        afterJson: {
          reason: 'Please check the quoted evidence',
          revisionId: revision.id,
        },
      }),
    });
    expect(publication.accept).not.toHaveBeenCalled();
    expect(publication.publish).not.toHaveBeenCalled();
  });

  it('directs an already published official result to the appeal workflow', async () => {
    const { service, db, revision, grading } = fixture();
    db.acceptedAssessment.findFirst.mockResolvedValue({ id: 'official' });
    await expect(
      service.requestReview(revision.id, { reason: 'Review it' }, learner),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(grading.review).not.toHaveBeenCalled();
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });

  it('does not let another learner or an instructor impersonate the submission owner', async () => {
    const { service, revision, grading } = fixture();
    await expect(
      service.requestReview(
        revision.id,
        { reason: 'Test' },
        actor('other', ['LEARNER']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.requestReview(revision.id, { reason: 'Test' }, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(grading.review).not.toHaveBeenCalled();
  });

  it('rejects objective submissions and owners who left the course', async () => {
    const { service, revision, db, grading } = fixture();
    revision.responseMode = 'OBJECTIVE';
    await expect(
      service.requestReview(revision.id, { reason: 'Test' }, learner),
    ).rejects.toBeInstanceOf(ForbiddenException);
    revision.responseMode = 'WRITING';
    db.enrollment.findUnique.mockResolvedValue({ status: 'LEFT' });
    await expect(
      service.requestReview(revision.id, { reason: 'Test' }, learner),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(grading.review).not.toHaveBeenCalled();
  });
});
