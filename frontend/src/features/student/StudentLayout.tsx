import { Outlet } from "react-router-dom";
import StudentNavbar from "../../components/StudentNavbar";
import { useSession } from "../auth/session";

export default function StudentLayout() {
  const { session } = useSession();
  return (
    <div data-workspace="student" className="min-h-screen bg-canvas">
      <StudentNavbar key={session?.user.id ?? "guest"} />
      <Outlet />
    </div>
  );
}
