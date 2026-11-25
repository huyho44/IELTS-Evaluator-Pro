import type { CourseRow, SkillRow } from "../managementApi";

export type AuthoringRun = (
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: unknown,
) => Promise<boolean>;

export type AuthoringProps = {
  course: CourseRow;
  busy: boolean;
  run: AuthoringRun;
};

export type { CourseRow, SkillRow };

export const STATUS_BADGES: Record<string, string> = {
  DRAFT: "border border-amber-200 bg-amber-50 text-amber-800",
  PUBLISHED: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  HIDDEN: "border border-slate-200 bg-slate-100 text-slate-700",
  ARCHIVED: "border border-rose-200 bg-rose-50 text-rose-800",
};

// Only fields that changed are sent, so the audit trail stays meaningful.
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Partial<T> {
  const changes: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[])
    if (after[key] !== before[key]) changes[key] = after[key];
  return changes;
}
