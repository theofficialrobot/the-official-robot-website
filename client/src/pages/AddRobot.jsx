import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, apiUpload, fetchCatalog, imageSrc, isKycEmpty, isKycRequired, isNotFound, isUnverifiedError, ITEM_CONDITIONS, mediaUrl, money, TYPES, typeLabel } from '../api';
import { needsVerification, useAuth } from '../AuthContext';
import EmailVerifyNotice from '../components/EmailVerifyNotice';
import HowToList from '../components/HowToList';
import ReqLabel from '../components/ReqLabel';
import SpecGroupFields from '../components/SpecGroupFields';
import { loadSpecGroups, TYPE_SPEC_GROUPS } from '../specGroups';

const CONDITIONS = [
  { id: 'new', label: 'New' },
  { id: 'cpo', label: 'Certified pre-owned' },
  { id: 'used', label: 'Used' }
];

const TYPE_OPTIONS = TYPES.filter((t) => t.id);
const field = 'mt-1 w-full border border-line rounded-[10px] px-3 py-2.5 bg-white';

function isPngWebp(file) {
  if (!file) return false;
  const t = String(file.type || '').toLowerCase();
  const n = String(file.name || '').toLowerCase();
  return t === 'image/png' || t === 'image/webp' || n.endsWith('.png') || n.endsWith('.webp');
}

function normalizeBrand(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, '')
    .replace(/\b(incorporated|corporation|limited|company|inc|llc|ltd|co|corp)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function brandsMatch(a, b) {
  const x = normalizeBrand(a);
  const y = normalizeBrand(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export default function AddRobot() {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const boxRef = useRef(null);
  const photosRef = useRef([]);
  const [mode, setMode] = useState('catalog');
  const [skus, setSkus] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    condition: 'used',
    itemCondition: 'good',
    price: '',
    shortDesc: '',
    inspectionNotes: ''
  });
  const [unique, setUnique] = useState({
    name: '',
    maker: '',
    modelNumber: '',
    type: 'humanoid',
    year: '',
    imageUrl: ''
  });
  const [photos, setPhotos] = useState([]);
  const [specs, setSpecs] = useState({});
  const [specGroups, setSpecGroups] = useState(TYPE_SPEC_GROUPS);
  const [kycState, setKycState] = useState('checking');
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    loadSpecGroups().then(setSpecGroups).catch(() => setSpecGroups(TYPE_SPEC_GROUPS));
  }, []);

  useEffect(() => {
    if (!user) return;
    const brand = user.companyName || user.company_name || '';
    if ((user.accountType || user.account_type) === 'manufacturer' && brand) {
      setUnique((u) => (u.maker ? u : { ...u, maker: brand }));
    }
    let cancelled = false;
    api('/api/kyc', { auth: true })
      .then((d) => {
        if (cancelled) return;
        const status = String((d.kyc && (d.kyc.status || d.kyc.state)) || d.status || '').toLowerCase();
        if (isKycEmpty(d)) setKycState('needed');
        else if (status === 'approved') setKycState('ok');
        else setKycState('pending');
      })
      .catch((e) => {
        if (cancelled) return;
        if (isKycRequired(e) || isNotFound(e)) setKycState('needed');
        else {
          setError(e.message);
          setKycState('error');
        }
      });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((d) => {
        if (cancelled) return;
        const list = d.robots || [];
        setSkus(list);
        setCatalogError(list.length ? '' : 'Catalog SKUs unavailable. Try again in a moment.');
      })
      .catch(() => {
        if (!cancelled) setCatalogError('Catalog SKUs unavailable. Try again in a moment.');
      })
      .finally(() => { if (!cancelled) setCatalogReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => () => {
    photosRef.current.forEach((p) => { if (p.preview) URL.revokeObjectURL(p.preview); });
  }, []);

  const isManufacturer = (user?.accountType || user?.account_type) === 'manufacturer';
  const manufacturerBrand = user?.companyName || user?.company_name || '';
  const sellConditions = CONDITIONS.filter((c) => c.id !== 'cpo' || isManufacturer);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = skus;
    if (isManufacturer && manufacturerBrand) {
      list = list.filter((r) => brandsMatch(r.maker, manufacturerBrand));
    }
    if (q) {
      list = list.filter((r) => {
        const name = (r.name || '').toLowerCase();
        const maker = (r.maker || '').toLowerCase();
        const type = (r.type || '').toLowerCase();
        const typeName = typeLabel(r.type).toLowerCase();
        const id = (r.id || '').toLowerCase();
        return name.includes(q) || maker.includes(q) || type.includes(q) || typeName.includes(q) || id.includes(q);
      });
    }
    return list.slice(0, 50);
  }, [skus, query, isManufacturer, manufacturerBrand]);

  if (ready && !user) return <Navigate to="/login?next=/add" replace />;
  if (user && kycState === 'needed') return <Navigate to="/kyc?next=/add" replace />;
  if (user && kycState === 'checking') {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-muted">Checking identity verification…</div>;
  }
  if (user && kycState === 'pending') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-display font-bold text-2xl tracking-tight">Verification pending</h1>
        <p className="text-muted mt-3 text-sm">Your KYC was submitted and is awaiting admin approval. You can list a robot after it is approved.</p>
        <Link to="/account" className="inline-block mt-6 text-sm font-semibold text-accent">View status</Link>
      </div>
    );
  }

  const blocked = needsVerification(user) || unverified;

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function pickSku(sku) {
    setSelected(sku);
    setQuery(sku.name || sku.id);
    setOpen(false);
    if (!form.price && sku.price != null) set('price', String(sku.price));
  }

  function addPhotos(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    if (photos.length === 0 && !isPngWebp(files[0])) {
      setError('The main (first) photo must be a PNG or WebP with a transparent background.');
      return;
    }
    setError('');
    setPhotos((prev) => prev.concat(files.map((file) => ({
      file,
      preview: URL.createObjectURL(file)
    }))));
  }

  function removePhoto(i) {
    setPhotos((prev) => {
      const next = prev.slice();
      const [gone] = next.splice(i, 1);
      if (gone && gone.preview) URL.revokeObjectURL(gone.preview);
      return next;
    });
  }

  async function uploadImage(file, isMain) {
    const fd = new FormData();
    fd.append('file', file);
    const d = await apiUpload(isMain ? '/api/uploads?main=1' : '/api/uploads', fd);
    return mediaUrl(d);
  }

  async function uploadAllPhotos() {
    const urls = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.url) {
        urls.push(p.url);
        continue;
      }
      if (!p.file) continue;
      const url = await uploadImage(p.file, i === 0);
      if (url) urls.push(url);
    }
    return urls;
  }

  async function submit(e) {
    e.preventDefault();
    if (needsVerification(user)) {
      setUnverified(true);
      setError('Verify your email to publish a listing.');
      return;
    }
    if (form.condition === 'cpo' && form.inspectionNotes.trim().length < 20) {
      setError('Inspection notes are required for certified pre-owned (at least 20 characters).');
      return;
    }
    if (mode === 'catalog' && !selected?.id) {
      setError('Pick a catalog SKU. Model name is not free-text.');
      return;
    }
    if (mode === 'unique') {
      if (!unique.name.trim() || !unique.maker.trim()) {
        setError('Name and maker are required for a unique platform.');
        return;
      }
      if (!unique.year) {
        setError('Year is required for a unique platform.');
        return;
      }
    }
    if (photos.length && !isPngWebp(photos[0].file)) {
      setError('The main (first) photo must be a PNG or WebP with a transparent background.');
      return;
    }
    setSaving(true);
    setError('');
    setUnverified(false);
    try {
      let imageUrls = [];
      if (photos.length) {
        try {
          imageUrls = await uploadAllPhotos();
        } catch (err) {
          if (!isNotFound(err)) throw err;
        }
      }
      let body;
      if (mode === 'catalog') {
        body = {
          catalogId: selected.id,
          condition: form.condition,
          price: Number(form.price),
          shortDesc: form.shortDesc,
          inspectionNotes: form.condition === 'cpo' ? form.inspectionNotes.trim() : (form.inspectionNotes.trim() || undefined),
          itemCondition: form.condition === 'used' ? form.itemCondition : undefined,
          images: imageUrls.length ? imageUrls : undefined,
          image: imageUrls[0] || undefined
        };
      } else {
        const filledSpecs = {};
        Object.entries(specs).forEach(([k, v]) => {
          if (v != null && String(v).trim() !== '') filledSpecs[k] = String(v).trim();
        });
        body = {
          name: unique.name.trim(),
          maker: isManufacturer ? (manufacturerBrand || unique.maker.trim()) : unique.maker.trim(),
          modelNumber: unique.modelNumber.trim() || undefined,
          type: unique.type,
          year: Number(unique.year),
          specs: filledSpecs,
          condition: form.condition,
          price: Number(form.price),
          shortDesc: form.shortDesc,
          image: imageUrls[0] || unique.imageUrl || undefined,
          images: imageUrls.length ? imageUrls : undefined,
          inspectionNotes: form.condition === 'cpo' ? form.inspectionNotes.trim() : (form.inspectionNotes.trim() || undefined),
          itemCondition: form.condition === 'used' ? form.itemCondition : undefined
        };
      }
      const d = await api('/api/robots', { method: 'POST', auth: true, body });
      const newId = d.robot?.id || d.id;
      if (newId) nav('/robots/' + encodeURIComponent(newId));
      else setError('Listing saved, but no id was returned.');
    } catch (err) {
      if (isUnverifiedError(err)) {
        setUnverified(true);
        setError('Verify your email to publish a listing.');
      } else if (isKycRequired(err)) {
        nav('/kyc?next=/add');
        return;
      } else if (err.status === 409) {
        setError('Duplicate maker + name. ' + (err.message || 'A listing for that platform already exists.'));
      } else if (isNotFound(err)) {
        setError('Listing API is not available yet.');
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = mode === 'catalog'
    ? Boolean(selected)
    : Boolean(unique.name.trim() && unique.maker.trim() && unique.year && form.price);

  const photoField = (
    <div>
      <label className="block text-sm font-semibold">
        Photos
        <input
          type="file"
          accept="image/png,image/webp,image/*"
          multiple
          onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }}
          className={field}
        />
      </label>
      <p className="text-xs text-dim mt-1">First photo is the main image. Use a PNG or WebP with a transparent background.</p>
      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={p.preview || i} className="relative w-24 h-24 rounded-[12px] border border-line bg-elevated grid place-items-center overflow-hidden">
              <img src={p.preview} alt="" className="max-h-full max-w-full object-contain p-1" />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase tracking-wide bg-white/90 px-1.5 py-0.5 rounded">
                  Main
                </span>
              )}
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 bg-white/90 text-[11px] font-semibold px-1.5 rounded"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto px-4 py-10 text-[13px] max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">Sell · used-robot liquidity</p>
      <h1 className="font-display font-bold text-3xl tracking-tight">
        {mode === 'unique' ? 'Add a unique platform' : 'List a robot by exact SKU'}
      </h1>
      <p className="text-muted mt-2 text-sm">
        {mode === 'unique'
          ? 'Name, maker, year, model number, and type specs for platforms that are not in the catalog yet.'
          : 'Pick the catalog model. You set condition, asking price, and notes — not a free-text name.'}
      </p>
      <HowToList compact className="mt-6" />

      <div className="mt-6 grid grid-cols-2 gap-2 p-1 rounded-[14px] bg-elevated border border-line">
        <button
          type="button"
          onClick={() => { setMode('catalog'); setError(''); }}
          className={'w-full min-h-[44px] px-2 rounded-[10px] font-semibold text-center leading-tight ' + (mode === 'catalog' ? 'or-check text-white' : 'text-muted hover:text-ink')}
        >
          Catalog SKU
        </button>
        <button
          type="button"
          onClick={() => { setMode('unique'); setError(''); }}
          className={'w-full min-h-[44px] px-2 rounded-[10px] font-semibold text-center leading-tight ' + (mode === 'unique' ? 'or-check text-white' : 'text-muted hover:text-ink')}
        >
          Add a unique platform
        </button>
      </div>

      {blocked && <EmailVerifyNotice className="mt-6" />}

      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === 'catalog' ? (
          <>
            <div ref={boxRef} className="relative">
              <label className="block text-sm font-semibold">
                <ReqLabel>Catalog SKU</ReqLabel>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setOpen(true); if (selected) setSelected(null); }}
                  onFocus={() => setOpen(true)}
                  placeholder="Search model, maker, or type…"
                  className={field}
                  autoComplete="off"
                  aria-autocomplete="list"
                />
              </label>
              {open && (
                <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto border border-line rounded-[12px] bg-white shadow-or">
                  {filtered.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-muted">{!catalogReady ? 'Loading catalog…' : 'No matching SKU.'}</li>
                  ) : (
                    filtered.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => pickSku(r)}
                          className="w-full text-left px-3 py-2.5 hover:bg-soft flex gap-3 items-center"
                        >
                          <span className="w-10 h-10 rounded-md bg-elevated shrink-0 grid place-items-center overflow-hidden">
                            {r.image ? (
                              <img
                                src={imageSrc(r.image)}
                                alt=""
                                width={40}
                                height={40}
                                loading="lazy"
                                decoding="async"
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold truncate">{r.name}</span>
                            <span className="block text-xs text-dim truncate">{r.maker} · {typeLabel(r.type)}{r.year ? ' · ' + r.year : ''}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            {catalogError && !skus.length && <p className="text-red-600 text-sm">{catalogError}</p>}
            {isManufacturer && catalogReady && !filtered.length && (
              <p className="text-muted text-sm">No catalog SKUs match your manufacturer name ({manufacturerBrand || 'unset'}).</p>
            )}

            {selected && (
              <div className="flex gap-4 border border-line rounded-[16px] p-3 bg-soft">
                <div className="w-20 h-20 rounded-[10px] bg-white shrink-0 border border-line grid place-items-center overflow-hidden">
                  {selected.image ? (
                    <img
                      src={imageSrc(selected.image)}
                      alt=""
                      width={80}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className="max-h-full max-w-full object-contain p-1"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold">{selected.name}</div>
                  <p className="text-xs text-dim mt-1">
                    {selected.maker} · {typeLabel(selected.type)}{selected.year ? ' · ' + selected.year : ''}
                  </p>
                  <p className="text-xs text-muted mt-1">SKU {selected.id}{selected.price != null ? ' · catalog from ' + money(selected.price) : ''}</p>
                </div>
              </div>
            )}
            {photoField}
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm font-semibold">
                <ReqLabel>Name</ReqLabel>
                <input required value={unique.name} onChange={(e) => setUnique((u) => ({ ...u, name: e.target.value }))} className={field} />
              </label>
              <label className="block text-sm font-semibold">
                <ReqLabel>Maker</ReqLabel>
                <input
                  required
                  readOnly={isManufacturer}
                  value={isManufacturer ? (manufacturerBrand || unique.maker) : unique.maker}
                  onChange={(e) => setUnique((u) => ({ ...u, maker: e.target.value }))}
                  className={field + (isManufacturer ? ' bg-elevated' : '')}
                />
                {isManufacturer && (
                  <span className="block text-xs text-dim font-normal mt-1">Manufacturers can only list their own brand.</span>
                )}
              </label>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <label className="block text-sm font-semibold">
                <ReqLabel>Type</ReqLabel>
                <select value={unique.type} onChange={(e) => setUnique((u) => ({ ...u, type: e.target.value }))} className={field}>
                  {TYPE_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                <ReqLabel>Year</ReqLabel>
                <input required type="number" min="1980" max="2035" value={unique.year} onChange={(e) => setUnique((u) => ({ ...u, year: e.target.value }))} className={field} />
              </label>
              <label className="block text-sm font-semibold">
                Model number
                <input value={unique.modelNumber} onChange={(e) => setUnique((u) => ({ ...u, modelNumber: e.target.value }))} className={field} />
              </label>
            </div>
            {unique.type && (
              <div>
                <h2 className="font-display font-semibold text-base mb-3">Specifications</h2>
                <SpecGroupFields
                  type={unique.type}
                  specs={specs}
                  groups={specGroups}
                  onChange={(k, v) => setSpecs((s) => ({ ...s, [k]: v }))}
                />
              </div>
            )}
            {photoField}
          </>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm font-semibold">
            <ReqLabel>Condition</ReqLabel>
            <select value={form.condition} onChange={(e) => set('condition', e.target.value)} className={field}>
              {sellConditions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            <ReqLabel>Asking price (USD)</ReqLabel>
            <input required type="number" min="0" step="1" value={form.price} onChange={(e) => set('price', e.target.value)} className={field} />
          </label>
        </div>
        {form.condition === 'used' && (
          <label className="block text-sm font-semibold">
            <ReqLabel>Item condition</ReqLabel>
            <select required value={form.itemCondition} onChange={(e) => set('itemCondition', e.target.value)} className={field}>
              {ITEM_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <span className="block text-xs text-dim font-normal mt-1">Required for used robots: excellent, very good, good, fair, or poor.</span>
          </label>
        )}
        <label className="block text-sm font-semibold">
          Short description
          <textarea value={form.shortDesc} onChange={(e) => set('shortDesc', e.target.value)} rows={4} className={field} />
        </label>
        {form.condition === 'cpo' && (
          <label className="block text-sm font-semibold">
            <ReqLabel>Inspection notes</ReqLabel>
            <textarea
              required
              minLength={20}
              value={form.inspectionNotes}
              onChange={(e) => set('inspectionNotes', e.target.value)}
              rows={4}
              placeholder="Hours, battery health, actuators, cosmetic grade, what was certified…"
              className={field}
            />
            <span className="block text-xs text-dim font-normal mt-1">Required for certified pre-owned (at least 20 characters).</span>
          </label>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={saving || !canSubmit || blocked} className="or-check w-full text-white font-semibold py-3.5 rounded-[12px] disabled:opacity-60">
          {saving ? 'Publishing…' : 'Publish listing'}
        </button>
        <p className="text-xs text-dim">Listing is public immediately. Buyers can request to purchase; financing and warranty attach on quote.</p>
      </form>
      <p className="mt-6 text-sm"><Link to="/" className="text-accent">Cancel · back to catalog</Link></p>
    </div>
  );
}
