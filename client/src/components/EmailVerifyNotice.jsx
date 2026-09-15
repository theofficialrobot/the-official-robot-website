import { useState } from 'react';
import { isNotFound } from '../api';
import { useAuth } from '../AuthContext';

export default function EmailVerifyNotice({ email, className = '' }) {
  const { user, resendVerify } = useAuth();
  const addr = email || user?.email || '';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function resend() {
    if (!addr) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await resendVerify(addr);
      setMsg('Verification email sent. Check your inbox.');
    } catch (e) {
      setErr(isNotFound(e)
        ? 'Resend is not available yet. Use the link from your original email.'
        : (e.message || 'Could not resend.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={'rounded-[14px] border border-line bg-soft p-4 text-[13px] ' + className}>
      <p className="font-semibold text-ink">Verify your email to continue.</p>
      <p className="text-muted mt-1">
        Sell, reviews, and checkout need a verified address
        {addr ? <> ({addr})</> : null}. Check your inbox for the link.
      </p>
      {addr && (
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="mt-3 text-accent font-semibold disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Resend verification email'}
        </button>
      )}
      {msg && <p className="mt-2 text-green">{msg}</p>}
      {err && <p className="mt-2 text-red-600">{err}</p>}
    </div>
  );
}
