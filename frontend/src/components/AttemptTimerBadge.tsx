import { resolveAttemptTimer } from "./attemptTimer";

export default function AttemptTimerBadge({
  expiresAt,
  now,
}: {
  expiresAt: string | null | undefined;
  now: number;
}) {
  const timer = resolveAttemptTimer(expiresAt, now);

  const toneClass =
    timer.kind === "expired"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : timer.kind === "urgent"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : timer.kind === "running"
          ? "border-blue-200 bg-[#eff6ff] text-[#1e40af]"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      role="timer"
      aria-live={timer.kind === "expired" ? "polite" : "off"}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums shadow-2xs ${toneClass}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>
        {timer.kind === "expired" ? "Time limit expired · 00:00" : timer.label}
      </span>
    </span>
  );
}
