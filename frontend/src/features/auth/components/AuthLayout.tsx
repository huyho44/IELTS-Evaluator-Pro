import { courseBackDestination } from "../returnDestination";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { safeReturn, useSession } from "../session";
import { signedInDestination } from "../workspaceAccess";
import Icon, { type IconName } from "../../../components/ui/Icon";
import Logo, { LogoMark } from "../../../components/ui/Logo";

const HIGHLIGHTS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "sparkles",
    title: "Instant band estimates",
    body: "AI-assisted scoring on every Writing attempt, aligned to the IELTS criteria.",
  },
  {
    icon: "pen",
    title: "Feedback from real instructors",
    body: "Request a review and get annotated comments on your essays.",
  },
  {
    icon: "target",
    title: "Progress toward your target",
    body: "Track every practice attempt and see which skills to work on next.",
  },
];
export default function AuthLayout({
  title,
  description,
  children,
  register = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  register?: boolean;
}) {
  const { session } = useSession();
  const location = useLocation();
  const from = safeReturn(location.state?.from, "/");
  const backTo = courseBackDestination(from);
  if (session) return <Navigate to={signedInDestination(from, session.user.roles)} replace />;
  return (
    <main
      data-workspace="student"
      className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
    >
      <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_400px_at_0%_0%,rgb(var(--brand-600)/0.55),transparent_70%),radial-gradient(500px_360px_at_100%_100%,rgb(var(--brand-500)/0.35),transparent_70%)]"
        />
        <Link
          to="/courses"
          className="relative flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-white"
        >
          <LogoMark className="h-10 w-10 bg-white/10 ring-1 ring-white/20" />
          <span className="text-lg font-bold tracking-tight">IELTS Evaluator Pro</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Reach your target band with focused, measurable practice.
          </h2>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon name={item.icon} size={19} />
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-white/70">
                    {item.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">
          Practice for IELTS Academic and General Training.
        </p>
      </aside>

      <div className="flex flex-col px-4 py-6 sm:px-8 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/courses"
            className="rounded-lg focus-visible:outline-offset-4 lg:invisible"
            aria-label="IELTS Evaluator Pro, go to courses"
          >
            <Logo />
          </Link>
          <Link
            to={backTo}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Icon name="arrowLeft" size={16} />
            {backTo === "/courses" ? "Back to courses" : "Back to course overview"}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <section className="w-full max-w-[420px]">
            <h1 className="text-[28px] font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mb-8 mt-2 text-[15px] text-slate-600">{description}</p>
            {children}
            <p className="mt-8 text-center text-sm text-slate-600">
              {register ? "Already have an account? " : "Don't have an account? "}
              <Link
                className="font-semibold text-brand-700 underline-offset-4 hover:underline"
                to={register ? "/login" : "/register"}
                state={{ from }}
              >
                {register ? "Sign in" : "Sign up"}
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
