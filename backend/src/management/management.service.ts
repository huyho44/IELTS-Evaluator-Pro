import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import { band, object, text, uuid } from '../auth/validation.js';
import { serializable } from '../submissions/transaction.js';

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  targetBand: true,
  userRoles: { select: { role: { select: { code: true } } } },
} satisfies Prisma.UserSelect;

export function assertAcyclic(
  edges: { skillId: string; prerequisiteSkillId: string }[],
) {
  const next = new Map<string, string[]>();
  for (const edge of edges)
    next.set(edge.skillId, [
      ...(next.get(edge.skillId) ?? []),
      edge.prerequisiteSkillId,
    ]);
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      throw new BadRequestException(
        'Skill prerequisites must not form a cycle',
      );
    if (done.has(id)) return;
    visiting.add(id);
    for (const target of next.get(id) ?? []) visit(target);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of next.keys()) visit(id);
}

@Injectable()
export class ManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private admin(actor: Actor) {
    this.access.role(actor, 'ADMIN');
  }
  private author(actor: Actor) {
    if (!actor.roles.some((role) => ['ADMIN', 'INSTRUCTOR'].includes(role)))
      throw new ForbiddenException('Instructor or administrator role required');
  }
  private audit(
    tx: Prisma.TransactionClient,
    actor: Actor,
    action: string,
    entityType: string,
    entityKey: string,
    afterJson: Prisma.InputJsonObject,
  ) {
    return tx.auditEvent.create({
      data: { actorId: actor.id, action, entityType, entityKey, afterJson },
    });
  }

  async users(actor: Actor) {
    this.admin(actor);
    const rows = await this.prisma.user.findMany({
      select: userSelect,
      orderBy: { email: 'asc' },
      take: 200,
    });
    return rows.map(({ userRoles, targetBand, ...row }) => ({
      ...row,
      targetBand: targetBand?.toNumber() ?? null,
      roles: userRoles.map((r) => r.role.code),
    }));
  }

  async updateUser(id: string, input: unknown, actor: Actor) {
    this.admin(actor);
    const dto = object(input),
      reason = text(dto.reason, 'reason');
    const status = dto.status;
    if (
      status !== undefined &&
      (typeof status !== 'string' ||
        !['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(status))
    )
      throw new BadRequestException('Invalid account status');
    const roles = dto.roles;
    if (
      roles !== undefined &&
      (!Array.isArray(roles) ||
        !roles.length ||
        roles.length > 3 ||
        new Set(roles).size !== roles.length ||
        roles.some(
          (r) =>
            typeof r !== 'string' ||
            !['LEARNER', 'INSTRUCTOR', 'ADMIN'].includes(r),
        ))
    )
      throw new BadRequestException('Provide unique supported roles');
    if (status === undefined && roles === undefined)
      throw new BadRequestException('No account change supplied');
    return serializable(this.prisma, async (tx) => {
      const current = await tx.user.findUnique({
        where: { id },
        select: userSelect,
      });
      if (!current) throw new NotFoundException('User not found');
      const losingAdmin =
        current.userRoles.some((r) => r.role.code === 'ADMIN') &&
        ((status !== undefined && status !== 'ACTIVE') ||
          (Array.isArray(roles) && !roles.includes('ADMIN')));
      if (losingAdmin && current.status === 'ACTIVE') {
        const others = await tx.user.count({
          where: {
            id: { not: id },
            status: 'ACTIVE',
            userRoles: { some: { role: { code: 'ADMIN' } } },
          },
        });
        if (!others)
          throw new ConflictException(
            'The last active administrator must be retained',
          );
      }
      if (Array.isArray(roles)) {
        const definitions = await tx.role.findMany({
          where: { code: { in: roles as string[] } },
        });
        if (definitions.length !== roles.length)
          throw new ConflictException('Role definitions are not configured');
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: definitions.map((role) => ({ userId: id, roleId: role.id })),
        });
      }
      if (status !== undefined)
        await tx.user.update({
          where: { id },
          data: { status: status as 'ACTIVE' | 'SUSPENDED' | 'CLOSED' },
        });
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit(tx, actor, 'ACCOUNT_UPDATED', 'User', id, {
        reason,
        ...(status ? { status } : {}),
        ...(Array.isArray(roles) ? { roles: roles as string[] } : {}),
      });
      const updated = await tx.user.findUniqueOrThrow({
        where: { id },
        select: userSelect,
      });
      return {
        ...updated,
        roles: updated.userRoles.map((r) => r.role.code),
        userRoles: undefined,
      };
    });
  }

  async apply(input: unknown, actor: Actor) {
    this.access.role(actor, 'LEARNER');
    if (actor.roles.includes('INSTRUCTOR'))
      throw new ConflictException('Already an instructor');
    const profileText = text(object(input).profileText, 'profileText', 20000);
    return serializable(this.prisma, async (tx) => {
      if (
        await tx.instructorApplication.findFirst({
          where: { applicantId: actor.id, status: 'PENDING' },
        })
      )
        throw new ConflictException('An application is already pending');
      return tx.instructorApplication.create({
        data: { applicantId: actor.id, profileText },
      });
    });
  }
  applications(actor: Actor, all = false) {
    if (all) this.admin(actor);
    return this.prisma.instructorApplication.findMany({
      where: all ? {} : { applicantId: actor.id },
      include: {
        applicant: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 200,
    });
  }
  async decide(id: string, input: unknown, actor: Actor) {
    this.admin(actor);
    const dto = object(input),
      reason = text(dto.reason, 'reason');
    const status = dto.status;
    if (
      typeof status !== 'string' ||
      !['APPROVED', 'REJECTED'].includes(status)
    )
      throw new BadRequestException('Invalid decision status');
    return serializable(this.prisma, async (tx) => {
      const application = await tx.instructorApplication.findUnique({
        where: { id },
        include: { applicant: { select: { status: true } } },
      });
      if (!application) throw new NotFoundException('Application not found');
      if (application.status !== 'PENDING')
        throw new ConflictException('Application has already been decided');
      if (application.applicantId === actor.id)
        throw new ForbiddenException('Cannot approve your own application');
      if (application.applicant.status !== 'ACTIVE')
        throw new ConflictException('Applicant must be active');
      const changed = await tx.instructorApplication.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: status as 'APPROVED' | 'REJECTED',
          reviewerId: actor.id,
          decisionReason: reason,
          reviewedAt: new Date(),
        },
      });
      if (!changed.count) throw new ConflictException('Application changed');
      if (status === 'APPROVED') {
        const role = await tx.role.findUnique({
          where: { code: 'INSTRUCTOR' },
        });
        if (!role)
          throw new ConflictException('Instructor role is not configured');
        await tx.userRole.upsert({
          where: {
            userId_roleId: { userId: application.applicantId, roleId: role.id },
          },
          create: { userId: application.applicantId, roleId: role.id },
          update: {},
        });
      }
      await this.audit(
        tx,
        actor,
        'INSTRUCTOR_APPLICATION_DECIDED',
        'InstructorApplication',
        id,
        { status, reason },
      );
      return tx.instructorApplication.findUniqueOrThrow({ where: { id } });
    });
  }
  async assign(courseId: string, input: unknown, actor: Actor) {
    this.admin(actor);
    const dto = object(input),
      instructorId = uuid(dto.instructorId, 'instructorId'),
      reason = text(dto.reason, 'reason');
    const responsibility = dto.responsibility ?? 'REVIEWER';
    if (
      typeof responsibility !== 'string' ||
      !['OWNER', 'REVIEWER'].includes(responsibility)
    )
      throw new BadRequestException('Invalid instructor responsibility');
    return serializable(this.prisma, async (tx) => {
      const [course, instructor] = await Promise.all([
        tx.course.findUnique({ where: { id: courseId }, select: { id: true } }),
        tx.user.findFirst({
          where: {
            id: instructorId,
            status: 'ACTIVE',
            userRoles: { some: { role: { code: 'INSTRUCTOR' } } },
          },
          select: { id: true },
        }),
      ]);
      if (!course || !instructor)
        throw new NotFoundException('Course or active instructor not found');
      const assigned = await tx.courseInstructor.upsert({
        where: { courseId_instructorId: { courseId, instructorId } },
        create: {
          courseId,
          instructorId,
          responsibility,
        },
        update: { responsibility },
      });
      await this.audit(
        tx,
        actor,
        'COURSE_INSTRUCTOR_ASSIGNED',
        'Course',
        courseId,
        { instructorId, responsibility, reason },
      );
      return assigned;
    });
  }
  skills(actor: Actor) {
    return this.prisma.skill.findMany({
      where: actor.roles.includes('ADMIN') ? {} : { status: 'PUBLISHED' },
      include: { skillPrerequisites: true },
      orderBy: [{ skillArea: 'asc' }, { name: 'asc' }],
    });
  }
  async saveSkill(id: string | undefined, input: unknown, actor: Actor) {
    this.admin(actor);
    const dto = object(input);
    const data: Prisma.SkillUpdateInput = {};
    for (const [field, max] of [
      ['code', 80],
      ['name', 160],
      ['observableDefinition', 10000],
    ] as const)
      if (!id || dto[field] !== undefined)
        data[field] = text(dto[field], field, max);
    if (!id || dto.skillArea !== undefined) {
      if (
        typeof dto.skillArea !== 'string' ||
        !['READING', 'LISTENING', 'WRITING', 'SPEAKING'].includes(dto.skillArea)
      )
        throw new BadRequestException('Invalid skill area');
      data.skillArea = dto.skillArea as
        'READING' | 'LISTENING' | 'WRITING' | 'SPEAKING';
    }
    if (dto.status !== undefined) {
      if (
        typeof dto.status !== 'string' ||
        !['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'].includes(dto.status)
      )
        throw new BadRequestException('Invalid skill status');
      data.status = dto.status as 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';
    }
    return serializable(this.prisma, async (tx) => {
      if (id && !(await tx.skill.findUnique({ where: { id } })))
        throw new NotFoundException('Skill not found');
      // Skill area is part of historical findings; do not retag existing evidence.
      if (id && dto.skillArea !== undefined) {
        const previous = await tx.skill.findUniqueOrThrow({ where: { id } });
        if (previous.skillArea !== dto.skillArea)
          throw new ConflictException(
            'Create a new skill instead of changing its area',
          );
      }
      const skill = id
        ? await tx.skill.update({ where: { id }, data })
        : await tx.skill.create({ data: data as Prisma.SkillCreateInput });
      await this.audit(tx, actor, 'SKILL_SAVED', 'Skill', skill.id, {
        code: skill.code,
        status: skill.status,
      });
      return skill;
    });
  }
  async prerequisites(id: string, input: unknown, actor: Actor) {
    this.admin(actor);
    const values = object(input).prerequisites;
    if (!Array.isArray(values) || values.length > 100)
      throw new BadRequestException('Provide up to 100 prerequisites');
    const rows = values.map((value) => {
      const v = object(value),
        prerequisiteSkillId = uuid(
          v.prerequisiteSkillId,
          'prerequisiteSkillId',
        );
      const fraction = (key: string) => {
        const n = v[key];
        if (n == null) return null;
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)
          throw new BadRequestException(`${key} must be between 0 and 1`);
        return n;
      };
      return {
        skillId: id,
        prerequisiteSkillId,
        minStrength: fraction('minStrength'),
        minSupport: fraction('minSupport'),
      };
    });
    if (new Set(rows.map((r) => r.prerequisiteSkillId)).size !== rows.length)
      throw new BadRequestException('Duplicate prerequisite');
    return serializable(this.prisma, async (tx) => {
      const skills = await tx.skill.findMany({
        where: { id: { in: [id, ...rows.map((r) => r.prerequisiteSkillId)] } },
      });
      if (
        skills.length !==
        new Set([id, ...rows.map((r) => r.prerequisiteSkillId)]).size
      )
        throw new NotFoundException('Skill not found');
      if (skills.some((s) => s.skillArea !== skills[0].skillArea))
        throw new BadRequestException(
          'Prerequisites must share the skill area',
        );
      const edges = await tx.skillPrerequisite.findMany({
        where: { skillId: { not: id } },
      });
      assertAcyclic([...edges, ...rows]);
      await tx.skillPrerequisite.deleteMany({ where: { skillId: id } });
      if (rows.length) await tx.skillPrerequisite.createMany({ data: rows });
      await this.audit(tx, actor, 'SKILL_PREREQUISITES_UPDATED', 'Skill', id, {
        prerequisiteSkillIds: rows.map((r) => r.prerequisiteSkillId),
      });
      return tx.skillPrerequisite.findMany({ where: { skillId: id } });
    });
  }
  async catalog(actor: Actor) {
    this.author(actor);
    const [courses, skills, rubrics, gradingConfigs] = await Promise.all([
      this.prisma.course.findMany({
        where: actor.roles.includes('ADMIN')
          ? {}
          : { courseInstructors: { some: { instructorId: actor.id } } },
        include: {
          courseInstructors: {
            include: {
              instructor: { select: { id: true, displayName: true } },
            },
          },
          chapters: { orderBy: { position: 'asc' } },
          learningItems: {
            include: {
              lesson: { include: { lessonMaterials: true } },
              practiceActivity: {
                include: {
                  activityVersions: { orderBy: { versionNo: 'desc' } },
                },
              },
            },
            orderBy: { position: 'asc' },
          },
          assignments: {
            include: { assignmentVersions: { orderBy: { versionNo: 'desc' } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.skill.findMany({
        where: { status: 'PUBLISHED' },
        include: { skillPrerequisites: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.rubricVersion.findMany({
        where: { publishedAt: { lte: new Date() } },
        include: { rubricCriterions: true },
        orderBy: [{ rubricCode: 'asc' }, { versionNo: 'desc' }],
      }),
      this.prisma.gradingConfig.findMany({
        select: {
          id: true,
          provider: true,
          modelId: true,
          rubricVersionId: true,
          createdAt: true,
          promptVersion: {
            select: { id: true, promptCode: true, versionNo: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { courses, skills, rubrics, gradingConfigs };
  }
  notifications(actor: Actor) {
    return this.prisma.notification.findMany({
      where: { recipientId: actor.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }
  async readNotification(id: string, actor: Actor) {
    const row = await this.prisma.notification.findFirst({
      where: { id, recipientId: actor.id },
    });
    if (!row) throw new NotFoundException('Notification not found');
    if (row.readAt) return row;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
  async profile(input: unknown, actor: Actor) {
    const dto = object(input),
      data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined)
      data.displayName = text(dto.displayName, 'displayName', 120);
    if (dto.targetBand !== undefined)
      data.targetBand = dto.targetBand === null ? null : band(dto.targetBand);
    if (dto.targetExamDate !== undefined) {
      if (dto.targetExamDate === null) data.targetExamDate = null;
      else {
        if (
          typeof dto.targetExamDate !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(dto.targetExamDate)
        )
          throw new BadRequestException('targetExamDate must be YYYY-MM-DD');
        const parsed = new Date(`${dto.targetExamDate}T00:00:00.000Z`);
        if (
          !Number.isFinite(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== dto.targetExamDate
        )
          throw new BadRequestException(
            'targetExamDate must be a valid calendar date',
          );
        data.targetExamDate = parsed;
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: actor.id },
      data,
      select: { ...userSelect, targetExamDate: true },
    });
    return {
      ...updated,
      roles: updated.userRoles.map((r) => r.role.code),
      userRoles: undefined,
      targetBand: updated.targetBand?.toNumber() ?? null,
    };
  }
  async completeCourse(courseId: string, actor: Actor) {
    this.access.role(actor, 'LEARNER');
    return serializable(this.prisma, async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { learnerId_courseId: { learnerId: actor.id, courseId } },
        include: { course: true },
      });
      if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status))
        throw new ForbiddenException('Current enrollment required');
      if (enrollment.status === 'COMPLETED') return enrollment;
      const policy = object(enrollment.course.completionPolicyJson);
      if (!['ALL_REQUIRED_ITEMS', 'ALL_LESSONS'].includes(String(policy.mode)))
        throw new ConflictException('Unsupported course completion policy');
      const items = await tx.learningItem.findMany({
        where: { courseId, status: 'PUBLISHED' },
        select: { id: true, kind: true },
      });
      const required = items.filter(
        (item) => policy.mode !== 'ALL_LESSONS' || item.kind === 'LESSON',
      );
      if (!required.length)
        throw new ConflictException('No required published learning content');
      const lessons = await tx.lessonProgress.findMany({
        where: { enrollmentId: enrollment.id, status: 'COMPLETED' },
        select: { lessonId: true },
      });
      const accepted = await tx.acceptedAssessment.findMany({
        where: {
          isCurrent: true,
          publishedAt: { lte: new Date() },
          result: {
            revision: {
              attempt: {
                learnerId: actor.id,
                assignmentVersion: { assignment: { courseId } },
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
      });
      const completed = new Set([
        ...lessons.map((l) => l.lessonId),
        ...accepted.map(
          (a) => a.result.revision.attempt.assignmentVersion.activityId,
        ),
      ]);
      const remaining = required.filter((item) => !completed.has(item.id));
      if (remaining.length)
        return {
          ...enrollment,
          remainingItemIds: remaining.map((item) => item.id),
        };
      const updated = await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await this.audit(
        tx,
        actor,
        'COURSE_COMPLETED',
        'Enrollment',
        enrollment.id,
        { courseId },
      );
      return { ...updated, remainingItemIds: [] };
    });
  }
}
