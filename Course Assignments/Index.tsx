import { useMemo, useState } from "react";

const navigationItems = [
  { label: "Overview", icon: "grid" },
  { label: "Courses", icon: "book" },
  { label: "Assignments", icon: "clipboard", active: true },
  { label: "People", icon: "users" },
  { label: "Reports", icon: "chart" },
];

const assignmentRows = [
  {
    title: "Introduction to Biology",
    course: "BIO 101",
    dueDate: "Sep 24, 2024",
    assigned: 28,
    completed: 21,
    status: "Published",
  },
  {
    title: "Cell Structure and Function",
    course: "BIO 101",
    dueDate: "Sep 27, 2024",
    assigned: 28,
    completed: 16,
    status: "Published",
  },
  {
    title: "Chemical Reactions",
    course: "CHEM 110",
    dueDate: "Oct 1, 2024",
    assigned: 24,
    completed: 9,
    status: "Published",
  },
  {
    title: "Lab Safety Review",
    course: "CHEM 110",
    dueDate: "Oct 4, 2024",
    assigned: 24,
    completed: 24,
    status: "Completed",
  },
  {
    title: "Scientific Method",
    course: "SCI 100",
    dueDate: "Oct 8, 2024",
    assigned: 32,
    completed: 0,
    status: "Draft",
  },
];

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M4 5.5v16M8 7h8M8 11h8" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M8 9h8M8 13h8M8 17h5" />
      </>
    ),
    users: (
      <>
        <path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20" />
        <circle cx="10" cy="7" r="3.5" />
        <path d="M16 11a3.5 3.5 0 0 0 0-7M17 14.2a4.5 4.5 0 0 1 3 4.3V20" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5M4 19h17" />
        <path d="m7 15 3-4 3 2 5-7" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    chevron: (
      <>
        <path d="m6 9 6 6 6-6" />
      </>
    ),
    dots: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
  };

  return <svg {...commonProps}>{paths[name]}</svg>;
}

export function AdminHeaderSection() {
  return (
    <header
      className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-7"
      data-id="admin-header-section"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          A
        </div>
        <span className="text-[18px] font-semibold tracking-[-0.02em] text-slate-900">
          Acme Academy
        </span>
      </div>
      <div className="flex items-center gap-5">
        <button
          type="button"
          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Notifications"
        >
          <Icon name="bell" size={19} />
        </button>
        <div className="h-7 w-px bg-slate-200" />
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-50"
          aria-label="Open account menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">
            JD
          </span>
          <span className="hidden text-sm font-medium text-slate-700 sm:block">
            Jordan Davis
          </span>
          <Icon name="chevron" size={15} />
        </button>
      </div>
    </header>
  );
}

export function AdministrationNavigationSection() {
  return (
    <aside
      className="w-60 shrink-0 border-r border-slate-200 bg-white px-3 py-6"
      data-id="administration-navigation-section"
    >
      <nav aria-label="Administration navigation">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
          Administration
        </p>
        <ul className="space-y-1">
          {navigationItems.map((item) => (
            <li key={item.label}>
              <a
                href={`#${item.label.toLowerCase()}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  item.active
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
                aria-current={item.active ? "page" : undefined}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="my-7 border-t border-slate-100" />
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
          Workspace
        </p>
        <a
          href="#settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center text-base">
            ⚙
          </span>
          Settings
        </a>
      </nav>
      <div className="mt-auto pt-40">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-700">Need help?</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Visit our help center for answers and guides.
          </p>
          <a
            href="#help"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600"
          >
            Help center <Icon name="arrow" size={13} />
          </a>
        </div>
      </div>
    </aside>
  );
}

export function CourseAssignmentsSection() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All assignments");
  const [showMenu, setShowMenu] = useState(null);

  const filteredAssignments = useMemo(() => {
    return assignmentRows.filter((assignment) => {
      const matchesQuery =
        assignment.title.toLowerCase().includes(query.toLowerCase()) ||
        assignment.course.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        filter === "All assignments" ||
        assignment.status.toLowerCase() === filter.toLowerCase();
      return matchesQuery && matchesFilter;
    });
  }, [query, filter]);

  return (
    <main
      className="min-w-0 flex-1 bg-slate-50 px-8 py-8"
      data-id="course-assignments-section"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-indigo-600">
              Courses / Assignments
            </p>
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">
              Course assignments
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Create, manage, and track assignments across your courses.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Icon name="plus" size={17} strokeWidth={2.2} />
            New assignment
          </button>
        </div>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            ["Total assignments", "24", "Across 6 courses"],
            ["Active learners", "136", "Currently enrolled"],
            ["Completion rate", "78%", "Up 6% this month"],
          ].map(([label, value, detail]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  {value}
                </p>
                <p className="text-xs font-medium text-emerald-600">{detail}</p>
              </div>
            </div>
          ))}
        </div>
        <section
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          aria-labelledby="assignments-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <h2
              id="assignments-heading"
              className="text-base font-semibold text-slate-900"
            >
              All assignments
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative">
                <span className="sr-only">Search assignments</span>
                <Icon name="search" size={16} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search assignments"
                  className="h-9 w-52 rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                  <Icon name="search" size={16} />
                </span>
              </label>
              <label>
                <span className="sr-only">Filter assignments</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option>All assignments</option>
                  <option>Published</option>
                  <option>Completed</option>
                  <option>Draft</option>
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Assignment</th>
                  <th className="px-5 py-3">Due date</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((assignment) => {
                  const progress = assignment.assigned
                    ? Math.round(
                        (assignment.completed / assignment.assigned) * 100,
                      )
                    : 0;
                  return (
                    <tr
                      key={assignment.title}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-800">
                          {assignment.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {assignment.course}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {assignment.dueDate}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600">
                            {assignment.completed}/{assignment.assigned}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            assignment.status === "Published"
                              ? "bg-emerald-50 text-emerald-700"
                              : assignment.status === "Completed"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {assignment.status}
                        </span>
                      </td>
                      <td className="relative px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setShowMenu(
                              showMenu === assignment.title
                                ? null
                                : assignment.title,
                            )
                          }
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Actions for ${assignment.title}`}
                          aria-expanded={showMenu === assignment.title}
                        >
                          <Icon name="dots" size={18} />
                        </button>
                        {showMenu === assignment.title && (
                          <div className="absolute right-5 top-12 z-10 w-32 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              Edit assignment
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              View details
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredAssignments.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                No assignments match your search.
              </p>
            )}
          </div>
          <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            Showing {filteredAssignments.length} of {assignmentRows.length}{" "}
            assignments
          </div>
        </section>
      </div>
    </main>
  );
}

export const ElementAdminPhnCng = () => {
  return (
    <div className="flex min-h-screen min-w-[320px] flex-col bg-slate-50 text-slate-900">
      <AdminHeaderSection />
      <div className="flex flex-1">
        <AdministrationNavigationSection />
        <CourseAssignmentsSection />
      </div>
    </div>
  );
};

export default ElementAdminPhnCng;
    