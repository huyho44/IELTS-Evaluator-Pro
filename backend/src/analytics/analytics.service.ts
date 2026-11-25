import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import type { Actor } from '../auth/auth.service.js';
import { date, uuid } from '../auth/validation.js';

export const ACTIVE_WINDOW_DAYS = 7;
const AUDIT_PAGE = 50;

type Counter = Map<string, number>;
const bump = (map: Counter, key: string, by = 1) =>
  map.set(key, (map.get(key) ?? 0) + by);
const round = (value: number, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

export type AuditQuery = {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityKey?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: string;
};

// Course analytics (admins: every course; instructors: assigned courses) and
// the admin audit log (A7).
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async scope(actor: Actor, courseId?: string) {
    const admin = actor.roles.includes('ADMIN');
    if (!admin && !actor.roles.includes('INSTRUCTOR'))
      throw new ForbiddenException('INSTRUCTOR or ADMIN role required');
    const where: Prisma.CourseWhereInput = {
      ...(courseId ? { id: uuid(courseId, 'courseId') } : {}),
      ...(admin
        ? {}
        : { courseInstructors: { some: { instructorId: actor.id } } }),
    };
    return this.prisma.course.findMany({
      where,
      select: { id: true, title: true, status: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
  }

  // GET admin/analytics?courseId=
  async analytics(actor: Actor, courseId?: string, now = new Date()) {
    const courses = await this.scope(actor, courseId);
    const ids = courses.map((course) => course.id);
    const since = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86400000);
    const byCourse = { assignment: { courseId: { in: ids } } };

    const enrollments = await this.prisma.enrollment.groupBy({
      by: ['courseId', 'status'],
      where: { courseId: { in: ids } },
      _count: { _all: true },
    });
    const lessonActivity = await this.prisma.lessonProgress.findMany({
      where: {
        lastAccessedAt: { gte: since },
        enrollment: { courseId: { in: ids } },
      },
      select: { enrollment: { select: { courseId: true, learnerId: true } } },
    });
    const attemptActivity = await this.prisma.attempt.findMany({
      where: { startedAt: { gte: since }, assignmentVersion: byCourse },
      select: {
        learnerId: true,
        assignmentVersion: {
          select: { assignment: { select: { courseId: true } } },
        },
      },
    });
    const revisions = await this.prisma.submissionRevision.findMany({
      where: { attempt: { assignmentVersion: byCourse } },
      select: {
        attempt: {
          select: {
            assignmentVersion: {
              select: { assignment: { select: { courseId: true } } },
            },
          },
        },
      },
    });
    const official = await this.prisma.acceptedAssessment.findMany({
      where: {
        isCurrent: true,
        publishedAt: { lte: now },
        result: {
          scoreScale: 'BAND',
          revision: { attempt: { assignmentVersion: byCourse } },
        },
      },
      select: {
        result: {
          select: {
            overallScore: true,
            revision: {
              select: {
                attempt: {
                  select: {
                    assignmentVersion: {
                      select: { assignment: { select: { courseId: true } } },
                    },
                  },
                },
              },
            },
            criterionScores: {
              select: {
                score: true,
                criterion: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });
    const reviews = await this.prisma.reviewCase.findMany({
      where: {
        status: { in: ['PENDING', 'CLAIMED'] },
        revision: { attempt: { assignmentVersion: byCourse } },
      },
      select: {
        status: true,
        revision: {
          select: {
            attempt: {
              select: {
                assignmentVersion: {
                  select: { assignment: { select: { courseId: true } } },
                },
              },
            },
          },
        },
      },
    });

    const enrollmentCount = new Map<string, Record<string, number>>();
    for (const row of enrollments) {
      const counts = enrollmentCount.get(row.courseId) ?? {};
      counts[row.status] = row._count._all;
      enrollmentCount.set(row.courseId, counts);
    }
    const active = new Map<string, Set<string>>();
    const markActive = (course: string, learner: string) =>
      active.set(course, (active.get(course) ?? new Set()).add(learner));
    for (const { enrollment } of lessonActivity)
      markActive(enrollment.courseId, enrollment.learnerId);
    for (const attempt of attemptActivity)
      markActive(
        attempt.assignmentVersion.assignment.courseId,
        attempt.learnerId,
      );
    const submissions: Counter = new Map();
    for (const revision of revisions)
      bump(submissions, revision.attempt.assignmentVersion.assignment.courseId);
    const pending: Counter = new Map();
    const claimed: Counter = new Map();
    for (const review of reviews)
      bump(
        review.status === 'PENDING' ? pending : claimed,
        review.revision.attempt.assignmentVersion.assignment.courseId,
      );
    const bands = new Map<
      string,
      {
        overall: number[];
        criteria: Map<string, { name: string; scores: number[] }>;
      }
    >();
    for (const row of official) {
      const course =
        row.result.revision.attempt.assignmentVersion.assignment.courseId;
      const entry = bands.get(course) ?? {
        overall: [] as number[],
        criteria: new Map<string, { name: string; scores: number[] }>(),
      };
      if (row.result.overallScore !== null)
        entry.overall.push(Number(row.result.overallScore));
      for (const score of row.result.criterionScores) {
        const criterion = entry.criteria.get(score.criterion.code) ?? {
          name: score.criterion.name,
          scores: [],
        };
        criterion.scores.push(Number(score.score));
        entry.criteria.set(score.criterion.code, criterion);
      }
      bands.set(course, entry);
    }
    const average = (values: number[]) =>
      values.length
        ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : null;

    const rows = courses.map((course) => {
      const counts = enrollmentCount.get(course.id) ?? {};
      const activeCount = counts.ACTIVE ?? 0;
      const completed = counts.COMPLETED ?? 0;
      const band = bands.get(course.id);
      return {
        ...course,
        enrollments: {
          active: activeCount,
          completed,
          left: counts.LEFT ?? 0,
          total: Object.values(counts).reduce((sum, value) => sum + value, 0),
        },
        // Share of current (active + completed) learners who completed.
        completionRate:
          activeCount + completed
            ? round(completed / (activeCount + completed), 4)
            : null,
        activeLearners: active.get(course.id)?.size ?? 0,
        submissions: submissions.get(course.id) ?? 0,
        officialResults: band?.overall.length ?? 0,
        averageBand: band ? average(band.overall) : null,
        criteria: band
          ? [...band.criteria.entries()]
              .map(([code, value]) => ({
                code,
                name: value.name,
                average: average(value.scores),
                count: value.scores.length,
              }))
              .sort((a, b) => a.code.localeCompare(b.code))
          : [],
        reviewBacklog: {
          pending: pending.get(course.id) ?? 0,
          claimed: claimed.get(course.id) ?? 0,
        },
      };
    });
    const sum = (pick: (row: (typeof rows)[number]) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);
    return {
      generatedAt: now,
      activeWindowDays: ACTIVE_WINDOW_DAYS,
      totals: {
        courses: rows.length,
        activeEnrollments: sum((row) => row.enrollments.active),
        completedEnrollments: sum((row) => row.enrollments.completed),
        activeLearners: new Set(
          [...active.values()].flatMap((learners) => [...learners]),
        ).size,
        submissions: sum((row) => row.submissions),
        reviewBacklog: sum(
          (row) => row.reviewBacklog.pending + row.reviewBacklog.claimed,
        ),
      },
      courses: rows,
    };
  }

  // GET admin/audit-events (admin only), newest first with cursor paging.
  async auditEvents(actor: Actor, query: AuditQuery) {
    if (!actor.roles.includes('ADMIN'))
      throw new ForbiddenException('ADMIN role required');
    const limit = query.limit ? Number(query.limit) : AUDIT_PAGE;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200)
      throw new BadRequestException('limit must be an integer from 1 to 200');
    const textFilter = (value: string | undefined, field: string) => {
      if (value === undefined || value === '') return undefined;
      if (value.length > 100)
        throw new BadRequestException(`${field} is too long`);
      return value.trim();
    };
    const from = query.from ? date(query.from, 'from') : undefined;
    const to = query.to ? date(query.to, 'to') : undefined;
    if (from && to && from > to)
      throw new BadRequestException('from must be before to');
    const where: Prisma.AuditEventWhereInput = {
      ...(query.actorId ? { actorId: uuid(query.actorId, 'actorId') } : {}),
      ...(textFilter(query.action, 'action')
        ? { action: textFilter(query.action, 'action')!.toUpperCase() }
        : {}),
      ...(textFilter(query.entityType, 'entityType')
        ? { entityType: textFilter(query.entityType, 'entityType') }
        : {}),
      ...(textFilter(query.entityKey, 'entityKey')
        ? { entityKey: textFilter(query.entityKey, 'entityKey') }
        : {}),
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
    const cursor = query.cursor ? uuid(query.cursor, 'cursor') : undefined;
    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        actor: { select: { id: true, displayName: true, email: true } },
      },
    });
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? items[items.length - 1].id : null,
    };
  }
}
