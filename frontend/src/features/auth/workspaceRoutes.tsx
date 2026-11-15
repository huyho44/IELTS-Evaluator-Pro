import { Route } from "react-router-dom";
import Dashboard from "../../pages/Dashboard";
import NotificationsPage from "../management/NotificationsPage";
import ProfilePage from "../management/ProfilePage";

export function accountRoutes(student = false) {
  return (
    <>
      <Route path="dashboard" element={<Dashboard student={student} />} />
      <Route path="profile" element={<ProfilePage student={student} />} />
      <Route
        path="notifications"
        element={<NotificationsPage student={student} />}
      />
    </>
  );
}
