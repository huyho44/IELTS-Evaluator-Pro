import { Navigate, Route } from "react-router-dom";
import StudentLayout from "./StudentLayout";
import PrivateRoute from "../auth/components/PrivateRoute";
import { accountRoutes } from "../auth/workspaceRoutes";
import CourseCatalogPage from "../courses/CourseCatalogPage";
import CourseDetailPage from "../courses/CourseDetailPage";
import LessonPage from "../courses/LessonPage";
import PracticePage from "../courses/PracticePage";
import AttemptPage from "../courses/AttemptPage";
import PracticeHistoryPage from "../courses/PracticeHistoryPage";
import LearningPage from "../learning/LearningPage";
import SubmissionRedirect from "../writing/SubmissionRedirect";

export function studentRoutes(
  accessToken: string | null,
  onSessionExpired: () => void,
) {
  const attemptProps = { accessToken, onSessionExpired };
  return (
    <>
      <Route element={<PrivateRoute allowedRoles={["LEARNER"]} allowGuests />}>
        <Route element={<StudentLayout />}>
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
        </Route>
      </Route>
      <Route element={<PrivateRoute allowedRoles={["LEARNER"]} />}>
        <Route element={<StudentLayout />}>
          <Route path="/student">{accountRoutes(true)}</Route>
          <Route
            path="/learning"
            element={<LearningPage {...attemptProps} />}
          />
          <Route path="/skills" element={<Navigate to="/learning" replace />} />
          <Route
            path="/recommendations"
            element={<Navigate to="/learning" replace />}
          />
          <Route
            path="/courses/:courseId/lessons/:lessonId"
            element={<LessonPage {...attemptProps} />}
          />
          <Route
            path="/courses/:courseId/practices/:activityId"
            element={<PracticePage {...attemptProps} />}
          />
          <Route
            path="/attempts/:attemptId"
            element={<AttemptPage {...attemptProps} />}
          />
          <Route
            path="/practice-history"
            element={<PracticeHistoryPage {...attemptProps} />}
          />
          <Route
            path="/submissions/:revisionId"
            element={<SubmissionRedirect />}
          />
        </Route>
      </Route>
    </>
  );
}
