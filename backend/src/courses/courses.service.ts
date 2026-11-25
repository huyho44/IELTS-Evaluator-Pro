import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import { object, text, uuid } from '../auth/validation.js';
import { assertAcyclic } from '../management/management.service.js';
import { visibleItemWhere } from './visibility.js';

const itemPath = (courseId: string, id: string, kind: string) =>
  `/courses/${courseId}/${kind === 'LESSON' ? 'lessons' : 'practices'}/${id}`;

@Injectable()
export class CoursesService {
  // Inject required services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}
  // List published courses.
  findAll() {
    return this.prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        enrollmentOpen: true,
        createdAt: true,
        completionPolicyJson: true,
        creator: { select: { id: true, displayName: true } },
        _count: {
          select: {
            learningItems: { where: visibleItemWhere },
            enrollments: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
  }
  // Get course details.
  async findOne(id: string, actor?: Actor) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, displayName: true } },
        courseInstructors: {
          select: {
            responsibility: true,
            instructor: { select: { id: true, displayName: true } },
          },
          orderBy: [{ responsibility: 'asc' }, { instructorId: 'asc' }],
        },
        prerequisites: {
          select: {
            prerequisiteCourse: { select: { id: true, title: true } },
          },
        },
        chapters: {
          where: { status: 'PUBLISHED' },
          orderBy: { position: 'asc' },
        },
        learningItems: {
          where: visibleItemWhere,
          select: {
            id: true,
            chapterId: true,
            title: true,
            kind: true,
            position: true,
            lesson: { select: { summary: true } },
            practiceActivity: {
              select: { skillArea: true, responseMode: true },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    const enrolled = actor
      ? await this.prisma.enrollment.findUnique({
          where: { learnerId_courseId: { learnerId: actor.id, courseId: id } },
        })
      : null;
    if (course.status !== 'PUBLISHED') {
      if (!actor) throw new NotFoundException('Course not found');
      if (
        !enrolled ||
        !['ACTIVE', 'COMPLETED'].includes(enrolled.status) ||
        course.status === 'DRAFT'
      )
        await this.access.instructor(actor, id);
    }
    const {
      chapters,
      learningItems,
      courseInstructors,
      prerequisites,
      ...details
    } = course;
    const completedPrerequisites =
      actor && prerequisites.length
        ? await this.completedCourses(
            actor.id,
            prerequisites.map((row) => row.prerequisiteCourse.id),
          )
        : new Set<string>();
    const lessonIds = learningItems
      .filter((item) => item.kind === 'LESSON')
      .map((item) => item.id);
    const progresses =
      enrolled && lessonIds.length
        ? await this.prisma.lessonProgress.findMany({
            where: { enrollmentId: enrolled.id, lessonId: { in: lessonIds } },
            select: { lessonId: true, status: true, completedAt: true },
          })
        : [];
    const progressByLesson = new Map(
      progresses.map(({ lessonId, ...progress }) => [lessonId, progress]),
    );
    const validEnrollment = Boolean(
      enrolled && ['ACTIVE', 'COMPLETED'].includes(enrolled.status),
    );
    const practiceIds = learningItems
      .filter((item) => item.kind === 'PRACTICE')
      .map((item) => item.id);
    const accepted =
      actor && validEnrollment && practiceIds.length
        ? await this.prisma.acceptedAssessment.findMany({
            where: {
              isCurrent: true,
              publishedAt: { lte: new Date() },
              result: {
                revision: {
                  attempt: {
                    learnerId: actor.id,
                    assignmentVersion: {
                      activityId: { in: practiceIds },
                      assignment: { courseId: id },
                    },
                  },
                },
              },
            },
            select: {
              result: {
                select: {
                  revision: {
                    select: {
                      attempt: {
                        select: {
                          assignmentVersion: { select: { activityId: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          })
        : [];
    const completedPractices = new Set(
      accepted.map(
        (a) => a.result.revision.attempt.assignmentVersion.activityId,
      ),
    );
    return {
      ...details,
      prerequisites: prerequisites.map(({ prerequisiteCourse }) => ({
        ...prerequisiteCourse,
        completed: completedPrerequisites.has(prerequisiteCourse.id),
      })),
      // OWNER sorts before REVIEWER, so the course owner is listed first.
      instructors: courseInstructors.map(({ instructor, responsibility }) => ({
        ...instructor,
        responsibility,
      })),
      sections: chapters,
      learningItems: learningItems.map(({ chapterId, ...item }) => ({
        ...item,
        sectionId: chapterId,
        progress:
          item.kind === 'LESSON' && enrolled
            ? (progressByLesson.get(item.id) ?? {
                status: 'NOT_STARTED',
                completedAt: null,
              })
            : null,
        practiceCompleted:
          item.kind === 'PRACTICE' && completedPractices.has(item.id),
      })),
    };
  }
  // Enroll a learner in a course.
  async enrollCourse(courseId: string, actor: Actor) {
    this.access.role(actor, 'LEARNER');
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== 'PUBLISHED' || !course.enrollmentOpen)
      throw new ConflictException('Enrollment is closed');
    // Course prerequisites must be completed before enrolling.
    const required = await this.prisma.coursePrerequisite.findMany({
      where: { courseId },
      select: { prerequisiteCourse: { select: { id: true, title: true } } },
    });
    if (required.length) {
      const done = await this.completedCourses(
        actor.id,
        required.map((row) => row.prerequisiteCourse.id),
      );
      const missing = required
        .map((row) => row.prerequisiteCourse)
        .filter((prerequisite) => !done.has(prerequisite.id));
      if (missing.length)
        throw new ConflictException(
          `Complete the prerequisite course${missing.length > 1 ? 's' : ''} first: ${missing.map((p) => p.title).join(', ')}`,
        );
    }
    try {
      return await this.prisma.enrollment.create({
        data: { courseId, learnerId: actor.id, status: 'ACTIVE' },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Already enrolled; contact the course instructor to rejoin',
        );
      throw error;
    }
  }
  private async completedCourses(learnerId: string, courseIds: string[]) {
    const rows = await this.prisma.enrollment.findMany({
      where: { learnerId, courseId: { in: courseIds }, status: 'COMPLETED' },
      select: { courseId: true },
    });
    return new Set(rows.map((row) => row.courseId));
  }
  // PUT /courses/:id/prerequisites { prerequisiteCourseIds }
  async setPrerequisites(courseId: string, input: unknown, actor: Actor) {
    if (!actor.roles.includes('ADMIN'))
      await this.access.instructor(actor, courseId);
    const ids = object(input).prerequisiteCourseIds;
    if (!Array.isArray(ids) || ids.length > 10)
      throw new BadRequestException(
        'prerequisiteCourseIds must be an array of at most 10 course ids',
      );
    const prerequisiteIds = [
      ...new Set(ids.map((id) => uuid(id, 'prerequisiteCourseId'))),
    ];
    if (prerequisiteIds.includes(courseId))
      throw new BadRequestException('A course cannot require itself');
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });
      if (!course) throw new NotFoundException('Course not found');
      const found = await tx.course.count({
        where: {
          id: { in: prerequisiteIds },
          status: { in: ['PUBLISHED', 'ARCHIVED'] },
        },
      });
      if (found !== prerequisiteIds.length)
        throw new BadRequestException(
          'Prerequisites must be published or archived courses',
        );
      const edges = await tx.coursePrerequisite.findMany({
        where: { courseId: { not: courseId } },
      });
      assertAcyclic(
        [
          ...edges,
          ...prerequisiteIds.map((prerequisiteCourseId) => ({
            courseId,
            prerequisiteCourseId,
          })),
        ].map((edge) => ({
          skillId: edge.courseId,
          prerequisiteSkillId: edge.prerequisiteCourseId,
        })),
        'Course prerequisites',
      );
      await tx.coursePrerequisite.deleteMany({ where: { courseId } });
      if (prerequisiteIds.length)
        await tx.coursePrerequisite.createMany({
          data: prerequisiteIds.map((prerequisiteCourseId) => ({
            courseId,
            prerequisiteCourseId,
          })),
        });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'COURSE_PREREQUISITES_UPDATED',
          entityType: 'Course',
          entityKey: courseId,
          afterJson: { prerequisiteCourseIds: prerequisiteIds },
        },
      });
      return tx.coursePrerequisite.findMany({
        where: { courseId },
        select: { prerequisiteCourse: { select: { id: true, title: true } } },
      });
    });
  }
  // List my course enrollments.
  mine(actor: Actor) {
    return this.prisma.enrollment.findMany({
      where: { learnerId: actor.id },
      include: { course: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }
  // Leave a course.
  async leave(courseId: string, actor: Actor) {
    const changed = await this.prisma.enrollment.updateMany({
      where: { courseId, learnerId: actor.id, status: 'ACTIVE' },
      data: { status: 'LEFT', leftAt: new Date() },
    });
    if (!changed.count) throw new ConflictException('No active enrollment');
    return { message: 'Left course; submission history retained' };
  }
  // Create a course.
  async create(input: unknown, actor: Actor) {
    this.access.role(actor, 'INSTRUCTOR');
    const dto = object(input);
    const title = text(dto.title, 'title', 240);
    const description = text(dto.description, 'description');
    const policy = object(dto.completionPolicyJson);
    return this.prisma.course.create({
      data: {
        title,
        description,
        creatorId: actor.id,
        completionPolicyJson: policy as Prisma.InputJsonObject,
        courseInstructors: {
          create: { instructorId: actor.id, responsibility: 'OWNER' },
        },
      },
    });
  }
  // Update course details or status.
  async update(id: string, input: unknown, actor: Actor) {
    await this.access.instructor(actor, id);
    const dto = object(input);
    const data: Prisma.CourseUpdateInput = {};
    if (dto.title !== undefined) data.title = text(dto.title, 'title', 240);
    if (dto.description !== undefined)
      data.description = text(dto.description, 'description');
    if (dto.enrollmentOpen !== undefined) {
      if (typeof dto.enrollmentOpen !== 'boolean')
        throw new BadRequestException('enrollmentOpen must be boolean');
      data.enrollmentOpen = dto.enrollmentOpen;
    }
    if (dto.status !== undefined) {
      if (
        typeof dto.status !== 'string' ||
        !['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'].includes(dto.status)
      )
        throw new BadRequestException('Invalid course status');
      data.status = dto.status as 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';
      if (dto.status === 'PUBLISHED') {
        const count = await this.prisma.learningItem.count({
          where: { courseId: id, status: 'PUBLISHED' },
        });
        if (!count)
          throw new ConflictException(
            'Publish at least one learning item before publishing the course',
          );
      }
    }
    return this.prisma.course.update({ where: { id }, data });
  }
  // Get lesson content.
  async lesson(courseId: string, lessonId: string, actor: Actor) {
    const enrollment = await this.access.learner(actor, courseId, true);
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, learningItem: { courseId, ...visibleItemWhere } },
      include: {
        lessonMaterials: { orderBy: { position: 'asc' } },
        learningItem: { select: { title: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Published lesson not found');
    const progress = await this.prisma.lessonProgress.findUnique({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
      },
      select: { status: true, completedAt: true, lastPositionJson: true },
    });
    return {
      ...lesson,
      progress: progress ?? {
        status: 'NOT_STARTED',
        completedAt: null,
        lastPositionJson: null,
      },
    };
  }
  // POST /courses/:id/lessons/:lessonId/progress { position?: { scrollRatio } }
  // Records that the learner opened the lesson (and where they stopped) so the
  // dashboard can offer "Continue learning". Reads alone never write progress.
  async touchLesson(
    courseId: string,
    lessonId: string,
    input: unknown,
    actor: Actor,
  ) {
    const enrollment = await this.access.learner(actor, courseId);
    await this.lesson(courseId, lessonId, actor);
    const dto = input === undefined || input === null ? {} : object(input);
    let position: { scrollRatio: number } | undefined;
    if (dto.position !== undefined && dto.position !== null) {
      const ratio = object(dto.position).scrollRatio;
      if (typeof ratio !== 'number' || !(ratio >= 0 && ratio <= 1))
        throw new BadRequestException(
          'position.scrollRatio must be a number from 0 to 1',
        );
      position = { scrollRatio: Math.round(ratio * 1000) / 1000 };
    }
    const now = new Date();
    return this.prisma.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId,
        status: 'IN_PROGRESS',
        lastAccessedAt: now,
        ...(position ? { lastPositionJson: position } : {}),
      },
      update: {
        lastAccessedAt: now,
        ...(position ? { lastPositionJson: position } : {}),
      },
      select: {
        status: true,
        completedAt: true,
        lastAccessedAt: true,
        lastPositionJson: true,
      },
    });
  }
  // GET /me/learning-overview
  async learningOverview(actor: Actor, now = new Date()) {
    this.access.role(actor, 'LEARNER');
    const enrollments = await this.prisma.enrollment.findMany({
      where: { learnerId: actor.id, status: { in: ['ACTIVE', 'COMPLETED'] } },
      select: {
        id: true,
        status: true,
        enrolledAt: true,
        completedAt: true,
        course: {
          select: {
            id: true,
            title: true,
            learningItems: {
              where: visibleItemWhere,
              select: { id: true, title: true, kind: true, position: true },
              orderBy: [{ position: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });
    const progress = enrollments.length
      ? await this.prisma.lessonProgress.findMany({
          where: { enrollmentId: { in: enrollments.map((e) => e.id) } },
          select: {
            enrollmentId: true,
            lessonId: true,
            status: true,
            lastAccessedAt: true,
          },
        })
      : [];
    const courseIds = enrollments.map((e) => e.course.id);
    const accepted = courseIds.length
      ? await this.prisma.acceptedAssessment.findMany({
          where: {
            isCurrent: true,
            publishedAt: { lte: now },
            result: {
              revision: {
                attempt: {
                  learnerId: actor.id,
                  assignmentVersion: {
                    assignment: { courseId: { in: courseIds } },
                  },
                },
              },
            },
          },
          select: {
            result: {
              select: {
                revision: {
                  select: {
                    attempt: {
                      select: {
                        assignmentVersion: { select: { activityId: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [];
    const donePractices = new Set(
      accepted.map(
        (row) => row.result.revision.attempt.assignmentVersion.activityId,
      ),
    );
    const attempts = await this.prisma.attempt.findMany({
      where: {
        learnerId: actor.id,
        status: 'IN_PROGRESS',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
        attemptNo: true,
        startedAt: true,
        expiresAt: true,
        assignmentVersion: {
          select: {
            assignment: {
              select: {
                title: true,
                courseId: true,
                course: { select: { title: true } },
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const courses = enrollments.map((enrollment) => {
      const { course } = enrollment;
      const rows = progress.filter((p) => p.enrollmentId === enrollment.id);
      const doneLessons = new Set(
        rows.filter((p) => p.status === 'COMPLETED').map((p) => p.lessonId),
      );
      const done = (item: { id: string; kind: string }) =>
        item.kind === 'LESSON'
          ? doneLessons.has(item.id)
          : donePractices.has(item.id);
      const items = course.learningItems;
      const completedItems = items.filter(done).length;
      const visible = new Map(items.map((item) => [item.id, item]));
      const last = rows
        .filter((p) => visible.has(p.lessonId))
        .sort((a, b) => +b.lastAccessedAt - +a.lastAccessedAt)[0];
      const next = items.find((item) => !done(item));
      // Resume the last opened lesson if unfinished, else the next item.
      const resume =
        last && last.status !== 'COMPLETED' ? visible.get(last.lessonId) : next;
      const lessons = items.filter((item) => item.kind === 'LESSON');
      return {
        courseId: course.id,
        title: course.title,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        lastAccessedAt: last?.lastAccessedAt ?? null,
        progress: {
          completedItems,
          totalItems: items.length,
          completedLessons: lessons.filter((item) => doneLessons.has(item.id))
            .length,
          totalLessons: lessons.length,
          percent: items.length
            ? Math.round((completedItems / items.length) * 100)
            : 0,
        },
        nextItem: resume
          ? {
              id: resume.id,
              title: resume.title,
              kind: resume.kind,
              path: itemPath(course.id, resume.id, resume.kind),
            }
          : null,
      };
    });
    const inProgress = courses.filter((c) => c.status === 'ACTIVE');
    const recent = [...inProgress]
      .filter((c) => c.nextItem)
      .sort(
        (a, b) =>
          +(b.lastAccessedAt ?? b.enrolledAt) -
          +(a.lastAccessedAt ?? a.enrolledAt),
      )[0];
    return {
      continueLearning: recent
        ? {
            courseId: recent.courseId,
            courseTitle: recent.title,
            ...recent.nextItem!,
            lastAccessedAt: recent.lastAccessedAt,
          }
        : null,
      inProgress,
      completed: courses.filter((c) => c.status === 'COMPLETED'),
      resumeAttempts: attempts.map((attempt) => ({
        id: attempt.id,
        attemptNo: attempt.attemptNo,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        title: attempt.assignmentVersion.assignment.title,
        courseId: attempt.assignmentVersion.assignment.courseId,
        courseTitle: attempt.assignmentVersion.assignment.course.title,
        path: `/attempts/${attempt.id}`,
      })),
    };
  }
  // Mark a lesson as completed.
  async completeLesson(courseId: string, lessonId: string, actor: Actor) {
    const enrollment = await this.access.learner(actor, courseId);
    await this.lesson(courseId, lessonId, actor);
    return this.prisma.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      update: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
  // List course assignments with the learner's remaining attempts and resumable attempt state.
  async assignments(courseId: string, actor: Actor) {
    await this.access.learner(actor, courseId, true);
    const now = new Date();
    const rows = await this.prisma.assignment.findMany({
      where: {
        courseId,
        assignmentVersions: { some: { publishedAt: { lte: now } } },
      },
      select: {
        id: true,
        title: true,
        activityId: true,
        assignmentVersions: {
          where: { publishedAt: { lte: now } },
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
    });
    const attempts =
      rows.length > 0 && this.prisma.attempt?.findMany
        ? await this.prisma.attempt.findMany({
            where: {
              learnerId: actor.id,
              assignmentId: { in: rows.map((row) => row.id) },
            },
            orderBy: { attemptNo: 'desc' },
            select: {
              id: true,
              assignmentId: true,
              attemptNo: true,
              status: true,
              expiresAt: true,
            },
          })
        : [];
    return rows.map((row) => {
      const latestVersion = row.assignmentVersions?.[0];
      const maxAttempts = latestVersion?.maxAttempts ?? 1;
      const assignmentAttempts = attempts.filter(
        (attempt) => attempt.assignmentId === row.id,
      );
      const attemptsUsed = assignmentAttempts.reduce(
        (max, attempt) => Math.max(max, attempt.attemptNo),
        0,
      );
      const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);
      const active =
        assignmentAttempts.find(
          (attempt) =>
            attempt.status === 'IN_PROGRESS' &&
            (!attempt.expiresAt || attempt.expiresAt > now),
        ) ?? null;
      return {
        ...row,
        attemptsUsed,
        attemptsRemaining,
        activeAttempt: active
          ? {
              id: active.id,
              attemptNo: active.attemptNo,
              expiresAt: active.expiresAt,
            }
          : null,
      };
    });
  }
}
