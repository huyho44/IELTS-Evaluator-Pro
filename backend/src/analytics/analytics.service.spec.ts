import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma.service.js';
import { AnalyticsService } from './analytics.service.js';

const actor = (id: string, roles: string[]): Actor => ({
  id,
  email: `${id}@test.example`,
  displayName: id,
  roles,
  targetBand: null,
  targetExamDate: null,
  status: 'ACTIVE',
});
const learner = actor('learner', ['LEARNER']);
const teacher = actor('teacher', ['INSTRUCTOR']);
const admin = actor('admin', ['ADMIN']);
const C1 = '00000000-0000-4000-8000-000000000001';
const C2 = '00000000-0000-4000-8000-000000000002';
const inCourse = (courseId: string) => ({
  assignmentVersion: { assignment: { courseId } },
});
type Row = Record<string, any>;

function fixture() {
  const calls: Row = {};
  const prisma = {
    course: {
      findMany: async ({ where }: { where: Row }) => {
        calls.courseWhere = where;
        const all = [
          { id: C1, title: 'Writing', status: 'PUBLISHED' },
          { id: C2, title: 'Reading', status: 'PUBLISHED' },
        ];
        return where.courseInstructors ? all.slice(0, 1) : all;
      },
    },
    enrollment: {
      groupBy: async () => [
        { courseId: C1, status: 'ACTIVE', _count: { _all: 3 } },
        { courseId: C1, status: 'COMPLETED', _count: { _all: 1 } },
        { courseId: C1, status: 'LEFT', _count: { _all: 1 } },
      ],
    },
    lessonProgress: {
      findMany: async () => [
        { enrollment: { courseId: C1, learnerId: 'an' } },
        { enrollment: { courseId: C1, learnerId: 'an' } },
      ],
    },
    attempt: {
      findMany: async () => [{ learnerId: 'binh', ...inCourse(C1) }],
    },
    submissionRevision: {
      findMany: async () => [
        { attempt: inCourse(C1) },
        { attempt: inCourse(C1) },
        { attempt: inCourse(C2) },
      ],
    },
    acceptedAssessment: {
      findMany: async () =>
        [6.5, 7].map((overall, index) => ({
          result: {
            overallScore: overall,
            revision: { attempt: inCourse(C1) },
            criterionScores: [
              {
                score: 6 + index,
                criterion: { code: 'TR', name: 'Task Response' },
              },
              { score: 7, criterion: { code: 'CC', name: 'Coherence' } },
            ],
          },
        })),
    },
    reviewCase: {
      findMany: async () => [
        { status: 'PENDING', revision: { attempt: inCourse(C1) } },
        { status: 'CLAIMED', revision: { attempt: inCourse(C1) } },
        { status: 'PENDING', revision: { attempt: inCourse(C2) } },
      ],
    },
    auditEvent: {
      findMany: async (args: Row) => {
        calls.audit = args;
        return Array.from({ length: args.take }, (_, i) => ({
          id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
          action: 'X',
        }));
      },
    },
  };
  return {
    service: new AnalyticsService(prisma as unknown as PrismaService),
    calls,
  };
}

describe('AnalyticsService', () => {
  it('aggregates enrollment, activity, submissions, official bands and review backlog per course', async () => {
    const { service } = fixture();
    const report = await service.analytics(admin);
    const writing = report.courses[0];
    expect(writing).toMatchObject({
      id: C1,
      enrollments: { active: 3, completed: 1, left: 1, total: 5 },
      completionRate: 0.25,
      activeLearners: 2,
      submissions: 2,
      officialResults: 2,
      averageBand: 6.75,
      reviewBacklog: { pending: 1, claimed: 1 },
    });
    expect(writing.criteria).toEqual([
      { code: 'CC', name: 'Coherence', average: 7, count: 2 },
      { code: 'TR', name: 'Task Response', average: 6.5, count: 2 },
    ]);
    expect(report.courses[1]).toMatchObject({
      completionRate: null,
      averageBand: null,
      submissions: 1,
      reviewBacklog: { pending: 1, claimed: 0 },
    });
    expect(report.totals).toMatchObject({
      courses: 2,
      activeLearners: 2,
      submissions: 3,
      reviewBacklog: 3,
    });
  });

  it('scopes instructors to assigned courses and refuses learners', async () => {
    const { service, calls } = fixture();
    expect((await service.analytics(teacher)).courses.map((c) => c.id)).toEqual(
      [C1],
    );
    expect(calls.courseWhere).toEqual({
      courseInstructors: { some: { instructorId: teacher.id } },
    });
    await expect(service.analytics(learner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.analytics(admin, 'nope')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('pages the audit log for admins with validated filters', async () => {
    const { service, calls } = fixture();
    await expect(service.auditEvents(teacher, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const page = await service.auditEvents(admin, {
      action: ' password_reset ',
      entityType: 'User',
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-30T00:00:00Z',
      limit: '2',
    });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(page.items[1].id);
    expect(calls.audit.where).toMatchObject({
      action: 'PASSWORD_RESET',
      entityType: 'User',
      occurredAt: {
        gte: new Date('2026-11-01T00:00:00Z'),
        lte: new Date('2026-11-30T00:00:00Z'),
      },
    });
    await service.auditEvents(admin, { cursor: page.nextCursor! });
    expect(calls.audit).toMatchObject({
      cursor: { id: page.nextCursor },
      skip: 1,
      take: 51,
    });
    for (const query of [
      { limit: '0' },
      { limit: '500' },
      { from: 'yesterday' },
      { from: '2026-12-01T00:00:00Z', to: '2026-11-01T00:00:00Z' },
      { actorId: 'x' },
      { cursor: 'x' },
    ])
      await expect(service.auditEvents(admin, query)).rejects.toBeInstanceOf(
        BadRequestException,
      );
  });
});
