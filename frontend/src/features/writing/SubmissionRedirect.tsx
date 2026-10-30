import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useSession } from "../auth/session";
import { isRecord, studentRequest } from "../../lib/api/studentRequest";

export default function SubmissionRedirect() {
  const { revisionId } = useParams();
  const { requestToken, session } = useSession();
  return (
    <Content
      key={`${revisionId}:${session?.user.id}`}
      id={revisionId ?? ""}
      token={requestToken ?? ""}
    />
  );
}
function Content({ id, token }: { id: string; token: string }) {
  const [attempt, setAttempt] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    studentRequest(`/submissions/${encodeURIComponent(id)}`, token, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!isRecord(value) || typeof value.attemptId !== "string")
          throw new Error("The submission link could not be verified.");
        if (!controller.signal.aborted) setAttempt(value.attemptId);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to open submission.",
          );
      });
    return () => controller.abort();
  }, [id, token]);
  if (attempt)
    return (
      <Navigate
        replace
        to={`/attempts/${encodeURIComponent(attempt)}?revision=${encodeURIComponent(id)}`}
      />
    );
  return (
    <main className="space-y-4 p-8">
      <p role={error ? "alert" : "status"}>
        {error || "Opening your feedback..."}
      </p>
      <Link to="/practice-history" className="text-blue-600">
        Open practice history
      </Link>
    </main>
  );
}
