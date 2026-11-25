import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../auth/auth.service.js';
import { AccessService } from '../auth/access.service.js';
import type { PrismaService } from '../prisma.service.js';
import { CoursesService } from './courses.service.js';

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = (id: string, roles: string[]): Actor => ({
  id,
  email: `${id}@test.example`,
  displayName: id,
  roles,
  targetBand: null,
  targetExamDate: null,
  status: 'ACTIVE',
});
const an = actor('an', ['LEARNER']);
const teacher = actor('teacher', ['INSTRUCTOR']);
const admin = actor('admin', ['ADMIN']);
const [BASICS, INTER, ADV, DRAFT] = [uid(1), uid(2), uid(3), uid(4)];
type Row = Record<string, any>;

function fixture() {
  const courses: Row[] = [
    { id: BASICS, title: 'Basics', status: 'PUBLISHED', enrollmentOpen: true },
    {
      id: INTER,
      title: 'Intermediate',
      status: 'PUBLISHED',
      enrollmentOpen: true,
    },
    { id: ADV, title: 'Advanced', status: 'PUBLISHED', enrollmentOpen: true },
    { id: DRAFT, title: 'Draft', status: 'DRAFT', enrollmentOpen: false },
  ];
  const edges: Row[] = [];
  const enrollments: Row[] = [];
  const audits: Row[] = [];
  const title = (id: string) => {
    const c = courses.find((x) => x.id === id)!;
    return { id: c.id, title: c.title };
  };
  const prisma: Row = {
    course: {
      findUnique: async ({ where }: { where: Row }) =>
        courses.find((c) => c.id === where.id) ?? null,
      count: async ({ where }: { where: Row }) =>
        courses.filter(
          (c) =>
            where.id.in.includes(c.id) && where.status.in.includes(c.status),
        ).length,
    },
    courseInstructor: {
      findUnique: async ({ where }: { where: Row }) =>
        where.courseId_instructorId.instructorId === teacher.id &&
        where.courseId_instructorId.courseId !== BASICS
          ? { courseId: where.courseId_instructorId.courseId }
          : null,
    },
    coursePrerequisite: {
      findMany: async ({ where }: { where: Row }) =>
        edges
          .filter((e) =>
            typeof where.courseId === 'string'
              ? e.courseId === where.courseId
              : e.courseId !== where.courseId.not,
          )
          .map((e) => ({
            ...e,
            prerequisiteCourse: title(e.prerequisiteCourseId),
          })),
      deleteMany: async ({ where }: { where: Row }) => {
        for (let i = edges.length - 1; i >= 0; i--)
          if (edges[i].courseId === where.courseId) edges.splice(i, 1);
      },
      createMany: async ({ data }: { data: Row[] }) => edges.push(...data),
    },
    enrollment: {
      findMany: async ({ where }: { where: Row }) =>
        enrollments.filter(
          (e) =>
            e.learnerId === where.learnerId &&
            where.courseId.in.includes(e.courseId) &&
            e.status === where.status,
        ),
      create: async ({ data }: { data: Row }) => {
        enrollments.push(data);
        return data;
      },
    },
    auditEvent: {
      create: async ({ data }: { data: Row }) => audits.push(data),
    },
  };
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prisma);
  const db = prisma as unknown as PrismaService;
  return {
    service: new CoursesService(db, new AccessService(db)),
    edges,
    enrollments,
    audits,
  };
}

describe('Course prerequisites', () => {
  it('lets the course instructor or an admin set prerequisites, with audit', async () => {
    const f = fixture();
    const saved = await f.service.setPrerequisites(
      INTER,
      { prerequisiteCourseIds: [BASICS, BASICS] },
      teacher,
    );
    expect(saved.map((row) => row.prerequisiteCourse.title)).toEqual([
      'Basics',
    ]);
    expect(f.audits[0]).toMatchObject({
      action: 'COURSE_PREREQUISITES_UPDATED',
      entityKey: INTER,
      afterJson: { prerequisiteCourseIds: [BASICS] },
    });
    await expect(
      f.service.setPrerequisites(
        BASICS,
        { prerequisiteCourseIds: [] },
        teacher,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      f.service.setPrerequisites(ADV, { prerequisiteCourseIds: [INTER] }, an),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await f.service.setPrerequisites(
      ADV,
      { prerequisiteCourseIds: [INTER] },
      admin,
    );
    expect(f.edges).toHaveLength(2);
  });

  it('rejects self-references, cycles, drafts and malformed input', async () => {
    const f = fixture();
    await f.service.setPrerequisites(
      INTER,
      { prerequisiteCourseIds: [BASICS] },
      admin,
    );
    await f.service.setPrerequisites(
      ADV,
      { prerequisiteCourseIds: [INTER] },
      admin,
    );
    for (const [course, ids] of [
      [BASICS, [BASICS]],
      [BASICS, [ADV]],
      [ADV, [DRAFT]],
      [ADV, 'not-a-list'],
      [ADV, ['bad-id']],
    ] as const)
      await expect(
        f.service.setPrerequisites(
          course,
          { prerequisiteCourseIds: ids },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.edges).toHaveLength(2);
  });

  it('blocks enrollment until every prerequisite course is completed', async () => {
    const f = fixture();
    await f.service.setPrerequisites(
      INTER,
      { prerequisiteCourseIds: [BASICS] },
      admin,
    );
    await expect(f.service.enrollCourse(INTER, an)).rejects.toThrow(
      new ConflictException('Complete the prerequisite course first: Basics'),
    );
    f.enrollments.push({
      learnerId: an.id,
      courseId: BASICS,
      status: 'ACTIVE',
    });
    await expect(f.service.enrollCourse(INTER, an)).rejects.toBeInstanceOf(
      ConflictException,
    );
    f.enrollments[0].status = 'COMPLETED';
    await expect(f.service.enrollCourse(INTER, an)).resolves.toMatchObject({
      courseId: INTER,
      learnerId: an.id,
    });
  });
});
