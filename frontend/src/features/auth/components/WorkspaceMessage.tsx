import { Link } from "react-router-dom";
import { useSession } from "../session";
import { workspaceHome } from "../workspaceAccess";

export default function WorkspaceMessage({
  title,
  denied = false,
}: {
  title: string;
  denied?: boolean;
}) {
  const { session } = useSession();
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
        {denied && (
          <p role="alert" className="mt-2 text-sm text-slate-600">
            Your current account does not have permission to open this page.
          </p>
        )}
        <Link
          className="mt-4 inline-block font-semibold text-blue-700 underline"
          to={workspaceHome(session?.user.roles ?? [])}
        >
          {session ? "Return to your workspace" : "Back to courses"}
        </Link>
      </div>
    </main>
  );
}
