import type { RoleVariant } from "./ActionForm";

export type WorkspaceTheme = {
  variant: RoleVariant;
  eyebrowText: string;
  primaryButton: string;
  outlineButton: string;
  avatarBadge: string;
  unreadBadge: string;
  unreadCardBorder: string;
  accentLink: string;
  accentSummary: string;
  chipBadge: string;
  sectionBorder: string;
};

// Hue comes from the workspace `brand` scale (see index.css), so every
// workspace shares the same class recipe.
const BASE_THEME: Omit<WorkspaceTheme, "variant"> = {
  eyebrowText: "text-brand-700",
  primaryButton:
    "bg-brand-600 text-white shadow-xs hover:bg-brand-700 focus-visible:outline-brand-500",
  outlineButton:
    "border-slate-200 bg-white text-slate-800 shadow-xs hover:border-slate-300 hover:bg-slate-50",
  avatarBadge: "bg-brand-600 text-white",
  unreadBadge: "border-brand-200 bg-brand-50 text-brand-800",
  unreadCardBorder: "border-l-brand-600 bg-brand-50/40 hover:bg-brand-50/70",
  accentLink: "text-brand-700 hover:text-brand-900",
  accentSummary: "text-brand-800",
  chipBadge: "border border-brand-200 bg-brand-50 text-brand-800",
  sectionBorder: "border-slate-200/80",
};

const THEMES: Record<RoleVariant, WorkspaceTheme> = {
  student: { variant: "student", ...BASE_THEME },
  instructor: { variant: "instructor", ...BASE_THEME },
  admin: { variant: "admin", ...BASE_THEME },
};

export function resolveWorkspaceVariant(
  pathname: string,
  student = false,
): RoleVariant {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/teacher")) return "instructor";
  return student ? "student" : "admin";
}

export function getWorkspaceTheme(
  pathname: string,
  student = false,
): WorkspaceTheme {
  return THEMES[resolveWorkspaceVariant(pathname, student)];
}

export function getRoleBadgeClass(role: string): string {
  if (role === "ADMIN") {
    return "border border-slate-300 bg-slate-100 text-slate-800";
  }
  if (role === "INSTRUCTOR") {
    return "border border-teal-200 bg-teal-50 text-teal-800";
  }
  return "border border-indigo-200 bg-indigo-50 text-indigo-800";
}
