import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import PasswordField from '../components/PasswordField';
import ReqLabel from '../components/ReqLabel';

const PUBLIC_EMAIL = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|protonmail|proton|pm)\./i;
const PASSWORD_OK = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const field = 'mt-1 w-full border border-line rounded-[10px] px-3 py-2.5 bg-white font-normal';

const ACCOUNT_TYPES = [
  { id: 'individual', label: 'Individual' },
  { id: 'reseller', label: 'Reseller' },
  { id: 'manufacturer', label: 'Manufacturer' }
];

function verifyHref(verifyUrl) {
  if (!verifyUrl) return '';
  try {
    const u = new URL(verifyUrl, window.location.origin);
    const token = u.searchParams.get('token');
    if (token) return '/verify-email?token=' + encodeURIComponent(token);
    return u.pathname + u.search || verifyUrl;
  } catch {
    return verifyUrl;
  }
}

export default function Register() {
  const { register } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [accountType, setAccountType] = useState('individual');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const isBusiness = accountType === 'reseller' || accountType === 'manufacturer';
  const companyLabel = accountType === 'manufacturer' ? 'Manufacturer name' : 'Company name';

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!PASSWORD_OK.test(password)) {
      setError('Password must be 8+ characters and include a letter, a number, and a special symbol.');
      return;
    }
    if (isBusiness) {
      if (!companyName.trim()) {
        setError(companyLabel + ' is required.');
        return;
      }
      if (PUBLIC_EMAIL.test(email)) {
        setError((accountType === 'manufacturer' ? 'Manufacturer' : 'Reseller') + ' accounts must use a company-domain email, not a public provider.');
        return;
      }
    }
    setBusy(true);
    try {
      const payload = {
        email,
        password,
        accountType
      };
      if (accountType === 'individual') {
        payload.firstName = firstName.trim();
        payload.lastName = lastName.trim();
      } else {
        payload.companyName = companyName.trim();
      }
      const d = await register(payload);
      setDone({
        email,
        verifyUrl: d && d.verifyUrl
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const href = verifyHref(done.verifyUrl);
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="font-display font-bold text-3xl tracking-tight">Check your email</h1>
        <p className="text-muted text-sm mt-3">
          We sent a verification link{done.email ? <> to <span className="text-ink font-semibold">{done.email}</span></> : null}.
          Confirm it before you list, review, or check out.
        </p>
        {href && (
          <a href={href} className="or-check mt-6 inline-flex text-white font-semibold px-5 py-3 rounded-[12px] no-underline">
            Verify email (local dev)
          </a>
        )}
        <p className="mt-6 text-sm text-muted">
          Already verified? <Link to={'/login?next=' + encodeURIComponent(next)} className="text-accent font-semibold">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display font-bold text-3xl tracking-tight">Create account</h1>
      <p className="text-muted text-sm mt-2">List used robots by exact SKU. Buy new or pre-owned. Huntington Beach, California.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <fieldset>
          <legend className="text-sm font-semibold"><ReqLabel>Account type</ReqLabel></legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ACCOUNT_TYPES.map((t) => (
              <label
                key={t.id}
                className={
                  'text-center text-[12px] font-semibold rounded-[10px] border px-2 py-2 cursor-pointer ' +
                  (accountType === t.id ? 'or-check text-white border-transparent' : 'bg-white text-muted border-line')
                }
              >
                <input
                  type="radio"
                  name="accountType"
                  value={t.id}
                  checked={accountType === t.id}
                  onChange={() => setAccountType(t.id)}
                  className="sr-only"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        {accountType === 'individual' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              <ReqLabel>First name</ReqLabel>
              <input required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold">
              <ReqLabel>Last name</ReqLabel>
              <input required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} />
            </label>
          </div>
        ) : (
          <label className="block text-sm font-semibold">
            <ReqLabel>{companyLabel}</ReqLabel>
            <input required autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={field} />
          </label>
        )}
        <label className="block text-sm font-semibold">
          <ReqLabel>Email</ReqLabel>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          {isBusiness && (
            <span className="block text-xs text-dim font-normal mt-1">
              Use an email on your company domain (not Gmail, Outlook, Yahoo, or other public providers).
            </span>
          )}
        </label>
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
          helper="8+ characters, including a letter, a number, and a special symbol."
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="or-check w-full text-white font-semibold py-3 rounded-[12px]">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already registered? <Link to={'/login?next=' + encodeURIComponent(next)} className="text-accent font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
