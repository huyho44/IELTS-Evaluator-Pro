import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../auth/auth.service.js';
import { AccessService } from '../auth/access.service.js';
import type { NotifierService } from '../notifications/notifier.service.js';
import type { PrismaService } from '../prisma.service.js';
import { CourseAuthoringService } from './course-authoring.service.js';

const actor = (id: string, roles: string[]): Actor => ({
  id,
  email: `${id}@test.example`,
  displayName: id,
  roles,
  targetBand: null,
  targetExamDate: null,
  status: 'ACTIVE',
});
const teacher = actor('teacher', ['INSTRUCTOR']);
const stranger = actor('stranger', ['INSTRUCTOR']);
const COURSE = '00000000-0000-4000-8000-000000000001';
const CHAPTER = '00000000-0000-4000-8000-000000000002';
const LESSON = '00000000-0000-4000-8000-000000000003';
const PRACTICE = '00000000-0000-4000-8000-000000000004';
type Row = Record<string, any>;

function fixture() {
  const chapters: Row[] = [
    {
      id: CHAPTER,
      courseId: COURSE,
      title: 'Unit 1',
      position: 1,
      status: 'PUBLISHED',
    },
  ];
  const items: Row[] = [
    {
      id: LESSON,
      courseId: COURSE,
      chapterId: CHAPTER,
      kind: 'LESSON',
      title: 'Cohesion',
      position: 1,
      status: 'PUBLISHED',
    },
    {
      id: PRACTICE,
      courseId: COURSE,
      chapterId: CHAPTER,
      kind: 'PRACTICE',
      title: 'Essay',
      position: 2,
      status: 'PUBLISHED',
    },
  ];
  const lessons: Row[] = [{ id: LESSON, summary: 'Old summary' }];
  const materials: Row[] = [
    {
      id: 'm1',
      lessonId: LESSON,
      kind: 'TEXT',
      position: 1,
      contentText: 'Old text',
    },
  ];
  const audits: Row[] = [];
  const announced: Row[] = [];
  const prisma: Row = {
    courseInstructor: {
      findUnique: async ({ where }: { where: Row }) =>
        where.courseId_instructorId.instructorId === teacher.id
          ? { courseId: COURSE }
          : null,
    },
    chapter: {
      findFirst: async ({ where }: { where: Row }) => {
        const c = chapters.find(
          (x) => x.id === where.id && x.courseId === where.courseId,
        );
        return c ? { ...c } : null;
      },
      update: async ({ where, data }: { where: Row; data: Row }) =>
        Object.assign(
          chapters.find((c) => c.id === where.id)!,
          data,
        ),
    },
    learningItem: {
      findFirst: async ({ where }: { where: Row }) => {
        const item = items.find(
          (i) => i.id === where.id && i.courseId === where.courseId,
        );
        if (!item) return null;
        const lesson = lessons.find((l) => l.id === item.id);
        return {
          ...item,
          lesson: lesson
            ? {
                ...lesson,
                lessonMaterials: materials.filter(
                  (m) => m.lessonId === lesson.id,
                ),
              }
            : null,
        };
      },
      findMany: async ({ where }: { where: Row }) =>
        items.filter(
          (i) => i.chapterId === where.chapterId && i.status === where.status,
        ),
      update: async ({ where, data }: { where: Row; data: Row }) => ({
        ...Object.assign(
          items.find((i) => i.id === where.id)!,
          data,
        ),
      }),
    },
    lesson: {
      update: async ({ where, data }: { where: Row; data: Row }) =>
        Object.assign(
          lessons.find((l) => l.id === where.id)!,
          data,
        ),
    },
    lessonMaterial: {
      update: async ({ where, data }: { where: Row; data: Row }) =>
        Object.assign(
          materials.find((m) => m.id === where.id)!,
          data,
        ),
      create: async ({ data }: { data: Row }) => materials.push(data),
    },
    auditEvent: {
      create: async ({ data }: { data: Row }) => audits.push(data),
    },
  };
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prisma);
  const notifier = {
    announce: async (notice: Row) => {
      announced.push(notice);
      return 1;
    },
  };
  const db = prisma as unknown as PrismaService;
  const service = new CourseAuthoringService(
    db,
    new AccessService(db),
    notifier as unknown as NotifierService,
  );
  return { service, chapters, items, lessons, materials, audits, announced };
}

describe('Course content editing (A8)', () => {
  it('edits lesson title and text in place with an audit trail', async () => {
    const f = fixture();
    const updated = await f.service.updateItem(
      COURSE,
      LESSON,
      { title: ' Cohesive devices ', summary: '', contentText: 'New text' },
      teacher,
    );
    expect(updated).toMatchObject({
      title: 'Cohesive devices',
      sectionId: CHAPTER,
    });
    expect(f.lessons[0].summary).toBeNull();
    expect(f.materials[0].contentText).toBe('New text');
    expect(f.audits[0]).toMatchObject({
      action: 'LEARNING_ITEM_UPDATED',
      beforeJson: { title: 'Cohesion' },
      afterJson: {
        title: 'Cohesive devices',
        contentChanged: true,
        summaryChanged: true,
      },
    });
  });

  it('hides and re-publishes items without deleting them, announcing on re-publish', async () => {
    const f = fixture();
    await f.service.updateItem(COURSE, PRACTICE, { status: 'HIDDEN' }, teacher);
    expect(f.items[1].status).toBe('HIDDEN');
    expect(f.announced).toEqual([]);
    await f.service.updateItem(
      COURSE,
      PRACTICE,
      { status: 'PUBLISHED' },
      teacher,
    );
    expect(f.announced).toEqual([
      expect.objectContaining({
        key: PRACTICE,
        navigationPath: `/courses/${COURSE}/practices/${PRACTICE}`,
      }),
    ]);
  });

  it('hides a whole chapter and announces its items when it is shown again', async () => {
    const f = fixture();
    await f.service.updateSection(
      COURSE,
      CHAPTER,
      { status: 'HIDDEN', title: 'Unit A' },
      teacher,
    );
    expect(f.chapters[0]).toMatchObject({ status: 'HIDDEN', title: 'Unit A' });
    expect(f.items.every((item) => item.status === 'PUBLISHED')).toBe(true);
    await f.service.updateSection(
      COURSE,
      CHAPTER,
      { status: 'PUBLISHED' },
      teacher,
    );
    expect(f.announced.map((n) => n.key)).toEqual([LESSON, PRACTICE]);
    expect(f.audits.map((a) => a.action)).toEqual([
      'COURSE_SECTION_UPDATED',
      'COURSE_SECTION_UPDATED',
    ]);
  });

  it('rejects invalid edits and other instructors', async () => {
    const f = fixture();
    await expect(
      f.service.updateItem(COURSE, LESSON, { title: 'x' }, stranger),
    ).rejects.toBeInstanceOf(ForbiddenException);
    for (const body of [
      {},
      { status: 'DRAFT' },
      { position: 0 },
      { sectionId: 'nope' },
    ])
      await expect(
        f.service.updateItem(COURSE, LESSON, body, teacher),
      ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      f.service.updateItem(
        COURSE,
        PRACTICE,
        { contentText: 'Prompt' },
        teacher,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      f.service.updateItem(
        COURSE,
        '00000000-0000-4000-8000-000000000099',
        { title: 'x' },
        teacher,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      f.service.updateSection(COURSE, CHAPTER, {}, teacher),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
