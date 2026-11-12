import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function RecoveryPage() {
  const { pathname, hash } = useLocation();
  const reset = pathname === '/reset-password';
  const token = new URLSearchParams(hash.slice(1)).get('token');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    if (reset && form.get('password') !== form.get('confirm')) {
      setError('The passwords must match.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth' + pathname, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { token, newPassword: form.get('password') } : { email: form.get('email') }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Please try again.');
      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally { setBusy(false); }
  }
  const field = 'block w-full rounded-lg border border-gray-300 p-3 mt-1';
  return <main className="mx-auto mt-16 max-w-md rounded-xl border bg-white p-6 space-y-5">
    <h1 className="text-2xl font-bold">{reset ? 'Choose a new password' : 'Forgot password?'}</h1>
    {success ? <p role="status">{success}</p> : reset && !token ? <p>Open the reset link in your email to continue.</p> :
      <form onSubmit={submit} className="space-y-4">
        {reset ? <>
          <label className="block">New password (8–256 characters)<input className={field} name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required /></label>
          <label className="block">Confirm new password<input className={field} name="confirm" type="password" autoComplete="new-password" required /></label>
        </> : <label className="block">Email address<input className={field} name="email" type="email" autoComplete="email" required /></label>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-50">{busy ? 'Please wait…' : reset ? 'Save new password' : 'Send reset link'}</button>
      </form>}
    {reset && !success && <Link className="block text-blue-700" to="/forgot-password">Request a new link</Link>}
    <Link className="block text-blue-700" to="/login">Back to sign in</Link>
  </main>;
}
