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
import { NotifierService } from '../notifications/notifier.service.js';
@Injectable()
export class CourseAuthoringService {
  private readonly notifier: NotifierService;
  // Inject required services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    notifier?: NotifierService,
  ) {
    this.notifier = notifier ?? new NotifierService(prisma);
  }
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
    await this.notifier.announce({
      courseId,
      key: item.id,
      title: `New lesson: ${title}`,
      body: `A new lesson "${title}" is available in your course.`,
      navigationPath: `/courses/${courseId}/lessons/${item.id}`,
    });
    const { chapterId, ...lesson } = item;
    return { ...lesson, sectionId: chapterId };
  }

  private async audit(
    db: PrismaService | Prisma.TransactionClient,
    actor: Actor,
    action: string,
    entityType: string,
    entityKey: string,
    beforeJson: Prisma.InputJsonObject,
    afterJson: Prisma.InputJsonObject,
  ) {
    await db.auditEvent.create({
      data: {
        actorId: actor.id,
        action,
        entityType,
        entityKey,
        beforeJson,
        afterJson,
      },
    });
  }

  private status(value: unknown) {
    if (value !== 'PUBLISHED' && value !== 'HIDDEN')
      throw new BadRequestException('status must be PUBLISHED or HIDDEN');
    return value;
  }

  // PATCH /courses/:id/sections/:sectionId { title?, position?, status? }
  // Hiding a chapter hides every item in it from learners; nothing is deleted.
  async updateSection(
    courseId: string,
    sectionId: string,
    input: unknown,
    actor: Actor,
  ) {
    await this.access.instructor(actor, courseId);
    const dto = object(input);
    const data: Prisma.ChapterUpdateInput = {};
    if (dto.title !== undefined) data.title = text(dto.title, 'title', 240);
    if (dto.position !== undefined)
      data.position = integer(dto.position, 'position', 1);
    if (dto.status !== undefined) data.status = this.status(dto.status);
    if (!Object.keys(data).length)
      throw new BadRequestException('Nothing to update');
    const before = await this.prisma.chapter.findFirst({
      where: { id: sectionId, courseId },
    });
    if (!before) throw new NotFoundException('Section not found');
    let updated;
    try {
      updated = await this.prisma.chapter.update({
        where: { id: sectionId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Another section already uses this position',
        );
      throw error;
    }
    await this.audit(
      this.prisma,
      actor,
      'COURSE_SECTION_UPDATED',
      'Chapter',
      sectionId,
      { title: before.title, position: before.position, status: before.status },
      {
        title: updated.title,
        position: updated.position,
        status: updated.status,
      },
    );
    if (before.status !== 'PUBLISHED' && updated.status === 'PUBLISHED') {
      const items = await this.prisma.learningItem.findMany({
        where: { chapterId: sectionId, status: 'PUBLISHED' },
        select: { id: true, title: true, kind: true },
      });
      for (const item of items) await this.announceItem(courseId, item);
    }
    return updated;
  }

  private announceItem(
    courseId: string,
    item: { id: string; title: string; kind: string },
  ) {
    const lesson = item.kind === 'LESSON';
    return this.notifier.announce({
      courseId,
      key: item.id,
      title: `${lesson ? 'New lesson' : 'New practice'}: ${item.title}`,
      body: `"${item.title}" is now available in your course.`,
      navigationPath: `/courses/${courseId}/${lesson ? 'lessons' : 'practices'}/${item.id}`,
    });
  }

  // PATCH /courses/:id/items/:itemId
  // { title?, position?, status?, sectionId?, summary?, contentText? }
  // summary/contentText apply to lessons. Practice prompts are versioned and
  // are not edited in place, so past attempts keep the prompt they answered.
  async updateItem(
    courseId: string,
    itemId: string,
    input: unknown,
    actor: Actor,
  ) {
    await this.access.instructor(actor, courseId);
    const dto = object(input);
    const before = await this.prisma.learningItem.findFirst({
      where: { id: itemId, courseId },
      include: {
        lesson: {
          include: { lessonMaterials: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!before) throw new NotFoundException('Learning item not found');
    const data: Prisma.LearningItemUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = text(dto.title, 'title', 240);
    if (dto.position !== undefined)
      data.position = integer(dto.position, 'position', 1);
    if (dto.status !== undefined) data.status = this.status(dto.status);
    if (dto.sectionId !== undefined) {
      const sectionId =
        dto.sectionId === null ? null : uuid(dto.sectionId, 'sectionId');
      if (
        sectionId &&
        !(await this.prisma.chapter.findFirst({
          where: { id: sectionId, courseId },
        }))
      )
        throw new BadRequestException('Section must belong to this course');
      data.chapterId = sectionId;
    }
    const lessonEdit =
      dto.summary !== undefined || dto.contentText !== undefined;
    if (lessonEdit && !before.lesson)
      throw new BadRequestException(
        'summary and contentText can only be edited on lessons',
      );
    const summary =
      dto.summary === undefined
        ? undefined
        : dto.summary === null || dto.summary === ''
          ? null
          : text(dto.summary, 'summary');
    const contentText =
      dto.contentText === undefined
        ? undefined
        : text(dto.contentText, 'contentText', 100000);
    if (!Object.keys(data).length && !lessonEdit)
      throw new BadRequestException('Nothing to update');
    const textMaterial = before.lesson?.lessonMaterials.find(
      (material) => material.kind === 'TEXT',
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.learningItem.update({
        where: { id: itemId },
        data,
      });
      if (summary !== undefined)
        await tx.lesson.update({ where: { id: itemId }, data: { summary } });
      if (contentText !== undefined) {
        if (textMaterial)
          await tx.lessonMaterial.update({
            where: { id: textMaterial.id },
            data: { contentText },
          });
        else
          await tx.lessonMaterial.create({
            data: {
              lessonId: itemId,
              kind: 'TEXT',
              position:
                Math.max(
                  0,
                  ...(before.lesson?.lessonMaterials.map((m) => m.position) ??
                    []),
                ) + 1,
              contentText,
            },
          });
      }
      await this.audit(
        tx,
        actor,
        'LEARNING_ITEM_UPDATED',
        'LearningItem',
        itemId,
        {
          title: before.title,
          position: before.position,
          status: before.status,
          sectionId: before.chapterId,
        },
        {
          title: item.title,
          position: item.position,
          status: item.status,
          sectionId: item.chapterId,
          ...(summary !== undefined ? { summaryChanged: true } : {}),
          ...(contentText !== undefined ? { contentChanged: true } : {}),
        },
      );
      return item;
    });
    if (before.status !== 'PUBLISHED' && updated.status === 'PUBLISHED')
      await this.announceItem(courseId, updated);
    const { chapterId, ...item } = updated;
    return { ...item, sectionId: chapterId };
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
    const created = await this.prisma.learningItem.create({
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
    await this.notifier.announce({
      courseId,
      key: created.id,
      title: `New practice: ${title}`,
      body: `A new ${skillArea.toLowerCase()} practice "${title}" is available in your course.`,
      navigationPath: `/courses/${courseId}/practices/${created.id}`,
    });
    return created;
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
    const version = await serializable(this.prisma, async (tx) => {
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
    // Announced once per assignment; later versions do not notify again.
    await this.notifier.announce({
      courseId,
      key: `ASSIGNMENT:${version.assignmentId}`,
      title: `New assignment: ${title}`,
      body: version.dueAt
        ? `"${title}" is now open. Due ${version.dueAt.toISOString()}.`
        : `"${title}" is now open.`,
      navigationPath: `/courses/${courseId}/practices/${version.activityId}`,
    });
    return version;
  }
}
