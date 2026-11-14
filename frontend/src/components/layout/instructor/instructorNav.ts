// src/components/layout/instructor/instructorNav.ts
export type InstructorSectionKey =
  | "review-queue"
  | "course-authoring"
  | "grading-reports";

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
    subtitle: "Chấm & duyệt bài nộp",
    to: "/teacher/reviews",
    matchPrefixes: ["/teacher/reviews"],
  },
  {
    key: "course-authoring",
    label: "Course Authoring",
    subtitle: "Chương trình, bài tập & Rubric",
    to: "/teacher/courses",
    matchPrefixes: ["/teacher/courses", "/teacher/assessments"],
  },
  {
    key: "grading-reports",
    label: "Grading Reports",
    subtitle: "Vận hành & phổ điểm",
    to: "/teacher/reports",
    matchPrefixes: ["/teacher/reports"],
  },
];

export function resolveActiveInstructorKey(
  pathname: string,
): InstructorSectionKey {
  const matched = INSTRUCTOR_NAV_ITEMS.find((item) =>
    item.matchPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ),
  );
  return matched?.key ?? "review-queue";
}