import { Link } from "react-router-dom";
import { useSession } from "../session";
import { workspaceHome } from "../workspaceAccess";
import Icon from "../../../components/ui/Icon";

export default function WorkspaceMessage({
  title,
  denied = false,
}: {
  title: string;
  denied?: boolean;
}) {
  const { session } = useSession();
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="ui-card w-full max-w-md p-8 text-center">
        <span
          aria-hidden="true"
          className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${
            denied ? "bg-amber-50 text-amber-600" : "bg-brand-50 text-brand-600"
          }`}
        >
          <Icon name={denied ? "shield" : "alert"} size={24} />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">{title}</h1>
        {denied ? (
          <p role="alert" className="mt-2 text-sm leading-relaxed text-slate-600">
            Your current account does not have permission to open this page.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The link may be broken, or the page may have moved.
          </p>
        )}
        <Link
          className="ui-btn-primary mt-6"
          to={workspaceHome(session?.user.roles ?? [])}
        >
          {session ? "Return to your workspace" : "Back to courses"}
        </Link>
      </div>
    </main>
  );
}
