import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import type { Actor } from '../auth/auth.service.js';

@Injectable()
export class GradingReportService {
  constructor(private readonly prisma: PrismaService) {}
  async report(actor: Actor) {
    if (!actor.roles.some((role) => ['ADMIN', 'INSTRUCTOR'].includes(role)))
      throw new ForbiddenException('Instructor or administrator required');
    const revision: Prisma.SubmissionRevisionWhereInput = actor.roles.includes(
      'ADMIN',
    )
      ? {}
      : {
          attempt: {
            assignmentVersion: {
              assignment: {
                course: {
                  courseInstructors: { some: { instructorId: actor.id } },
                },
              },
            },
          },
        };
    const [runs, attempts, quality, reviews] = await Promise.all([
      this.prisma.gradingRun.groupBy({
        by: ['status'],
        where: { revision },
        _count: { _all: true },
      }),
      this.prisma.providerAttempt.findMany({
        where: { gradingRun: { revision } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 500,
        select: {
          status: true,
          latencyMs: true,
          inputTokens: true,
          outputTokens: true,
          errorJson: true,
          createdAt: true,
        },
      }),
      this.prisma.aiResult.groupBy({
        by: ['qualityStatus'],
        where: { gradingRun: { revision } },
        _count: { _all: true },
      }),
      this.prisma.reviewCase.groupBy({
        by: ['status'],
        where: { revision },
        _count: { _all: true },
      }),
    ]);
    const latencies = attempts
      .flatMap((a) => (a.latencyMs === null ? [] : [a.latencyMs]))
      .sort((a, b) => a - b);
    const failures: Record<string, number> = {};
    for (const attempt of attempts) {
      const error = attempt.errorJson as { code?: unknown } | null;
      if (typeof error?.code === 'string')
        failures[error.code] = (failures[error.code] ?? 0) + 1;
    }
    return {
      scope: actor.roles.includes('ADMIN') ? 'ALL_COURSES' : 'ASSIGNED_COURSES',
      generatedAt: new Date(),
      runs: Object.fromEntries(runs.map((r) => [r.status, r._count._all])),
      quality: Object.fromEntries(
        quality.map((r) => [r.qualityStatus, r._count._all]),
      ),
      reviews: Object.fromEntries(
        reviews.map((r) => [r.status, r._count._all]),
      ),
      providerSample: {
        limit: 500,
        count: attempts.length,
        since: attempts.at(-1)?.createdAt ?? null,
        successCount: attempts.filter((a) => a.status === 'SUCCESS').length,
        meanLatencyMs: latencies.length
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : null,
        p95LatencyMs: latencies.length
          ? latencies[Math.ceil(latencies.length * 0.95) - 1]
          : null,
        inputTokens: attempts.reduce((sum, a) => sum + (a.inputTokens ?? 0), 0),
        outputTokens: attempts.reduce(
          (sum, a) => sum + (a.outputTokens ?? 0),
          0,
        ),
        tokenUsageRecordedCount: attempts.filter(
          (a) => a.inputTokens !== null && a.outputTokens !== null,
        ).length,
        failures,
      },
    };
  }
}
