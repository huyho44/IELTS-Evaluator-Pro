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

const THEMES: Record<RoleVariant, WorkspaceTheme> = {
  student: {
    variant: "student",
    eyebrowText: "text-[#2563eb]",
    primaryButton:
      "bg-[#2563eb] text-white hover:bg-blue-700 focus-visible:outline-[#2563eb]",
    outlineButton:
      "border-slate-200 bg-white text-[#1e40af] hover:border-blue-200 hover:bg-[#eff6ff]/60",
    avatarBadge: "bg-[#2563eb] text-white",
    unreadBadge: "border-blue-200 bg-[#eff6ff] text-[#1e40af]",
    unreadCardBorder: "border-l-[#2563eb] bg-[#eff6ff]/35 hover:bg-[#eff6ff]/55",
    accentLink: "text-[#1e40af] hover:text-[#2563eb]",
    accentSummary: "text-[#1e40af]",
    chipBadge: "bg-[#eff6ff] text-[#1e40af]",
    sectionBorder: "border-slate-200/80",
  },
  instructor: {
    variant: "instructor",
    eyebrowText: "text-teal-700",
    primaryButton:
      "bg-teal-700 text-white hover:bg-teal-800 focus-visible:outline-teal-700",
    outlineButton:
      "border-teal-200 bg-white text-teal-800 hover:border-teal-300 hover:bg-teal-50/70",
    avatarBadge: "bg-teal-700 text-white",
    unreadBadge: "border-teal-200 bg-teal-50 text-teal-800",
    unreadCardBorder: "border-l-teal-600 bg-teal-50/45 hover:bg-teal-50/70",
    accentLink: "text-teal-700 hover:text-teal-900",
    accentSummary: "text-teal-800",
    chipBadge: "bg-teal-50 text-teal-800 border border-teal-200",
    sectionBorder: "border-teal-100",
  },
  admin: {
    variant: "admin",
    eyebrowText: "text-violet-700",
    primaryButton:
      "bg-violet-700 text-white hover:bg-violet-800 focus-visible:outline-violet-700",
    outlineButton:
      "border-violet-200 bg-white text-violet-900 hover:border-violet-300 hover:bg-violet-50",
    avatarBadge: "bg-violet-700 text-white",
    unreadBadge: "border-violet-200 bg-violet-50 text-violet-800",
    unreadCardBorder: "border-l-violet-700 bg-violet-50/45 hover:bg-violet-50/70",
    accentLink: "text-violet-800 hover:text-violet-950",
    accentSummary: "text-violet-800",
    chipBadge: "bg-violet-50 text-violet-900 border border-violet-200",
    sectionBorder: "border-violet-100",
  },
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
    return "border border-violet-200 bg-violet-50 text-violet-900";
  }
  if (role === "INSTRUCTOR") {
    return "border border-teal-200 bg-teal-50 text-teal-800";
  }
  return "border border-blue-200 bg-blue-50 text-blue-800";
}
