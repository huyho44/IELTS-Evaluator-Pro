import { courseBackDestination } from "../returnDestination";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { safeReturn, useSession } from "../session";
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
  const from = safeReturn(location.state?.from);
  const backTo = courseBackDestination(from);
  if (session) return <Navigate to={from} replace />;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-[440px]">
        <Link to="/courses" className="text-xl font-bold text-blue-600">
          IELTS Evaluator Pro
        </Link>
        <Link
          to={backTo}
          className="mt-4 block text-sm text-slate-600 hover:underline"
        >
          {backTo === "/courses"
            ? "← Back to courses"
            : "← Back to course overview"}
        </Link>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mb-6 mt-2 text-sm text-slate-500">{description}</p>
          {children}
          <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">
            {register ? "Already have an account? " : "Don't have an account? "}
            <Link
              className="font-semibold text-blue-600 hover:underline"
              to={register ? "/login" : "/register"}
              state={{ from }}
            >
              {register ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
