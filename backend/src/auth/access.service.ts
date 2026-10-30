import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Actor } from './auth.service.js';
import { PrismaService } from '../prisma.service.js';
@Injectable()
export class AccessService {
  // Inject required services.
  constructor(private readonly prisma: PrismaService) {}
  // Check the required role.
  role(actor: Actor, role: string) {
    if (!actor.roles.includes(role))
      throw new ForbiddenException(`${role} role required`);
  }
  // Check course instructor access.
  async instructor(actor: Actor, courseId: string) {
    this.role(actor, 'INSTRUCTOR');
    const assignment = await this.prisma.courseInstructor.findUnique({
      where: { courseId_instructorId: { courseId, instructorId: actor.id } },
    });
    if (!assignment)
      throw new ForbiddenException('Course instructor assignment required');
  }
  // Check active course enrollment.
  async learner(actor: Actor, courseId: string, allowCompleted = false) {
    this.role(actor, 'LEARNER');
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { learnerId_courseId: { learnerId: actor.id, courseId } },
    });
    if (
      !enrollment ||
      (enrollment.status !== 'ACTIVE' &&
        !(allowCompleted && enrollment.status === 'COMPLETED'))
    )
      throw new ForbiddenException('Active enrollment required');
    return enrollment;
  }
  // Check access to a submission revision.
  async revision(actor: Actor, revisionId: string) {
    const revision = await this.prisma.submissionRevision.findUnique({
      where: { id: revisionId },
      include: {
        attempt: {
          include: { assignmentVersion: { include: { assignment: true } } },
        },
      },
    });
    if (!revision) throw new NotFoundException('Submission revision not found');
    if (revision.attempt.learnerId !== actor.id)
      await this.instructor(
        actor,
        revision.attempt.assignmentVersion.assignment.courseId,
      );
    return revision;
  }
}
