import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, imageSrc, isKycEmpty, isNotFound, money } from '../api';
import { needsVerification, useAuth } from '../AuthContext';
import EmailVerifyNotice from '../components/EmailVerifyNotice';

export default function Account() {
  const { user, ready } = useAuth();
  const [orders, setOrders] = useState([]);
  const [kycLabel, setKycLabel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api('/api/orders', { auth: true })
      .then((o) => setOrders(o.orders || []))
      .catch((e) => setError(e.message));
    api('/api/kyc', { auth: true })
      .then((d) => {
        const kyc = d.kyc !== undefined ? d.kyc : d;
        if (isKycEmpty(kyc)) setKycLabel('Not started');
        else setKycLabel(String(kyc.status || kyc.state || 'Submitted').replace(/_/g, ' '));
      })
      .catch((e) => {
        setKycLabel(isNotFound(e) ? 'Not started' : 'Unavailable');
      });
  }, [user]);

  if (ready && !user) return <Navigate to="/login?next=/account" replace />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-3xl tracking-tight">Orders</h1>
      <p className="text-muted mt-1 text-[13px]">
        {user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ')} · {user?.email}
        {user?.accountType ? ' · ' + user.accountType : ''}
        {user?.role ? ' · ' + user.role : ''}
        {user && user.emailVerified != null ? (user.emailVerified ? ' · verified' : ' · unverified') : ''}
      </p>
      {needsVerification(user) && <EmailVerifyNotice className="mt-4" />}
      {error && <p className="text-red-600 mt-4">{error}</p>}

      <section className="mt-8 border border-line rounded-[16px] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold">Identity verification (KYC)</h2>
          <p className="text-sm text-muted mt-1 capitalize">Status · {kycLabel || 'Loading…'}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/kyc?next=/account" className="text-sm font-semibold text-accent">
            {kycLabel && kycLabel !== 'Not started' ? 'Update KYC' : 'Complete KYC'}
          </Link>
          {(user?.accountType === 'manufacturer' || user?.account_type === 'manufacturer') && (
            <Link to="/mfr" className="text-sm font-semibold text-accent">My Robots</Link>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display font-semibold text-xl mb-4">Orders</h2>
        {orders.length === 0 ? (
          <p className="text-muted text-sm">No orders yet. <Link to="/" className="text-accent">Shop the catalog</Link></p>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="flex gap-4 border border-line rounded-or-sm p-3 bg-white">
                <div className="w-16 h-16 rounded-[10px] bg-elevated shrink-0 grid place-items-center overflow-hidden">
                  {o.robotImage ? (
                    <img
                      src={imageSrc(o.robotImage)}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      decoding="async"
                      className="max-h-full max-w-full object-contain p-1"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={'/robots/' + encodeURIComponent(o.robotId)} className="font-semibold no-underline text-ink">{o.robotName}</Link>
                  <p className="text-xs text-dim mt-1">
                    #{o.id} · {o.direction === 'sale' ? 'sale' : 'purchase'} · {o.kind} · {o.status} · qty {o.qty}
                    {o.warrantyId ? ' · warranty ' + o.warrantyId : ''}
                    {o.warrantyPrice ? ' ' + money(o.warrantyPrice) : ''}

                  </p>
                </div>
                <div className="font-display font-bold">{money(o.price * o.qty)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>


    </div>
  );
}
