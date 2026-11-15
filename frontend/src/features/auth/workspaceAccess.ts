export const WORKSPACES = [
  { role: "ADMIN", name: "Admin", home: "/admin" },
  { role: "INSTRUCTOR", name: "Instructor", home: "/teacher/reviews" },
  { role: "LEARNER", name: "Student", home: "/learning" },
] as const;

export function workspaceHome(roles: readonly string[]) {
  return (
    WORKSPACES.find(({ role }) => roles.includes(role))?.home ?? "/courses"
  );
}

export function workspacePath(roles: readonly string[], suffix: string) {
  const home = workspaceHome(roles);
  const prefix =
    home === "/admin"
      ? "/admin"
      : home === "/teacher/reviews"
        ? "/teacher"
        : "/student";
  return prefix + suffix;
}

// Route guards still enforce access when a URL is entered directly.
export function signedInDestination(path: string, roles: readonly string[]) {
  const pathname = path.split(/[?#]/, 1)[0].toLowerCase();
  if (pathname === "/") return workspaceHome(roles);
  if (/^\/admin(?:\/|$)/.test(pathname)) {
    return roles.includes("ADMIN") ? path : workspaceHome(roles);
  }
  if (/^\/teacher(?:\/|$)/.test(pathname)) {
    if (
      /^\/teacher\/authoring\/?$/.test(pathname) &&
      roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR")
    ) {
      return "/admin/authoring" + path.slice(pathname.length);
    }
    return roles.includes("INSTRUCTOR") ? path : workspaceHome(roles);
  }
  if (/^\/grading-report\/?$/.test(pathname)) {
    return roles.some((role) => role === "ADMIN" || role === "INSTRUCTOR")
      ? path
      : workspaceHome(roles);
  }
  if (/^\/(?:dashboard|profile|notifications)\/?$/.test(pathname)) {
    return path;
  }
  return roles.includes("LEARNER") ? path : workspaceHome(roles);
}
