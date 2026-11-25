import { Outlet } from "react-router-dom";
import WorkspaceShell, {
  type ShellNavGroup,
} from "../../components/layout/WorkspaceShell";
import { useSession } from "../auth/session";

const GROUPS: ShellNavGroup[] = [
  {
    label: "Administration",
    items: [
      { to: "/admin", label: "Accounts", subtitle: "Roles & access status", icon: "users", end: true },
      { to: "/admin/instructor-approvals", label: "Instructor approvals", subtitle: "Review applications", icon: "checkSquare" },
      { to: "/admin/course-assignments", label: "Course assignments", subtitle: "Owners & reviewers", icon: "book" },
      { to: "/admin/discussions", label: "Discussions", subtitle: "Course Q&A threads", icon: "messageSquare" },
    ],
  },
  {
    label: "Curriculum & grading",
    items: [
      { to: "/admin/skills", label: "Skill catalog", subtitle: "Skills & prerequisites", icon: "layers" },
      { to: "/admin/authoring", label: "Grading setup", subtitle: "Courses & AI config", icon: "settings" },
      { to: "/admin/reports", label: "Grading reports", subtitle: "Operations & latency", icon: "barChart" },
    ],
  },
];

export default function AdminLayout() {
  const { session } = useSession();
  const roles = session?.user.roles ?? [];

  return (
    <WorkspaceShell
      workspace="admin"
      caption="Admin console"
      homeTo="/admin"
      accountBase="/admin"
      currentRole="ADMIN"
      roleLabel={roles.includes("INSTRUCTOR") ? "Admin · Instructor" : "Administrator"}
      groups={GROUPS}
      labels={{
        nav: "Administration",
        openMenu: "Open administration menu",
        closeMenu: "Close administration menu",
        accountMenu: "Open admin account menu",
      }}
    >
      <Outlet />
    </WorkspaceShell>
  );
}
