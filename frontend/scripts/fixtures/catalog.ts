import type { Course } from "../../src/features/courses/course";
// Only imported by the explicit DEV preview and test runner, never the app.
export const catalogFixture: Course[] = Array.from({ length: 14 }, (_, i) => ({
  id: String(i),
  title: `Course ${i}`,
  description: "Reading",
  instructorName: i === 13 ? "Unique instructor" : "Teacher",
  enrollmentOpen: i < 7,
  category: null,
  lessonCount: null,
  enrolled: null,
  progress: null,
}));
