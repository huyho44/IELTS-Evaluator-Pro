import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signIn } from '../session';
import Spinner from '../../../components/ui/Spinner';
import FormAlert from './FormAlert';
import PasswordField from './PasswordField';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError('');
    setLoading(true);

    try {
      await signIn({ email, password });
      setPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="w-full space-y-5">
      {location.state?.registered && (
        <FormAlert tone="success">Account created. Please sign in.</FormAlert>
      )}
      {location.state?.passwordReset && (
        <FormAlert tone="success">
          Your password has been reset. Sign in with your new password.
        </FormAlert>
      )}
      {error && <FormAlert tone="error">{error}</FormAlert>}

      <div>
        <label htmlFor="login-email" className="ui-label">Email address</label>
        <input
          type="email"
          placeholder="name@example.com"
          id="login-email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="ui-input"
        />
      </div>

      <PasswordField
        id="login-password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <div className="-mt-2 flex justify-end">
        <Link
          to="/forgot-password"
          className="rounded text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <button type="submit" disabled={loading} className="ui-btn-primary min-h-11 w-full">
        {loading && <Spinner className="h-4 w-4" />}
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
