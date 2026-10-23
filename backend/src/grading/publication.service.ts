import { Injectable } from '@nestjs/common';
import type { AssignmentVersion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { serializable } from '../submissions/transaction.js';

// Get the release time, or null for manual release.
export function releaseTime(
  policy: Prisma.JsonValue,
  dueAt: Date | null,
  now = new Date(),
): Date | null {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy))
    return null;
  if (policy.releaseMode === 'IMMEDIATE') return now;
  if (policy.releaseMode === 'AFTER_DUE_DATE') return dueAt;
  if (
    policy.releaseMode === 'SCHEDULED' &&
    typeof policy.releaseAt === 'string'
  ) {
    const at = new Date(policy.releaseAt);
    return Number.isFinite(at.getTime()) ? at : null;
  }
  return null; // Manual and unrecognized policies never leak results.
}
@Injectable()
export class PublicationService {
  // Inject required services.
  constructor(private readonly prisma: PrismaService) {}
  // Accept a result and apply its release policy.
  async accept(
    tx: Prisma.TransactionClient,
    resultId: string,
    version: Pick<AssignmentVersion, 'releasePolicyJson' | 'dueAt'>,
  ) {
    const result = await tx.assessmentResult.findUniqueOrThrow({
      where: { id: resultId },
    });
    if (result.kind === 'AI')
      throw new Error('AI results cannot become official assessments');
    const previous = await tx.acceptedAssessment.findFirst({
      where: { revisionId: result.revisionId },
      orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }],
    });
    const releaseAfter = releaseTime(version.releasePolicyJson, version.dueAt);
    const accepted = await tx.acceptedAssessment.create({
      data: {
        resultId,
        resultKind: result.kind,
        revisionId: result.revisionId,
        supersedesId: previous?.id,
        releaseAfter,
      },
    });
    if (releaseAfter && releaseAfter <= new Date())
      return this.publish(tx, accepted.id);
    return accepted;
  }
  // Publish a result and record skill evidence.
  async publish(tx: Prisma.TransactionClient, id: string) {
    const accepted = await tx.acceptedAssessment.findUniqueOrThrow({
      where: { id },
      include: {
        result: {
          include: {
            revision: { include: { attempt: true } },
            skillObservations: true,
          },
        },
      },
    });
    if (accepted.publishedAt) return accepted;
    const history = await tx.acceptedAssessment.findMany({
      where: { revisionId: accepted.revisionId },
      select: { id: true, supersedesId: true, publishedAt: true },
    });
    const parents = new Map(history.map((row) => [row.id, row.supersedesId]));
    for (const row of history.filter((row) => row.publishedAt !== null)) {
      let parent = row.supersedesId;
      const visited = new Set<string>();
      while (parent && !visited.has(parent)) {
        if (parent === accepted.id) return accepted; // A newer published decision must never be undone by a delayed release.
        visited.add(parent);
        parent = parents.get(parent) ?? null;
      }
    }
    await tx.acceptedAssessment.updateMany({
      where: { revisionId: accepted.revisionId, isCurrent: true },
      data: { isCurrent: false },
    });
    const published = await tx.acceptedAssessment.update({
      where: { id },
      data: { publishedAt: new Date(), isCurrent: true },
    });
    for (const observation of accepted.result.skillObservations) {
      await tx.skillEvidence.upsert({
        where: {
          acceptedId_observationId: {
            acceptedId: id,
            observationId: observation.id,
          },
        },
        create: {
          acceptedId: id,
          observationId: observation.id,
          resultId: accepted.resultId,
          evidencePolicyVersion: 'accepted-observation-v1',
        },
        update: {},
      });
    }
    await tx.outboxEvent.create({
      data: {
        eventType: 'AssessmentAccepted',
        aggregateType: 'AcceptedAssessment',
        aggregateId: id,
        payloadJson: {
          acceptedId: id,
          learnerId: accepted.result.revision.attempt.learnerId,
        },
      },
    });
    await tx.notification.create({
      data: {
        recipientId: accepted.result.revision.attempt.learnerId,
        notificationType: 'ASSESSMENT_PUBLISHED',
        title: 'Assessment available',
        body: 'Your assessment has been published.',
        navigationPath: '/submissions/' + accepted.revisionId,
      },
    });
    return published;
  }
  // Publish results whose release time has arrived.
  async publishDue() {
    const due = await this.prisma.acceptedAssessment.findMany({
      where: { publishedAt: null, releaseAfter: { lte: new Date() } },
      orderBy: { acceptedAt: 'asc' },
      take: 50,
    });
    for (const item of due)
      await serializable(this.prisma, (tx) => this.publish(tx, item.id));
  }
}
