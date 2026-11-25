import axiosClient from "../../lib/api/axiosClient";

export type ReportTargetType = "POST" | "LEARNING_ITEM" | "COURSE";
export type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export type ModerationReport = {
  id: string;
  status: ReportStatus;
  reason: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; displayName: string };
  resolver: { id: string; displayName: string } | null;
  target: {
    type: ReportTargetType;
    id: string;
    courseId: string | null;
    courseTitle: string | null;
    title: string | null;
    kind: string | null;
    excerpt: string | null;
    author: { id: string; displayName: string } | null;
    threadId: string | null;
    contentStatus: string | null;
  };
};

const path = (value: string) => encodeURIComponent(value);

export const moderationApi = {
  async report(targetType: ReportTargetType, targetId: string, reason: string) {
    return (
      await axiosClient.post<{ id: string; status: ReportStatus }>(
        "/moderation/reports",
        { targetType, targetId, reason },
      )
    ).data;
  },
  async list(status: ReportStatus | "ALL" = "PENDING") {
    return (
      await axiosClient.get<ModerationReport[]>("/moderation/reports", {
        params: { status },
      })
    ).data;
  },
  async resolve(id: string, resolution: string, hideContent: boolean) {
    return (
      await axiosClient.post<ModerationReport>(
        `/moderation/reports/${path(id)}/resolve`,
        { resolution, hideContent },
      )
    ).data;
  },
  async dismiss(id: string, resolution: string) {
    return (
      await axiosClient.post<ModerationReport>(
        `/moderation/reports/${path(id)}/dismiss`,
        { resolution },
      )
    ).data;
  },
};

export const TARGET_LABELS: Record<ReportTargetType, string> = {
  POST: "Discussion post",
  LEARNING_ITEM: "Lesson or practice",
  COURSE: "Course",
};

// Learner-facing link to the reported content, when there is one.
export function targetLink(report: ModerationReport): string | null {
  const { target } = report;
  if (!target.courseId) return null;
  if (target.type === "POST" && target.threadId)
    return `/courses/${target.courseId}?thread=${target.threadId}#discussion`;
  if (target.type === "LEARNING_ITEM")
    return `/courses/${target.courseId}/${target.kind === "LESSON" ? "lessons" : "practices"}/${target.id}`;
  return `/courses/${target.courseId}`;
}
