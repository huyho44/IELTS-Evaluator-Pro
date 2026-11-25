import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../auth/auth.service.js';
import type { DiscussionsService } from '../discussions/discussions.service.js';
import type { PrismaService } from '../prisma.service.js';
import { ModerationService } from './moderation.service.js';

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = (n: number, roles: string[]): Actor => ({
  id: uid(100 + n),
  email: `u${n}@test.example`,
  displayName: `User ${n}`,
  roles,
  targetBand: null,
  targetExamDate: null,
  status: 'ACTIVE',
});
const an = actor(1, ['LEARNER']);
const binh = actor(2, ['LEARNER']);
const outsider = actor(3, ['LEARNER']);
const teacher = actor(4, ['INSTRUCTOR']);
const otherTeacher = actor(5, ['INSTRUCTOR']);
const admin = actor(6, ['ADMIN']);
const COURSE = uid(1);
const OTHER = uid(2);
const ITEM = uid(10);
const POST = uid(20);
const OTHER_POST = uid(21);
type Row = Record<string, any>;

function fixture() {
  let seq = 500;
  const courses: Row[] = [
    { id: COURSE, title: 'Writing', status: 'PUBLISHED' },
    { id: OTHER, title: 'Reading', status: 'PUBLISHED' },
  ];
  const items: Row[] = [
    {
      id: ITEM,
      courseId: COURSE,
      title: 'Lesson 1',
      kind: 'LESSON',
      status: 'PUBLISHED',
    },
  ];
  const threads: Row[] = [
    { id: uid(30), courseId: COURSE, title: 'Q', status: 'OPEN' },
    { id: uid(31), courseId: OTHER, title: 'Other Q', status: 'OPEN' },
  ];
  const posts: Row[] = [
    {
      id: POST,
      threadId: uid(30),
      authorId: binh.id,
      body: 'Spam link',
      status: 'VISIBLE',
    },
    {
      id: OTHER_POST,
      threadId: uid(31),
      authorId: binh.id,
      body: 'Other',
      status: 'VISIBLE',
    },
  ];
  const instructors = [{ courseId: COURSE, instructorId: teacher.id }];
  const reports: Row[] = [];
  const notifications: Row[] = [];
  const audits: Row[] = [];
  const people = [an, binh, outsider, teacher, otherTeacher, admin];
  const person = (id: string | null) => {
    const p = people.find((x) => x.id === id);
    return p ? { id: p.id, displayName: p.displayName } : null;
  };
  const courseOf = (r: Row) =>
    r.courseId ??
    items.find((i) => i.id === r.learningItemId)?.courseId ??
    threads.find((t) => t.id === posts.find((p) => p.id === r.postId)?.threadId)
      ?.courseId;
  const view = (r: Row) => {
    const post = posts.find((p) => p.id === r.postId);
    const thread = post && threads.find((t) => t.id === post.threadId);
    const item = items.find((i) => i.id === r.learningItemId);
    const course = (id: string) => {
      const c = courses.find((x) => x.id === id)!;
      return { id: c.id, title: c.title, status: c.status };
    };
    return {
      ...r,
      reporter: person(r.reporterId),
      resolver: person(r.resolverId),
      course: r.courseId ? course(r.courseId) : null,
      learningItem: item ? { ...item, course: course(item.courseId) } : null,
      post: post
        ? {
            ...post,
            author: person(post.authorId),
            thread: {
              id: thread!.id,
              title: thread!.title,
              course: course(thread!.courseId),
            },
          }
        : null,
    };
  };
  const matches = (r: Row, where: Row) =>
    (!where.id ||
      (typeof where.id === 'string'
        ? r.id === where.id
        : where.id.in.includes(r.id))) &&
    (!where.status || r.status === where.status) &&
    (!where.reporterId || r.reporterId === where.reporterId) &&
    (!('postId' in where) || r.postId === where.postId) &&
    (!('learningItemId' in where) ||
      r.learningItemId === where.learningItemId) &&
    (!('courseId' in where) || r.courseId === where.courseId) &&
    (!where.OR || where.OR[0].courseId.in.includes(courseOf(r)));
  const setStatus =
    (rows: Row[]) =>
    async ({ where, data }: { where: Row; data: Row }) => {
      const hit = rows.filter(
        (x) => x.id === where.id && x.status === where.status,
      );
      hit.forEach((x) => Object.assign(x, data));
      return { count: hit.length };
    };
  const prisma = {
    discussionPost: {
      findUnique: async ({ where }: { where: Row }) => {
        const p = posts.find((x) => x.id === where.id);
        if (!p) return null;
        const t = threads.find((x) => x.id === p.threadId)!;
        return { ...p, thread: { courseId: t.courseId, status: t.status } };
      },
      updateMany: setStatus(posts),
    },
    learningItem: {
      findUnique: async ({ where }: { where: Row }) =>
        items.find((x) => x.id === where.id) ?? null,
      updateMany: setStatus(items),
    },
    course: {
      findUnique: async ({ where }: { where: Row }) =>
        courses.find((x) => x.id === where.id) ?? null,
      updateMany: setStatus(courses),
    },
    courseInstructor: {
      findMany: async ({ where }: { where: Row }) =>
        instructors.filter(
          (i) =>
            (!where.courseId || i.courseId === where.courseId) &&
            (!where.instructorId || i.instructorId === where.instructorId),
        ),
    },
    user: {
      findMany: async () => [{ id: admin.id }],
    },
    moderationReport: {
      findFirst: async ({ where }: { where: Row }) => {
        const r = reports.find((x) => matches(x, where));
        return r ? view(r) : null;
      },
      findMany: async ({ where }: { where: Row }) =>
        reports.filter((x) => matches(x, where)).map(view),
      findUnique: async ({ where }: { where: Row }) =>
        view(reports.find((x) => x.id === where.id)!),
      create: async ({ data }: { data: Row }) => {
        const row = {
          id: uid(++seq),
          postId: null,
          learningItemId: null,
          courseId: null,
          status: 'PENDING',
          resolverId: null,
          resolution: null,
          resolvedAt: null,
          createdAt: new Date(),
          ...data,
        };
        reports.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hit = reports.filter((x) => matches(x, where));
        hit.forEach((x) => Object.assign(x, data));
        return { count: hit.length };
      },
    },
    notification: {
      createMany: async ({ data }: { data: Row[] }) => {
        notifications.push(...data);
        return { count: data.length };
      },
    },
    auditEvent: {
      create: async ({ data }: { data: Row }) => audits.push(data),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  // Course access as in DiscussionsService: enrolled learners, assigned instructors, admins.
  const enrolled: Record<string, string[]> = {
    [COURSE]: [an.id, binh.id],
    [OTHER]: [binh.id],
  };
  const discussions = {
    access: async (who: Actor, courseId: string) => {
      if (who.roles.includes('ADMIN')) return { staff: true };
      if (
        instructors.some(
          (i) => i.courseId === courseId && i.instructorId === who.id,
        )
      )
        return { staff: true };
      if (enrolled[courseId]?.includes(who.id)) return { staff: false };
      throw new ForbiddenException(
        'Course enrollment or instructor assignment required',
      );
    },
  };
  const service = new ModerationService(
    prisma as unknown as PrismaService,
    discussions as unknown as DiscussionsService,
  );
  return { service, posts, items, courses, reports, notifications, audits };
}

describe('ModerationService', () => {
  it('accepts reports from people who can see the content and notifies the right staff', async () => {
    const { service, notifications } = fixture();
    const report = await service.report(an, {
      targetType: 'POST',
      targetId: POST,
      reason: 'Spam',
    });
    expect(report.status).toBe('PENDING');
    expect(notifications).toEqual([
      expect.objectContaining({
        recipientId: teacher.id,
        notificationType: 'MODERATION_REPORT',
        navigationPath: '/teacher/moderation',
      }),
    ]);
    await service.report(an, {
      targetType: 'COURSE',
      targetId: OTHER,
      reason: 'Misleading',
    });
    expect(notifications.at(-1)).toMatchObject({
      recipientId: admin.id,
      navigationPath: '/admin/moderation',
    });

    await expect(
      service.report(an, {
        targetType: 'POST',
        targetId: POST,
        reason: 'Again',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.report(binh, {
        targetType: 'POST',
        targetId: POST,
        reason: 'Mine',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.report(outsider, {
        targetType: 'LEARNING_ITEM',
        targetId: ITEM,
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.report(an, { targetType: 'USER', targetId: POST, reason: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.report(an, {
        targetType: 'POST',
        targetId: uid(99),
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('limits instructors to reports in their courses and refuses learners', async () => {
    const { service } = fixture();
    await service.report(an, {
      targetType: 'POST',
      targetId: POST,
      reason: 'Spam',
    });
    await service.report(binh, {
      targetType: 'COURSE',
      targetId: OTHER,
      reason: 'Other course',
    });
    await expect(service.list(an)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.list(teacher)).map((r) => r.target.type)).toEqual([
      'POST',
    ]);
    expect(await service.list(otherTeacher)).toEqual([]);
    expect(await service.list(admin)).toHaveLength(2);
    const [row] = await service.list(teacher);
    expect(row.target).toMatchObject({
      courseId: COURSE,
      excerpt: 'Spam link',
      contentStatus: 'VISIBLE',
    });
    await expect(service.list(admin, 'BOGUS')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('hides a reported post on resolve, closes duplicate reports, audits and informs reporters', async () => {
    const f = fixture();
    const first = await f.service.report(an, {
      targetType: 'POST',
      targetId: POST,
      reason: 'Spam',
    });
    await f.service.report(teacher, {
      targetType: 'POST',
      targetId: POST,
      reason: 'Spam too',
    });
    f.notifications.length = 0;

    await expect(
      f.service.resolve(otherTeacher, first.id, { resolution: 'Removed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      f.service.resolve(teacher, first.id, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    const resolved = await f.service.resolve(teacher, first.id, {
      resolution: 'Spam removed',
      hideContent: false,
    });
    expect(resolved.status).toBe('RESOLVED');
    expect(f.posts[0].status).toBe('HIDDEN');
    expect(f.reports.map((r) => r.status)).toEqual(['RESOLVED', 'RESOLVED']);
    expect(f.audits).toEqual([
      expect.objectContaining({
        action: 'MODERATION_REPORT_RESOLVED',
        actorId: teacher.id,
      }),
    ]);
    expect(f.audits[0].afterJson.hidden).toBe(true);
    expect(
      f.notifications.map((n) => [n.recipientId, n.notificationType]),
    ).toEqual([
      [an.id, 'MODERATION_UPDATE'],
      [teacher.id, 'MODERATION_UPDATE'],
    ]);
    await expect(
      f.service.dismiss(admin, first.id, { resolution: 'late' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets the moderator choose whether to hide a lesson, and dismisses without changes', async () => {
    const f = fixture();
    const kept = await f.service.report(an, {
      targetType: 'LEARNING_ITEM',
      targetId: ITEM,
      reason: 'Outdated',
    });
    await f.service.resolve(teacher, kept.id, {
      resolution: 'Will update next week',
    });
    expect(f.items[0].status).toBe('PUBLISHED');

    const hidden = await f.service.report(binh, {
      targetType: 'LEARNING_ITEM',
      targetId: ITEM,
      reason: 'Wrong answers',
    });
    await f.service.resolve(admin, hidden.id, {
      resolution: 'Hidden for review',
      hideContent: true,
    });
    expect(f.items[0].status).toBe('HIDDEN');

    const course = await f.service.report(binh, {
      targetType: 'COURSE',
      targetId: OTHER,
      reason: 'Not IELTS',
    });
    const dismissed = await f.service.dismiss(admin, course.id, {
      resolution: 'Course is fine',
    });
    expect(dismissed).toMatchObject({
      status: 'DISMISSED',
      resolution: 'Course is fine',
    });
    expect(f.courses[1].status).toBe('PUBLISHED');
    expect(f.audits.at(-1)).toMatchObject({
      action: 'MODERATION_REPORT_DISMISSED',
    });
  });
});
