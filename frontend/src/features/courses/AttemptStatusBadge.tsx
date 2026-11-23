export default function AttemptStatusBadge({ status }: { status: string }) {
  const color =
    status === "SUBMITTED" || status === "FINISHED"
      ? "bg-emerald-50 text-emerald-700"
      : status === "IN_PROGRESS"
        ? "bg-brand-50 text-brand-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}
    >
      {status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^./, (s) => s.toUpperCase())}
    </span>
  );
}
