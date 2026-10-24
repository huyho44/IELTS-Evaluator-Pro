import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  AssignmentVersion,
  Prisma,
  SubmissionRevision,
} from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import { PublicationService, releaseTime } from './publication.service.js';
import { matchesAnswer } from './objective-scoring.js';
import type { ValidatedAssessment } from './assessment-validation.js';
import { object, uuid } from '../auth/validation.js';
import { serializable } from '../submissions/transaction.js';

@Injectable()
export class GradingService {
  // Inject required services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly publication: PublicationService,
  ) {}
  // Queue grading or request teacher review.
  async queueRevision(
    tx: Prisma.TransactionClient,
    revision: SubmissionRevision,
    version: AssignmentVersion,
  ) {
    if (revision.responseMode === 'OBJECTIVE')
      return tx.outboxEvent.create({
        data: {
          eventType: 'ObjectiveGradeRequested',
          aggregateType: 'SubmissionRevision',
          aggregateId: revision.id,
          payloadJson: { revisionId: revision.id },
        },
      });
    if (revision.responseMode === 'SPEAKING')
      return this.review(tx, revision.id, 'SPEAKING_MANUAL');
    const config = version.rubricVersionId
      ? await tx.gradingConfig.findFirst({
          where: {
            rubricVersionId: version.rubricVersionId,
            rubricVersion: { publishedAt: { lte: new Date() } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : null;
    if (!config) return this.review(tx, revision.id, 'AI_NOT_CONFIGURED');
    const run = await tx.gradingRun.create({
      data: {
        revisionId: revision.id,
        configId: config.id,
        requestKey: 'initial:' + revision.id,
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventType: 'GradeRequested',
        aggregateType: 'GradingRun',
        aggregateId: run.id,
        payloadJson: { gradingRunId: run.id, revisionId: revision.id },
      },
    });
    if (version.mode === 'GRADED')
      await this.review(tx, revision.id, 'GRADED_WRITING', run.id);
    return run;
  }
  // Get or create an open review case.
  async review(
    tx: Prisma.TransactionClient,
    revisionId: string,
    reasonCode: string,
    targetRunId?: string,
  ) {
    const current = await tx.reviewCase.findFirst({
      where: { revisionId, status: { in: ['PENDING', 'CLAIMED'] } },
    });
    return (
      current ??
      tx.reviewCase.create({
        data: {
          revisionId,
          reasonCode,
          targetRunId,
          priority: reasonCode.includes('FAILED') ? 10 : 0,
        },
      })
    );
  }
  // Grade answers using the answer key.
  async gradeObjective(
    tx: Prisma.TransactionClient,
    revision: SubmissionRevision,
    version: AssignmentVersion,
    correctedKeyId?: string,
  ) {
    const existing = await tx.assessmentResult.findFirst({
      where: { revisionId: revision.id, kind: 'ANSWER_KEY' },
    });
    if (existing && !correctedKeyId) return existing;
    const key = await tx.answerKeyVersion.findFirst({
      where: {
        ...(correctedKeyId ? { id: correctedKeyId } : {}),
        activityVersionId: version.activityVersionId,
        publishedAt: {
          lte: correctedKeyId ? new Date() : revision.submittedAt,
        },
      },
      orderBy: { versionNo: 'desc' },
      include: {
        answerKeyEntries: {
          include: {
            answerKeyOptions: true,
            assessmentItem: { include: { itemSkills: true } },
          },
        },
      },
    });
    if (!key)
      throw new ServiceUnavailableException(
        'No published answer key for this activity version',
      );
    const responses = await tx.itemResponse.findMany({
      where: { revisionId: revision.id },
      include: { responseSelections: true },
    });
    if (!responses.length || key.answerKeyEntries.length !== responses.length)
      throw new ServiceUnavailableException(
        'Answer key does not cover the assessment',
      );
    const marks = responses.map((response) => {
      const entry = key.answerKeyEntries.find(
        (e) => e.assessmentItemId === response.assessmentItemId,
      );
      if (!entry)
        throw new ServiceUnavailableException('Missing answer key entry');
      const correct = matchesAnswer(
        entry.gradingRuleJson,
        entry.acceptedTextsJson,
        entry.answerKeyOptions.map((x) => x.optionId),
        {
          textAnswer: response.textAnswer,
          optionIds: response.responseSelections.map((x) => x.optionId),
        },
      );
      return {
        responseId: response.id,
        keyEntryId: entry.id,
        awardedMarks: correct ? entry.assessmentItem.maxMarks.toNumber() : 0,
        maxMarks: entry.assessmentItem.maxMarks.toNumber(),
        skills: entry.assessmentItem.itemSkills,
      };
    });
    const rawScore = marks.reduce((s, m) => s + m.awardedMarks, 0),
      maxScore = marks.reduce((s, m) => s + m.maxMarks, 0);
    const result = await tx.assessmentResult.create({
      data: {
        revisionId: revision.id,
        kind: 'ANSWER_KEY',
        overallScore: rawScore,
        scoreScale: 'RAW',
        summary: `${rawScore}/${maxScore}`,
      },
    });
    await tx.answerKeyResult.create({
      data: {
        id: result.id,
        revisionId: revision.id,
        answerKeyVersionId: key.id,
        rawScore,
        maxScore,
      },
    });
    for (const mark of marks)
      await tx.questionMark.create({
        data: {
          answerKeyResultId: result.id,
          responseId: mark.responseId,
          keyEntryId: mark.keyEntryId,
          awardedMarks: mark.awardedMarks,
        },
      });
    const skillTotals = new Map<string, { awarded: number; maximum: number }>();
    for (const mark of marks)
      for (const skill of mark.skills) {
        const old = skillTotals.get(skill.skillId) ?? {
          awarded: 0,
          maximum: 0,
        };
        old.awarded += mark.awardedMarks * skill.observationWeight.toNumber();
        old.maximum += mark.maxMarks * skill.observationWeight.toNumber();
        skillTotals.set(skill.skillId, old);
      }
    for (const [skillId, total] of skillTotals)
      await tx.skillObservation.create({
        data: {
          resultId: result.id,
          skillId,
          outcome:
            total.maximum === 0
              ? 'NOT_OBSERVED'
              : total.awarded === total.maximum
                ? 'MET'
                : total.awarded === 0
                  ? 'NOT_MET'
                  : 'PARTIAL',
          rationale: `Answer-key evidence: ${total.awarded}/${total.maximum} weighted marks`,
        },
      });
    await this.publication.accept(tx, result.id, version);
    return result;
  }
  // Save scores, findings, and evidence anchors.
  async saveAssessment(
    tx: Prisma.TransactionClient,
    revisionId: string,
    rubricVersionId: string,
    kind: 'AI' | 'TEACHER',
    value: ValidatedAssessment,
  ) {
    const result = await tx.assessmentResult.create({
      data: {
        revisionId,
        rubricVersionId,
        kind,
        overallScore: value.overallScore,
        scoreScale: 'BAND',
        summary: value.summary,
      },
    });
    const scoreIds = new Map<string, string>();
    for (const score of value.scores) {
      const row = await tx.criterionScore.create({
        data: {
          resultId: result.id,
          rubricVersionId,
          criterionId: score.criterionId,
          score: score.score,
          explanation: score.explanation,
        },
      });
      scoreIds.set(score.code, row.id);
    }
    for (const f of value.findings)
      await tx.finding.create({
        data: {
          resultId: result.id,
          criterionScoreId: scoreIds.get(f.code),
          skillId: f.skillId,
          findingKind: f.findingKind,
          explanation: f.explanation,
          validationJson: { valid: true, validator: 'exact-quote-v1' },
          findingAnchors: { create: f.anchors },
        },
      });
    return result;
  }
  // Get the grading run status.
  async getGradingRunStatus(id: string, actor: Actor) {
    const run = await this.prisma.gradingRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Grading run not found');
    await this.access.revision(actor, run.revisionId);
    return {
      gradingRunId: run.id,
      revisionId: run.revisionId,
      status: run.status,
      attempts: run.attempts,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      errorCode: run.errorCode,
    };
  }
  // Request another AI grading run.
  async requestRegrade(revisionId: string, input: unknown, actor: Actor) {
    const revision = await this.access.revision(actor, revisionId);
    await this.access.instructor(
      actor,
      revision.attempt.assignmentVersion.assignment.courseId,
    );
    const key = uuid(object(input).requestKey, 'requestKey');
    if (revision.responseMode !== 'WRITING')
      throw new BadRequestException('AI regrading only supports Writing');
    return serializable(this.prisma, async (tx) => {
      const requestKey = 'regrade:' + key;
      const existing = await tx.gradingRun.findUnique({
        where: { requestKey },
      });
      if (existing) {
        if (existing.revisionId !== revisionId)
          throw new ConflictException('requestKey belongs to another revision');
        return existing;
      }
      const rubricVersionId =
        revision.attempt.assignmentVersion.rubricVersionId;
      if (!rubricVersionId) throw new ConflictException('No pinned rubric');
      const config = await tx.gradingConfig.findFirst({
        where: {
          rubricVersionId,
          rubricVersion: { publishedAt: { lte: new Date() } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (!config)
        throw new ServiceUnavailableException('No grading configuration');
      const run = await tx.gradingRun.create({
        data: { revisionId, configId: config.id, requestKey },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: 'GradeRequested',
          aggregateType: 'GradingRun',
          aggregateId: run.id,
          payloadJson: { gradingRunId: run.id, revisionId },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'AI_REGRADE_REQUESTED',
          entityType: 'SubmissionRevision',
          entityKey: revisionId,
          afterJson: { gradingRunId: run.id },
        },
      });
      return run;
    });
  }
  // Get assessment results visible to the user.
  async getAssessmentSubmission(revisionId: string, actor: Actor) {
    const revision = await this.access.revision(actor, revisionId);
    const owner = revision.attempt.learnerId === actor.id;
    const version = revision.attempt.assignmentVersion;
    const release = releaseTime(version.releasePolicyJson, version.dueAt);
    const allowProvisional =
      version.mode === 'PRACTICE' && release !== null && release <= new Date();
    const where: Prisma.AssessmentResultWhereInput = { revisionId };
    if (owner)
      where.OR = [
        {
          acceptedAssessment: {
            isCurrent: true,
            publishedAt: { lte: new Date() },
          },
        },
        ...(allowProvisional
          ? [
              {
                kind: 'AI' as const,
                aiResult: { qualityStatus: 'PASSED' as const },
              },
            ]
          : []),
      ];
    const results = await this.prisma.assessmentResult.findMany({
      where,
      include: {
        criterionScores: {
          include: { criterion: { select: { code: true, name: true } } },
        },
        findings: { include: { findingAnchors: true } },
        acceptedAssessment: true,
        answerKeyResult: { include: { questionMarks: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      revisionId,
      assessments: results.map((r) => ({
        ...r,
        isOfficial: !!r.acceptedAssessment?.isCurrent,
        provisional: r.kind === 'AI',
      })),
      isOfficial: results.some((r) => r.acceptedAssessment?.isCurrent),
    };
  }
}
