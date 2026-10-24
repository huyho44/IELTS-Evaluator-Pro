import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { GradingService } from './grading.service.js';
import { GradingProvider, ProviderFailure } from './grading-provider.js';
import { PublicationService } from './publication.service.js';
import { validateAssessment } from './assessment-validation.js';
import { serializable } from '../submissions/transaction.js';

@Injectable()
export class GradingWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(GradingWorker.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
    private readonly provider: GradingProvider,
    private readonly publication: PublicationService,
  ) {}
  onModuleInit() {
    if (
      process.env.GRADING_WORKER_ENABLED === 'false' ||
      process.env.NODE_ENV === 'test'
    )
      return;
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.error('Grading poll failed; durable work will be retried'),
      );
    }, 3000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.publication.publishDue();
      await this.processObjective();
      const now = new Date();
      const run = await this.prisma.gradingRun.findFirst({
        where: {
          OR: [
            {
              status: 'QUEUED',
              OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
            },
            { status: 'RUNNING', leaseUntil: { lte: now } },
          ],
        },
        orderBy: { revision: { submittedAt: 'asc' } },
      });
      if (!run) return;
      if (run.attempts >= 3) {
        await serializable(this.prisma, async (tx) => {
          const changed = await tx.gradingRun.updateMany({
            where: {
              id: run.id,
              status: run.status,
              attempts: run.attempts,
              processingToken: run.processingToken,
            },
            data: {
              status: 'FAILED',
              errorCode: 'RETRY_LIMIT',
              completedAt: now,
              processingToken: null,
              leaseUntil: null,
            },
          });
          if (changed.count) {
            await this.grading.review(tx, run.revisionId, 'AI_FAILED', run.id);
            await this.dispatch(tx, run.id);
          }
        });
        return;
      }
      const token = randomUUID();
      const claimed = await this.prisma.gradingRun.updateMany({
        where: {
          id: run.id,
          status: run.status,
          attempts: run.attempts,
          processingToken: run.processingToken,
        },
        data: {
          status: 'RUNNING',
          attempts: { increment: 1 },
          processingToken: token,
          leaseUntil: new Date(Date.now() + 120000),
          startedAt: now,
        },
      });
      if (!claimed.count) return;
      await this.process(run.id, token);
    } finally {
      this.busy = false;
    }
  }
  private dispatch(tx: Prisma.TransactionClient, runId: string) {
    return tx.outboxEvent.updateMany({
      where: {
        eventType: 'GradeRequested',
        aggregateId: runId,
        status: 'PENDING',
      },
      data: {
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }
  private async processObjective() {
    const event = await this.prisma.outboxEvent.findFirst({
      where: { eventType: 'ObjectiveGradeRequested', status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!event) return;
    try {
      await serializable(this.prisma, async (tx) => {
        const claimed = await tx.outboxEvent.updateMany({
          where: { id: event.id, status: 'PENDING', attempts: event.attempts },
          data: { attempts: { increment: 1 } },
        });
        if (!claimed.count) return;
        const revision = await tx.submissionRevision.findUniqueOrThrow({
          where: { id: event.aggregateId },
          include: { attempt: { include: { assignmentVersion: true } } },
        });
        await this.grading.gradeObjective(
          tx,
          revision,
          revision.attempt.assignmentVersion,
        );
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'DISPATCHED', dispatchedAt: new Date() },
        });
      });
    } catch {
      // The revision survives scoring/configuration failures; only work state changes.
      await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, status: 'PENDING', attempts: event.attempts },
        data: {
          attempts: { increment: 1 },
          status: event.attempts >= 2 ? 'FAILED' : 'PENDING',
        },
      });
    }
  }
  private async process(id: string, token: string) {
    const run = await this.prisma.gradingRun.findUniqueOrThrow({
      where: { id },
      include: {
        config: {
          include: {
            promptVersion: true,
            rubricVersion: {
              include: {
                rubricCriterions: { include: { bandDescriptors: true } },
              },
            },
          },
        },
        revision: {
          include: {
            revisionParagraphs: true,
            attempt: {
              include: {
                assignmentVersion: { include: { activityVersion: true } },
              },
            },
          },
        },
      },
    });
    const skills = await this.prisma.skill.findMany({
      where: { status: 'PUBLISHED', skillArea: 'WRITING' },
    });
    let raw: unknown;
    const started = Date.now();
    try {
      if (run.config.provider !== 'JSON_HTTP')
        throw new ProviderFailure('UNSUPPORTED_PROVIDER', false);
      raw = await this.provider.evaluate({
        model: run.config.modelId,
        instructions: run.config.promptVersion.instructions,
        schema: run.config.promptVersion.outputSchemaJson,
        settings: run.config.settingsJson,
        context: {
          task: run.revision.attempt.assignmentVersion.activityVersion
            .promptText,
          taskInstructions:
            run.revision.attempt.assignmentVersion.activityVersion.instructions,
          rubric: run.config.rubricVersion,
          paragraphs: run.revision.revisionParagraphs,
          skills: skills.map((s) => ({
            id: s.id,
            code: s.code,
            definition: s.observableDefinition,
          })),
          untrustedSubmission: run.revision.writingText,
        },
      });
      if (raw && typeof raw === 'object' && 'status' in raw) {
        if (raw.status === 'REFUSED')
          throw new ProviderFailure('REFUSED', false);
        if (raw.status === 'INCOMPLETE')
          throw new ProviderFailure('INCOMPLETE', true);
      }
      let validated;
      try {
        validated = validateAssessment(
          raw,
          run.config.rubricVersion.rubricCriterions,
          run.revision.revisionParagraphs,
          new Set(skills.map((s) => s.id)),
        );
      } catch {
        throw new ProviderFailure('INVALID_OUTPUT', false);
      }
      await serializable(this.prisma, async (tx) => {
        const won = await tx.gradingRun.updateMany({
          where: {
            id,
            processingToken: token,
            status: 'RUNNING',
            leaseUntil: { gt: new Date() },
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            leaseUntil: null,
            processingToken: null,
            errorCode: null,
          },
        });
        if (!won.count) return;
        await tx.providerAttempt.create({
          data: {
            gradingRunId: id,
            attemptNo: run.attempts,
            status: 'SUCCESS',
            rawResponseJson: raw as Prisma.InputJsonValue,
            latencyMs: Date.now() - started,
          },
        });
        const result = await this.grading.saveAssessment(
          tx,
          run.revisionId,
          run.config.rubricVersionId,
          'AI',
          validated,
        );
        await tx.aiResult.create({
          data: {
            id: result.id,
            revisionId: run.revisionId,
            gradingRunId: id,
            qualityStatus: 'PASSED',
            validationJson: {
              validator: 'rubric-and-evidence-v1',
              passed: true,
            },
          },
        });
        await this.dispatch(tx, id);
      });
    } catch (error) {
      const failure =
        error instanceof ProviderFailure
          ? error
          : new ProviderFailure('PROCESSING_ERROR', true);
      const retry = failure.retryable && run.attempts < 3;
      await serializable(this.prisma, async (tx) => {
        const won = await tx.gradingRun.updateMany({
          where: {
            id,
            processingToken: token,
            status: 'RUNNING',
            leaseUntil: { gt: new Date() },
          },
          data: {
            status: retry ? 'QUEUED' : 'FAILED',
            errorCode: failure.code,
            processingToken: null,
            leaseUntil: retry
              ? new Date(Date.now() + 10000 * run.attempts)
              : null,
            completedAt: retry ? null : new Date(),
          },
        });
        if (!won.count) return;
        await tx.providerAttempt.create({
          data: {
            gradingRunId: id,
            attemptNo: run.attempts,
            status:
              failure.code === 'REFUSED'
                ? 'REFUSED'
                : failure.code === 'INCOMPLETE'
                  ? 'INCOMPLETE'
                  : failure.code.startsWith('INVALID')
                    ? 'INVALID'
                    : 'ERROR',
            ...(raw === undefined || raw === null
              ? {}
              : { rawResponseJson: raw as Prisma.InputJsonValue }),
            errorJson: { code: failure.code },
            latencyMs: Date.now() - started,
          },
        });
        if (!retry) {
          await this.grading.review(tx, run.revisionId, 'AI_FAILED', id);
          await this.dispatch(tx, id);
        }
      });
    }
  }
}
