import { useId, useState } from "react";
import { discussionError } from "../discussions/discussionsApi";
import { moderationApi, type ReportTargetType } from "./moderationApi";

// Inline "Report" control for posts, lessons/practices and courses.
export default function ReportButton({
  targetType,
  targetId,
  label = "Report",
  className = "text-xs font-semibold text-slate-500 hover:text-red-600 hover:underline",
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const id = useId();

  if (sent)
    return (
      <span role="status" className="text-xs text-emerald-700">
        Thanks. Your report was sent to the moderators.
      </span>
    );
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
    );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !reason.trim()) return;
        setBusy(true);
        setError("");
        moderationApi
          .report(targetType, targetId, reason.trim())
          .then(() => setSent(true))
          .catch((cause) =>
            setError(discussionError(cause, "Unable to send the report.")),
          )
          .finally(() => setBusy(false));
      }}
      className="mt-2 w-full max-w-md space-y-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        Why is this content inappropriate?
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={2000}
        required
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="ui-input text-sm"
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !reason.trim()}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "Sending..." : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
