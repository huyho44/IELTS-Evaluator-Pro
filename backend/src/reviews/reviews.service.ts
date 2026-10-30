import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import { integer, object, text, uuid } from '../auth/validation.js';
import { GradingService } from '../grading/grading.service.js';
import { PublicationService } from '../grading/publication.service.js';
import { validateAssessment } from '../grading/assessment-validation.js';
import { serializable } from '../submissions/transaction.js';

@Injectable()
export class ReviewsService {
  // Inject required services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly grading: GradingService,
    private readonly publication: PublicationService,
  ) {}
  // List reviews assigned to my courses.
  async getTeacherQueue(actor: Actor) {
    this.access.role(actor, 'INSTRUCTOR');
    return this.prisma.reviewCase.findMany({
      where: {
        status: { in: ['PENDING', 'CLAIMED'] },
        revision: {
          attempt: {
            assignmentVersion: {
              assignment: {
                course: {
                  courseInstructors: { some: { instructorId: actor.id } },
                },
              },
            },
          },
        },
      },
      include: {
        revision: {
          select: {
            id: true,
            responseMode: true,
            submittedAt: true,
            attempt: {
              select: {
                learner: { select: { id: true, displayName: true } },
                assignmentVersion: {
                  select: { assignment: { select: { title: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { priority: 'desc' }],
      take: 100,
    });
  }
  // Check permission to review this submission.
  private async check(id: string, actor: Actor) {
    const review = await this.prisma.reviewCase.findUnique({
      where: { id },
      include: {
        revision: {
          include: {
            attempt: {
              include: { assignmentVersion: { include: { assignment: true } } },
            },
          },
        },
      },
    });
    if (!review) throw new NotFoundException('Review case not found');
    await this.access.instructor(
      actor,
      review.revision.attempt.assignmentVersion.assignment.courseId,
    );
    if (review.revision.attempt.learnerId === actor.id)
      throw new ForbiddenException('Cannot review your own submission');
    return review;
  }
  // Get review details.
  async details(id: string, actor: Actor) {
    const checked = await this.check(id, actor);
    const review = await this.prisma.reviewCase.findUnique({
      where: { id },
      include: {
        revision: {
          include: {
            revisionParagraphs: { orderBy: { paragraphNo: 'asc' } },
            attempt: {
              select: {
                id: true,
                learner: { select: { id: true, displayName: true } },
                assignmentVersion: {
                  select: {
                    id: true,
                    versionNo: true,
                    mode: true,
                    dueAt: true,
                    releasePolicyJson: true,
                    assignment: {
                      select: { id: true, title: true, courseId: true },
                    },
                    activityVersion: {
                      select: {
                        id: true,
                        versionNo: true,
                        promptText: true,
                        instructions: true,
                      },
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
                criterionScores: {
                  include: {
                    criterion: {
                      select: { id: true, code: true, name: true },
                    },
                  },
                },
                findings: { include: { findingAnchors: true } },
                aiResult: {
                  select: {
                    gradingRunId: true,
                    qualityStatus: true,
                    validationJson: true,
                  },
                },
                teacherResult: { select: { decisionId: true } },
                acceptedAssessment: true,
                skillObservations: true,
              },
            },
          },
        },
        targetRun: {
          select: {
            id: true,
            status: true,
            errorCode: true,
            completedAt: true,
          },
        },
        reviewDecisions: {
          orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
        },
        appeals: true,
      },
    });
    if (!review) throw new NotFoundException('Review case not found');
    const mode = checked.revision.responseMode;
    const skills =
      mode === 'WRITING' || mode === 'SPEAKING'
        ? await this.prisma.skill.findMany({
            where: { status: 'PUBLISHED', skillArea: mode },
            select: {
              id: true,
              code: true,
              name: true,
              observableDefinition: true,
            },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          })
        : [];
    return {
      ...review,
      availableSkills: skills.map(({ observableDefinition, ...skill }) => ({
        ...skill,
        description: observableDefinition,
      })),
    };
  }
  // Claim a review case.
  async claimSubmission(id: string, actor: Actor) {
    await this.check(id, actor);
    const result = await this.prisma.reviewCase.updateMany({
      where: { id, status: 'PENDING', assigneeId: null },
      data: {
        status: 'CLAIMED',
        assigneeId: actor.id,
        claimedAt: new Date(),
        lockVersion: { increment: 1 },
      },
    });
    if (!result.count) {
      const current = await this.prisma.reviewCase.findUnique({
        where: { id },
      });
      if (current?.status === 'CLAIMED' && current.assigneeId === actor.id)
        return current;
      throw new ConflictException('Review has already been claimed or closed');
    }
    return this.prisma.reviewCase.findUnique({ where: { id } });
  }
  // Confirm and save the teacher assessment.
  async confirmReview(id: string, input: unknown, actor: Actor) {
    await this.check(id, actor);
    const dto = object(input);
    const lockVersion = integer(dto.lockVersion, 'lockVersion');
    const reason = text(dto.reason, 'reason');
    return serializable(this.prisma, async (tx) => {
      const review = await tx.reviewCase.findUniqueOrThrow({
        where: { id },
        include: {
          revision: {
            include: {
              revisionParagraphs: true,
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
      if (
        review.status !== 'CLAIMED' ||
        review.assigneeId !== actor.id ||
        review.lockVersion !== lockVersion
      )
        throw new ConflictException(
          'Claim the review and use its current lockVersion',
        );
      const version = review.revision.attempt.assignmentVersion;
      if (!version.rubricVersion || !version.rubricVersion.publishedAt)
        throw new ConflictException(
          'A published rubric must be pinned to this assignment',
        );
      const skills = await tx.skill.findMany({
        where: {
          status: 'PUBLISHED',
          skillArea:
            review.revision.responseMode === 'SPEAKING'
              ? 'SPEAKING'
              : 'WRITING',
        },
      });
      const skillIds = new Set(skills.map((x) => x.id));
      const assessment = validateAssessment(
        dto,
        version.rubricVersion.rubricCriterions,
        review.revision.revisionParagraphs,
        skillIds,
      );
      if (
        dto.observations !== undefined &&
        (!Array.isArray(dto.observations) || dto.observations.length > 100)
      )
        throw new BadRequestException('Invalid observations');
      const observations = ((dto.observations ?? []) as unknown[]).map(
        (value) => {
          const o = object(value),
            skillId = uuid(o.skillId, 'skillId');
          if (
            !skillIds.has(skillId) ||
            !['MET', 'PARTIAL', 'NOT_MET', 'NOT_OBSERVED'].includes(
              String(o.outcome),
            )
          )
            throw new BadRequestException('Invalid skill observation');
          return {
            skillId,
            outcome: o.outcome as
              'MET' | 'PARTIAL' | 'NOT_MET' | 'NOT_OBSERVED',
            rationale: text(o.rationale, 'rationale'),
          };
        },
      );
      if (
        new Set(observations.map((o) => o.skillId)).size !== observations.length
      )
        throw new BadRequestException('Duplicate skill observation');
      const won = await tx.reviewCase.updateMany({
        where: { id, status: 'CLAIMED', assigneeId: actor.id, lockVersion },
        data: { status: 'CONFIRMED', lockVersion: { increment: 1 } },
      });
      if (!won.count) throw new ConflictException('Review changed; reload');
      const previous = await tx.reviewDecision.findFirst({
        where: { revisionId: review.revisionId },
        orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
      });
      const lastInCase = await tx.reviewDecision.findFirst({
        where: { reviewCaseId: id },
        orderBy: { decisionNo: 'desc' },
      });
      const decision = await tx.reviewDecision.create({
        data: {
          reviewCaseId: id,
          revisionId: review.revisionId,
          teacherId: actor.id,
          decisionNo: (lastInCase?.decisionNo ?? 0) + 1,
          supersedesId: previous?.id,
          reason,
        },
      });
      const result = await this.grading.saveAssessment(
        tx,
        review.revisionId,
        version.rubricVersion.id,
        'TEACHER',
        assessment,
      );
      await tx.teacherResult.create({
        data: {
          id: result.id,
          revisionId: review.revisionId,
          decisionId: decision.id,
        },
      });
      for (const observation of observations)
        await tx.skillObservation.create({
          data: { resultId: result.id, ...observation },
        });
      const accepted = await this.publication.accept(tx, result.id, version);
      await tx.appeal.updateMany({
        where: { reviewCaseId: id, status: { in: ['PENDING', 'IN_REVIEW'] } },
        data: {
          status: 'RESOLVED',
          resolution: reason,
          resolvedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'REVIEW_CONFIRMED',
          entityType: 'ReviewCase',
          entityKey: id,
          afterJson: {
            decisionId: decision.id,
            resultId: result.id,
            acceptedId: accepted.id,
          },
        },
      });
      return { decision, assessment: result, acceptedAssessment: accepted };
    });
  }
  // Appeal my published assessment.
  async createAppeal(acceptedId: string, input: unknown, actor: Actor) {
    const reason = text(object(input).reason, 'reason');
    return serializable(this.prisma, async (tx) => {
      const accepted = await tx.acceptedAssessment.findUnique({
        where: { id: acceptedId },
        include: {
          result: { include: { revision: { include: { attempt: true } } } },
        },
      });
      if (
        !accepted ||
        !accepted.isCurrent ||
        !accepted.publishedAt ||
        accepted.publishedAt > new Date()
      )
        throw new NotFoundException('Current published assessment not found');
      if (accepted.result.revision.attempt.learnerId !== actor.id)
        throw new ForbiddenException();
      const exists = await tx.appeal.findFirst({
        where: {
          acceptedId,
          requesterId: actor.id,
          status: { in: ['PENDING', 'IN_REVIEW'] },
        },
      });
      if (exists) throw new ConflictException('An appeal is already pending');
      const review = await this.grading.review(
        tx,
        accepted.revisionId,
        'LEARNER_APPEAL',
      );
      return tx.appeal.create({
        data: {
          acceptedId,
          revisionId: accepted.revisionId,
          requesterId: actor.id,
          reviewCaseId: review.id,
          reason,
        },
      });
    });
  }
  // Publish an accepted assessment.
  async publish(acceptedId: string, actor: Actor) {
    const accepted = await this.prisma.acceptedAssessment.findUnique({
      where: { id: acceptedId },
    });
    if (!accepted) throw new NotFoundException('Assessment not found');
    const revision = await this.access.revision(actor, accepted.revisionId);
    await this.access.instructor(
      actor,
      revision.attempt.assignmentVersion.assignment.courseId,
    );
    if (revision.attempt.learnerId === actor.id) throw new ForbiddenException();
    return serializable(this.prisma, (tx) =>
      this.publication.publish(tx, acceptedId),
    );
  }
  // Resolve an answer-key review or reject an appeal.
  async resolve(id: string, input: unknown, actor: Actor) {
    await this.check(id, actor);
    const dto = object(input),
      lockVersion = integer(dto.lockVersion, 'lockVersion'),
      reason = text(dto.reason, 'reason');
    return serializable(this.prisma, async (tx) => {
      const review = await tx.reviewCase.findUniqueOrThrow({
        where: { id },
        include: {
          revision: {
            include: { attempt: { include: { assignmentVersion: true } } },
          },
        },
      });
      const changed = await tx.reviewCase.updateMany({
        where: { id, status: 'CLAIMED', assigneeId: actor.id, lockVersion },
        data: { status: 'CONFIRMED', lockVersion: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException('Stale or unclaimed review');
      let resultId: string | null = null;
      if (dto.answerKeyVersionId !== undefined) {
        if (review.revision.responseMode !== 'OBJECTIVE')
          throw new BadRequestException(
            'Answer key correction requires an objective submission',
          );
        const result = await this.grading.gradeObjective(
          tx,
          review.revision,
          review.revision.attempt.assignmentVersion,
          uuid(dto.answerKeyVersionId, 'answerKeyVersionId'),
        );
        resultId = result.id;
      } else {
        const appeals = await tx.appeal.count({
          where: { reviewCaseId: id, status: { in: ['PENDING', 'IN_REVIEW'] } },
        });
        if (!appeals)
          throw new ConflictException(
            'Only an appeal can be resolved without a new assessment',
          );
      }
      await tx.appeal.updateMany({
        where: { reviewCaseId: id, status: { in: ['PENDING', 'IN_REVIEW'] } },
        data: {
          status: resultId ? 'RESOLVED' : 'REJECTED',
          resolution: reason,
          resolvedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: resultId ? 'ANSWER_KEY_CORRECTED' : 'APPEAL_REJECTED',
          entityType: 'ReviewCase',
          entityKey: id,
          afterJson: { reason, resultId },
        },
      });
      return { reviewCaseId: id, resultId, reason };
    });
  }
}
