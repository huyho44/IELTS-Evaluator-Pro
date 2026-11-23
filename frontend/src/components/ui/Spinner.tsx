export default function Spinner({ className = "h-5 w-5 text-brand-600" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`animate-spin motion-reduce:animate-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Centered full-area loading state with a live status message. */
export function LoadingScreen({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-sm font-medium text-slate-500"
    >
      <Spinner className="h-7 w-7 text-brand-600" />
      <span>{label}</span>
    </div>
  );
}
