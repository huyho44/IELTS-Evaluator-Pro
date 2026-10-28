import { isAxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { safeReturn } from '../session';
import { authApi } from '../services/authApi';

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
      navigate('/login', { replace: true, state: { from: safeReturn(location.state?.from), registered: true } });
    } catch (err: unknown) {
      setError(isAxiosError(err) && typeof err.response?.data?.message === 'string' ? err.response.data.message : err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister} className="space-y-4 w-full">
      {error && (
        <div role="alert" className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="register-displayName" className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
        <input
          type="text"
          placeholder="johndoe"
          id="register-displayName"
          autoComplete="name"
          maxLength={120}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
        />
      </div>

      <div>
        <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
        <input
          type="email"
          placeholder="name@company.com"
          id="register-email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
        />
      </div>

      <div>
        <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          placeholder="••••••••"
          id="register-password"
          autoComplete="new-password"
          minLength={8}
          maxLength={256}
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
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
  );
}