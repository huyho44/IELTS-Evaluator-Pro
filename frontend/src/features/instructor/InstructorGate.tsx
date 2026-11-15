import { Navigate, useLocation } from "react-router-dom";
import PrivateRoute from "../auth/components/PrivateRoute";
import { useSession } from "../auth/session";

export default function InstructorGate() {
  const { session } = useSession();
  const { pathname, search, hash } = useLocation();
  const roles = session?.user.roles ?? [];
  if (
    /^\/teacher\/authoring\/?$/i.test(pathname) &&
    roles.includes("ADMIN") &&
    !roles.includes("INSTRUCTOR")
  ) {
    return <Navigate to={"/admin/authoring" + search + hash} replace />;
  }
  return <PrivateRoute allowedRoles={["INSTRUCTOR"]} />;
}
