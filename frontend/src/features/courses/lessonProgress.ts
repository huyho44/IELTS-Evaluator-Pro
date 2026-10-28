export type LessonProgress = { status: string; completedAt: string | null };
export function isLessonProgress(value: unknown): value is LessonProgress {
 if (typeof value !== 'object' || value === null) return false;
 const p = value as LessonProgress;
 return ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(p.status) && (p.completedAt === null || (typeof p.completedAt === 'string' && Number.isFinite(Date.parse(p.completedAt))));
}
