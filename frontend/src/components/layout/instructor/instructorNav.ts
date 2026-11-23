export type InstructorSectionKey =
  "review-queue" | "course-authoring" | "grading-reports";

export interface InstructorNavItem {
  key: InstructorSectionKey;
  label: string;
  subtitle: string;
  to: string;
  matchPrefixes: string[];
}

export const INSTRUCTOR_NAV_ITEMS: InstructorNavItem[] = [
  {
    key: "review-queue",
    label: "Review Queue",
    subtitle: "Review submitted work",
    to: "/teacher/reviews",
    matchPrefixes: ["/teacher/reviews"],
  },
  {
    key: "course-authoring",
    label: "Course Authoring",
    subtitle: "Courses, activities and rubrics",
    to: "/teacher/authoring",
    matchPrefixes: ["/teacher/authoring"],
  },
  {
    key: "grading-reports",
    label: "Grading Reports",
    subtitle: "Assessment activity and quality",
    to: "/teacher/reports",
    matchPrefixes: ["/teacher/reports"],
  },
];

export function resolveActiveInstructorKey(
  pathname: string,
): InstructorSectionKey | undefined {
  const matched = INSTRUCTOR_NAV_ITEMS.find((item) =>
    item.matchPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ),
  );
  return matched?.key;
}
