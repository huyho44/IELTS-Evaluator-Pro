import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../session";
import { workspaceHome, workspacePath } from "../workspaceAccess";

export function WorkspaceHome() {
  const { session } = useSession();
  return <Navigate to={workspaceHome(session?.user.roles ?? [])} replace />;
}

export function LegacyWorkspacePage({ report = false }: { report?: boolean }) {
  const { session } = useSession();
  const { pathname, search, hash } = useLocation();
  const roles = session?.user.roles ?? [];
  const target = workspacePath(
    roles,
    report ? "/reports" : pathname.toLowerCase(),
  );
  return <Navigate to={target + search + hash} replace />;
}
