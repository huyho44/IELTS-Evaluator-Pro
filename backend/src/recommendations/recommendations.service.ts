import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import type { Actor } from '../auth/auth.service.js';
import { AccessService } from '../auth/access.service.js';
import { serializable } from '../submissions/transaction.js';
import { projectSkills } from './profile.js';

const PROJECTION = 'core-evidence-v1';
const RANKING = 'core-recommendation-v1';
@Injectable()
export class RecommendationsService {
  // Inject required services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}
  // Build a skill profile from published evidence.
  private async profile(tx: Prisma.TransactionClient, actor: Actor) {
    const policy = await tx.policyVersion.upsert({
      where: { policyCode_versionNo: { policyCode: PROJECTION, versionNo: 1 } },
      create: {
        policyCode: PROJECTION,
        versionNo: 1,
        policyKind: 'PROJECTION',
        codeVersion: PROJECTION,
        configJson: {
          sufficientOpportunities: 3,
          selection: 'latest-revision-per-attempt-skill',
        },
      },
      update: {},
    });
    const evidence = await tx.skillEvidence.findMany({
      where: {
        accepted: {
          isCurrent: true,
          publishedAt: { lte: new Date() },
          result: { revision: { attempt: { learnerId: actor.id } } },
        },
      },
      include: {
        observation: true,
        accepted: { include: { result: { include: { revision: true } } } },
      },
      orderBy: { id: 'asc' },
    });
    const skills = await tx.skill.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { id: 'asc' },
    });
    const goal = {
      targetBand: actor.targetBand,
      targetExamDate: actor.targetExamDate?.toISOString() ?? null,
    };
    const watermark = createHash('sha256')
      .update(
        JSON.stringify({
          evidence: evidence.map((e) => e.id),
          skills: skills.map((s) => s.id),
          goal,
          policy: policy.id,
        }),
      )
      .digest('hex');
    const previous = await tx.learnerProfileVersion.findFirst({
      where: { learnerId: actor.id },
      orderBy: { versionNo: 'desc' },
    });
    if (
      previous?.evidenceWatermark === watermark &&
      previous.projectionPolicyId === policy.id
    ) {
      return tx.learnerProfileVersion.findUniqueOrThrow({
        where: { id: previous.id },
        include: { learnerSkillStates: { include: { skill: true } } },
      });
    }
    const projection = projectSkills(
      evidence.map((e) => ({
        id: e.id,
        skillId: e.observation.skillId,
        outcome: e.observation.outcome,
        attemptId: e.accepted.result.revision.attemptId,
        revisionNo: e.accepted.result.revision.revisionNo,
      })),
      skills.map((s) => s.id),
    );
    const profile = await tx.learnerProfileVersion.create({
      data: {
        learnerId: actor.id,
        versionNo: (previous?.versionNo ?? 0) + 1,
        projectionPolicyId: policy.id,
        goalSnapshotJson: goal,
        evidenceWatermark: watermark,
        learnerSkillStates: { create: projection.states },
        profileContributions: {
          create: projection.evidence.map((e) => ({
            evidenceId: e.id,
            effectiveWeight: e.outcome === 'NOT_OBSERVED' ? 0 : 1,
          })),
        },
      },
      include: { learnerSkillStates: { include: { skill: true } } },
    });
    // This projection acknowledges only durable events represented by the current snapshot.
    await tx.outboxEvent.updateMany({
      where: {
        eventType: 'AssessmentAccepted',
        status: 'PENDING',
        aggregateId: { in: evidence.map((e) => e.acceptedId) },
      },
      data: {
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    return profile;
  }
  // Get the learner skill profile.
  async getLearnerSkills(actor: Actor) {
    this.access.role(actor, 'LEARNER');
    const profile = await serializable(this.prisma, (tx) =>
      this.profile(tx, actor),
    );
    return {
      userId: actor.id,
      profileId: profile.id,
      versionNo: profile.versionNo,
      status: profile.learnerSkillStates.some((s) => s.evidenceCount > 0)
        ? 'OBSERVED'
        : 'UNOBSERVED',
      skills: profile.learnerSkillStates.map((s) => ({
        skillId: s.skillId,
        code: s.skill.code,
        name: s.skill.name,
        strength: s.strength?.toNumber() ?? null,
        support: s.support.toNumber(),
        evidenceCount: s.evidenceCount,
        observationStatus: s.observationStatus,
      })),
    };
  }
  // Suggest up to three practice activities.
  async getRecommendations(actor: Actor) {
    this.access.role(actor, 'LEARNER');
    return serializable(this.prisma, async (tx) => {
      const profile = await this.profile(tx, actor);
      const policy = await tx.policyVersion.upsert({
        where: { policyCode_versionNo: { policyCode: RANKING, versionNo: 1 } },
        create: {
          policyCode: RANKING,
          versionNo: 1,
          policyKind: 'RECOMMENDATION',
          codeVersion: RANKING,
          configJson: {
            needWeight: 0.6,
            difficultyWeight: 0.25,
            freshnessWeight: 0.15,
            maxItems: 3,
            defaultPrerequisiteStrength: 0.6,
            defaultPrerequisiteSupport: 0.33,
          },
        },
        update: {},
      });
      const now = new Date();
      const items = await tx.learningItem.findMany({
        where: {
          status: 'PUBLISHED',
          course: {
            status: { in: ['PUBLISHED', 'HIDDEN'] },
            enrollments: { some: { learnerId: actor.id, status: 'ACTIVE' } },
          },
        },
        include: {
          learningItemSkills: {
            where: { skill: { status: 'PUBLISHED' } },
            include: { skill: { include: { skillPrerequisites: true } } },
          },
          lesson: {
            include: {
              lessonProgresses: {
                where: {
                  enrollment: { learnerId: actor.id },
                  status: 'COMPLETED',
                },
              },
            },
          },
          practiceActivity: {
            include: {
              assignments: {
                include: {
                  assignmentVersions: {
                    where: { publishedAt: { lte: now } },
                    orderBy: { versionNo: 'desc' },
                    take: 1,
                    include: { activityVersion: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
      });
      const attempts = await tx.attempt.findMany({
        where: { learnerId: actor.id },
        orderBy: { startedAt: 'desc' },
        select: {
          assignmentId: true,
          startedAt: true,
          assignmentVersion: { select: { activityId: true } },
        },
      });
      const states = new Map(
        profile.learnerSkillStates.map((s) => [s.skillId, s]),
      );
      const recentIds = new Set(
        attempts.slice(0, 5).map((a) => a.assignmentVersion.activityId),
      );
      const candidates: {
        learningItemId: string;
        targetActivityVersionId: string | null;
        targetAssignmentVersionId: string | null;
        title: string;
        skillId: string;
        totalScore: number;
        need: number;
        difficultyFit: number;
        freshness: number;
        reasonCode: string;
        reasonText: string;
      }[] = [];
      for (const item of items) {
        if (
          !item.learningItemSkills.length ||
          item.lesson?.lessonProgresses.length
        )
          continue;
        const allowed = item.learningItemSkills.every((tag) =>
          tag.skill.skillPrerequisites.every((p) => {
            const state = states.get(p.prerequisiteSkillId);
            return (
              state?.strength !== null &&
              state?.strength !== undefined &&
              state.strength.toNumber() >= (p.minStrength?.toNumber() ?? 0.6) &&
              state.support.toNumber() >= (p.minSupport?.toNumber() ?? 0.33)
            );
          }),
        );
        if (!allowed) continue;
        let targetActivityVersionId: string | null = null,
          targetAssignmentVersionId: string | null = null,
          difficulty = 1;
        if (item.kind === 'PRACTICE') {
          const versions =
            item.practiceActivity?.assignments
              .filter((a) => a.courseId === item.courseId)
              .flatMap((a) => a.assignmentVersions)
              .filter(
                (v) =>
                  v.mode === 'PRACTICE' &&
                  v.activityVersion.publishedAt &&
                  v.activityVersion.publishedAt <= now &&
                  (!v.opensAt || v.opensAt <= now) &&
                  (v.allowLate || !v.dueAt || v.dueAt >= now) &&
                  attempts.filter((a) => a.assignmentId === v.assignmentId)
                    .length < v.maxAttempts,
              ) ?? [];
          const version = versions.sort((a, b) => a.id.localeCompare(b.id))[0];
          if (!version) continue;
          targetActivityVersionId = version.activityVersionId;
          targetAssignmentVersionId = version.id;
          difficulty = version.activityVersion.difficulty;
        }
        const targets = item.learningItemSkills
          .map((t) => {
            const state = states.get(t.skillId),
              strength = state?.strength?.toNumber() ?? null;
            return {
              tag: t,
              strength,
              need:
                (strength === null ? 0.7 : 1 - strength) *
                t.coverageWeight.toNumber(),
            };
          })
          .sort(
            (a, b) =>
              b.need - a.need || a.tag.skillId.localeCompare(b.tag.skillId),
          );
        const target = targets[0];
        const desiredDifficulty = Math.max(
          1,
          Math.min(5, Math.round((actor.targetBand ?? 5) / 2)),
        );
        const difficultyFit = Math.max(
          0,
          1 - Math.abs(difficulty - desiredDifficulty) / 4,
        );
        const freshness = recentIds.has(item.id) ? 0 : 1;
        const totalScore =
          Math.round(
            (0.6 * target.need + 0.25 * difficultyFit + 0.15 * freshness) *
              100000,
          ) / 100000;
        candidates.push({
          learningItemId: item.id,
          targetActivityVersionId,
          targetAssignmentVersionId,
          title: item.title,
          skillId: target.tag.skillId,
          totalScore,
          need: target.need,
          difficultyFit,
          freshness,
          reasonCode:
            target.strength === null
              ? 'DIAGNOSTIC'
              : target.strength < 0.6
                ? 'ACCEPTED_EVIDENCE_GAP'
                : 'REINFORCEMENT',
          reasonText:
            target.strength === null
              ? `Build evidence for ${target.tag.skill.name}; proficiency is not yet established.`
              : `Practise ${target.tag.skill.name} based on ${states.get(target.tag.skillId)!.evidenceCount} accepted learning opportunities.`,
        });
      }
      candidates.sort(
        (a, b) =>
          b.totalScore - a.totalScore ||
          a.learningItemId.localeCompare(b.learningItemId),
      );
      const selected: typeof candidates = [],
        used = new Set<string>();
      for (const c of candidates)
        if (selected.length < 3 && !used.has(c.skillId)) {
          selected.push(c);
          used.add(c.skillId);
        }
      for (const c of candidates)
        if (selected.length < 3 && !selected.includes(c)) selected.push(c);
      const run = await tx.recommendationRun.create({
        data: {
          learnerId: actor.id,
          profileId: profile.id,
          policyId: policy.id,
          contextSnapshotJson: {
            targetBand: actor.targetBand,
            recentActivityIds: [...recentIds],
            generatedAt: now.toISOString(),
          },
          candidateSnapshotJson: candidates,
          recommendationItems: {
            create: selected.map((c, i) => ({
              learningItemId: c.learningItemId,
              targetActivityVersionId: c.targetActivityVersionId,
              targetAssignmentVersionId: c.targetAssignmentVersionId,
              rank: i + 1,
              totalScore: c.totalScore,
              scoreComponentsJson: {
                need: c.need,
                difficultyFit: c.difficultyFit,
                freshness: c.freshness,
              },
              reasonCode: c.reasonCode,
              reasonText: c.reasonText,
              targetSnapshotJson: { title: c.title, skillId: c.skillId },
            })),
          },
        },
        include: { recommendationItems: { orderBy: { rank: 'asc' } } },
      });
      return {
        userId: actor.id,
        runId: run.id,
        profileId: profile.id,
        policyVersion: RANKING,
        recommendedActivities: run.recommendationItems,
      };
    });
  }
}
