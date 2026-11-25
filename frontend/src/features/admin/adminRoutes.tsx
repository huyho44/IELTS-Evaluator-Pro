import { Route } from "react-router-dom";
import PrivateRoute from "../auth/components/PrivateRoute";
import { accountRoutes } from "../auth/workspaceRoutes";
import AuthoringPage from "../management/AuthoringPage";
import GradingReportPage from "../management/GradingReportPage";
import AdminLayout from "./AdminLayout";
import AccountsPage from "./AccountsPage";
import InstructorApprovalsPage from "./InstructorApprovalsPage";
import CourseAssignmentsPage from "./CourseAssignmentsPage";
import SkillCatalogPage from "./SkillCatalogPage";
import StaffDiscussionsPage from "../discussions/StaffDiscussionsPage";
import ModerationPage from "../moderation/ModerationPage";
import AnalyticsPage from "../analytics/AnalyticsPage";
import AuditLogPage from "../analytics/AuditLogPage";

export function adminRoutes() {
  return (
    <Route element={<PrivateRoute allowedRoles={["ADMIN"]} />}>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AccountsPage />} />
        <Route
          path="instructor-approvals"
          element={<InstructorApprovalsPage />}
        />
        <Route path="course-assignments" element={<CourseAssignmentsPage />} />
        <Route path="discussions" element={<StaffDiscussionsPage />} />
        <Route path="moderation" element={<ModerationPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="skills" element={<SkillCatalogPage />} />
        <Route path="authoring" element={<AuthoringPage mode="admin" />} />
        <Route path="reports" element={<GradingReportPage />} />
        {accountRoutes()}
      </Route>
    </Route>
  );
}
