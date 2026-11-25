import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma.service.js';
import { NotifierService } from './notifier.service.js';

type Row = Record<string, any>;
const NOW = new Date('2026-12-01T00:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3600000);

function fixture() {
  const courses: Row[] = [
    { id: 'c1', status: 'PUBLISHED', title: 'Writing' },
    { id: 'c2', status: 'DRAFT', title: 'Draft' },
  ];
  const enrollments: Row[] = [
    { courseId: 'c1', learnerId: 'an', status: 'ACTIVE' },
    { courseId: 'c1', learnerId: 'binh', status: 'ACTIVE' },
    { courseId: 'c1', learnerId: 'left', status: 'LEFT' },
    { courseId: 'c2', learnerId: 'an', status: 'ACTIVE' },
  ];
  const assignments: Row[] = [
    { id: 'a1', courseId: 'c1', activityId: 'act1', title: 'Essay 1' },
    { id: 'a2', courseId: 'c1', activityId: 'act2', title: 'Essay 2' },
    { id: 'a3', courseId: 'c2', activityId: 'act3', title: 'Hidden' },
  ];
  const versions: Row[] = [
    {
      id: 'v1',
      assignmentId: 'a1',
      versionNo: 1,
      dueAt: hours(5),
      publishedAt: hours(-48),
      opensAt: null,
    },
    // Superseded by v2b, which is due later than the window.
    {
      id: 'v2a',
      assignmentId: 'a2',
      versionNo: 1,
      dueAt: hours(5),
      publishedAt: hours(-48),
      opensAt: null,
    },
    {
      id: 'v2b',
      assignmentId: 'a2',
      versionNo: 2,
      dueAt: hours(72),
      publishedAt: hours(-1),
      opensAt: null,
    },
    {
      id: 'v3',
      assignmentId: 'a3',
      versionNo: 1,
      dueAt: hours(5),
      publishedAt: hours(-48),
      opensAt: null,
    },
  ];
  const attempts: Row[] = [
    { assignmentId: 'a1', learnerId: 'binh', status: 'SUBMITTED' },
  ];
  const notifications: Row[] = [];
  const course = (id: string) => courses.find((c) => c.id === id)!;
  const assignment = (id: string) => assignments.find((a) => a.id === id)!;
  const prisma = {
    course: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        course(where.id) ?? null,
    },
    enrollment: {
      findMany: async ({ where }: { where: Row }) =>
        enrollments.filter(
          (e) => e.courseId === where.courseId && e.status === where.status,
        ),
    },
    attempt: {
      findMany: async ({ where }: { where: Row }) =>
        attempts.filter(
          (a) =>
            a.assignmentId === where.assignmentId &&
            where.learnerId.in.includes(a.learnerId) &&
            where.status.in.includes(a.status),
        ),
    },
    assignmentVersion: {
      findMany: async ({ where }: { where: Row }) =>
        versions
          .filter(
            (v) =>
              v.dueAt > where.dueAt.gt &&
              v.dueAt <= where.dueAt.lte &&
              v.publishedAt <= where.publishedAt.lte &&
              course(assignment(v.assignmentId).courseId).status ===
                'PUBLISHED',
          )
          .map((v) => ({ ...v, assignment: assignment(v.assignmentId) })),
      findFirst: async ({ where }: { where: Row }) =>
        versions
          .filter(
            (v) =>
              v.assignmentId === where.assignmentId &&
              v.publishedAt <= where.publishedAt.lte,
          )
          .sort((a, b) => b.versionNo - a.versionNo)[0] ?? null,
    },
    notification: {
      createMany: async ({
        data,
        skipDuplicates,
      }: {
        data: Row[];
        skipDuplicates: boolean;
      }) => {
        expect(skipDuplicates).toBe(true);
        let count = 0;
        for (const row of data) {
          if (notifications.some((n) => n.dedupeKey === row.dedupeKey))
            continue;
          notifications.push(row);
          count++;
        }
        return { count };
      },
    },
  };
  return {
    service: new NotifierService(prisma as unknown as PrismaService),
    notifications,
  };
}

describe('NotifierService', () => {
  const notice = {
    courseId: 'c1',
    key: 'lesson-1',
    title: 'New lesson: Cohesion',
    body: 'A new lesson is available.',
    navigationPath: '/courses/c1/lessons/lesson-1',
  };

  it('notifies active learners of a published course once per content item', async () => {
    const { service, notifications } = fixture();
    expect(await service.newContent(notice)).toBe(2);
    expect(await service.newContent(notice)).toBe(0);
    expect(
      notifications.map((n) => [
        n.recipientId,
        n.notificationType,
        n.dedupeKey,
      ]),
    ).toEqual([
      ['an', 'NEW_CONTENT', 'NEW_CONTENT:lesson-1:an'],
      ['binh', 'NEW_CONTENT', 'NEW_CONTENT:lesson-1:binh'],
    ]);
    expect(
      await service.newContent({ ...notice, courseId: 'c2', key: 'draft' }),
    ).toBe(0);
  });

  it('never fails content creation when notifications cannot be stored', async () => {
    const { service } = fixture();
    (service as any).prisma.course.findUnique = async () => {
      throw new Error('db down');
    };
    await expect(service.announce(notice)).resolves.toBe(0);
  });

  it('sends DEADLINE_SOON once, only for the current version, to learners who have not submitted', async () => {
    const { service, notifications } = fixture();
    expect(await service.deadlineSoon(NOW)).toBe(1);
    expect(notifications).toEqual([
      expect.objectContaining({
        recipientId: 'an',
        notificationType: 'DEADLINE_SOON',
        navigationPath: '/courses/c1/practices/act1',
        dedupeKey: 'DEADLINE_SOON:v1:an',
      }),
    ]);
    expect(await service.deadlineSoon(NOW)).toBe(0);
    // Later, v2b enters the 24-hour window.
    expect(await service.deadlineSoon(hours(60))).toBe(2);
    expect(notifications.slice(1).map((n) => n.dedupeKey)).toEqual([
      'DEADLINE_SOON:v2b:an',
      'DEADLINE_SOON:v2b:binh',
    ]);
  });
});
