import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;
export const DEADLINE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ContentNotice = {
  courseId: string;
  /** Stable id of the announced content; one notice per learner per key. */
  key: string;
  title: string;
  body: string;
  navigationPath: string;
};

const clip = (value: string, max = 240) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

// In-app notifications for course content. Every row carries a dedupeKey, so
// repeated calls (retries, several workers) never notify a learner twice.
@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);
  constructor(private readonly prisma: PrismaService) {}

  // NEW_CONTENT for every ACTIVE learner of a published course.
  async newContent(notice: ContentNotice, db: Db = this.prisma) {
    const course = await db.course.findUnique({
      where: { id: notice.courseId },
      select: { status: true, title: true },
    });
    if (course?.status !== 'PUBLISHED') return 0;
    const learners = await db.enrollment.findMany({
      where: { courseId: notice.courseId, status: 'ACTIVE' },
      select: { learnerId: true },
    });
    if (!learners.length) return 0;
    const created = await db.notification.createMany({
      data: learners.map(({ learnerId }) => ({
        recipientId: learnerId,
        notificationType: 'NEW_CONTENT',
        title: clip(notice.title),
        body: notice.body,
        navigationPath: notice.navigationPath,
        contextSnapshotJson: {
          courseId: notice.courseId,
          courseTitle: course.title,
        },
        dedupeKey: `NEW_CONTENT:${notice.key}:${learnerId}`,
      })),
      skipDuplicates: true,
    });
    return created.count;
  }

  // Content creation must not fail because a notification could not be stored.
  async announce(notice: ContentNotice) {
    try {
      return await this.newContent(notice);
    } catch (error) {
      this.logger.error(
        `NEW_CONTENT notification failed for ${notice.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  // DEADLINE_SOON once per learner and assignment version that is due within
  // the window, for ACTIVE learners who have not submitted an attempt yet.
  async deadlineSoon(now = new Date(), windowMs = DEADLINE_WINDOW_MS) {
    const versions = await this.prisma.assignmentVersion.findMany({
      where: {
        dueAt: { gt: now, lte: new Date(now.getTime() + windowMs) },
        publishedAt: { lte: now },
        OR: [{ opensAt: null }, { opensAt: { lte: now } }],
        assignment: { course: { status: 'PUBLISHED' } },
      },
      select: {
        id: true,
        assignmentId: true,
        versionNo: true,
        dueAt: true,
        assignment: {
          select: { courseId: true, activityId: true, title: true },
        },
      },
      take: 500,
    });
    let count = 0;
    for (const version of versions) {
      // Only the current published version of an assignment is announced.
      const latest = await this.prisma.assignmentVersion.findFirst({
        where: {
          assignmentId: version.assignmentId,
          publishedAt: { lte: now },
        },
        orderBy: { versionNo: 'desc' },
        select: { id: true },
      });
      if (latest?.id !== version.id) continue;
      const { courseId, activityId, title } = version.assignment;
      const learners = await this.prisma.enrollment.findMany({
        where: { courseId, status: 'ACTIVE' },
        select: { learnerId: true },
      });
      if (!learners.length) continue;
      const submitted = await this.prisma.attempt.findMany({
        where: {
          assignmentId: version.assignmentId,
          learnerId: { in: learners.map((row) => row.learnerId) },
          status: { in: ['SUBMITTED', 'FINISHED'] },
        },
        select: { learnerId: true },
      });
      const done = new Set(submitted.map((row) => row.learnerId));
      const due = version.dueAt!.toISOString();
      const created = await this.prisma.notification.createMany({
        data: learners
          .filter(({ learnerId }) => !done.has(learnerId))
          .map(({ learnerId }) => ({
            recipientId: learnerId,
            notificationType: 'DEADLINE_SOON',
            title: clip(`Due soon: ${title}`),
            body: `"${title}" is due within 24 hours (${due}).`,
            navigationPath: `/courses/${courseId}/practices/${activityId}`,
            contextSnapshotJson: {
              courseId,
              assignmentId: version.assignmentId,
              dueAt: due,
            },
            dedupeKey: `DEADLINE_SOON:${version.id}:${learnerId}`,
          })),
        skipDuplicates: true,
      });
      count += created.count;
    }
    return count;
  }
}
