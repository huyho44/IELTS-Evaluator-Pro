import { isAxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { safeReturn } from '../session';
import { authApi } from '../services/authApi';
import Spinner from '../../../components/ui/Spinner';
import FormAlert from './FormAlert';
import PasswordField from './PasswordField';

export default function RegisterForm() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError('');
    setLoading(true);

    try {
      await authApi.register({ displayName, email, password });
      setPassword('');
      navigate('/login', { replace: true, state: { from: safeReturn(location.state?.from, '/'), registered: true } });
    } catch (err: unknown) {
      setError(isAxiosError(err) && typeof err.response?.data?.message === 'string' ? err.response.data.message : err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister} className="w-full space-y-5">
      {error && <FormAlert tone="error">{error}</FormAlert>}

      <div>
        <label htmlFor="register-displayName" className="ui-label">Display name</label>
        <input
          type="text"
          placeholder="e.g. Minh Anh"
          id="register-displayName"
          autoComplete="name"
          maxLength={120}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className="ui-input"
        />
      </div>

      <div>
        <label htmlFor="register-email" className="ui-label">Email address</label>
        <input
          type="email"
          placeholder="name@example.com"
          id="register-email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="ui-input"
        />
      </div>

      <PasswordField
        id="register-password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
        maxLength={256}
        hint="Use at least 8 characters."
      />

      <button type="submit" disabled={loading} className="ui-btn-primary min-h-11 w-full">
        {loading && <Spinner className="h-4 w-4" />}
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
  );
}
