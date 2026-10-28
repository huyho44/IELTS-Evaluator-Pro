import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
import PrivateRoute from './features/auth/components/PrivateRoute';
import Dashboard from './pages/Dashboard';
import ReviewQueuePage from './features/instructor/pages/ReviewQueuePage';
import ReviewDetailPage from './features/instructor/pages/ReviewDetailPage';
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
import PracticePage from "./features/courses/PracticePage";
import PracticeAttemptPage from "./features/courses/PracticeAttemptPage";
import PracticeHistoryPage from "./features/courses/PracticeHistoryPage";

export default function App() {
  return (
    <BrowserRouter>
      <StudentNavbar studentName="Hải" targetBand={7.0} />

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<PrivateRoute />}><Route path="/dashboard" element={<Dashboard />} /></Route>
        <Route element={<PrivateRoute allowedRoles={['INSTRUCTOR']} />}>
          <Route path="/teacher/reviews" element={<ReviewQueuePage />} />
          <Route path="/teacher/reviews/:id" element={<ReviewDetailPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/courses" replace />} />

        <Route path="/courses" element={<CourseCatalogPage />} />

        <Route path="/courses/:courseId" element={<CourseDetailPage />} />

        <Route
          path="/courses/:courseId/lessons/:lessonId"
          element={<LessonPage />}
        />

        <Route
          path="/courses/:courseId/practices/:activityId"
          element={<PracticePage />}
        />

        <Route
          path="/attempts/:attemptId"
          element={<PracticeAttemptPage />}
        />

        <Route
          path="/practice-history"
          element={<PracticeHistoryPage />}
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
