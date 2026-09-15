import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  conditionLabel,
  FALLBACK_WARRANTY_PLANS,
  fetchCatalog,
  imageSrc,
  isUnverifiedError,
  money,
  warrantyAmount,
  warrantyOptionLabel
} from '../api';
import { needsVerification, useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import EmailVerifyNotice from '../components/EmailVerifyNotice';
import { useEffect, useMemo, useState } from 'react';

export default function Cart() {
  const { items, subtotal, setQty, setWarranty, remove, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [done, setDone] = useState(null);
  const [plans, setPlans] = useState(FALLBACK_WARRANTY_PLANS);

  useEffect(() => {
    fetchCatalog().then((d) => {
      if (d.warrantyPlans?.length) setPlans(d.warrantyPlans);
    });
  }, []);

  const warrantyTotal = useMemo(
    () => items.reduce((n, i) => n + warrantyAmount(i.price, i.qty, i.warrantyId || '3yr', plans), 0),
    [items, plans]
  );

  async function checkout(kind) {
    if (!user) {
      nav('/login?next=/cart');
      return;
    }
    if (needsVerification(user)) {
      setUnverified(true);
      setError('Verify your email to check out.');
      return;
    }
    setBusy(true);
    setError('');
    setUnverified(false);
    try {
      const d = await api('/api/orders/checkout', {
        method: 'POST',
        auth: true,
        body: {
          kind,
          items: items.map((i) => ({
            robotId: i.robotId,
            variant: i.variant,
            qty: i.qty,
            warrantyId: i.warrantyId || '3yr',
            serviceRequested: Boolean(i.serviceRequested)
          }))
        }
      });
      clear();
      setDone({ kind, orders: d.orders });
    } catch (e) {
      if (isUnverifiedError(e)) {
        setUnverified(true);
        setError('Verify your email to check out.');
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-display font-bold text-3xl">Request received</h1>
        <p className="text-muted mt-2">
          {done.kind === 'financing'
            ? 'Financing request logged. We will follow up with terms, spread, and fee structure.'
            : 'Buy request logged. Landed cost, duties, warranty, and service attach on formal quote.'}
        </p>
        <Link to="/account" className="inline-block mt-6 text-accent font-semibold">View account →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-3xl tracking-tight">Cart</h1>
      {items.length === 0 ? (
        <p className="text-muted mt-6">Your cart is empty. <Link to="/" className="text-accent">Browse the catalog</Link></p>
      ) : (
        <div className="mt-8 grid lg:grid-cols-[1.4fr_0.8fr] gap-8">
          <ul className="space-y-4">
            {items.map((item) => {
              const wPrice = warrantyAmount(item.price, item.qty, item.warrantyId || '3yr', plans);
              return (
                <li key={item.key} className="flex gap-4 border border-line rounded-or-sm p-3 bg-white">
                  <div className="w-24 h-24 rounded-[10px] bg-elevated shrink-0 grid place-items-center overflow-hidden">
                    {item.image ? (
                      <img
                        src={imageSrc(item.image)}
                        alt=""
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={'/robots/' + encodeURIComponent(item.robotId)} className="font-display font-semibold no-underline text-ink">{item.name}</Link>
                    <p className="text-xs text-dim mt-1">{item.maker} · {conditionLabel(item.condition)}{item.variant ? ' · ' + item.variant : ''}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <label className="text-sm">Qty
                        <input type="number" min="1" value={item.qty} onChange={(e) => setQty(item.key, e.target.value)} className="ml-2 w-16 border border-line rounded-md px-2 py-1" />
                      </label>
                      <button type="button" onClick={() => remove(item.key)} className="text-sm text-muted hover:text-ink">Remove</button>
                    </div>
                    <label className="block text-sm mt-3">
                      Warranty
                      <select
                        value={item.warrantyId || '3yr'}
                        onChange={(e) => setWarranty(item.key, e.target.value)}
                        className="ml-2 border border-line rounded-md px-2 py-1 bg-white"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>{warrantyOptionLabel(p)}</option>
                        ))}
                      </select>
                      <span className="ml-2 text-muted">{money(wPrice)}</span>
                    </label>

                  </div>
                  <div className="font-display font-bold">{money(item.price * item.qty)}</div>
                </li>
              );
            })}
          </ul>
          <aside className="border border-line rounded-or p-5 bg-white h-fit shadow-or">
            <div className="flex justify-between text-sm text-muted">
              <span>Platform subtotal ({items.reduce((n, i) => n + i.qty, 0)} items)</span>
              <span className="font-display font-bold text-lg text-ink">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted mt-2">
              <span>Warranty</span>
              <span className="font-display font-bold text-ink">{money(warrantyTotal)}</span>
            </div>
            <div className="flex justify-between text-sm mt-3 pt-3 border-t border-line">
              <span className="font-semibold">Total</span>
              <span className="font-display font-bold text-lg">{money(subtotal + warrantyTotal)}</span>
            </div>
            {unverified && <EmailVerifyNotice className="mt-3" />}
            {error && !unverified && <p className="text-red-600 text-sm mt-3">{error}</p>}
            <button type="button" disabled={busy} onClick={() => checkout('buy')} className="or-check w-full mt-5 text-white font-semibold py-3 rounded-[12px]">
              {user ? (busy ? 'Submitting…' : 'Request to buy') : 'Sign in to checkout'}
            </button>
            <button type="button" disabled={busy} onClick={() => checkout('financing')} className="or-grad w-full mt-2 text-white font-semibold py-3 rounded-[12px] disabled:opacity-60">
              Request financing
            </button>
            <p className="text-xs text-dim mt-3">Estimates only. Financing is spread + fee. Warranty $ = round(price × qty × plan %). Service attach confirmed on quote.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
