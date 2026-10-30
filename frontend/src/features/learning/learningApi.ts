import { isRecord, studentRequest } from "../../lib/api/studentRequest";

export type LearnerSkill = {
  skillId: string;
  code: string;
  name: string;
  strength: number | null;
  support: number;
  evidenceCount: number;
  observationStatus: "UNKNOWN" | "INSUFFICIENT" | "OBSERVED";
};
export type SkillProfile = {
  userId: string;
  profileId: string;
  versionNo: number;
  status: string;
  skills: LearnerSkill[];
};
export type Recommendation = {
  id: string;
  rank: number;
  learningItemId: string;
  targetActivityVersionId: string | null;
  targetAssignmentVersionId: string | null;
  reasonCode: string;
  reasonText: string;
  targetSnapshotJson: { title?: string; skillId?: string };
  learningItem: {
    id: string;
    title: string;
    kind: "LESSON" | "PRACTICE";
    courseId: string;
  };
  targetAssignmentVersion: { assignmentId: string } | null;
};
export type RecommendationRun = {
  userId: string;
  runId: string;
  profileId: string;
  policyVersion: string;
  recommendedActivities: Recommendation[];
};

export function parseSkillProfile(value: unknown): SkillProfile {
  if (
    !isRecord(value) ||
    typeof value.userId !== "string" ||
    typeof value.profileId !== "string" ||
    !Number.isInteger(value.versionNo) ||
    typeof value.status !== "string" ||
    !Array.isArray(value.skills) ||
    !value.skills.every(
      (skill) =>
        isRecord(skill) &&
        typeof skill.skillId === "string" &&
        typeof skill.code === "string" &&
        typeof skill.name === "string" &&
        (skill.strength === null ||
          (typeof skill.strength === "number" &&
            Number.isFinite(skill.strength) &&
            skill.strength >= 0 &&
            skill.strength <= 1)) &&
        typeof skill.support === "number" &&
        Number.isFinite(skill.support) &&
        Number.isInteger(skill.evidenceCount) &&
        ["UNKNOWN", "INSUFFICIENT", "OBSERVED"].includes(
          String(skill.observationStatus),
        ),
    )
  )
    throw new Error("Your skill profile could not be verified.");
  return value as SkillProfile;
}
export function parseRecommendations(value: unknown): RecommendationRun {
  if (
    !isRecord(value) ||
    typeof value.userId !== "string" ||
    typeof value.runId !== "string" ||
    typeof value.profileId !== "string" ||
    typeof value.policyVersion !== "string" ||
    !Array.isArray(value.recommendedActivities)
  )
    throw new Error("Your suggested practice could not be verified.");
  for (const item of value.recommendedActivities) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !Number.isInteger(item.rank) ||
      typeof item.learningItemId !== "string" ||
      typeof item.reasonText !== "string" ||
      typeof item.reasonCode !== "string" ||
      !isRecord(item.learningItem) ||
      item.learningItem.id !== item.learningItemId ||
      typeof item.learningItem.title !== "string" ||
      typeof item.learningItem.courseId !== "string" ||
      !["LESSON", "PRACTICE"].includes(String(item.learningItem.kind)) ||
      (item.learningItem.kind === "PRACTICE" &&
        (!isRecord(item.targetAssignmentVersion) ||
          typeof item.targetAssignmentVersion.assignmentId !== "string" ||
          typeof item.targetAssignmentVersionId !== "string" ||
          typeof item.targetActivityVersionId !== "string"))
    ) {
      throw new Error(
        "A suggested activity is no longer available. Refresh your suggestions.",
      );
    }
  }
  return value as RecommendationRun;
}
export async function getSkillProfile(token: string, signal?: AbortSignal) {
  return parseSkillProfile(
    await studentRequest("/me/skills", token, { signal }),
  );
}
export async function getLearningRecommendations(
  token: string,
  signal?: AbortSignal,
) {
  return parseRecommendations(
    await studentRequest("/me/recommendations", token, { signal }),
  );
}
export function recommendedLessonPath(item: Recommendation): string | null {
  return item.learningItem.kind === "LESSON"
    ? `/courses/${encodeURIComponent(item.learningItem.courseId)}/lessons/${encodeURIComponent(item.learningItemId)}`
    : null;
}
export async function startRecommendedAttempt(
  item: Recommendation,
  token: string,
) {
  if (item.learningItem.kind !== "PRACTICE" || !item.targetAssignmentVersion)
    throw new Error("This suggestion is a lesson, not a practice attempt.");
  const assignmentId = item.targetAssignmentVersion.assignmentId;
  const value = await studentRequest(
    `/assignments/${encodeURIComponent(assignmentId)}/attempts`,
    token,
    {
      method: "POST",
      body: { recommendationItemId: item.id },
    },
  );
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.assignmentId !== assignmentId ||
    value.assignmentVersionId !== item.targetAssignmentVersionId ||
    value.activityVersionId !== item.targetActivityVersionId
  ) {
    throw new Error(
      "The recommended version could not be verified. Open your practice history before trying again.",
    );
  }
  return { id: value.id };
}
export function describeSkill(skill: LearnerSkill): string {
  if (skill.strength === null || !skill.evidenceCount)
    return "Not observed yet";
  return skill.strength >= 0.75
    ? "Usually demonstrated"
    : skill.strength >= 0.4
      ? "Developing"
      : "Needs focused practice";
}
