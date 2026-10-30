import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma.service.js';
import { assertAcyclic, ManagementService } from './management.service.js';

const id = 'f913f835-5bfc-4565-875c-05ad603d1be4';
const prerequisiteId = '1acf094c-8eda-45eb-a4af-a801098f823c';
const actor = (name: string, roles: string[]): Actor => ({
  id: name,
  email: `${name}@example.test`,
  displayName: name,
  roles,
  status: 'ACTIVE',
  targetBand: null,
  targetExamDate: null,
});
const admin = actor('admin', ['ADMIN']);
const teacher = actor('teacher', ['INSTRUCTOR']);
const learner = actor('learner', ['LEARNER']);

function fixture() {
  const user = {
    id: learner.id,
    email: learner.email,
    displayName: learner.displayName,
    status: 'ACTIVE',
    targetBand: new Prisma.Decimal('7'),
    targetExamDate: null,
    userRoles: [{ role: { code: 'LEARNER' } }],
  };
  const skill = {
    id,
    code: 'writing.development',
    name: 'Development',
    skillArea: 'WRITING',
    observableDefinition: 'Develop an argument.',
    status: 'PUBLISHED',
  };
  const enrollment = {
    id: 'enrollment',
    learnerId: learner.id,
    courseId: 'course',
    status: 'ACTIVE',
    course: { completionPolicyJson: { mode: 'ALL_REQUIRED_ITEMS' } },
  };
  const db = {
    user: {
      findMany: vi.fn().mockResolvedValue([user]),
      findUnique: vi.fn().mockResolvedValue(user),
      findUniqueOrThrow: vi.fn().mockResolvedValue(user),
      findFirst: vi.fn().mockResolvedValue({ id: teacher.id }),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(user),
    },
    role: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'learner-role', code: 'LEARNER' },
        { id: 'instructor-role', code: 'INSTRUCTOR' },
      ]),
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'instructor-role', code: 'INSTRUCTOR' }),
    },
    userRole: { deleteMany: vi.fn(), createMany: vi.fn(), upsert: vi.fn() },
    authSession: { updateMany: vi.fn() },
    auditEvent: { create: vi.fn() },
    instructorApplication: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'application',
        applicantId: learner.id,
        status: 'PENDING',
      }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({
        id: 'application',
        applicantId: learner.id,
        status: 'PENDING',
        applicant: { status: 'ACTIVE' },
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'application',
        applicantId: learner.id,
        status: 'APPROVED',
      }),
    },
    course: {
      findUnique: vi.fn().mockResolvedValue({ id: 'course' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    courseInstructor: {
      upsert: vi
        .fn()
        .mockResolvedValue({ courseId: 'course', instructorId: teacher.id }),
    },
    skill: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(skill),
      findUniqueOrThrow: vi.fn().mockResolvedValue(skill),
      create: vi.fn().mockResolvedValue(skill),
      update: vi.fn().mockResolvedValue(skill),
    },
    skillPrerequisite: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    rubricVersion: { findMany: vi.fn().mockResolvedValue([]) },
    gradingConfig: { findMany: vi.fn().mockResolvedValue([]) },
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({
        id: 'notification',
        recipientId: learner.id,
        readAt: null,
      }),
      update: vi.fn().mockResolvedValue({
        id: 'notification',
        recipientId: learner.id,
        readAt: new Date(),
      }),
    },
    enrollment: {
      findUnique: vi.fn().mockResolvedValue(enrollment),
      update: vi.fn().mockResolvedValue({ ...enrollment, status: 'COMPLETED' }),
    },
    learningItem: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'lesson', kind: 'LESSON' },
        { id: 'practice', kind: 'PRACTICE' },
      ]),
    },
    lessonProgress: {
      findMany: vi.fn().mockResolvedValue([{ lessonId: 'lesson' }]),
    },
    acceptedAssessment: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const transaction = vi.fn(async (work: (tx: typeof db) => Promise<unknown>) =>
    work(db),
  );
  const prisma = {
    ...db,
    $transaction: transaction,
  } as unknown as PrismaService;
  return {
    db,
    user,
    enrollment,
    skill,
    transaction,
    service: new ManagementService(prisma, new AccessService(prisma)),
  };
}

describe('Management access and account changes', () => {
  it('denies non-admin user management before reading or changing accounts', async () => {
    const { service, db, transaction } = fixture();
    await expect(service.users(learner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.updateUser(id, { status: 'SUSPENDED', reason: 'Test' }, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns safe user summaries and numeric goals without requesting credential data', async () => {
    const { service, db } = fixture();
    expect(await service.users(admin)).toEqual([
      {
        id: learner.id,
        email: learner.email,
        displayName: learner.displayName,
        status: 'ACTIVE',
        targetBand: 7,
        roles: ['LEARNER'],
        targetExamDate: null,
      },
    ]);
    const query = db.user.findMany.mock.calls[0][0];
    expect(query.select).not.toHaveProperty('passwordHash');
    expect(query.select).not.toHaveProperty('authSessions');
    expect(query.select.userRoles.select.role.select).toEqual({ code: true });
  });

  it('preserves the last active administrator without changing roles, status or sessions', async () => {
    const { service, db, user } = fixture();
    user.userRoles = [{ role: { code: 'ADMIN' } }];
    db.user.count.mockResolvedValue(0);
    await expect(
      service.updateUser(
        id,
        { roles: ['LEARNER'], reason: 'Role change' },
        admin,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.userRole.deleteMany).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('audits explicit role changes and revokes existing sessions', async () => {
    const { service, db } = fixture();
    await service.updateUser(
      id,
      { roles: ['LEARNER', 'INSTRUCTOR'], reason: 'Approved qualifications' },
      admin,
    );
    expect(db.userRole.createMany).toHaveBeenCalledWith({
      data: [
        { userId: id, roleId: 'learner-role' },
        { userId: id, roleId: 'instructor-role' },
      ],
    });
    expect(db.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: admin.id,
        action: 'ACCOUNT_UPDATED',
        entityKey: id,
        afterJson: {
          reason: 'Approved qualifications',
          roles: ['LEARNER', 'INSTRUCTOR'],
        },
      }),
    });
  });

  it.each([
    { roles: [] },
    { roles: ['ADMIN', 'ADMIN'] },
    { roles: ['SUPERUSER'] },
  ])(
    'rejects invalid role list $roles before starting a transaction',
    async ({ roles }) => {
      const { service, transaction } = fixture();
      await expect(
        service.updateUser(id, { roles, reason: 'Change' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('does not allow learner access to authoring metadata', async () => {
    const { service, db } = fixture();
    await expect(service.catalog(learner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.gradingConfig.findMany).not.toHaveBeenCalled();
  });

  it('scopes instructor courses and exposes model identifiers without provider instructions', async () => {
    const { service, db } = fixture();
    await service.catalog(teacher);
    expect(db.course.findMany.mock.calls[0][0].where).toEqual({
      courseInstructors: { some: { instructorId: teacher.id } },
    });
    const configSelect = db.gradingConfig.findMany.mock.calls[0][0].select;
    expect(configSelect).not.toHaveProperty('settingsJson');
    expect(configSelect.promptVersion.select).toEqual({
      id: true,
      promptCode: true,
      versionNo: true,
    });
  });
});

describe('Instructor applications and assignment', () => {
  it('does not create another pending application', async () => {
    const { service, db } = fixture();
    db.instructorApplication.findFirst.mockResolvedValue({ id: 'pending' });
    await expect(
      service.apply({ profileText: 'My qualifications' }, learner),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.instructorApplication.create).not.toHaveBeenCalled();
  });

  it('only permits the applicant to query their own application history', async () => {
    const { service, db } = fixture();
    await service.applications(learner);
    expect(db.instructorApplication.findMany.mock.calls[0][0].where).toEqual({
      applicantId: learner.id,
    });
    await expect(
      Promise.resolve().then(() => service.applications(learner, true)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('approves pending applications, grants the instructor role and records the decision', async () => {
    const { service, db } = fixture();
    await service.decide(
      id,
      { status: 'APPROVED', reason: 'Qualifications verified' },
      admin,
    );
    expect(db.instructorApplication.updateMany).toHaveBeenCalledWith({
      where: { id, status: 'PENDING' },
      data: expect.objectContaining({
        status: 'APPROVED',
        reviewerId: admin.id,
        decisionReason: 'Qualifications verified',
      }),
    });
    expect(db.userRole.upsert).toHaveBeenCalledWith({
      where: {
        userId_roleId: { userId: learner.id, roleId: 'instructor-role' },
      },
      create: { userId: learner.id, roleId: 'instructor-role' },
      update: {},
    });
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'INSTRUCTOR_APPLICATION_DECIDED',
        actorId: admin.id,
      }),
    });
  });

  it('cannot approve an owned application or decide a closed application again', async () => {
    const { service, db } = fixture();
    db.instructorApplication.findUnique.mockResolvedValueOnce({
      id,
      applicantId: admin.id,
      status: 'PENDING',
      applicant: { status: 'ACTIVE' },
    });
    await expect(
      service.decide(id, { status: 'APPROVED', reason: 'Test' }, admin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    db.instructorApplication.findUnique.mockResolvedValueOnce({
      id,
      applicantId: learner.id,
      status: 'APPROVED',
      applicant: { status: 'ACTIVE' },
    });
    await expect(
      service.decide(id, { status: 'APPROVED', reason: 'Test' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.userRole.upsert).not.toHaveBeenCalled();
    expect(db.instructorApplication.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a non-instructor course assignee before assignment/audit writes', async () => {
    const { service, db } = fixture();
    db.user.findFirst.mockResolvedValue(null);
    await expect(
      service.assign(
        'course',
        {
          instructorId: id,
          responsibility: 'REVIEWER',
          reason: 'Cover reviews',
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.courseInstructor.upsert).not.toHaveBeenCalled();
    expect(db.user.findFirst.mock.calls[0][0].where).toMatchObject({
      status: 'ACTIVE',
      userRoles: { some: { role: { code: 'INSTRUCTOR' } } },
    });
  });
});

describe('Skill prerequisite correctness', () => {
  it('allows shared prerequisite DAGs but rejects self/indirect cycles', () => {
    expect(() =>
      assertAcyclic([
        { skillId: 'a', prerequisiteSkillId: 'b' },
        { skillId: 'a', prerequisiteSkillId: 'c' },
        { skillId: 'c', prerequisiteSkillId: 'b' },
      ]),
    ).not.toThrow();
    expect(() =>
      assertAcyclic([{ skillId: 'a', prerequisiteSkillId: 'a' }]),
    ).toThrow(BadRequestException);
    expect(() =>
      assertAcyclic([
        { skillId: 'a', prerequisiteSkillId: 'b' },
        { skillId: 'b', prerequisiteSkillId: 'c' },
        { skillId: 'c', prerequisiteSkillId: 'a' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('detects a cycle against existing edges without replacing the stored graph', async () => {
    const { service, db, skill } = fixture();
    db.skill.findMany.mockResolvedValue([
      skill,
      { ...skill, id: prerequisiteId },
    ]);
    db.skillPrerequisite.findMany.mockResolvedValue([
      { skillId: prerequisiteId, prerequisiteSkillId: id },
    ]);
    await expect(
      service.prerequisites(
        id,
        { prerequisites: [{ prerequisiteSkillId: prerequisiteId }] },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.skillPrerequisite.deleteMany).not.toHaveBeenCalled();
    expect(db.skillPrerequisite.createMany).not.toHaveBeenCalled();
  });

  it('rejects unsupported threshold values and duplicate dependencies', async () => {
    const { service, transaction } = fixture();
    await expect(
      service.prerequisites(
        id,
        {
          prerequisites: [
            { prerequisiteSkillId: prerequisiteId, minStrength: 1.1 },
          ],
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.prerequisites(
        id,
        {
          prerequisites: [
            { prerequisiteSkillId: prerequisiteId },
            { prerequisiteSkillId: prerequisiteId },
          ],
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not let instructors mutate the shared skill taxonomy', async () => {
    const { service, transaction } = fixture();
    await expect(
      service.saveSkill(id, { status: 'ARCHIVED' }, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('Learner profile, notifications and course completion', () => {
  it.each([
    '2026-99-10',
    '2026-02-30',
    '2025-02-29',
    '2026-10-30T00:00:00Z',
    'invalid',
  ])(
    'rejects invalid calendar input %s with a client error and no account update',
    async (targetExamDate) => {
      const { service, db } = fixture();
      await expect(
        service.profile({ targetExamDate }, learner),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.user.update).not.toHaveBeenCalled();
    },
  );

  it('accepts a real leap-day goal and can explicitly clear goals', async () => {
    const { service, db } = fixture();
    await service.profile(
      { targetExamDate: '2028-02-29', targetBand: 7.5 },
      learner,
    );
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: learner.id },
      data: {
        targetExamDate: new Date('2028-02-29T00:00:00.000Z'),
        targetBand: 7.5,
      },
      select: expect.not.objectContaining({ passwordHash: true }),
    });
    await service.profile({ targetExamDate: null, targetBand: null }, learner);
    expect(db.user.update.mock.calls[1][0].data).toEqual({
      targetExamDate: null,
      targetBand: null,
    });
  });

  it('does not mark another learner notification as read', async () => {
    const { service, db } = fixture();
    db.notification.findFirst.mockResolvedValue(null);
    await expect(service.readNotification(id, learner)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.notification.findFirst).toHaveBeenCalledWith({
      where: { id, recipientId: learner.id },
    });
    expect(db.notification.update).not.toHaveBeenCalled();
  });

  it('preserves the first read timestamp on repeated notification reads', async () => {
    const { service, db } = fixture();
    const readAt = new Date('2026-10-30T00:00:00.000Z');
    db.notification.findFirst.mockResolvedValue({
      id,
      recipientId: learner.id,
      readAt,
    });
    expect((await service.readNotification(id, learner)).readAt).toBe(readAt);
    expect(db.notification.update).not.toHaveBeenCalled();
  });

  it('does not complete practice requirements from unpublished/provisional AI results', async () => {
    const { service, db } = fixture();
    const result = await service.completeCourse('course', learner);
    expect(result).toMatchObject({
      status: 'ACTIVE',
      remainingItemIds: ['practice'],
    });
    expect(db.enrollment.update).not.toHaveBeenCalled();
    expect(db.acceptedAssessment.findMany.mock.calls[0][0].where).toMatchObject(
      {
        isCurrent: true,
        publishedAt: { lte: expect.any(Date) },
        result: { revision: { attempt: { learnerId: learner.id } } },
      },
    );
  });

  it('completes and audits the course only once every required item has a published accepted result', async () => {
    const { service, db } = fixture();
    db.acceptedAssessment.findMany.mockResolvedValue([
      {
        result: {
          revision: {
            attempt: { assignmentVersion: { activityId: 'practice' } },
          },
        },
      },
    ]);
    expect(await service.completeCourse('course', learner)).toMatchObject({
      status: 'COMPLETED',
      remainingItemIds: [],
    });
    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment' },
      data: { status: 'COMPLETED', completedAt: expect.any(Date) },
    });
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: learner.id,
        action: 'COURSE_COMPLETED',
        entityKey: 'enrollment',
      }),
    });
  });

  it('does not grant completion for an empty course or a LEFT enrollment', async () => {
    const { service, db, enrollment } = fixture();
    db.learningItem.findMany.mockResolvedValue([]);
    await expect(
      service.completeCourse('course', learner),
    ).rejects.toBeInstanceOf(ConflictException);
    enrollment.status = 'LEFT';
    await expect(
      service.completeCourse('course', learner),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });
});
