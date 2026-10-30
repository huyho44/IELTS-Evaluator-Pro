import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../auth/session";
import { StudentApiError } from "../../lib/api/studentRequest";
import { getStudentAttempt, type StudentAttempt } from "../writing/writingApi";
import WritingAttemptPage from "../writing/WritingAttemptPage";
import PracticeAttemptPage from "./PracticeAttemptPage";

type Props = { accessToken?: string | null; onSessionExpired?: () => void };
export default function AttemptPage(props: Props) {
  const { attemptId } = useParams();
  const { requestToken, session } = useSession();
  const token = props.accessToken ?? requestToken;
  return (
    <AttemptContent
      key={`${attemptId}:${session?.user.id}`}
      attemptId={attemptId ?? ""}
      accessToken={token ?? ""}
      onSessionExpired={props.onSessionExpired}
    />
  );
}
function AttemptContent({
  attemptId,
  accessToken,
  onSessionExpired,
}: {
  attemptId: string;
  accessToken: string;
  onSessionExpired?: () => void;
}) {
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await getStudentAttempt(
          attemptId,
          accessToken,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setAttempt(result);
          setError("");
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to open this attempt.",
        );
        if (cause instanceof StudentApiError && cause.status === 401)
          onSessionExpired?.();
      }
    }
    void load();
    return () => controller.abort();
  }, [attemptId, accessToken, onSessionExpired, reloadKey]);
  if (error)
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-8">
        <p role="alert" className="text-red-700">
          {error}
        </p>
        <button
          onClick={() => setReloadKey((value) => value + 1)}
          className="text-blue-600"
        >
          Try again
        </button>
        <Link to="/practice-history" className="block text-blue-600">
          Open your practice history
        </Link>
      </main>
    );
  if (!attempt)
    return (
      <main className="p-8" role="status">
        Loading attempt...
      </main>
    );
  const mode = attempt.assignmentVersion.assignment.activity.responseMode;
  if (mode === "WRITING")
    return (
      <WritingAttemptPage
        initialAttempt={attempt}
        accessToken={accessToken}
        onSessionExpired={onSessionExpired}
      />
    );
  if (mode === "OBJECTIVE")
    return (
      <PracticeAttemptPage
        accessToken={accessToken}
        onSessionExpired={onSessionExpired}
      />
    );
  return (
    <main className="p-8">
      <p>
        This Speaking activity requires an audio submission workflow. Your
        attempt is preserved.
      </p>
      <Link className="mt-4 block text-blue-600" to="/practice-history">
        Back to your attempts
      </Link>
    </main>
  );
}
