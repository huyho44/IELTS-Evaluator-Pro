import { useRef, useState, type FormEvent } from "react";
import { authApi, authError } from "../services/authApi";
import FormAlert from "./FormAlert";
import PasswordField from "./PasswordField";

// Password change for the signed-in user. Other sessions are signed out by the
// server; this session stays active.
export default function ChangePasswordForm({
  buttonClassName,
}: {
  buttonClassName: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setMessage("");
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      setMessage(await authApi.changePassword(current, next));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (cause) {
      setError(
        authError(cause, "Unable to change the password. Please try again."),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="border-b border-slate-100 pb-2">
        <h2 className="text-base font-bold text-slate-900">Password</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Changing your password signs you out on every other device.
        </p>
      </div>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <PasswordField
          id="current-password"
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          maxLength={256}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            id="new-password"
            label="New password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            hint="At least 8 characters."
          />
          <PasswordField
            id="confirm-new-password"
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
          />
        </div>
        <button
          type="submit"
          className={`w-full rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 sm:w-auto ${buttonClassName}`}
        >
          {busy ? "Changing..." : "Change password"}
        </button>
        {message && <FormAlert tone="success">{message}</FormAlert>}
        {error && <FormAlert tone="error">{error}</FormAlert>}
      </fieldset>
    </form>
  );
}
