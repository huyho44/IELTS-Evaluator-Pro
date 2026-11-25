import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import FormAlert from "../components/FormAlert";
import PasswordField from "../components/PasswordField";
import Spinner from "../../../components/ui/Spinner";
import { currentSession, expireSession } from "../session";
import { authApi, authError } from "../services/authApi";

const linkClass =
  "font-semibold text-brand-700 underline-offset-4 hover:underline";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const validToken = /^[0-9a-f]{64}$/i.test(token);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      await authApi.resetPassword(token, password);
      // The server signed out every session, including one in this browser.
      expireSession(currentSession()?.accessToken);
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (cause) {
      setError(
        authError(cause, "Unable to reset the password. Please try again."),
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description="Your new password must be at least 8 characters. All signed-in devices will be signed out."
      allowSignedIn
      footer={
        <Link className={linkClass} to="/login">
          Back to sign in
        </Link>
      }
    >
      {!validToken ? (
        <div className="space-y-4">
          <FormAlert tone="error">
            This reset link is incomplete or invalid.
          </FormAlert>
          <Link to="/forgot-password" className="ui-btn-primary min-h-11 w-full">
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-5">
          {error && (
            <FormAlert tone="error">
              {error}{" "}
              {/expired|invalid/i.test(error) && (
                <Link className={linkClass} to="/forgot-password">
                  Request a new link
                </Link>
              )}
            </FormAlert>
          )}
          <PasswordField
            id="reset-password"
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            hint="At least 8 characters."
          />
          <PasswordField
            id="reset-password-confirm"
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
          />
          <button
            type="submit"
            disabled={loading}
            className="ui-btn-primary min-h-11 w-full"
          >
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "Saving..." : "Reset password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
