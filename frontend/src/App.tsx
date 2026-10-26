import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import StudentNavbar from "./components/StudentNavbar";
import CourseCatalogPage from "./features/courses/CourseCatalogPage";
import CourseDetailPage from "./features/courses/CourseDetailPage";
import LessonPage from "./features/courses/LessonPage";

export default function App() {
  return (
    <BrowserRouter>
      <StudentNavbar studentName="Hải" targetBand={7.0} />

      <Routes>
        <Route path="/" element={<Navigate to="/courses" replace />} />

        <Route path="/courses" element={<CourseCatalogPage />} />

        <Route path="/courses/:courseId" element={<CourseDetailPage />} />

        <Route
          path="/courses/:courseId/lessons/:lessonId"
          element={<LessonPage />}
        />

        <Route
          path="*"
          element={
            <main className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8">
              <h1 className="text-2xl font-bold">Page not found</h1>

              <Link
                to="/courses"
                className="mt-4 inline-block font-semibold text-blue-600 hover:underline"
              >
                Back to courses
              </Link>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
