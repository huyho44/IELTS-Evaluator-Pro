import type { Course } from "./course";
export const PAGE_SIZE = 6;
export function catalogPage(
  courses: Course[],
  search: string,
  openOnly: boolean,
  page: number,
) {
  const keyword = search.trim().toLowerCase();

  const filteredCourses = courses.filter((course) => {
    const searchableText = [
      course.title,
      course.description,
      course.instructorName,
    ]
      .join(" ")
      .toLowerCase();

    return (
      searchableText.includes(keyword) &&
      (!openOnly || course.enrollmentOpen === true)
    );
  });

  const totalPages = Math.ceil(filteredCourses.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(1, totalPages));

  const visibleCourses = filteredCourses.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return { filteredCourses, totalPages, currentPage, visibleCourses };
}
