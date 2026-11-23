import { useState } from "react";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  maxLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="ui-label">
        {label}
      </label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          id={id}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          aria-describedby={hintId}
          className="ui-input pr-16"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-1 right-1 min-w-12 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
