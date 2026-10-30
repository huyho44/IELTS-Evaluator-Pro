import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Actor } from '../auth/auth.service.js';
import { AccessService } from '../auth/access.service.js';
import type { PrismaService } from '../prisma.service.js';
import { CoursesService } from './courses.service.js';

const courseId = 'course';
const lessonId = 'lesson-one';
const secondLessonId = 'lesson-two';
const practiceId = 'practice';
const actor = (id: string, roles = ['LEARNER']): Actor => ({
  id,
  email: `${id}@test.example`,
  displayName: id,
  roles,
  targetBand: null,
  targetExamDate: null,
  status: 'ACTIVE',
});
const an = actor('an');
const binh = actor('binh');
const chi = actor('chi');
const teacher = actor('teacher', ['INSTRUCTOR']);

type Progress = {
  enrollmentId: string;
  lessonId: string;
  status: string;
  completedAt: Date | null;
};
type ProgressKey = {
  enrollmentId_lessonId: { enrollmentId: string; lessonId: string };
};
const progressKey = (enrollmentId: string, id: string) =>
  `${enrollmentId}/${id}`;

function fixture() {
  const enrollments = [an, binh].map((learner) => ({
    id: `${learner.id}-enrollment`,
    learnerId: learner.id,
    courseId,
    status: 'ACTIVE',
  }));
  const saved = new Map<string, Progress>();
  const course = {
    id: courseId,
    title: 'Writing course',
    status: 'PUBLISHED',
    creator: { id: teacher.id, displayName: teacher.displayName },
    chapters: [{ id: 'section', title: 'Section one', position: 1 }],
    learningItems: [
      ...[lessonId, secondLessonId].map((id, index) => ({
        id,
        chapterId: 'section',
        title: id,
        kind: 'LESSON',
        position: index + 1,
        lesson: { summary: 'Lesson summary' },
        practiceActivity: null,
      })),
      {
        id: practiceId,
        chapterId: null,
        title: 'Writing practice',
        kind: 'PRACTICE',
        position: 3,
        lesson: null,
        practiceActivity: { skillArea: 'WRITING', responseMode: 'WRITING' },
      },
    ],
  };
  const prisma = {
    course: { findUnique: vi.fn(async () => structuredClone(course)) },
    enrollment: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            learnerId_courseId: { learnerId: string; courseId: string };
          };
        }) => {
          const key = where.learnerId_courseId;
          return (
            enrollments.find(
              (row) =>
                row.learnerId === key.learnerId &&
                row.courseId === key.courseId,
            ) ?? null
          );
        },
      ),
    },
    courseInstructor: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            courseId_instructorId: { courseId: string; instructorId: string };
          };
        }) =>
          where.courseId_instructorId.courseId === courseId &&
          where.courseId_instructorId.instructorId === teacher.id
            ? { courseId, instructorId: teacher.id }
            : null,
      ),
    },
    lesson: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            id: string;
            learningItem: { courseId: string; status: string };
          };
        }) => {
          const item = course.learningItems.find(
            (row) => row.id === where.id && row.kind === 'LESSON',
          );
          return item &&
            where.learningItem.courseId === courseId &&
            where.learningItem.status === 'PUBLISHED'
            ? {
                id: item.id,
                summary: 'Lesson summary',
                learningItem: { title: item.title },
                lessonMaterials: [
                  { kind: 'TEXT', position: 1, contentText: 'Lesson content' },
                ],
              }
            : null;
        },
      ),
    },
    lessonProgress: {
      findUnique: vi.fn(async ({ where }: { where: ProgressKey }) => {
        const key = where.enrollmentId_lessonId;
        const progress = saved.get(progressKey(key.enrollmentId, key.lessonId));
        return progress
          ? { status: progress.status, completedAt: progress.completedAt }
          : null;
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { enrollmentId: string; lessonId: { in: string[] } };
        }) =>
          [...saved.values()]
            .filter(
              (row) =>
                row.enrollmentId === where.enrollmentId &&
                where.lessonId.in.includes(row.lessonId),
            )
            .map(({ lessonId, status, completedAt }) => ({
              lessonId,
              status,
              completedAt,
            })),
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: ProgressKey;
          create: Progress;
          update: Pick<Progress, 'status' | 'completedAt'>;
        }) => {
          const key = where.enrollmentId_lessonId;
          const id = progressKey(key.enrollmentId, key.lessonId);
          const previous = saved.get(id);
          const progress = previous
            ? { ...previous, ...update }
            : { ...create };
          saved.set(id, progress);
          return { ...progress };
        },
      ),
    },
  };
  const db = prisma as unknown as PrismaService;
  const reload = () => new CoursesService(db, new AccessService(db));
  return { prisma, saved, course, enrollments, reload, service: reload() };
}

describe('course lesson progress', () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });

  it('returns NOT_STARTED for an enrolled learner without creating a progress record', async () => {
    const lesson = await f.service.lesson(courseId, lessonId, an);
    expect(lesson).toMatchObject({
      id: lessonId,
      lessonMaterials: [{ contentText: 'Lesson content' }],
      progress: { status: 'NOT_STARTED', completedAt: null },
    });
    expect(f.saved.size).toBe(0);
    expect(f.prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it('returns persisted completion on fresh lesson and course reads and keeps one row on repeat completion', async () => {
    await f.service.completeLesson(courseId, lessonId, an);
    const completed = await f.service.completeLesson(courseId, lessonId, an);
    const reloaded = f.reload();
    const expected = {
      status: 'COMPLETED',
      completedAt: completed.completedAt,
    };

    expect((await reloaded.lesson(courseId, lessonId, an)).progress).toEqual(
      expected,
    );
    const course = await reloaded.findOne(courseId, an);
    expect(
      course.learningItems.find((item) => item.id === lessonId)?.progress,
    ).toEqual(expected);
    expect(
      course.learningItems.find((item) => item.id === secondLessonId)?.progress,
    ).toEqual({ status: 'NOT_STARTED', completedAt: null });
    expect(f.saved.size).toBe(1);
  });

  it('isolates progress between learners on both read endpoints', async () => {
    await f.service.completeLesson(courseId, lessonId, an);
    expect((await f.service.lesson(courseId, lessonId, binh)).progress).toEqual(
      { status: 'NOT_STARTED', completedAt: null },
    );
    expect(
      (await f.service.findOne(courseId, binh)).learningItems.find(
        (item) => item.id === lessonId,
      )?.progress,
    ).toEqual({ status: 'NOT_STARTED', completedAt: null });
    expect(
      (await f.service.lesson(courseId, lessonId, an)).progress.status,
    ).toBe('COMPLETED');
  });

  it('preserves an existing IN_PROGRESS state without treating it as completed', async () => {
    f.saved.set(progressKey('an-enrollment', lessonId), {
      enrollmentId: 'an-enrollment',
      lessonId,
      status: 'IN_PROGRESS',
      completedAt: null,
    });
    const expected = { status: 'IN_PROGRESS', completedAt: null };
    expect((await f.service.lesson(courseId, lessonId, an)).progress).toEqual(
      expected,
    );
    expect(
      (await f.service.findOne(courseId, an)).learningItems.find(
        (item) => item.id === lessonId,
      )?.progress,
    ).toEqual(expected);
  });

  it.each([
    { name: 'anonymous visitor', actor: undefined },
    { name: 'unenrolled learner', actor: chi },
    { name: 'instructor without enrollment', actor: teacher },
  ])('returns no personal progress for an $name', async ({ actor }) => {
    await f.service.completeLesson(courseId, lessonId, an);
    f.prisma.lessonProgress.findMany.mockClear();
    const course = await f.service.findOne(courseId, actor);
    expect(course.learningItems.every((item) => item.progress === null)).toBe(
      true,
    );
    expect(f.prisma.lessonProgress.findMany).not.toHaveBeenCalled();
    expect(course.sections).toHaveLength(1);
  });

  it('batches outline progress reads and leaves practice items without lesson progress', async () => {
    await f.service.completeLesson(courseId, lessonId, an);
    f.prisma.lessonProgress.findUnique.mockClear();
    const course = await f.service.findOne(courseId, an);
    expect(f.prisma.lessonProgress.findMany).toHaveBeenCalledTimes(1);
    expect(f.prisma.lessonProgress.findUnique).not.toHaveBeenCalled();
    expect(
      course.learningItems.find((item) => item.id === practiceId)?.progress,
    ).toBeNull();
  });

  it('still denies lesson access and completion without an active enrollment', async () => {
    await expect(
      f.service.lesson(courseId, lessonId, chi),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      f.service.completeLesson(courseId, lessonId, chi),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await f.service.completeLesson(courseId, lessonId, an);
    f.enrollments[0].status = 'LEFT';
    await expect(
      f.service.lesson(courseId, lessonId, an),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // Historical progress remains the learner's own on a publicly visible course.
    expect(
      (await f.service.findOne(courseId, an)).learningItems.find(
        (item) => item.id === lessonId,
      )?.progress?.status,
    ).toBe('COMPLETED');
  });

  it('returns 404 for a missing lesson before looking up progress', async () => {
    await expect(
      f.service.lesson(courseId, 'missing-lesson', an),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(f.prisma.lessonProgress.findUnique).not.toHaveBeenCalled();
  });

  it('preserves draft course visibility rules', async () => {
    f.course.status = 'DRAFT';
    await expect(f.service.findOne(courseId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(f.service.findOne(courseId, an)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect((await f.service.findOne(courseId, teacher)).id).toBe(courseId);
  });

  it('allows completed learners to read lessons while keeping progress writes closed', async () => {
    await f.service.completeLesson(courseId, lessonId, an);
    f.course.status = 'HIDDEN';
    f.enrollments[0].status = 'COMPLETED';
    expect(
      (await f.service.findOne(courseId, an)).learningItems.find(
        (item) => item.id === lessonId,
      )?.progress?.status,
    ).toBe('COMPLETED');
    expect(
      (await f.service.lesson(courseId, lessonId, an)).progress.status,
    ).toBe('COMPLETED');
    await expect(
      f.service.completeLesson(courseId, lessonId, an),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
