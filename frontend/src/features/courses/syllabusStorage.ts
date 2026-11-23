export function getSyllabusStorageKey(
  courseId: string,
  userId?: string | null,
): string {
  return `ielts:course-syllabus-open:${userId || "guest"}:${courseId}`;
}

export function readStoredOpenSectionIds(
  storageKey: string,
  validSectionIds: readonly string[],
): string[] | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return null;
    }
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item): item is string => typeof item === "string")
    ) {
      return null;
    }
    const validSet = new Set(validSectionIds);
    return Array.from(new Set(parsed.filter((id) => validSet.has(id))));
  } catch {
    return null;
  }
}

export function writeStoredOpenSectionIds(
  storageKey: string,
  sectionIds: readonly string[],
): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }
    window.sessionStorage.setItem(storageKey, JSON.stringify(sectionIds));
  } catch {
    // Ignore storage quota or privacy-mode failures.
  }
}
