import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isUnverifiedError } from '../api';
import { useAuth } from '../AuthContext';
import EmailVerifyNotice from '../components/EmailVerifyNotice';
import PasswordField from '../components/PasswordField';
import ReqLabel from '../components/ReqLabel';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setUnverified(false);
    try {
      await login(email, password);
      nav(next);
    } catch (err) {
      if (isUnverifiedError(err)) {
        setUnverified(true);
        setError('Verify your email before signing in.');
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display font-bold text-3xl tracking-tight">Sign in</h1>
      <p className="text-muted text-sm mt-2">Buy, list, and request financing on The Official Robot marketplace.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-sm font-semibold">
          <ReqLabel>Email</ReqLabel>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-line rounded-[10px] px-3 py-2.5" />
        </label>
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {unverified && <EmailVerifyNotice email={email} />}
        {error && !unverified && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="or-grad w-full text-white font-semibold py-3 rounded-[12px]">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        No account? <Link to={'/register?next=' + encodeURIComponent(next)} className="text-accent font-semibold">Create one</Link>
      </p>
    </div>
  );
}
