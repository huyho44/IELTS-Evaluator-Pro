type LogoProps = {
  /** Hide the wordmark and show only the mark. */
  compact?: boolean;
  /** Small caption under the wordmark, e.g. "Instructor". */
  caption?: string;
  className?: string;
};

/** Brand mark: three ascending band bars on the workspace brand colour. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[10px] bg-brand-600 text-white shadow-xs ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="currentColor">
        <rect x="3" y="13" width="4.5" height="8" rx="2.25" opacity="0.55" />
        <rect x="9.75" y="8" width="4.5" height="13" rx="2.25" opacity="0.8" />
        <rect x="16.5" y="3" width="4.5" height="18" rx="2.25" />
      </svg>
    </span>
  );
}

export default function Logo({ compact = false, caption, className = "" }: LogoProps) {
  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <LogoMark />
      {!compact && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-[15px] font-bold tracking-tight text-slate-900">
            IELTS Evaluator <span className="text-brand-600">Pro</span>
          </span>
          {caption && (
            <span className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {caption}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
