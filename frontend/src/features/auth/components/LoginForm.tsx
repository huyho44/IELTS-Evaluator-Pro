import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signIn, safeReturn } from '../session';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
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
      navigate(safeReturn(location.state?.from), { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4 w-full">
      {location.state?.registered && <p role="status" className="text-sm text-emerald-700">Account created. Please sign in.</p>}
      {error && (
        <div role="alert" className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
        <input
          type="email"
          placeholder="name@company.com"
          id="login-email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">Password</label>
        </div>
        <input
          type="password"
          placeholder="••••••••"
          id="login-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition duration-150 disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}