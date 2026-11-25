import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../session";
import WorkspaceMessage from "./WorkspaceMessage";
import { LoadingScreen } from "../../../components/ui/Spinner";

export default function PrivateRoute({
  allowedRoles,
  allowGuests = false,
}: {
  allowedRoles?: readonly string[];
  allowGuests?: boolean;
}) {
  const { session, restoring } = useSession();
  const { pathname, search, hash } = useLocation();

  if (restoring) return <LoadingScreen label="Restoring session..." />;
  if (!session) {
    return allowGuests ? (
      <Outlet />
    ) : (
      <Navigate
        to="/login"
        replace
        state={{ from: pathname + search + hash }}
      />
    );
  }
  if (
    allowedRoles &&
    !allowedRoles.some((role) => session.user.roles.includes(role))
  ) {
    return <WorkspaceMessage title="Access denied" denied />;
  }
  return <Outlet />;
}
