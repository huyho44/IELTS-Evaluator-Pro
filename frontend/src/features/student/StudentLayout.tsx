import { Outlet } from "react-router-dom";
import StudentNavbar from "../../components/StudentNavbar";
import { useSession } from "../auth/session";

export default function StudentLayout() {
  const { session } = useSession();
  return (
    <>
      <StudentNavbar key={session?.user.id ?? "guest"} />
      <Outlet />
    </>
  );
}
