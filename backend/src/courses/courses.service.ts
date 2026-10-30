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
import { object, text } from '../auth/validation.js';

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
            learningItems: { where: { status: 'PUBLISHED' } },
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
        chapters: { orderBy: { position: 'asc' } },
        learningItems: {
          where: { status: 'PUBLISHED' },
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
    const { chapters, learningItems, ...details } = course;
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
    return {
      ...details,
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
      where: { id: lessonId, learningItem: { courseId, status: 'PUBLISHED' } },
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
      select: { status: true, completedAt: true },
    });
    return {
      ...lesson,
      progress: progress ?? { status: 'NOT_STARTED', completedAt: null },
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
  // List course assignments.
  async assignments(courseId: string, actor: Actor) {
    await this.access.learner(actor, courseId, true);
    return this.prisma.assignment.findMany({
      where: {
        courseId,
        assignmentVersions: { some: { publishedAt: { lte: new Date() } } },
      },
      select: {
        id: true,
        title: true,
        activityId: true,
        assignmentVersions: {
          where: { publishedAt: { lte: new Date() } },
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
    });
  }
}
