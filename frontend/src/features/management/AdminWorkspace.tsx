import { Link, Outlet, useLocation } from "react-router-dom";

const sections = [
  ["/admin", "Overview"], ["/admin/manage", "Users & instructors"],
  ["/admin/catalog", "Courses"], ["/admin/skills", "Skills"], ["/grading-report", "Reports"],
];
export default function AdminWorkspace() {
  const { pathname } = useLocation();
  const courses = pathname === "/admin/catalog" || pathname === "/admin/assign" || pathname.startsWith("/courses/") || pathname === "/teacher/authoring";
  return <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[210px_minmax(0,1fr)]">
    <aside className="bg-slate-900 p-4 text-white md:sticky md:top-0 md:h-screen">
      <Link to="/admin" className="text-sm font-bold">IELTS Evaluator Pro</Link>
      <nav aria-label="Admin navigation" className="mt-4 flex flex-wrap gap-1 md:flex-col">
        {sections.map(([to,label]) => {
          const active = pathname === to || (to === "/admin/catalog" && courses);
          return <Link key={to} to={to} aria-current={active ? "page" : undefined} className={"rounded-lg px-3 py-2 text-sm " + (active ? "bg-blue-600 font-semibold text-white" : "text-slate-200 hover:bg-slate-800")}>{label}</Link>;
        })}
      </nav>
    </aside>
    <div className="min-w-0">
      <nav aria-label="Account" className="flex justify-end gap-5 border-b border-slate-200 bg-white px-5 py-3 text-sm">
        <Link to="/notifications">Notifications</Link><Link to="/profile">Profile</Link><Link to="/logout">Sign out</Link>
      </nav>
      {courses && <nav aria-label="Course management" className="flex flex-wrap gap-4 px-5 pt-4 text-sm font-semibold text-blue-700">
        <Link to="/admin/catalog">Catalog</Link><Link to="/teacher/authoring">Authoring</Link><Link to="/admin/assign">Assign instructor</Link>
      </nav>}
      <Outlet />
    </div>
  </div>;
}
