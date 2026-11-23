import { useCallback, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { adminRoutes } from "./features/admin/adminRoutes";
import { instructorRoutes } from "./features/instructor/instructorRoutes";
import { studentRoutes } from "./features/student/studentRoutes";
import PrivateRoute from "./features/auth/components/PrivateRoute";
import LoginPage from "./features/auth/pages/LoginPage";
import RegisterPage from "./features/auth/pages/RegisterPage";
import {
  expireSession,
  restoreSession,
  retryRestore,
  signOut,
  useSession,
} from "./features/auth/session";
import {
  LegacyWorkspacePage,
  WorkspaceHome,
} from "./features/auth/components/WorkspaceRedirects";
import WorkspaceMessage from "./features/auth/components/WorkspaceMessage";
import { LoadingScreen } from "./components/ui/Spinner";

function LogoutPage() {
  useEffect(() => {
    void signOut();
  }, []);
  return <Navigate to="/login" replace />;
}

export default function App() {
  const { restoring, requestToken, restoreError } = useSession();
  useEffect(() => {
    void restoreSession();
  }, []);
  const onSessionExpired = useCallback(
    () => expireSession(requestToken ?? undefined),
    [requestToken],
  );

  return (
    <BrowserRouter>
      {restoring ? (
        <LoadingScreen label="Restoring session..." />
      ) : restoreError ? (
        <section className="flex min-h-screen items-center justify-center px-4">
          <div className="ui-card w-full max-w-md p-8 text-center">
            <h1 className="text-xl font-bold text-slate-900">
              We could not restore your session
            </h1>
            <p role="alert" className="mt-2 text-sm text-slate-600">
              {restoreError}
            </p>
            <button
              type="button"
              className="ui-btn-primary mt-6"
              onClick={() => void retryRestore()}
            >
              Try again
            </button>
          </div>
        </section>
      ) : (
        <Routes>
          <Route path="/" element={<WorkspaceHome />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/logout" element={<LogoutPage />} />
          {studentRoutes(requestToken, onSessionExpired)}
          {instructorRoutes()}
          {adminRoutes()}
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<LegacyWorkspacePage />} />
            <Route path="/profile" element={<LegacyWorkspacePage />} />
            <Route path="/notifications" element={<LegacyWorkspacePage />} />
          </Route>
          <Route
            element={<PrivateRoute allowedRoles={["INSTRUCTOR", "ADMIN"]} />}
          >
            <Route
              path="/grading-report"
              element={<LegacyWorkspacePage report />}
            />
          </Route>
          <Route
            path="*"
            element={<WorkspaceMessage title="Page not found" />}
          />
        </Routes>
      )}
    </BrowserRouter>
  );
}
