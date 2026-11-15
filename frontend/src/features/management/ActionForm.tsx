import type { FormEvent, ReactNode } from "react";
import { button, panel } from "./managementApi";

export type RoleVariant = "admin" | "instructor" | "student";

const VARIANT_BUTTONS: Record<RoleVariant, string> = {
  admin:
    "rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-2xs transition-colors hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700 disabled:opacity-50",
  instructor:
    "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-2xs transition-colors hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50",
  student: button,
};

export default function ActionForm({
  title,
  description,
  busy,
  children,
  submit,
  label = "Save",
  variant = "student",
  resetOnSuccess = true,
  submitDisabled = false,
}: {
  title: string;
  description?: string;
  busy: boolean;
  children: ReactNode;
  submit: (data: FormData) => Promise<boolean>;
  label?: string;
  variant?: RoleVariant;
  resetOnSuccess?: boolean;
  submitDisabled?: boolean;
}) {
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const saved = await submit(new FormData(form));
    if (saved && resetOnSuccess) form.reset();
  }
  return (
    <form
      onSubmit={(event) => void handle(event)}
      className={`${panel} shadow-2xs`}
    >
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <fieldset disabled={busy} className="min-w-0 space-y-3.5">
        {children}
        <div className="pt-1">
          <button
            className={VARIANT_BUTTONS[variant]}
            disabled={busy || submitDisabled}
            type="submit"
          >
            {busy ? "Saving..." : label}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
