import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma.service.js';
import { DiscussionsService } from './discussions.service.js';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const COURSE = id(1);
const OTHER_COURSE = id(2);
const LESSON = id(10);
const DRAFT_LESSON = id(11);
const actor = (n: number, roles: string[]): Actor => ({
  id: id(100 + n),
  email: `u${n}@test.example`,
  displayName: `User ${n}`,
  roles,
  targetBand: null,
  targetExamDate: null,
  status: 'ACTIVE',
});
const an = actor(1, ['LEARNER']);
const binh = actor(2, ['LEARNER']);
const done = actor(3, ['LEARNER']);
const outsider = actor(4, ['LEARNER']);
const teacher = actor(5, ['INSTRUCTOR']);
const otherTeacher = actor(6, ['INSTRUCTOR']);
const admin = actor(7, ['ADMIN']);
const users = [an, binh, done, outsider, teacher, otherTeacher, admin];

type Thread = {
  id: string;
  courseId: string;
  contextItemId: string | null;
  creatorId: string;
  title: string;
  status: string;
  createdAt: Date;
};
type Post = {
  id: string;
  threadId: string;
  authorId: string;
  parentPostId: string | null;
  body: string;
  status: string;
  createdAt: Date;
  editedAt: Date | null;
};
type Where = Record<string, any>;

function fixture() {
  let seq = 1000;
  let clock = Date.parse('2026-11-25T00:00:00Z');
  const next = () => id(++seq);
  const now = () => new Date((clock += 1000));
  const threads: Thread[] = [];
  const posts: Post[] = [];
  const notifications: Record<string, any>[] = [];
  const audits: Record<string, any>[] = [];
  const instructors = [{ courseId: COURSE, instructorId: teacher.id }];
  const enrollments = [
    { learnerId: an.id, courseId: COURSE, status: 'ACTIVE' },
    { learnerId: binh.id, courseId: COURSE, status: 'ACTIVE' },
    { learnerId: done.id, courseId: COURSE, status: 'COMPLETED' },
  ];
  const items = [
    {
      id: LESSON,
      courseId: COURSE,
      status: 'PUBLISHED',
      title: 'Lesson',
      kind: 'LESSON',
    },
    {
      id: DRAFT_LESSON,
      courseId: COURSE,
      status: 'DRAFT',
      title: 'Draft',
      kind: 'LESSON',
    },
  ];
  const userOf = (userId: string) => {
    const user = users.find((u) => u.id === userId)!;
    return { id: user.id, displayName: user.displayName };
  };
  const statusMatch = (status: string, filter: unknown) =>
    filter === undefined ||
    (typeof filter === 'string'
      ? status === filter
      : status !== (filter as { not: string }).not);
  const threadView = (t: Thread) => {
    const item = items.find((i) => i.id === t.contextItemId);
    const visible = posts
      .filter((p) => p.threadId === t.id && p.status === 'VISIBLE')
      .sort((a, b) => +b.createdAt - +a.createdAt);
    return {
      ...t,
      contextItem: item
        ? { id: item.id, title: item.title, kind: item.kind }
        : null,
      creator: userOf(t.creatorId),
      discussionPosts: visible
        .slice(0, 1)
        .map((p) => ({ createdAt: p.createdAt })),
      _count: { discussionPosts: visible.length },
    };
  };
  const postView = (p: Post) => ({ ...p, author: userOf(p.authorId) });
  const postMatch = (p: Post, where: Where) =>
    (!where.id || p.id === where.id) &&
    (!where.threadId || p.threadId === where.threadId) &&
    (!where.authorId || p.authorId === where.authorId) &&
    (!where.status || p.status === where.status);

  const prisma = {
    course: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        [COURSE, OTHER_COURSE].includes(where.id) ? { id: where.id } : null,
      findMany: async ({ where }: { where: Where }) =>
        [COURSE, OTHER_COURSE]
          .filter(
            (courseId) =>
              !where.courseInstructors ||
              instructors.some(
                (i) =>
                  i.courseId === courseId &&
                  i.instructorId === where.courseInstructors.some.instructorId,
              ),
          )
          .map((courseId) => ({
            id: courseId,
            title: courseId,
            status: 'PUBLISHED',
            _count: {
              discussionThreads: threads.filter(
                (t) => t.courseId === courseId && t.status === 'OPEN',
              ).length,
            },
          })),
    },
    courseInstructor: {
      findUnique: async ({ where }: { where: Where }) =>
        instructors.find(
          (i) =>
            i.courseId === where.courseId_instructorId.courseId &&
            i.instructorId === where.courseId_instructorId.instructorId,
        ) ?? null,
      findMany: async ({ where }: { where: Where }) =>
        instructors.filter((i) => i.courseId === where.courseId),
    },
    enrollment: {
      findUnique: async ({ where }: { where: Where }) =>
        enrollments.find(
          (e) =>
            e.learnerId === where.learnerId_courseId.learnerId &&
            e.courseId === where.learnerId_courseId.courseId,
        ) ?? null,
      findMany: async ({ where }: { where: Where }) =>
        enrollments.filter(
          (e) =>
            e.courseId === where.courseId &&
            where.learnerId.in.includes(e.learnerId),
        ),
    },
    learningItem: {
      findFirst: async ({ where }: { where: Where }) =>
        items.find(
          (i) =>
            i.id === where.id &&
            i.courseId === where.courseId &&
            i.status === where.status,
        ) ?? null,
    },
    user: {
      findMany: async ({ where }: { where: Where }) =>
        users
          .filter((u) => where.id.in.includes(u.id))
          .map((u) => ({
            id: u.id,
            userRoles: u.roles.map((code) => ({ role: { code } })),
          })),
    },
    discussionThread: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const t = threads.find((row) => row.id === where.id);
        return t ? threadView(t) : null;
      },
      findMany: async ({ where }: { where: Where }) =>
        threads
          .filter(
            (t) =>
              t.courseId === where.courseId &&
              (!where.contextItemId ||
                t.contextItemId === where.contextItemId) &&
              statusMatch(t.status, where.status),
          )
          .sort((a, b) => +b.createdAt - +a.createdAt)
          .map(threadView),
      create: async ({
        data,
      }: {
        data: Omit<Thread, 'id' | 'status' | 'createdAt'>;
      }) => {
        const row = { ...data, id: next(), status: 'OPEN', createdAt: now() };
        threads.push(row);
        return { id: row.id };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Where;
        data: Partial<Thread>;
      }) => {
        const rows = threads.filter(
          (t) => t.id === where.id && t.status === where.status,
        );
        rows.forEach((t) => Object.assign(t, data));
        return { count: rows.length };
      },
    },
    discussionPost: {
      create: async ({ data }: { data: Partial<Post> }) => {
        const row: Post = {
          id: next(),
          threadId: data.threadId!,
          authorId: data.authorId!,
          parentPostId: data.parentPostId ?? null,
          body: data.body!,
          status: 'VISIBLE',
          createdAt: now(),
          editedAt: null,
        };
        posts.push(row);
        return row;
      },
      findMany: async ({ where }: { where: Where }) => {
        if (typeof where.threadId === 'string')
          return posts
            .filter((p) => p.threadId === where.threadId)
            .map(postView);
        // Opening posts: first top-level post per thread (posts are in insert order).
        const seen = new Set<string>();
        return posts.filter((p) => {
          if (!where.threadId.in.includes(p.threadId) || p.parentPostId)
            return false;
          if (seen.has(p.threadId)) return false;
          seen.add(p.threadId);
          return true;
        });
      },
      findFirst: async ({ where }: { where: Where }) =>
        posts.find((p) => postMatch(p, where)) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        posts.find((p) => p.id === where.id) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: Where;
        data: Partial<Post>;
      }) => {
        const rows = posts.filter((p) => postMatch(p, where));
        rows.forEach((p) => Object.assign(p, data));
        return { count: rows.length };
      },
    },
    notification: {
      createMany: async ({ data }: { data: Record<string, any>[] }) => {
        notifications.push(...data);
        return { count: data.length };
      },
    },
    auditEvent: {
      create: async ({ data }: { data: Record<string, any> }) => {
        audits.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  const service = new DiscussionsService(prisma as unknown as PrismaService);
  return { service, threads, posts, notifications, audits };
}

describe('DiscussionsService', () => {
  it('lets enrolled learners ask lesson questions and notifies course instructors', async () => {
    const { service, notifications } = fixture();
    const thread = await service.create(an, COURSE, {
      title: '  Task 2 conclusion  ',
      body: 'Can I add a new idea in the conclusion?',
      contextItemId: LESSON,
    });
    expect(thread.title).toBe('Task 2 conclusion');
    expect(thread.contextItem?.id).toBe(LESSON);
    expect(thread.canPost).toBe(true);
    expect(thread.posts).toHaveLength(1);
    expect(notifications).toEqual([
      expect.objectContaining({
        recipientId: teacher.id,
        notificationType: 'DISCUSSION_THREAD',
        navigationPath: `/teacher/discussions?course=${COURSE}&thread=${thread.id}`,
      }),
    ]);

    const lessonList = await service.list(binh, COURSE, LESSON);
    expect(lessonList.threads.map((t) => t.id)).toEqual([thread.id]);
    expect(lessonList.threads[0].replyCount).toBe(0);
    expect((await service.list(binh, COURSE, id(99))).threads).toEqual([]);
  });

  it('enforces course access: completed learners read only, outsiders are refused', async () => {
    const { service } = fixture();
    const thread = await service.create(an, COURSE, {
      title: 'Q',
      body: 'Body',
    });

    const readOnly = await service.list(done, COURSE);
    expect(readOnly.canPost).toBe(false);
    expect((await service.detail(done, thread.id)).canPost).toBe(false);
    await expect(
      service.reply(done, thread.id, { body: 'Hi' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list(outsider, COURSE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.detail(otherTeacher, thread.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list(admin, COURSE)).resolves.toMatchObject({
      canModerate: true,
    });
    await expect(service.list(an, id(98))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.staffCourses(an)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect((await service.staffCourses(teacher)).map((c) => c.id)).toEqual([
      COURSE,
    ]);
    expect((await service.staffCourses(admin)).map((c) => c.id)).toEqual([
      COURSE,
      OTHER_COURSE,
    ]);
  });

  it('rejects context items from drafts or other courses and invalid input', async () => {
    const { service } = fixture();
    await expect(
      service.create(an, COURSE, {
        title: 'Q',
        body: 'B',
        contextItemId: DRAFT_LESSON,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(an, COURSE, { title: ' ', body: 'B' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(an, COURSE, { title: 'Q', body: 'x'.repeat(5001) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps replies one level deep and notifies the people involved, never the author', async () => {
    const { service, notifications, posts } = fixture();
    const thread = await service.create(an, COURSE, {
      title: 'Q',
      body: 'Question',
    });
    notifications.length = 0;

    const answered = await service.reply(teacher, thread.id, {
      body: 'Answer',
    });
    const answer = answered.posts[1];
    expect(answer.author.role).toBe('INSTRUCTOR');
    expect(notifications).toEqual([
      expect.objectContaining({
        recipientId: an.id,
        notificationType: 'DISCUSSION_REPLY',
        navigationPath: `/courses/${COURSE}?thread=${thread.id}#discussion`,
      }),
    ]);

    notifications.length = 0;
    const replied = await service.reply(binh, thread.id, {
      body: 'Follow-up',
      parentPostId: answer.id,
    });
    const nested = await service.reply(an, thread.id, {
      body: 'Thanks',
      parentPostId: replied.posts[1].replies[0].id,
    });
    expect(posts.at(-1)?.parentPostId).toBe(answer.id);
    expect(nested.posts[1].replies.map((r) => r.body)).toEqual([
      'Follow-up',
      'Thanks',
    ]);
    expect(notifications.map((n) => n.recipientId)).toEqual([
      an.id,
      teacher.id,
      binh.id,
    ]);
    expect(nested.posts[0].replies).toEqual([]);

    await expect(
      service.reply(an, thread.id, { body: 'x', parentPostId: id(97) }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets staff lock threads, which blocks posting and editing, and audits it', async () => {
    const { service, audits } = fixture();
    const thread = await service.create(an, COURSE, {
      title: 'Q',
      body: 'Question',
    });
    const postId = thread.posts[0].id;

    await expect(
      service.lock(an, thread.id, { locked: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.lock(teacher, thread.id, { locked: 'yes' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const locked = await service.lock(teacher, thread.id, { locked: true });
    expect(locked.status).toBe('LOCKED');
    expect(locked.canPost).toBe(false);
    expect(locked.posts[0].canEdit).toBe(false);
    await expect(
      service.reply(binh, thread.id, { body: 'Late' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.edit(an, postId, { body: 'Edit' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.lock(admin, thread.id, { locked: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      (await service.lock(admin, thread.id, { locked: false })).status,
    ).toBe('OPEN');
    expect(audits.map((a) => [a.action, a.actorId])).toEqual([
      ['DISCUSSION_THREAD_LOCKED', teacher.id],
      ['DISCUSSION_THREAD_UNLOCKED', admin.id],
    ]);
  });

  it('lets only the author edit or soft-delete a post', async () => {
    const { service } = fixture();
    const thread = await service.create(an, COURSE, {
      title: 'Q',
      body: 'Question',
    });
    const postId = thread.posts[0].id;

    await expect(
      service.edit(binh, postId, { body: 'Hijack' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(teacher, postId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const edited = await service.edit(an, postId, { body: 'Clearer question' });
    expect(edited.posts[0]).toMatchObject({
      body: 'Clearer question',
      canEdit: true,
    });
    expect(edited.posts[0].editedAt).toBeInstanceOf(Date);

    const removed = await service.remove(an, postId);
    expect(removed.posts[0]).toMatchObject({
      status: 'DELETED',
      body: null,
      canEdit: false,
    });
    await expect(
      service.edit(an, postId, { body: 'Again' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.reply(binh, thread.id, { body: 'Reply', parentPostId: postId }),
    ).rejects.toBeInstanceOf(ConflictException);
    // The thread still accepts new answers after its opening post is deleted.
    const answered = await service.reply(binh, thread.id, { body: 'Answer' });
    expect(answered.posts).toHaveLength(2);
    expect((await service.list(an, COURSE)).threads[0].replyCount).toBe(1);
  });

  it('hides moderated threads and posts from learners but not from staff', async () => {
    const { service, threads, posts } = fixture();
    const thread = await service.create(an, COURSE, {
      title: 'Q',
      body: 'Question',
    });
    await service.reply(binh, thread.id, { body: 'Off-topic' });
    posts[1].status = 'HIDDEN';
    expect((await service.detail(an, thread.id)).posts[1].body).toBeNull();
    expect((await service.detail(teacher, thread.id)).posts[1].body).toBe(
      'Off-topic',
    );

    threads[0].status = 'HIDDEN';
    expect((await service.list(an, COURSE)).threads).toEqual([]);
    await expect(service.detail(an, thread.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect((await service.list(teacher, COURSE)).threads).toHaveLength(1);
  });
});
