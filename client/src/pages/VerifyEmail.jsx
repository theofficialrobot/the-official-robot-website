import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isNotFound } from '../api';
import { useAuth } from '../AuthContext';

export default function VerifyEmail() {
  const { verifyEmail } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('token') || '';
  const next = params.get('next') || '/';
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer;
    if (!token) {
      setError('This verification link is missing a token.');
      return undefined;
    }
    verifyEmail(token)
      .then(() => {
        if (cancelled) return;
        setDone(true);
        timer = setTimeout(() => nav(next), 800);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(isNotFound(e)
          ? 'Email verification is not available yet.'
          : (e.message || 'Could not verify this link.'));
      });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token]);

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display font-bold text-3xl tracking-tight">Verify email</h1>
      {!token && (
        <p className="text-muted text-sm mt-3">Open the link from your inbox, or request a new one when you sign in.</p>
      )}
      {token && !error && !done && <p className="text-muted text-sm mt-3">Confirming your address…</p>}
      {done && <p className="text-green text-sm mt-3">Email verified. You are signed in.</p>}
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      <p className="mt-6 text-sm">
        <Link to="/login" className="text-accent font-semibold">Sign in</Link>
        <span className="text-dim"> · </span>
        <Link to="/" className="text-accent font-semibold">Marketplace</Link>
      </p>
    </div>
  );
}
