import type { FormEvent, ReactNode } from "react";
import { button, panel } from "./managementApi";
export default function ActionForm({
  title,
  busy,
  children,
  submit,
  label = "Save",
}: {
  title: string;
  busy: boolean;
  children: ReactNode;
  submit: (data: FormData) => Promise<boolean>;
  label?: string;
}) {
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const saved = await submit(new FormData(form));
    if (saved) form.reset();
  }
  return (
    <form onSubmit={(event) => void handle(event)} className={panel}>
      <h2 className="text-lg font-bold">{title}</h2>
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        {children}
        <button className={button} type="submit">
          {busy ? "Saving..." : label}
        </button>
      </fieldset>
    </form>
  );
}
