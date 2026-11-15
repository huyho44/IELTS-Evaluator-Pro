import { Link } from "react-router-dom";
import { WORKSPACES } from "../workspaceAccess";

export default function WorkspaceLinks({
  roles,
  currentRole,
  className,
  onNavigate,
}: {
  roles: readonly string[];
  currentRole: string;
  className: string;
  onNavigate?: () => void;
}) {
  return WORKSPACES.filter(
    ({ role }) => role !== currentRole && roles.includes(role),
  ).map(({ role, name, home }) => (
    <Link key={role} to={home} className={className} onClick={onNavigate}>
      {name} workspace
    </Link>
  ));
}
