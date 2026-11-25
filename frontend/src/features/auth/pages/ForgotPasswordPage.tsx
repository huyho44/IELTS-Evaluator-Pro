import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import FormAlert from "../components/FormAlert";
import Spinner from "../../../components/ui/Spinner";
import { authApi, authError } from "../services/authApi";

const backToSignIn = (
  <Link
    className="font-semibold text-brand-700 underline-offset-4 hover:underline"
    to="/login"
  >
    Back to sign in
  </Link>
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      setSent(await authApi.forgotPassword(email.trim()));
    } catch (cause) {
      setError(
        authError(cause, "Unable to send the reset link. Please try again."),
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter the email you use to sign in and we will send you a link to choose a new password."
      footer={backToSignIn}
    >
      {sent ? (
        <div className="space-y-4">
          <FormAlert tone="success">{sent}</FormAlert>
          <p className="text-sm text-slate-600">
            The link expires in 30 minutes and works once. Check your spam
            folder if it does not arrive.
          </p>
          <button
            type="button"
            className="ui-btn-secondary min-h-11 w-full"
            onClick={() => setSent("")}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-5">
          {error && <FormAlert tone="error">{error}</FormAlert>}
          <div>
            <label htmlFor="forgot-email" className="ui-label">
              Email address
            </label>
            <input
              type="email"
              id="forgot-email"
              placeholder="name@example.com"
              autoComplete="email"
              inputMode="email"
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="ui-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="ui-btn-primary min-h-11 w-full"
          >
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
