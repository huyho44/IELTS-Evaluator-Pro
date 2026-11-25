import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import type { Actor } from '../auth/auth.service.js';
import { object, text, uuid } from '../auth/validation.js';

export const TITLE_MAX = 240;
export const BODY_MAX = 5000;
const THREAD_LIMIT = 100;
const POST_LIMIT = 500;

type Access = { courseId: string; staff: boolean; canWrite: boolean };
type PostRow = {
  id: string;
  parentPostId: string | null;
  authorId: string;
  body: string;
  status: string;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; displayName: string };
};
type Tx = Prisma.TransactionClient;

const snippet = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

// Course discussion and lesson Q&A.
// Learners with an ACTIVE enrollment read and write; COMPLETED learners read.
// Assigned instructors and admins read, write and lock threads.
// Replies are one level deep: a reply to a reply is attached to its top-level post.
@Injectable()
export class DiscussionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async access(actor: Actor, courseId: string): Promise<Access> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (actor.roles.includes('ADMIN'))
      return { courseId, staff: true, canWrite: true };
    if (actor.roles.includes('INSTRUCTOR')) {
      const assignment = await this.prisma.courseInstructor.findUnique({
        where: { courseId_instructorId: { courseId, instructorId: actor.id } },
      });
      if (assignment) return { courseId, staff: true, canWrite: true };
    }
    if (actor.roles.includes('LEARNER')) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { learnerId_courseId: { learnerId: actor.id, courseId } },
        select: { status: true },
      });
      if (enrollment?.status === 'ACTIVE')
        return { courseId, staff: false, canWrite: true };
      if (enrollment?.status === 'COMPLETED')
        return { courseId, staff: false, canWrite: false };
    }
    throw new ForbiddenException(
      'Course enrollment or instructor assignment required',
    );
  }

  private writable(access: Access) {
    if (!access.canWrite)
      throw new ForbiddenException(
        'Completed enrollments can read but not post in the discussion',
      );
  }

  // Thread with its course access; hidden threads are visible to staff only.
  private async thread(actor: Actor, threadId: string) {
    const thread = await this.prisma.discussionThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        courseId: true,
        title: true,
        status: true,
        creatorId: true,
        createdAt: true,
        contextItem: { select: { id: true, title: true, kind: true } },
        creator: { select: { id: true, displayName: true } },
      },
    });
    if (!thread) throw new NotFoundException('Discussion thread not found');
    const access = await this.access(actor, thread.courseId);
    if (thread.status === 'HIDDEN' && !access.staff)
      throw new NotFoundException('Discussion thread not found');
    return { thread, access };
  }

  private async contextItem(courseId: string, value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const id = uuid(value, 'contextItemId');
    const item = await this.prisma.learningItem.findFirst({
      where: { id, courseId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!item)
      throw new BadRequestException(
        'contextItemId must be a published item of this course',
      );
    return item.id;
  }

  private async instructorIds(courseId: string) {
    const rows = await this.prisma.courseInstructor.findMany({
      where: { courseId },
      select: { instructorId: true },
    });
    return new Set(rows.map((row) => row.instructorId));
  }

  // Deep link per recipient workspace. It only routes; access is rechecked.
  private async notify(
    tx: Tx,
    courseId: string,
    threadId: string,
    recipients: string[],
    message: { type: string; title: string; body: string },
  ) {
    const ids = [...new Set(recipients)];
    if (!ids.length) return;
    const [instructors, enrollments, users] = [
      await this.instructorIds(courseId),
      await tx.enrollment.findMany({
        where: { courseId, learnerId: { in: ids } },
        select: { learnerId: true },
      }),
      await tx.user.findMany({
        where: { id: { in: ids }, status: 'ACTIVE' },
        select: {
          id: true,
          userRoles: { select: { role: { select: { code: true } } } },
        },
      }),
    ];
    const learners = new Set(enrollments.map((row) => row.learnerId));
    const query = `course=${courseId}&thread=${threadId}`;
    await tx.notification.createMany({
      data: users.map((user) => {
        const roles = user.userRoles.map((row) => row.role.code);
        const navigationPath = instructors.has(user.id)
          ? `/teacher/discussions?${query}`
          : learners.has(user.id) || !roles.includes('ADMIN')
            ? `/courses/${courseId}?thread=${threadId}#discussion`
            : `/admin/discussions?${query}`;
        return {
          recipientId: user.id,
          notificationType: message.type,
          title: snippet(message.title, 240),
          body: message.body,
          navigationPath,
          contextSnapshotJson: { courseId, threadId },
        };
      }),
    });
  }

  // GET discussions/courses: courses an instructor or admin can moderate.
  async staffCourses(actor: Actor) {
    const admin = actor.roles.includes('ADMIN');
    if (!admin && !actor.roles.includes('INSTRUCTOR'))
      throw new ForbiddenException('INSTRUCTOR or ADMIN role required');
    const courses = await this.prisma.course.findMany({
      where: admin
        ? {}
        : { courseInstructors: { some: { instructorId: actor.id } } },
      select: {
        id: true,
        title: true,
        status: true,
        _count: {
          select: { discussionThreads: { where: { status: 'OPEN' } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    return courses.map(({ _count, ...course }) => ({
      ...course,
      openThreads: _count.discussionThreads,
    }));
  }

  // GET courses/:id/threads?contextItemId=
  async list(actor: Actor, courseId: string, contextItemId?: string) {
    const access = await this.access(actor, courseId);
    const itemId = contextItemId ? uuid(contextItemId, 'contextItemId') : null;
    const threads = await this.prisma.discussionThread.findMany({
      where: {
        courseId,
        ...(itemId ? { contextItemId: itemId } : {}),
        ...(access.staff ? {} : { status: { not: 'HIDDEN' } }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        contextItem: { select: { id: true, title: true, kind: true } },
        creator: { select: { id: true, displayName: true } },
        discussionPosts: {
          where: { status: 'VISIBLE' },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { discussionPosts: { where: { status: 'VISIBLE' } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: THREAD_LIMIT,
    });
    // The opening post (first top-level post) is not counted as a reply.
    const openings = threads.length
      ? await this.prisma.discussionPost.findMany({
          where: {
            threadId: { in: threads.map((thread) => thread.id) },
            parentPostId: null,
          },
          distinct: ['threadId'],
          orderBy: [{ threadId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: { threadId: true, status: true },
        })
      : [];
    const openingVisible = new Set(
      openings
        .filter((post) => post.status === 'VISIBLE')
        .map((post) => post.threadId),
    );
    return {
      courseId,
      canPost: access.canWrite,
      canModerate: access.staff,
      threads: threads.map(({ discussionPosts, _count, ...thread }) => ({
        ...thread,
        replyCount:
          _count.discussionPosts - (openingVisible.has(thread.id) ? 1 : 0),
        lastActivityAt: discussionPosts[0]?.createdAt ?? thread.createdAt,
      })),
    };
  }

  // POST courses/:id/threads { title, body, contextItemId? }
  async create(actor: Actor, courseId: string, input: unknown) {
    const access = await this.access(actor, courseId);
    this.writable(access);
    const body = object(input);
    const title = text(body.title, 'title', TITLE_MAX);
    const content = text(body.body, 'body', BODY_MAX);
    const contextItemId = await this.contextItem(courseId, body.contextItemId);
    const instructors = access.staff
      ? []
      : [...(await this.instructorIds(courseId))];
    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.discussionThread.create({
        data: { courseId, contextItemId, creatorId: actor.id, title },
        select: { id: true },
      });
      await tx.discussionPost.create({
        data: { threadId: created.id, authorId: actor.id, body: content },
      });
      await this.notify(tx, courseId, created.id, instructors, {
        type: 'DISCUSSION_THREAD',
        title: `New question: ${title}`,
        body: `${actor.displayName} asked: ${snippet(content, 160)}`,
      });
      return created;
    });
    return this.detail(actor, thread.id);
  }

  // GET threads/:id
  async detail(actor: Actor, threadId: string) {
    const { thread, access } = await this.thread(actor, threadId);
    const [rows, instructors] = [
      (await this.prisma.discussionPost.findMany({
        where: { threadId },
        select: {
          id: true,
          parentPostId: true,
          authorId: true,
          body: true,
          status: true,
          createdAt: true,
          editedAt: true,
          author: { select: { id: true, displayName: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: POST_LIMIT,
      })) as PostRow[],
      await this.instructorIds(thread.courseId),
    ];
    const open = thread.status === 'OPEN';
    const view = (post: PostRow) => {
      const mine = post.authorId === actor.id;
      const readable =
        post.status === 'VISIBLE' || (post.status === 'HIDDEN' && access.staff);
      return {
        id: post.id,
        parentPostId: post.parentPostId,
        author: {
          ...post.author,
          role: instructors.has(post.authorId) ? 'INSTRUCTOR' : null,
        },
        body: readable ? post.body : null,
        status: post.status,
        createdAt: post.createdAt,
        editedAt: post.editedAt,
        mine,
        canEdit: mine && open && access.canWrite && post.status === 'VISIBLE',
        canDelete: mine && post.status === 'VISIBLE',
      };
    };
    const top = rows.filter((post) => !post.parentPostId);
    return {
      ...thread,
      canPost: open && access.canWrite,
      canModerate: access.staff,
      posts: top.map((post) => ({
        ...view(post),
        replies: rows
          .filter((reply) => reply.parentPostId === post.id)
          .map(view),
      })),
    };
  }

  // POST threads/:id/posts { body, parentPostId? }
  async reply(actor: Actor, threadId: string, input: unknown) {
    const { thread, access } = await this.thread(actor, threadId);
    this.writable(access);
    const body = object(input);
    const content = text(body.body, 'body', BODY_MAX);
    const parentId =
      body.parentPostId === undefined || body.parentPostId === null
        ? null
        : uuid(body.parentPostId, 'parentPostId');
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.discussionThread.findUnique({
        where: { id: threadId },
        select: { status: true },
      });
      if (current?.status !== 'OPEN')
        throw new ConflictException('This thread is locked');
      let parent: { id: string; authorId: string } | null = null;
      if (parentId) {
        const found = await tx.discussionPost.findFirst({
          where: { id: parentId, threadId },
          select: { id: true, authorId: true, parentPostId: true },
        });
        if (!found) throw new NotFoundException('Parent post not found');
        // Keep replies one level deep.
        const rootId = found.parentPostId ?? found.id;
        parent = await tx.discussionPost.findFirst({
          where: { id: rootId, threadId, status: 'VISIBLE' },
          select: { id: true, authorId: true },
        });
        if (!parent)
          throw new ConflictException('The post you replied to is unavailable');
        if (found.parentPostId)
          parent = { id: rootId, authorId: found.authorId };
      }
      await tx.discussionPost.create({
        data: {
          threadId,
          authorId: actor.id,
          parentPostId: parent?.id ?? null,
          body: content,
        },
      });
      const recipients = [thread.creatorId, parent?.authorId].filter(
        (id): id is string => Boolean(id) && id !== actor.id,
      );
      await this.notify(tx, thread.courseId, threadId, recipients, {
        type: 'DISCUSSION_REPLY',
        title: `New reply: ${thread.title}`,
        body: `${actor.displayName} replied: ${snippet(content, 160)}`,
      });
    });
    return this.detail(actor, threadId);
  }

  private async ownPost(actor: Actor, postId: string) {
    const post = await this.prisma.discussionPost.findUnique({
      where: { id: postId },
      select: { id: true, threadId: true, authorId: true, status: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    const { thread, access } = await this.thread(actor, post.threadId);
    if (post.authorId !== actor.id)
      throw new ForbiddenException('Only the author can change this post');
    if (post.status !== 'VISIBLE')
      throw new ConflictException('This post can no longer be changed');
    return { post, thread, access };
  }

  // PATCH posts/:id { body }
  async edit(actor: Actor, postId: string, input: unknown) {
    const { post, thread, access } = await this.ownPost(actor, postId);
    this.writable(access);
    if (thread.status !== 'OPEN')
      throw new ConflictException('This thread is locked');
    const content = text(object(input).body, 'body', BODY_MAX);
    const updated = await this.prisma.discussionPost.updateMany({
      where: { id: post.id, authorId: actor.id, status: 'VISIBLE' },
      data: { body: content, editedAt: new Date() },
    });
    if (updated.count !== 1)
      throw new ConflictException('This post can no longer be changed');
    return this.detail(actor, thread.id);
  }

  // DELETE posts/:id (soft delete by the author)
  async remove(actor: Actor, postId: string) {
    const { post, thread } = await this.ownPost(actor, postId);
    const updated = await this.prisma.discussionPost.updateMany({
      where: { id: post.id, authorId: actor.id, status: 'VISIBLE' },
      data: { status: 'DELETED' },
    });
    if (updated.count !== 1)
      throw new ConflictException('This post can no longer be changed');
    return this.detail(actor, thread.id);
  }

  // POST threads/:id/lock { locked }
  async lock(actor: Actor, threadId: string, input: unknown) {
    const { thread, access } = await this.thread(actor, threadId);
    if (!access.staff)
      throw new ForbiddenException(
        'Only course instructors and admins can lock threads',
      );
    const locked = object(input).locked;
    if (typeof locked !== 'boolean')
      throw new BadRequestException('locked must be a boolean');
    const from = locked ? 'OPEN' : 'LOCKED';
    const to = locked ? 'LOCKED' : 'OPEN';
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.discussionThread.updateMany({
        where: { id: threadId, status: from },
        data: { status: to },
      });
      if (updated.count !== 1)
        throw new ConflictException(`This thread is not ${from.toLowerCase()}`);
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: locked
            ? 'DISCUSSION_THREAD_LOCKED'
            : 'DISCUSSION_THREAD_UNLOCKED',
          entityType: 'DiscussionThread',
          entityKey: threadId,
          afterJson: { courseId: thread.courseId, status: to },
        },
      });
    });
    return this.detail(actor, threadId);
  }
}
