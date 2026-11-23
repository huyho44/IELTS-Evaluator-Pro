import { Navigate, Route } from "react-router-dom";
import InstructorLayout from "../../components/layout/instructor/InstructorLayout";
import InstructorGate from "./InstructorGate";
import { accountRoutes } from "../auth/workspaceRoutes";
import AuthoringPage from "../management/AuthoringPage";
import GradingReportPage from "../management/GradingReportPage";
import ReviewDetailPage from "./pages/ReviewDetailPage";
import ReviewQueuePage from "./pages/ReviewQueuePage";

export function instructorRoutes() {
  return (
    <Route element={<InstructorGate />}>
      <Route path="/teacher" element={<InstructorLayout />}>
        <Route index element={<Navigate to="reviews" replace />} />
        <Route path="reviews" element={<ReviewQueuePage />} />
        <Route path="reviews/:id" element={<ReviewDetailPage />} />
        <Route path="authoring" element={<AuthoringPage />} />
        <Route
          path="courses"
          element={<Navigate to="/teacher/authoring" replace />}
        />
        <Route path="reports" element={<GradingReportPage />} />
        {accountRoutes()}
      </Route>
    </Route>
  );
}
