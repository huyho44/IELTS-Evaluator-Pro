import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import { integer, object, uuid } from '../auth/validation.js';
import { GradingService } from '../grading/grading.service.js';
import { serializable } from './transaction.js';
import { projectSkills } from '../recommendations/profile.js';
import { paragraphs, submissionPayload } from './submission-validation.js';

@Injectable()
export class SubmissionsService {
  // Inject required services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly grading: GradingService,
  ) {}
  // Check active enrollment in the transaction.
  private async activeEnrollment(
    tx: Prisma.TransactionClient,
    learnerId: string,
    courseId: string,
  ) {
    const e = await tx.enrollment.findUnique({
      where: { learnerId_courseId: { learnerId, courseId } },
    });
    if (!e || e.status !== 'ACTIVE')
      throw new ForbiddenException('Active enrollment required');
  }
  // Check assignment opening time and deadline.
  private window(
    version: { opensAt: Date | null; dueAt: Date | null; allowLate: boolean },
    now = new Date(),
  ) {
    if (version.opensAt && now < version.opensAt)
      throw new ConflictException('Assignment is not open');
    if (version.dueAt && now > version.dueAt && !version.allowLate)
      throw new ConflictException('Submission deadline has passed');
  }
  // Start an attempt within the allowed limits.
  async start(assignmentId: string, actor: Actor, input?: unknown) {
    this.access.role(actor, 'LEARNER');
    const dto = input == null ? {} : object(input);
    const recommendationItemId =
      dto.recommendationItemId == null
        ? undefined
        : uuid(dto.recommendationItemId, 'recommendationItemId');
    return serializable(this.prisma, async (tx) => {
      const recommendation = recommendationItemId
        ? await tx.recommendationItem.findUnique({
            where: { id: recommendationItemId },
            include: { run: { select: { learnerId: true } } },
          })
        : null;
      if (
        recommendationItemId &&
        (!recommendation ||
          recommendation.run.learnerId !== actor.id ||
          !recommendation.targetAssignmentVersionId ||
          !recommendation.targetActivityVersionId)
      )
        throw new NotFoundException('Available recommendation not found');
      const version = await tx.assignmentVersion.findFirst({
        where: {
          assignmentId,
          publishedAt: { lte: new Date() },
          ...(recommendation
            ? { id: recommendation.targetAssignmentVersionId! }
            : {}),
        },
        orderBy: { versionNo: 'desc' },
        include: {
          assignment: {
            include: {
              course: true,
              activity: { include: { learningItem: true } },
            },
          },
        },
      });
      if (
        !version ||
        !['PUBLISHED', 'HIDDEN'].includes(version.assignment.course.status) ||
        version.assignment.activity.learningItem.status !== 'PUBLISHED'
      )
        throw new NotFoundException('Published assignment not found');
      await this.activeEnrollment(tx, actor.id, version.assignment.courseId);
      if (
        recommendation &&
        (version.activityVersionId !== recommendation.targetActivityVersionId ||
          version.activityId !== recommendation.learningItemId)
      )
        throw new ConflictException('The recommendation target has changed');
      if (recommendation) {
        const tags = await tx.learningItemSkill.findMany({
          where: { learningItemId: version.activityId },
          include: { skill: { include: { skillPrerequisites: true } } },
        });
        const prerequisites = tags
          .filter((t) => t.purpose !== 'DIAGNOSTIC')
          .flatMap((t) => t.skill.skillPrerequisites);
        if (prerequisites.length) {
          const evidence = await tx.skillEvidence.findMany({
            where: {
              accepted: {
                isCurrent: true,
                publishedAt: { lte: new Date() },
                result: { revision: { attempt: { learnerId: actor.id } } },
              },
            },
            include: {
              observation: true,
              accepted: {
                include: { result: { include: { revision: true } } },
              },
            },
          });
          const states = projectSkills(
            evidence.map((e) => ({
              id: e.id,
              skillId: e.observation.skillId,
              outcome: e.observation.outcome,
              attemptId: e.accepted.result.revision.attemptId,
              revisionNo: e.accepted.result.revision.revisionNo,
            })),
            [...new Set(prerequisites.map((p) => p.prerequisiteSkillId))],
          ).states;
          if (
            prerequisites.some((p) => {
              const s = states.find((v) => v.skillId === p.prerequisiteSkillId);
              return (
                !s ||
                s.strength === null ||
                s.strength < (p.minStrength?.toNumber() ?? 0.6) ||
                s.support < (p.minSupport?.toNumber() ?? 0.33)
              );
            })
          )
            throw new ConflictException(
              'Prerequisites changed. Refresh your learning recommendations.',
            );
        }
      }
      const existing = await tx.attempt.findFirst({
        where: { learnerId: actor.id, assignmentId, status: 'IN_PROGRESS' },
        orderBy: { attemptNo: 'desc' },
      });
      if (existing) {
        if (existing.expiresAt && existing.expiresAt <= new Date()) {
          await tx.attempt.update({
            where: { id: existing.id },
            data: { status: 'CANCELLED', finishedAt: new Date() },
          });
        } else {
          if (
            recommendation &&
            (existing.assignmentVersionId !== version.id ||
              existing.recommendationItemId !== recommendationItemId)
          )
            throw new ConflictException(
              'Resume your existing attempt before starting another recommendation',
            );
          return existing;
        }
      }
      this.window(version);
      const last = await tx.attempt.findFirst({
        where: { learnerId: actor.id, assignmentId },
        orderBy: { attemptNo: 'desc' },
      });
      if ((last?.attemptNo ?? 0) >= version.maxAttempts)
        throw new ConflictException('Maximum attempts reached');
      const now = new Date();
      return tx.attempt.create({
        data: {
          learnerId: actor.id,
          assignmentId,
          assignmentVersionId: version.id,
          activityVersionId: version.activityVersionId,
          recommendationItemId,
          attemptNo: (last?.attemptNo ?? 0) + 1,
          startedAt: now,
          expiresAt: version.timeLimitSeconds
            ? new Date(now.getTime() + version.timeLimitSeconds * 1000)
            : null,
        },
      });
    });
  }
  async revise(id: string, actor: Actor) {
    this.access.role(actor, 'LEARNER');
    return serializable(this.prisma, async (tx) => {
      const attempt = await tx.attempt.findUnique({
        where: { id },
        include: {
          assignmentVersion: {
            include: { assignment: { include: { activity: true } } },
          },
        },
      });
      if (!attempt || attempt.learnerId !== actor.id)
        throw new NotFoundException('Owned attempt not found');
      const version = attempt.assignmentVersion;
      if (version.assignment.activity.responseMode !== 'WRITING')
        throw new ConflictException('Only Writing attempts support rewriting');
      await this.activeEnrollment(tx, actor.id, version.assignment.courseId);
      this.window(version);
      if (attempt.status === 'IN_PROGRESS') return attempt;
      if (attempt.status !== 'SUBMITTED')
        throw new ConflictException('This attempt cannot be reopened');
      const latest = await tx.submissionRevision.findFirst({
        where: { attemptId: id },
        orderBy: { revisionNo: 'desc' },
      });
      if (!latest || latest.revisionNo >= version.maxRevisions)
        throw new ConflictException('No revisions remain');
      const now = new Date();
      const changed = await tx.attempt.updateMany({
        where: { id, status: 'SUBMITTED' },
        data: {
          status: 'IN_PROGRESS',
          expiresAt: version.timeLimitSeconds
            ? new Date(now.getTime() + version.timeLimitSeconds * 1000)
            : null,
        },
      });
      if (!changed.count)
        throw new ConflictException('Attempt changed; reload');
      await tx.attemptDraft.upsert({
        where: { attemptId: id },
        create: {
          attemptId: id,
          payloadJson: { writingText: latest.writingText ?? '' },
          lockVersion: 1,
        },
        update: {
          payloadJson: { writingText: latest.writingText ?? '' },
          lockVersion: { increment: 1 },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'REVISION_EDITING_STARTED',
          entityType: 'Attempt',
          entityKey: id,
          afterJson: {
            previousRevisionId: latest.id,
            nextRevisionNo: latest.revisionNo + 1,
          },
        },
      });
      return tx.attempt.findUniqueOrThrow({ where: { id } });
    });
  }
  // Get attempt details.
  async attempt(id: string, actor: Actor) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id },
      include: {
        attemptDraft: true,
        submissionRevisions: {
          select: { id: true, revisionNo: true, submittedAt: true },
          orderBy: { revisionNo: 'desc' },
        },
        assignmentVersion: {
          include: {
            assignment: { include: { activity: true } },
            rubricVersion: { include: { rubricCriterions: true } },
            activityVersion: {
              include: {
                assessmentItems: {
                  orderBy: { position: 'asc' },
                  include: {
                    questionVersion: {
                      include: {
                        questionOptions: { orderBy: { position: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.learnerId !== actor.id)
      await this.access.instructor(
        actor,
        attempt.assignmentVersion.assignment.courseId,
      );
    return attempt;
  }
  // Save a draft with version checking.
  async draft(id: string, input: unknown, actor: Actor) {
    const dto = object(input);
    const lockVersion = integer(dto.lockVersion, 'lockVersion');
    const payload = object(dto.payload);
    if (JSON.stringify(payload).length > 120000)
      throw new BadRequestException('Draft too large');
    return serializable(this.prisma, async (tx) => {
      const attempt = await tx.attempt.findUnique({
        where: { id },
        include: { assignmentVersion: { include: { assignment: true } } },
      });
      if (!attempt) throw new NotFoundException('Attempt not found');
      if (attempt.learnerId !== actor.id) throw new ForbiddenException();
      await this.activeEnrollment(
        tx,
        actor.id,
        attempt.assignmentVersion.assignment.courseId,
      );
      this.window(attempt.assignmentVersion);
      if (
        attempt.status !== 'IN_PROGRESS' ||
        (attempt.expiresAt && attempt.expiresAt <= new Date())
      )
        throw new ConflictException('Attempt is closed');
      const previous = await tx.attemptDraft.findUnique({
        where: { attemptId: id },
      });
      if (!previous) {
        if (lockVersion !== 0) throw new ConflictException('Stale draft');
        return tx.attemptDraft.create({
          data: {
            attemptId: id,
            payloadJson: payload as Prisma.InputJsonObject,
            lockVersion: 1,
          },
        });
      }
      const update = await tx.attemptDraft.updateMany({
        where: { attemptId: id, lockVersion },
        data: {
          payloadJson: payload as Prisma.InputJsonObject,
          lockVersion: { increment: 1 },
        },
      });
      if (!update.count)
        throw new ConflictException('Stale draft; reload before saving');
      return tx.attemptDraft.findUnique({ where: { attemptId: id } });
    });
  }
  // Save a submission revision and queue grading.
  async submitAssignment(assignmentId: string, input: unknown, actor: Actor) {
    this.access.role(actor, 'LEARNER');
    const dto = object(input);
    const attemptId = uuid(dto.attemptId, 'attemptId');
    return serializable(this.prisma, async (tx) => {
      const attempt = await tx.attempt.findUnique({
        where: { id: attemptId },
        include: {
          assignmentVersion: {
            include: { assignment: { include: { activity: true } } },
          },
        },
      });
      if (!attempt || attempt.assignmentId !== assignmentId)
        throw new NotFoundException('Attempt not found for this assignment');
      if (attempt.learnerId !== actor.id)
        throw new ForbiddenException("Cannot submit another learner's attempt");
      const version = attempt.assignmentVersion;
      await this.activeEnrollment(tx, actor.id, version.assignment.courseId);
      const mode = version.assignment.activity.responseMode;
      const payload = submissionPayload(dto, mode);
      const contentHash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
      const previous = await tx.submissionRevision.findFirst({
        where: { attemptId },
        orderBy: { revisionNo: 'desc' },
      });
      if (previous?.contentHash === contentHash)
        return this.receipt(tx, previous.id, attemptId);
      this.window(version);
      if (
        ['CANCELLED', 'FINISHED'].includes(attempt.status) ||
        (attempt.expiresAt && attempt.expiresAt <= new Date())
      )
        throw new ConflictException('Attempt is closed');
      if ((previous?.revisionNo ?? 0) >= version.maxRevisions)
        throw new ConflictException('Maximum revisions reached');
      if (payload.audioAssetId) {
        const asset = await tx.fileAsset.findUnique({
          where: { id: payload.audioAssetId },
        });
        if (
          !asset ||
          asset.ownerId !== actor.id ||
          !asset.mimeType.startsWith('audio/')
        )
          throw new BadRequestException('An owned audio asset is required');
      }
      if (mode === 'OBJECTIVE') {
        const items = await tx.assessmentItem.findMany({
          where: { activityVersionId: attempt.activityVersionId },
          include: { questionVersion: { include: { questionOptions: true } } },
        });
        for (const response of payload.itemResponses) {
          const item = items.find((x) => x.id === response.assessmentItemId);
          if (!item)
            throw new BadRequestException(
              'Item does not belong to the pinned activity version',
            );
          const q = item.questionVersion;
          if (
            response.optionIds.some(
              (id) => !q.questionOptions.some((o) => o.id === id),
            )
          )
            throw new BadRequestException(
              'Option does not belong to the question',
            );
          if (
            q.questionType === 'SHORT_ANSWER'
              ? response.optionIds.length > 0
              : response.textAnswer !== null
          )
            throw new BadRequestException(
              'Answer format does not match question type',
            );
          if (
            q.questionType === 'SINGLE_CHOICE' &&
            response.optionIds.length > 1
          )
            throw new BadRequestException(
              'Single-choice question accepts one option',
            );
        }
        // Persist unanswered items too so scoring and evidence cover the entire test.
        for (const item of items)
          if (
            !payload.itemResponses.some((r) => r.assessmentItemId === item.id)
          )
            payload.itemResponses.push({
              assessmentItemId: item.id,
              textAnswer: null,
              optionIds: [],
            });
      }
      const revision = await tx.submissionRevision.create({
        data: {
          attemptId,
          revisionNo: (previous?.revisionNo ?? 0) + 1,
          responseMode: mode,
          writingText: payload.writingText,
          audioAssetId: payload.audioAssetId,
          contentHash,
          revisionParagraphs: payload.writingText
            ? { create: paragraphs(payload.writingText) }
            : undefined,
          itemResponses: {
            create: payload.itemResponses.map((r) => ({
              assessmentItemId: r.assessmentItemId,
              textAnswer: r.textAnswer,
              responseSelections: {
                create: r.optionIds.map((optionId) => ({ optionId })),
              },
            })),
          },
        },
      });
      await tx.attempt.update({
        where: { id: attemptId },
        data: { status: 'SUBMITTED' },
      });
      await this.grading.queueRevision(tx, revision, version);
      return this.receipt(tx, revision.id, attemptId);
    });
  }
  // Build the submission status response.
  private async receipt(
    tx: Prisma.TransactionClient,
    revisionId: string,
    attemptId: string,
  ) {
    const run = await tx.gradingRun.findFirst({
      where: { revisionId },
      orderBy: { id: 'desc' },
    });
    const review = await tx.reviewCase.findFirst({
      where: { revisionId, status: { in: ['PENDING', 'CLAIMED'] } },
    });
    const objective = await tx.outboxEvent.findFirst({
      where: { aggregateId: revisionId, eventType: 'ObjectiveGradeRequested' },
    });
    return {
      statusCode: 202,
      submissionId: revisionId,
      revisionId,
      attemptId,
      gradingRunId: run?.id ?? null,
      reviewCaseId: review?.id ?? null,
      status:
        run?.status ??
        (review
          ? 'AWAITING_REVIEW'
          : objective?.status === 'PENDING'
            ? 'QUEUED'
            : objective?.status === 'FAILED'
              ? 'FAILED'
              : 'COMPLETED'),
    };
  }
  // Get submission content and status.
  async getSubmissionById(id: string, actor: Actor) {
    const revision = await this.access.revision(actor, id);
    const paragraphs = await this.prisma.revisionParagraph.findMany({
      where: { revisionId: id },
      orderBy: { paragraphNo: 'asc' },
    });
    const itemResponses = await this.prisma.itemResponse.findMany({
      where: { revisionId: id },
      include: { responseSelections: true },
    });
    const processing = await this.receipt(this.prisma, id, revision.attemptId);
    return {
      id: revision.id,
      attemptId: revision.attemptId,
      revisionNo: revision.revisionNo,
      responseMode: revision.responseMode,
      writingText: revision.writingText,
      audioAssetId: revision.audioAssetId,
      submittedAt: revision.submittedAt,
      paragraphs,
      itemResponses,
      processing,
    };
  }
  // List my recent attempts and revisions.
  history(actor: Actor) {
    return this.prisma.attempt.findMany({
      where: { learnerId: actor.id },
      include: {
        submissionRevisions: {
          select: { id: true, revisionNo: true, submittedAt: true },
          orderBy: { revisionNo: 'desc' },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }
}
