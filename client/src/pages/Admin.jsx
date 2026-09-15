import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, apiUpload, conditionLabel, CONDITIONS, imageSrc, isNotFound, ITEM_CONDITIONS, money, TYPES } from '../api';
import { useAuth } from '../AuthContext';
import ReqLabel from '../components/ReqLabel';
import SpecGroupFields from '../components/SpecGroupFields';
import { TYPE_SPEC_GROUPS } from '../specGroups';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'listings', label: 'Listings' },
  { id: 'orders', label: 'Orders' },
  { id: 'reviews', label: 'Reviews' }
];

const LISTING_BUCKETS = [
  { id: 'new', label: 'New' },
  { id: 'used', label: 'Used' }
];

const ORDER_STATUSES = ['requested', 'quoted', 'confirmed', 'paid', 'fulfilled', 'cancelled'];
const LISTING_CONDITIONS = CONDITIONS.filter((c) => c.id);
const field = 'mt-1 w-full border border-line rounded-[10px] px-3 py-2.5 bg-white';

function asList(data, ...keys) {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

function when(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function yn(v) {
  if (v === true || v === 1 || v === 'true') return 'Yes';
  if (v === false || v === 0 || v === 'false') return 'No';
  return '—';
}

function countsFrom(d) {
  const c = d?.counts || d || {};
  return {
    users: Number(c.users ?? c.userCount ?? 0) || 0,
    listings: Number(c.listings ?? c.robots ?? c.listingCount ?? 0) || 0,
    orders: Number(c.orders ?? c.orderCount ?? 0) || 0,
    reviews: Number(c.reviews ?? c.reviewCount ?? 0) || 0
  };
}

function isNewListing(r) {
  return String(r.condition || '').toLowerCase() === 'new';
}

function Table({ columns, rows, empty, rowKey }) {
  if (!rows.length) {
    return <p className="text-[13px] text-muted py-8">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
      <table className="w-full text-[12px] text-left">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-dim">
            {columns.map((c) => (
              <th key={c.key} className="font-semibold px-3 py-2.5 whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row) : (row.id ?? i)} className="border-b border-line last:border-0 align-top">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5">{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Admin() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';
  const listingBucket = params.get('cond') === 'used' ? 'used' : 'new';
  const [counts, setCounts] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  function setTab(id) {
    const next = new URLSearchParams(params);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    if (id !== 'listings') next.delete('cond');
    else if (!next.get('cond')) next.set('cond', 'new');
    setParams(next, { replace: true });
  }

  function setListingBucket(id) {
    const next = new URLSearchParams(params);
    next.set('tab', 'listings');
    next.set('cond', id);
    setParams(next, { replace: true });
  }

  useEffect(() => {
    if (!user || user.role !== 'admin') return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setMissing(false);
    setRows([]);

    async function load() {
      if (tab === 'overview') {
        try {
          const d = await api('/api/admin/overview', { auth: true });
          if (!cancelled) setCounts(countsFrom(d));
        } catch (e) {
          if (cancelled) return;
          if (isNotFound(e)) setMissing(true);
          else setError(e.message);
          setCounts(null);
        }
        return;
      }
      const paths = {
        users: ['/api/admin/users', 'users'],
        listings: ['/api/admin/listings?limit=500', 'listings', 'robots'],
        orders: ['/api/admin/orders', 'orders'],
        reviews: ['/api/admin/reviews', 'reviews']
      };
      const [path, ...keys] = paths[tab];
      try {
        const d = await api(path, { auth: true });
        if (!cancelled) setRows(asList(d, ...keys));
      } catch (e) {
        if (cancelled) return;
        if (tab === 'listings' && isNotFound(e)) {
          try {
            const d = await api('/api/admin/robots', { auth: true });
            if (!cancelled) setRows(asList(d, 'robots', 'listings'));
            return;
          } catch (e2) {
            if (cancelled) return;
            if (isNotFound(e2)) { setMissing(true); setRows([]); }
            else setError(e2.message);
            return;
          }
        }
        if (isNotFound(e)) { setMissing(true); setRows([]); }
        else setError(e.message);
        setRows([]);
      }
    }

    load().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, user]);

  async function patchOrder(id, status) {
    setError('');
    try {
      await api('/api/admin/orders/' + encodeURIComponent(id), { method: 'PATCH', auth: true, body: { status } });
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    } catch (e) {
      setError(isNotFound(e) ? 'Order status API is not available yet.' : e.message);
    }
  }

  async function removeRow(path) {
    setError('');
    try {
      await api(path, { method: 'DELETE', auth: true });
      const id = path.split('/').pop();
      setRows((prev) => prev.filter((r) => String(r.id) !== String(id)));
    } catch (e) {
      setError(isNotFound(e) ? 'Delete is not available yet.' : e.message);
    }
  }

  const listingType = params.get('type') || '';
  const visibleRows = tab === 'listings'
    ? rows.filter((r) => {
        const bucketOk = listingBucket === 'new' ? isNewListing(r) : !isNewListing(r);
        const typeOk = !listingType || r.type === listingType;
        return bucketOk && typeOk;
      })
    : rows;

  const columns = useMemo(() => {
    if (tab === 'users') {
      return [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'accountType', label: 'Type', render: (r) => r.accountType || r.account_type || 'individual' },
        { key: 'role', label: 'Role', render: (r) => r.role || 'user' },
        { key: 'emailVerified', label: 'Verified', render: (r) => yn(r.emailVerified ?? r.verified) },
        { key: 'kycStatus', label: 'KYC', render: (r) => r.kycStatus || r.kyc_status || '—' },
        { key: 'createdAt', label: 'Created', render: (r) => when(r.createdAt || r.created_at) },
        {
          key: 'actions',
          label: '',
          render: (r) => r.id
            ? <Link to={'/admin/users/' + encodeURIComponent(r.id)} className="text-accent font-semibold no-underline">View / Edit</Link>
            : null
        }
      ];
    }
    if (tab === 'listings') {
      return [
        {
          key: 'name',
          label: 'Listing',
          render: (r) => r.id
            ? <Link to={'/robots/' + encodeURIComponent(r.id)} className="text-accent font-semibold no-underline">{r.name || r.id}</Link>
            : (r.name || '—')
        },
        { key: 'maker', label: 'Maker' },
        { key: 'type', label: 'Type', render: (r) => r.type || '—' },
        { key: 'seller', label: 'Seller', render: (r) => r.sellerName || r.seller || r.sellerEmail || '—' },
        { key: 'condition', label: 'Condition', render: (r) => conditionLabel(r.condition) },
        { key: 'price', label: 'Price', render: (r) => money(r.price) },
        { key: 'createdAt', label: 'Created', render: (r) => when(r.createdAt || r.created_at) },
        {
          key: 'actions',
          label: '',
          render: (r) => r.id
            ? <Link to={'/admin/listings/' + encodeURIComponent(r.id)} className="text-accent font-semibold no-underline">Edit</Link>
            : null
        }
      ];
    }
    if (tab === 'orders') {
      return [
        { key: 'id', label: '#', render: (r) => r.id },
        { key: 'buyer', label: 'Buyer', render: (r) => r.userName || r.buyerName || r.email || r.userEmail || '—' },
        {
          key: 'listing',
          label: 'Listing',
          render: (r) => r.robotId
            ? <Link to={'/robots/' + encodeURIComponent(r.robotId)} className="text-accent no-underline">{r.robotName || r.robotId}</Link>
            : (r.robotName || '—')
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => (
            <select
              value={r.status || 'requested'}
              onChange={(e) => patchOrder(r.id, e.target.value)}
              className="border border-line rounded-md px-2 py-1 bg-white text-[12px]"
            >
              {uniqStatus(r.status).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )
        },
        { key: 'total', label: 'Total', render: (r) => money((Number(r.price) || 0) * (Number(r.qty) || 1) + (Number(r.warrantyPrice) || 0)) },
        { key: 'createdAt', label: 'Created', render: (r) => when(r.createdAt || r.created_at) }
      ];
    }
    if (tab === 'reviews') {
      return [
        {
          key: 'listing',
          label: 'Listing',
          render: (r) => r.robotId
            ? <Link to={'/robots/' + encodeURIComponent(r.robotId)} className="text-accent no-underline">{r.robotName || r.robotId}</Link>
            : (r.robotName || '—')
        },
        { key: 'user', label: 'User', render: (r) => r.userName || r.name || r.email || '—' },
        { key: 'rating', label: 'Stars', render: (r) => r.rating != null ? r.rating + ' / 5' : '—' },
        { key: 'body', label: 'Review', render: (r) => <span className="block max-w-sm whitespace-pre-wrap">{r.body || r.text || '—'}</span> },
        {
          key: 'actions',
          label: '',
          render: (r) => (
            <button type="button" onClick={() => removeRow('/api/admin/reviews/' + r.id)} className="text-red-600 font-semibold">
              Delete
            </button>
          )
        }
      ];
    }
    return [];
  }, [tab]);

  if (!ready) return <div className="max-w-6xl mx-auto px-4 py-16 text-muted text-[13px]">Loading…</div>;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const countCards = counts || { users: '—', listings: '—', orders: '—', reviews: '—' };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-[13px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent mb-2">Admin</p>
      <h1 className="font-display font-bold text-3xl tracking-tight">CRM</h1>
      <p className="text-muted mt-1">Users, listings, orders, and reviews.</p>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              'px-3 py-2 text-[12px] font-semibold rounded-t-[10px] ' +
              (tab === t.id ? 'text-ink bg-white border border-line border-b-white -mb-px' : 'text-muted hover:text-ink')
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {error && <p className="text-red-600 text-[13px] mb-4">{error}</p>}
        {missing && <p className="text-muted text-[13px] mb-4">This CRM endpoint is not available yet.</p>}
        {loading && <p className="text-muted">Loading…</p>}

        {!loading && tab === 'overview' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TABS.filter((t) => t.id !== 'overview').map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="text-left rounded-[16px] border border-line bg-white px-4 py-5 shadow-or hover:border-accent"
              >
                <div className="text-[11px] uppercase tracking-[0.08em] text-dim font-semibold">{t.label}</div>
                <div className="font-display font-bold text-2xl mt-2 text-ink">{countCards[t.id] ?? '—'}</div>
              </button>
            ))}
          </div>
        )}

        {!loading && tab === 'listings' && (
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="flex gap-1">
            {LISTING_BUCKETS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setListingBucket(b.id)}
                className={
                  'px-3 py-1.5 rounded-full text-[12px] font-semibold border ' +
                  (listingBucket === b.id ? 'bg-accent text-white border-accent' : 'bg-white text-muted border-line')
                }
              >
                {b.label}
              </button>
            ))}
            </div>
            <label className="text-[12px] font-semibold text-muted flex items-center gap-2">
              Type
              <select
                value={params.get('type') || ''}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  next.set('tab', 'listings');
                  if (e.target.value) next.set('type', e.target.value);
                  else next.delete('type');
                  setParams(next, { replace: true });
                }}
                className="border border-line rounded-md px-2 py-1.5 bg-white text-[12px] text-ink font-semibold"
              >
                <option value="">All types</option>
                {TYPES.filter((t) => t.id).map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {!loading && tab !== 'overview' && (
          <Table
            columns={columns}
            rows={visibleRows}
            empty={missing ? 'No data — API not available yet.' : 'No rows.'}
            rowKey={(r) => r.id}
          />
        )}
      </div>
    </div>
  );
}

function listingFromApi(r) {
  const gallery = [];
  if (r.image) gallery.push(r.image);
  (r.images || []).forEach((src) => { if (src && !gallery.includes(src)) gallery.push(src); });
  return {
    name: r.name || '',
    maker: r.maker || '',
    type: r.type || 'humanoid',
    modelNumber: r.modelNumber || r.model_number || '',
    price: r.price != null ? String(r.price) : '',
    condition: r.condition === 'like_new' ? 'used' : (r.condition || 'used'),
    itemCondition: r.itemCondition || r.item_condition || 'good',
    year: r.year != null ? String(r.year) : '',
    shortDesc: r.shortDesc || r.short_desc || '',
    uniqueSummary: r.uniqueSummary || r.unique_summary || '',
    specs: r.specs && typeof r.specs === 'object' ? { ...r.specs } : {},
    photos: gallery,
    sellerName: r.sellerName || r.seller_name || '',
    sellerEmail: r.sellerEmail || r.seller_email || '',
    source: r.source || ''
  };
}

export function AdminListingEdit() {
  const { user, ready } = useAuth();
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        let r;
        try {
          const d = await api('/api/admin/listings/' + encodeURIComponent(id), { auth: true });
          r = d.listing || d.robot || d;
        } catch (err) {
          if (!isNotFound(err)) throw err;
          const d = await api('/api/robots/' + encodeURIComponent(id));
          r = d.robot || d;
        }
        if (!cancelled) setForm(listingFromApi(r));
      } catch (e) {
        if (!cancelled) setError(isNotFound(e) ? 'Listing not found.' : e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (!ready) return <div className="max-w-3xl mx-auto px-4 py-16 text-muted text-[13px]">Loading…</div>;
  if (!user) return <Navigate to={'/login?next=' + encodeURIComponent('/admin/listings/' + id)} replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  async function onPhoto(e, main) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const d = await apiUpload('/api/uploads' + (main ? '?main=1' : ''), fd);
      const url = d.url;
      setForm((f) => {
        const photos = (f.photos || []).filter((p) => p !== url);
        return { ...f, photos: main ? [url, ...photos] : photos.concat(url) };
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      const photos = form.photos || [];
      await api('/api/admin/listings/' + encodeURIComponent(id), {
        method: 'PATCH',
        auth: true,
        body: {
          name: form.name.trim(),
          maker: form.maker.trim(),
          type: form.type,
          modelNumber: form.modelNumber.trim() || undefined,
          price: Number(form.price),
          condition: form.condition,
          itemCondition: form.condition === 'used' ? form.itemCondition : null,
          year: form.year ? Number(form.year) : undefined,
          shortDesc: form.shortDesc.trim(),
          uniqueSummary: form.uniqueSummary.trim(),
          specs: form.specs,
          image: photos[0] || '',
          images: photos.slice(1)
        }
      });
      nav('/admin?tab=listings&cond=' + (form.condition === 'used' || form.condition === 'cpo' ? 'used' : 'new'));
    } catch (err) {
      setError(isNotFound(err) ? 'Listing edit API is not available yet.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  const typeOptions = TYPES.filter((t) => t.id);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-[13px]">
      <Link to="/admin?tab=listings" className="text-sm font-semibold text-accent no-underline">← Listings</Link>
      <h1 className="font-display font-bold text-3xl tracking-tight mt-3">Edit listing</h1>
      {form && (form.sellerName || form.sellerEmail) && (
        <p className="text-muted mt-1">Seller: {form.sellerName || '—'} {form.sellerEmail ? '· ' + form.sellerEmail : ''} {form.source ? '· ' + form.source : ''}</p>
      )}
      {!form && !error && <p className="mt-6 text-muted">Loading…</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {form && (
        <form onSubmit={save} className="mt-8 space-y-4">
          <label className="block text-sm font-semibold">
            <ReqLabel>Name</ReqLabel>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={field} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              Maker
              <input value={form.maker} onChange={(e) => setForm((f) => ({ ...f, maker: e.target.value }))} className={field} />
            </label>
            <label className="block text-sm font-semibold">
              Model number
              <input value={form.modelNumber} onChange={(e) => setForm((f) => ({ ...f, modelNumber: e.target.value }))} className={field} />
            </label>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block text-sm font-semibold">
              Type
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={field}>
                {typeOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              <ReqLabel>Price</ReqLabel>
              <input required type="number" min="0" step="1" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={field} />
            </label>
            <label className="block text-sm font-semibold">
              Year
              <input type="number" min="1980" max="2035" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className={field} />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            <ReqLabel>Condition</ReqLabel>
            <select required value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} className={field}>
              {LISTING_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          {form.condition === 'used' && (
            <label className="block text-sm font-semibold">
              <ReqLabel>Item condition</ReqLabel>
              <select required value={form.itemCondition} onChange={(e) => setForm((f) => ({ ...f, itemCondition: e.target.value }))} className={field}>
                {ITEM_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          )}
          <label className="block text-sm font-semibold">
            Short description
            <textarea value={form.shortDesc} onChange={(e) => setForm((f) => ({ ...f, shortDesc: e.target.value }))} rows={3} className={field} />
          </label>
          <label className="block text-sm font-semibold">
            Summary
            <textarea value={form.uniqueSummary} onChange={(e) => setForm((f) => ({ ...f, uniqueSummary: e.target.value }))} rows={3} className={field} />
          </label>

          <div>
            <div className="text-sm font-semibold mb-2">Photos</div>
            <div className="flex flex-wrap gap-2">
              {(form.photos || []).map((src, i) => (
                <div key={src} className="relative w-20 h-20 rounded-[10px] border border-line overflow-hidden bg-elevated">
                  <img src={imageSrc(src)} alt="" className="w-full h-full object-contain p-1" />
                  {i === 0 && <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-ink/70 text-white">Main</span>}
                  <button
                    type="button"
                    className="absolute top-0 right-0 w-5 h-5 text-[10px] bg-white/90"
                    onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((p) => p !== src) }))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
              <label className="font-semibold cursor-pointer text-accent">
                Replace main (PNG/WebP transparent)
                <input type="file" accept="image/png,image/webp" className="hidden" onChange={(e) => onPhoto(e, true)} />
              </label>
              <label className="font-semibold cursor-pointer text-accent">
                Add photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e, false)} />
              </label>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Specifications</div>
            <SpecGroupFields
              type={form.type}
              specs={form.specs}
              groups={TYPE_SPEC_GROUPS}
              onChange={(k, v) => setForm((f) => ({ ...f, specs: { ...f.specs, [k]: v } }))}
            />
          </div>

          <button type="submit" disabled={busy} className="or-check text-white font-semibold px-5 py-3 rounded-[12px] disabled:opacity-60">
            {busy ? 'Saving…' : 'Save listing'}
          </button>
        </form>
      )}
    </div>
  );
}

function kycEntries(kyc) {
  if (!kyc || typeof kyc !== 'object') return [];
  return Object.entries(kyc).filter(([, v]) => v != null && v !== '' && typeof v !== 'object');
}

export function AdminUserEdit() {
  const { user, ready } = useAuth();
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api('/api/admin/users/' + encodeURIComponent(id), { auth: true })
      .then((d) => {
        if (cancelled) return;
        const u = d.user || d;
        setData(d);
        setForm({
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          email: u.email || '',
          role: u.role || 'user',
          accountType: u.accountType || 'individual',
          companyName: u.companyName || '',
          emailVerified: !!(u.emailVerified ?? u.email_verified)
        });
      })
      .catch((e) => {
        if (!cancelled) setError(isNotFound(e) ? 'User not found.' : e.message);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (!ready) return <div className="max-w-3xl mx-auto px-4 py-16 text-muted text-[13px]">Loading…</div>;
  if (!user) return <Navigate to={'/login?next=' + encodeURIComponent('/admin/users/' + id)} replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  async function save(e) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/users/' + encodeURIComponent(id), {
        method: 'PATCH',
        auth: true,
        body: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          role: form.role,
          accountType: form.accountType,
          companyName: form.companyName.trim(),
          emailVerified: form.emailVerified
        }
      });
      nav('/admin?tab=users');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const kyc = data && data.kyc;
  const docUrl = kyc && (kyc.idDocumentUrl || kyc.documentUrl);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-[13px]">
      <Link to="/admin?tab=users" className="text-sm font-semibold text-accent no-underline">← Users</Link>
      <h1 className="font-display font-bold text-3xl tracking-tight mt-3">User</h1>
      {data && (
        <p className="text-muted mt-1">
          {data.listingCount ?? 0} listings · {data.orderCount ?? 0} orders · KYC {data.kycKind || 'individual'}
        </p>
      )}
      {!form && !error && <p className="mt-6 text-muted">Loading…</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {form && (
        <form onSubmit={save} className="mt-8 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              First name
              <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className={field} />
            </label>
            <label className="block text-sm font-semibold">
              Last name
              <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className={field} />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            <ReqLabel>Email</ReqLabel>
            <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={field} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              Account type
              <select value={form.accountType} onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))} className={field}>
                <option value="individual">individual</option>
                <option value="reseller">reseller</option>
                <option value="manufacturer">manufacturer</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Role
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={field}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </div>
          {(form.accountType === 'reseller' || form.accountType === 'manufacturer') && (
            <label className="block text-sm font-semibold">
              {form.accountType === 'manufacturer' ? 'Manufacturer name' : 'Company name'}
              <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} className={field} />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.emailVerified} onChange={(e) => setForm((f) => ({ ...f, emailVerified: e.target.checked }))} />
            Email verified
          </label>
          <button type="submit" disabled={busy} className="or-check text-white font-semibold px-5 py-3 rounded-[12px] disabled:opacity-60">
            {busy ? 'Saving…' : 'Save user'}
          </button>
        </form>
      )}

      {kyc && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true); setError('');
              try {
                const d = await api('/api/admin/kyc/' + encodeURIComponent(id), { method: 'PATCH', auth: true, body: { status: 'approved' } });
                setData((prev) => ({ ...prev, kyc: d.kyc || { ...kyc, status: 'approved' } }));
              } catch (err) { setError(err.message); }
              finally { setBusy(false); }
            }}
            className="or-grad text-white font-semibold px-4 py-2 rounded-[10px] disabled:opacity-60"
          >
            Approve KYC
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true); setError('');
              try {
                const d = await api('/api/admin/kyc/' + encodeURIComponent(id), { method: 'PATCH', auth: true, body: { status: 'rejected' } });
                setData((prev) => ({ ...prev, kyc: d.kyc || { ...kyc, status: 'rejected' } }));
              } catch (err) { setError(err.message); }
              finally { setBusy(false); }
            }}
            className="border border-line font-semibold px-4 py-2 rounded-[10px] bg-white disabled:opacity-60"
          >
            Reject KYC
          </button>
        </div>
      )}

      {kyc && (
        <section className="mt-10 border border-line rounded-[16px] bg-white p-5">
          <h2 className="font-display font-semibold text-lg">Verification data</h2>
          <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {kycEntries(kyc).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] uppercase tracking-wide text-dim">{k}</dt>
                <dd className="font-medium break-all">{String(v)}</dd>
              </div>
            ))}
          </dl>
          {docUrl && (
            <p className="mt-4">
              <a href={imageSrc(docUrl)} target="_blank" rel="noreferrer" className="text-accent font-semibold">
                Open identity / company document
              </a>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function uniqStatus(current) {
  const list = ORDER_STATUSES.slice();
  if (current && !list.includes(current)) list.unshift(current);
  return list;
}
