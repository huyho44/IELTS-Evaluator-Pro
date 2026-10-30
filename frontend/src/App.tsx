import { useEffect, useCallback } from "react";
import {
  useSession,
  restoreSession,
  expireSession,
  retryRestore,
  signOut,
} from "./features/auth/session";
import LoginPage from "./features/auth/pages/LoginPage";
import RegisterPage from "./features/auth/pages/RegisterPage";
import PrivateRoute from "./features/auth/components/PrivateRoute";
import Dashboard from "./pages/Dashboard";
import ReviewQueuePage from "./features/instructor/pages/ReviewQueuePage";
import ReviewDetailPage from "./features/instructor/pages/ReviewDetailPage";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  Outlet,
  useLocation,
} from "react-router-dom";
import StudentNavbar from "./components/StudentNavbar";
import CourseCatalogPage from "./features/courses/CourseCatalogPage";
import CourseDetailPage from "./features/courses/CourseDetailPage";
import LessonPage from "./features/courses/LessonPage";
import PracticePage from "./features/courses/PracticePage";
import AttemptPage from "./features/courses/AttemptPage";
import LearningPage from "./features/learning/LearningPage";
import AdminPage from "./features/management/AdminPage";
import AuthoringPage from "./features/management/AuthoringPage";
import NotificationsPage from "./features/management/NotificationsPage";
import ProfilePage from "./features/management/ProfilePage";
import GradingReportPage from "./features/management/GradingReportPage";
import SubmissionRedirect from "./features/writing/SubmissionRedirect";
import PracticeHistoryPage from "./features/courses/PracticeHistoryPage";

function LogoutPage() {
  useEffect(() => {
    void signOut();
  }, []);
  return <Navigate to="/courses" replace />;
}
function StudentLayout() {
  const { session } = useSession();
  const location = useLocation();
  const authPage = ["/login", "/register"].includes(location.pathname);
  return (
    <>
      {!authPage && <StudentNavbar key={session?.user.id ?? "guest"} />}
      <Outlet />
    </>
  );
}
export default function App() {
  const { restoring, requestToken, restoreError } = useSession();
  useEffect(() => {
    void restoreSession();
  }, []);
  const accessToken = requestToken;
  const onSessionExpired = useCallback(
    () => expireSession(accessToken ?? undefined),
    [accessToken],
  );
  return (
    <BrowserRouter>
      {restoring ? (
        <p role="status" className="p-8">
          Restoring session...
        </p>
      ) : restoreError ? (
        <section className="p-8">
          <p role="alert">{restoreError}</p>
          <button
            className="mt-4 text-blue-600"
            onClick={() => void retryRestore()}
          >
            Try again
          </button>
        </section>
      ) : (
        <Routes>
          <Route element={<StudentLayout />}>
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<PrivateRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route
                path="/submissions/:revisionId"
                element={<SubmissionRedirect />}
              />
            </Route>
            <Route element={<PrivateRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route
              element={<PrivateRoute allowedRoles={["INSTRUCTOR", "ADMIN"]} />}
            >
              <Route path="/teacher/authoring" element={<AuthoringPage />} />
              <Route path="/grading-report" element={<GradingReportPage />} />
            </Route>
            <Route element={<PrivateRoute allowedRoles={["INSTRUCTOR"]} />}>
              <Route path="/teacher/reviews" element={<ReviewQueuePage />} />
              <Route
                path="/teacher/reviews/:id"
                element={<ReviewDetailPage />}
              />
            </Route>
            <Route path="/" element={<Navigate to="/courses" replace />} />

            <Route path="/courses" element={<CourseCatalogPage />} />

            <Route
              path="/courses/:courseId"
              element={
                <CourseDetailPage
                  key={accessToken ?? "guest"}
                  accessToken={accessToken}
                />
              }
            />

            <Route element={<PrivateRoute allowedRoles={["LEARNER"]} />}>
              <Route
                path="/learning"
                element={
                  <LearningPage
                    accessToken={accessToken}
                    onSessionExpired={onSessionExpired}
                  />
                }
              />
              <Route
                path="/skills"
                element={<Navigate to="/learning" replace />}
              />
              <Route
                path="/recommendations"
                element={<Navigate to="/learning" replace />}
              />
              <Route
                path="/courses/:courseId/lessons/:lessonId"
                element={
                  <LessonPage
                    accessToken={accessToken}
                    onSessionExpired={onSessionExpired}
                  />
                }
              />

              <Route
                path="/courses/:courseId/practices/:activityId"
                element={
                  <PracticePage
                    accessToken={accessToken}
                    onSessionExpired={onSessionExpired}
                  />
                }
              />

              <Route
                path="/attempts/:attemptId"
                element={
                  <AttemptPage
                    accessToken={accessToken}
                    onSessionExpired={onSessionExpired}
                  />
                }
              />

              <Route
                path="/practice-history"
                element={
                  <PracticeHistoryPage
                    accessToken={accessToken}
                    onSessionExpired={onSessionExpired}
                  />
                }
              />
            </Route>
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
          </Route>
        </Routes>
      )}
    </BrowserRouter>
  );
}
