import { Outlet } from "react-router-dom";
import { useSession } from "../../../features/auth/session";
import WorkspaceShell from "../WorkspaceShell";
import { INSTRUCTOR_NAV_ITEMS } from "./instructorNav";

const ICONS = {
  "review-queue": "checkSquare",
  "course-authoring": "book",
  "grading-reports": "barChart",
} as const;

const GROUPS = [
  {
    label: "Workspace",
    items: INSTRUCTOR_NAV_ITEMS.map((item) => ({
      to: item.to,
      label: item.label,
      subtitle: item.subtitle,
      icon: ICONS[item.key],
    })),
  },
];

export default function InstructorLayout() {
  const { session } = useSession();
  if (!session) return null;

  return (
    <WorkspaceShell
      workspace="instructor"
      caption="Instructor workspace"
      homeTo="/teacher/reviews"
      accountBase="/teacher"
      currentRole="INSTRUCTOR"
      roleLabel={session.user.roles.includes("ADMIN") ? "Admin · Instructor" : "Instructor"}
      groups={GROUPS}
      labels={{
        nav: "Instructor navigation",
        openMenu: "Open instructor menu",
        closeMenu: "Close instructor menu",
        accountMenu: "Open instructor account menu",
      }}
    >
      <Outlet />
    </WorkspaceShell>
  );
}
