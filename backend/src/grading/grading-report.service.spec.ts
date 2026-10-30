import { ForbiddenException } from '@nestjs/common';
import type { Actor } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma.service.js';
import { GradingReportService } from './grading-report.service.js';
const actor = (roles: string[]): Actor => ({
  id: 'teacher',
  email: 'teacher@example.test',
  displayName: 'Teacher',
  status: 'ACTIVE',
  roles,
  targetBand: null,
  targetExamDate: null,
});
function fixture() {
  const db = {
    gradingRun: {
      groupBy: vi
        .fn()
        .mockResolvedValue([{ status: 'COMPLETED', _count: { _all: 2 } }]),
    },
    providerAttempt: {
      findMany: vi.fn().mockResolvedValue([
        {
          status: 'SUCCESS',
          latencyMs: 100,
          inputTokens: 20,
          outputTokens: 10,
          createdAt: new Date(),
          errorJson: null,
        },
        {
          status: 'ERROR',
          latencyMs: 400,
          inputTokens: null,
          outputTokens: null,
          createdAt: new Date(),
          errorJson: { code: 'HTTP_429' },
        },
      ]),
    },
    aiResult: { groupBy: vi.fn().mockResolvedValue([]) },
    reviewCase: { groupBy: vi.fn().mockResolvedValue([]) },
  };
  return {
    db,
    service: new GradingReportService(db as unknown as PrismaService),
  };
}
it('denies learners before reading operational data', async () => {
  const f = fixture();
  await expect(f.service.report(actor(['LEARNER']))).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect(f.db.providerAttempt.findMany).not.toHaveBeenCalled();
});
it('scopes teachers to assigned courses and reports missing token metadata explicitly', async () => {
  const f = fixture();
  const report = await f.service.report(actor(['INSTRUCTOR']));
  const query = f.db.providerAttempt.findMany.mock.calls[0][0];
  expect(
    query.where.gradingRun.revision.attempt.assignmentVersion.assignment.course
      .courseInstructors.some.instructorId,
  ).toBe('teacher');
  expect(query.select.rawResponseJson).toBeUndefined();
  expect(report.providerSample).toMatchObject({
    count: 2,
    successCount: 1,
    meanLatencyMs: 250,
    p95LatencyMs: 400,
    inputTokens: 20,
    outputTokens: 10,
    tokenUsageRecordedCount: 1,
    failures: { HTTP_429: 1 },
  });
});
it('permits administrator aggregates and returns null for unmeasured latency', async () => {
  const f = fixture();
  f.db.providerAttempt.findMany.mockResolvedValue([]);
  expect(
    (await f.service.report(actor(['ADMIN']))).providerSample.meanLatencyMs,
  ).toBeNull();
  expect(f.db.gradingRun.groupBy.mock.calls[0][0].where.revision).toEqual({});
});
