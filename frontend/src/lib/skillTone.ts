/**
 * One categorical colour per IELTS skill, used everywhere a skill area is
 * labelled. Deliberately independent of the workspace `brand` colour.
 */
export const SKILL_AREA_BADGES: Record<string, string> = {
  READING: "border border-sky-200 bg-sky-50 text-sky-800",
  WRITING: "border border-violet-200 bg-violet-50 text-violet-800",
  LISTENING: "border border-teal-200 bg-teal-50 text-teal-800",
  SPEAKING: "border border-amber-200 bg-amber-50 text-amber-800",
};

export const SKILL_AREA_FALLBACK = "border border-slate-200 bg-slate-50 text-slate-700";

export function skillAreaBadge(area: string | null | undefined) {
  return (area && SKILL_AREA_BADGES[area.toUpperCase()]) || SKILL_AREA_FALLBACK;
}
