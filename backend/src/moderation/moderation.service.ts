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
import { DiscussionsService } from '../discussions/discussions.service.js';

export const TARGET_TYPES = ['POST', 'LEARNING_ITEM', 'COURSE'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];
const STATUSES = ['PENDING', 'RESOLVED', 'DISMISSED'] as const;
type Tx = Prisma.TransactionClient;
type Target = { type: TargetType; id: string; courseId: string };

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const reportInclude = {
  reporter: { select: { id: true, displayName: true } },
  resolver: { select: { id: true, displayName: true } },
  course: { select: { id: true, title: true, status: true } },
  learningItem: {
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      course: { select: { id: true, title: true } },
    },
  },
  post: {
    select: {
      id: true,
      body: true,
      status: true,
      author: { select: { id: true, displayName: true } },
      thread: {
        select: {
          id: true,
          title: true,
          course: { select: { id: true, title: true } },
        },
      },
    },
  },
} satisfies Prisma.ModerationReportInclude;
type ReportRow = Prisma.ModerationReportGetPayload<{
  include: typeof reportInclude;
}>;

// Content reports (A3). Anyone who can see the content may report it.
// Admins handle every report; instructors handle reports in their courses.
// Resolving a post report hides the post; for lessons/practices and courses
// the moderator chooses to hide the content or only record the decision.
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discussions: DiscussionsService,
  ) {}

  private targetOf(row: {
    postId: string | null;
    learningItemId: string | null;
    courseId: string | null;
  }) {
    if (row.postId) return { type: 'POST' as const, id: row.postId };
    if (row.learningItemId)
      return { type: 'LEARNING_ITEM' as const, id: row.learningItemId };
    return { type: 'COURSE' as const, id: row.courseId! };
  }

  // Resolves the target and checks that the reporter can see it.
  private async target(
    actor: Actor,
    type: TargetType,
    id: string,
  ): Promise<Target> {
    if (type === 'POST') {
      const post = await this.prisma.discussionPost.findUnique({
        where: { id },
        select: {
          authorId: true,
          status: true,
          thread: { select: { courseId: true, status: true } },
        },
      });
      if (!post || post.status !== 'VISIBLE')
        throw new NotFoundException('Post not found');
      const access = await this.discussions.access(actor, post.thread.courseId);
      if (post.thread.status === 'HIDDEN' && !access.staff)
        throw new NotFoundException('Post not found');
      if (post.authorId === actor.id)
        throw new BadRequestException('You cannot report your own post');
      return { type, id, courseId: post.thread.courseId };
    }
    if (type === 'LEARNING_ITEM') {
      const item = await this.prisma.learningItem.findUnique({
        where: { id },
        select: { courseId: true, status: true },
      });
      if (!item || item.status !== 'PUBLISHED')
        throw new NotFoundException('Learning item not found');
      await this.discussions.access(actor, item.courseId);
      return { type, id, courseId: item.courseId };
    }
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!course || course.status !== 'PUBLISHED')
      throw new NotFoundException('Course not found');
    return { type, id, courseId: id };
  }

  private targetWhere(target: { type: TargetType; id: string }) {
    return target.type === 'POST'
      ? { postId: target.id }
      : target.type === 'LEARNING_ITEM'
        ? { learningItemId: target.id }
        : { courseId: target.id };
  }

  private async notify(
    tx: Tx,
    recipients: string[],
    data: { type: string; title: string; body: string; path: string | null },
  ) {
    const ids = [...new Set(recipients)];
    if (!ids.length) return;
    await tx.notification.createMany({
      data: ids.map((recipientId) => ({
        recipientId,
        notificationType: data.type,
        title: clip(data.title, 240),
        body: data.body,
        navigationPath: data.path,
      })),
    });
  }

  // POST moderation/reports { targetType, targetId, reason }
  async report(actor: Actor, input: unknown) {
    const dto = object(input);
    if (!TARGET_TYPES.includes(dto.targetType as TargetType))
      throw new BadRequestException(
        `targetType must be one of ${TARGET_TYPES.join(', ')}`,
      );
    const type = dto.targetType as TargetType;
    const targetId = uuid(dto.targetId, 'targetId');
    const reason = text(dto.reason, 'reason', 2000);
    const target = await this.target(actor, type, targetId);
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.moderationReport.findFirst({
        where: {
          reporterId: actor.id,
          status: 'PENDING',
          ...this.targetWhere(target),
        },
        select: { id: true },
      });
      if (duplicate)
        throw new ConflictException('You have already reported this content');
      const report = await tx.moderationReport.create({
        data: { reporterId: actor.id, reason, ...this.targetWhere(target) },
        select: { id: true, status: true, createdAt: true },
      });
      // Course reports go to admins; other reports to the course instructors.
      const recipients =
        type === 'COURSE'
          ? await tx.user.findMany({
              where: {
                status: 'ACTIVE',
                userRoles: { some: { role: { code: 'ADMIN' } } },
              },
              select: { id: true },
            })
          : (
              await tx.courseInstructor.findMany({
                where: { courseId: target.courseId },
                select: { instructorId: true },
              })
            ).map((row) => ({ id: row.instructorId }));
      await this.notify(
        tx,
        recipients.map((row) => row.id).filter((id) => id !== actor.id),
        {
          type: 'MODERATION_REPORT',
          title: 'New content report',
          body: `A ${type === 'POST' ? 'discussion post' : type === 'COURSE' ? 'course' : 'lesson or practice'} was reported: ${clip(reason, 160)}`,
          path: type === 'COURSE' ? '/admin/moderation' : '/teacher/moderation',
        },
      );
      return report;
    });
  }

  private async staffScope(actor: Actor) {
    if (actor.roles.includes('ADMIN')) return null;
    if (!actor.roles.includes('INSTRUCTOR'))
      throw new ForbiddenException('INSTRUCTOR or ADMIN role required');
    const rows = await this.prisma.courseInstructor.findMany({
      where: { instructorId: actor.id },
      select: { courseId: true },
    });
    return rows.map((row) => row.courseId);
  }

  private scopeWhere(courseIds: string[]): Prisma.ModerationReportWhereInput {
    return {
      OR: [
        { courseId: { in: courseIds } },
        { learningItem: { courseId: { in: courseIds } } },
        { post: { thread: { courseId: { in: courseIds } } } },
      ],
    };
  }

  private view(row: ReportRow) {
    const target = this.targetOf(row);
    const course =
      row.course ?? row.learningItem?.course ?? row.post?.thread.course;
    return {
      id: row.id,
      status: row.status,
      reason: row.reason,
      resolution: row.resolution,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      reporter: row.reporter,
      resolver: row.resolver,
      target: {
        ...target,
        courseId: course?.id ?? null,
        courseTitle: course?.title ?? null,
        title:
          row.post?.thread.title ??
          row.learningItem?.title ??
          row.course?.title ??
          null,
        kind: row.learningItem?.kind ?? null,
        excerpt: row.post ? clip(row.post.body, 300) : null,
        author: row.post?.author ?? null,
        threadId: row.post?.thread.id ?? null,
        contentStatus:
          row.post?.status ?? row.learningItem?.status ?? row.course?.status,
      },
    };
  }

  // GET moderation/reports?status=PENDING|RESOLVED|DISMISSED|ALL
  async list(actor: Actor, status = 'PENDING') {
    const scope = await this.staffScope(actor);
    if (status !== 'ALL' && !STATUSES.includes(status as never))
      throw new BadRequestException('Invalid status filter');
    const rows = await this.prisma.moderationReport.findMany({
      where: {
        ...(status === 'ALL'
          ? {}
          : { status: status as (typeof STATUSES)[number] }),
        ...(scope ? this.scopeWhere(scope) : {}),
      },
      include: reportInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    return rows.map((row) => this.view(row));
  }

  private async pending(actor: Actor, id: string) {
    const scope = await this.staffScope(actor);
    const row = await this.prisma.moderationReport.findFirst({
      where: { id, ...(scope ? this.scopeWhere(scope) : {}) },
      include: reportInclude,
    });
    if (!row) throw new NotFoundException('Report not found');
    if (row.status !== 'PENDING')
      throw new ConflictException('This report has already been handled');
    return row;
  }

  // POST moderation/reports/:id/resolve { resolution, hideContent? }
  async resolve(actor: Actor, id: string, input: unknown) {
    const dto = object(input);
    const resolution = text(dto.resolution, 'resolution', 2000);
    if (dto.hideContent !== undefined && typeof dto.hideContent !== 'boolean')
      throw new BadRequestException('hideContent must be a boolean');
    const row = await this.pending(actor, id);
    const target = this.targetOf(row);
    // Reported posts are always hidden when a report is upheld.
    const hide = target.type === 'POST' || dto.hideContent === true;
    await this.prisma.$transaction(async (tx) => {
      let hidden = false;
      if (hide) {
        const changed =
          target.type === 'POST'
            ? await tx.discussionPost.updateMany({
                where: { id: target.id, status: 'VISIBLE' },
                data: { status: 'HIDDEN' },
              })
            : target.type === 'LEARNING_ITEM'
              ? await tx.learningItem.updateMany({
                  where: { id: target.id, status: 'PUBLISHED' },
                  data: { status: 'HIDDEN' },
                })
              : await tx.course.updateMany({
                  where: { id: target.id, status: 'PUBLISHED' },
                  data: { status: 'HIDDEN' },
                });
        hidden = changed.count > 0;
      }
      // Every pending report on the same content is closed by this decision.
      const handled = await tx.moderationReport.findMany({
        where: { status: 'PENDING', ...this.targetWhere(target) },
        select: { id: true, reporterId: true },
      });
      if (!handled.some((report) => report.id === id))
        throw new ConflictException('This report has already been handled');
      await tx.moderationReport.updateMany({
        where: { id: { in: handled.map((report) => report.id) } },
        data: {
          status: 'RESOLVED',
          resolverId: actor.id,
          resolution,
          resolvedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'MODERATION_REPORT_RESOLVED',
          entityType: 'ModerationReport',
          entityKey: id,
          afterJson: {
            target,
            hidden,
            resolution,
            reportIds: handled.map((report) => report.id),
          },
        },
      });
      await this.notify(
        tx,
        handled.map((report) => report.reporterId),
        {
          type: 'MODERATION_UPDATE',
          title: 'Your report was reviewed',
          body: `Action taken: ${clip(resolution, 200)}`,
          path: null,
        },
      );
    });
    return this.view(
      (await this.prisma.moderationReport.findUnique({
        where: { id },
        include: reportInclude,
      }))!,
    );
  }

  // POST moderation/reports/:id/dismiss { resolution }
  async dismiss(actor: Actor, id: string, input: unknown) {
    const resolution = text(object(input).resolution, 'resolution', 2000);
    const row = await this.pending(actor, id);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.moderationReport.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'DISMISSED',
          resolverId: actor.id,
          resolution,
          resolvedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('This report has already been handled');
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'MODERATION_REPORT_DISMISSED',
          entityType: 'ModerationReport',
          entityKey: id,
          afterJson: { target: this.targetOf(row), resolution },
        },
      });
      await this.notify(tx, [row.reporterId], {
        type: 'MODERATION_UPDATE',
        title: 'Your report was reviewed',
        body: `No action was needed: ${clip(resolution, 200)}`,
        path: null,
      });
    });
    return this.view(
      (await this.prisma.moderationReport.findUnique({
        where: { id },
        include: reportInclude,
      }))!,
    );
  }
}
