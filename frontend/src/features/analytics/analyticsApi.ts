import axiosClient from "../../lib/api/axiosClient";

export type CourseAnalytics = {
  id: string;
  title: string;
  status: string;
  enrollments: { active: number; completed: number; left: number; total: number };
  completionRate: number | null;
  activeLearners: number;
  submissions: number;
  officialResults: number;
  averageBand: number | null;
  criteria: { code: string; name: string; average: number | null; count: number }[];
  reviewBacklog: { pending: number; claimed: number };
};

export type AnalyticsReport = {
  generatedAt: string;
  activeWindowDays: number;
  totals: {
    courses: number;
    activeEnrollments: number;
    completedEnrollments: number;
    activeLearners: number;
    submissions: number;
    reviewBacklog: number;
  };
  courses: CourseAnalytics[];
};

export type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityKey: string;
  beforeJson: unknown;
  afterJson: unknown;
  occurredAt: string;
  actor: { id: string; displayName: string; email: string } | null;
};

export type AuditFilters = {
  action?: string;
  entityType?: string;
  entityKey?: string;
  actorId?: string;
  from?: string;
  to?: string;
};

// Drops empty filters so they are not sent as blank query parameters.
export function auditParams(filters: AuditFilters, cursor?: string | null) {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters))
    if (typeof value === "string" && value.trim()) params[key] = value.trim();
  if (cursor) params.cursor = cursor;
  return params;
}

export function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export const analyticsApi = {
  async report(courseId?: string) {
    return (
      await axiosClient.get<AnalyticsReport>("/admin/analytics", {
        params: courseId ? { courseId } : undefined,
      })
    ).data;
  },
  async audit(filters: AuditFilters, cursor?: string | null) {
    return (
      await axiosClient.get<{ items: AuditEvent[]; nextCursor: string | null }>(
        "/admin/audit-events",
        { params: auditParams(filters, cursor) },
      )
    ).data;
  },
};
