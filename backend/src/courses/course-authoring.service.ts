import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import { date, integer, object, text, uuid } from '../auth/validation.js';
import { serializable } from '../submissions/transaction.js';
@Injectable()
export class CourseAuthoringService {
  // Inject required services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}
  // Create a text lesson.
  async lesson(courseId: string, input: unknown, actor: Actor) {
    await this.access.instructor(actor, courseId);
    const dto = object(input),
      title = text(dto.title, 'title', 240),
      content = text(dto.contentText, 'contentText', 100000);
    const position = integer(dto.position, 'position', 1);
    const sectionId =
      dto.sectionId == null ? null : uuid(dto.sectionId, 'sectionId');
    if (
      sectionId &&
      !(await this.prisma.chapter.findFirst({
        where: { id: sectionId, courseId },
      }))
    )
      throw new BadRequestException('Section must belong to this course');
    const item = await this.prisma.learningItem.create({
      data: {
        courseId,
        chapterId: sectionId,
        kind: 'LESSON',
        title,
        position,
        status: 'PUBLISHED',
        lesson: {
          create: {
            summary: dto.summary == null ? null : text(dto.summary, 'summary'),
            lessonMaterials: {
              create: { kind: 'TEXT', position: 1, contentText: content },
            },
          },
        },
      },
    });
    const { chapterId, ...lesson } = item;
    return { ...lesson, sectionId: chapterId };
  }

  // Create a course section (stored as Chapter in Prisma).
  async section(courseId: string, input: unknown, actor: Actor) {
    await this.access.instructor(actor, courseId);
    const dto = object(input);
    return this.prisma.chapter.create({
      data: {
        courseId,
        title: text(dto.title, 'title', 240),
        position: integer(dto.position, 'position', 1),
      },
    });
  }
  // Create a Writing or Speaking activity.
  async activity(courseId: string, input: unknown, actor: Actor) {
    await this.access.instructor(actor, courseId);
    const dto = object(input);
    if (!['WRITING', 'SPEAKING'].includes(String(dto.skillArea)))
      throw new BadRequestException(
        'This endpoint creates Writing/Speaking activities; objective activities use the question bank',
      );
    const skillArea = dto.skillArea as 'WRITING' | 'SPEAKING';
    const promptText = text(dto.promptText, 'promptText'),
      instructions = text(dto.instructions, 'instructions');
    const title = text(dto.title, 'title', 240),
      position = integer(dto.position, 'position', 1);
    const difficulty = integer(dto.difficulty, 'difficulty', 1, 5),
      expectedMinutes = integer(dto.expectedMinutes, 'expectedMinutes', 1, 240);
    if (
      !Array.isArray(dto.skillIds) ||
      !dto.skillIds.length ||
      dto.skillIds.length > 20
    )
      throw new BadRequestException('Provide 1-20 skillIds');
    const skillIds = [...new Set(dto.skillIds.map((s) => uuid(s, 'skillId')))];
    if (
      (await this.prisma.skill.count({
        where: { id: { in: skillIds }, status: 'PUBLISHED', skillArea },
      })) !== skillIds.length
    )
      throw new BadRequestException(
        'Skills must be published and match the activity',
      );
    return this.prisma.learningItem.create({
      data: {
        courseId,
        kind: 'PRACTICE',
        title,
        position,
        status: 'PUBLISHED',
        learningItemSkills: {
          create: skillIds.map((skillId) => ({ skillId, purpose: 'PRACTISE' })),
        },
        practiceActivity: {
          create: {
            creatorId: actor.id,
            skillArea,
            responseMode: skillArea,
            activityVersions: {
              create: {
                promptText,
                instructions,
                difficulty,
                expectedMinutes,
                publishedAt: new Date(),
                contentHash: createHash('sha256')
                  .update(JSON.stringify({ promptText, instructions }))
                  .digest('hex'),
              },
            },
          },
        },
      },
      include: { practiceActivity: { include: { activityVersions: true } } },
    });
  }
  // Create an assignment or a new version.
  async assignment(
    courseId: string,
    input: unknown,
    actor: Actor,
    existingId?: string,
  ) {
    await this.access.instructor(actor, courseId);
    const dto = object(input),
      activityVersionId = uuid(dto.activityVersionId, 'activityVersionId');
    const title = text(dto.title, 'title', 240);
    if (!['PRACTICE', 'GRADED'].includes(String(dto.mode)))
      throw new BadRequestException('Invalid assignment mode');
    const mode = dto.mode as 'PRACTICE' | 'GRADED';
    const maxAttempts = integer(dto.maxAttempts ?? 1, 'maxAttempts', 1, 100),
      maxRevisions = integer(dto.maxRevisions ?? 1, 'maxRevisions', 1, 100);
    const opensAt = dto.opensAt == null ? null : date(dto.opensAt, 'opensAt'),
      dueAt = dto.dueAt == null ? null : date(dto.dueAt, 'dueAt');
    if (opensAt && dueAt && opensAt >= dueAt)
      throw new BadRequestException('dueAt must be after opensAt');
    const timeLimitSeconds =
      dto.timeLimitSeconds == null
        ? null
        : integer(dto.timeLimitSeconds, 'timeLimitSeconds', 1, 86400);
    if (dto.allowLate !== undefined && typeof dto.allowLate !== 'boolean')
      throw new BadRequestException('allowLate must be boolean');
    const releasePolicy = object(dto.releasePolicyJson);
    if (
      !['IMMEDIATE', 'AFTER_DUE_DATE', 'SCHEDULED', 'MANUAL'].includes(
        String(releasePolicy.releaseMode),
      )
    )
      throw new BadRequestException('Invalid releaseMode');
    if (releasePolicy.releaseMode === 'AFTER_DUE_DATE' && !dueAt)
      throw new BadRequestException('dueAt required');
    if (releasePolicy.releaseMode === 'SCHEDULED')
      date(releasePolicy.releaseAt, 'releaseAt');
    return serializable(this.prisma, async (tx) => {
      const activity = await tx.activityVersion.findUnique({
        where: { id: activityVersionId },
        include: { activity: { include: { learningItem: true } } },
      });
      if (
        !activity ||
        !activity.publishedAt ||
        activity.publishedAt > new Date() ||
        activity.activity.learningItem.courseId !== courseId ||
        activity.activity.learningItem.status !== 'PUBLISHED'
      )
        throw new NotFoundException(
          'Published activity version not found in this course',
        );
      const rubricVersionId =
        dto.rubricVersionId == null
          ? null
          : uuid(dto.rubricVersionId, 'rubricVersionId');
      if (activity.activity.responseMode !== 'OBJECTIVE') {
        const rubric = rubricVersionId
          ? await tx.rubricVersion.findUnique({
              where: { id: rubricVersionId },
              include: { rubricCriterions: true },
            })
          : null;
        if (
          !rubric?.publishedAt ||
          rubric.publishedAt > new Date() ||
          !rubric.rubricCriterions.length ||
          !rubric.taskType.startsWith(activity.activity.responseMode)
        )
          throw new BadRequestException(
            'A matching published rubric is required',
          );
      } else if (
        !(await tx.answerKeyVersion.findFirst({
          where: { activityVersionId, publishedAt: { lte: new Date() } },
        }))
      )
        throw new BadRequestException('Publish an answer key first');
      let assignment;
      if (existingId) {
        assignment = await tx.assignment.findUnique({
          where: { id: existingId },
        });
        if (
          !assignment ||
          assignment.courseId !== courseId ||
          assignment.activityId !== activity.activityId
        )
          throw new ConflictException(
            'Assignment versions must retain the same course and activity',
          );
      } else
        assignment = await tx.assignment.create({
          data: {
            courseId,
            activityId: activity.activityId,
            creatorId: actor.id,
            title,
          },
        });
      const previous = await tx.assignmentVersion.findFirst({
        where: { assignmentId: assignment.id },
        orderBy: { versionNo: 'desc' },
      });
      return tx.assignmentVersion.create({
        data: {
          assignmentId: assignment.id,
          activityId: activity.activityId,
          activityVersionId,
          rubricVersionId,
          versionNo: (previous?.versionNo ?? 0) + 1,
          mode,
          opensAt,
          dueAt,
          timeLimitSeconds,
          maxAttempts,
          maxRevisions,
          allowLate: dto.allowLate === true,
          releasePolicyJson: releasePolicy as Prisma.InputJsonObject,
          publishedAt: new Date(),
        },
      });
    });
  }
}
