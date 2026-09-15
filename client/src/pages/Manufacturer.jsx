import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, apiUpload, imageSrc, isNotFound, mediaUrl, typeLabel } from '../api';
import { useAuth } from '../AuthContext';
import ReqLabel from '../components/ReqLabel';
import SpecGroupFields from '../components/SpecGroupFields';
import { loadSpecGroups, TYPE_SPEC_GROUPS } from '../specGroups';

const field = 'mt-1 w-full border border-line rounded-[10px] px-3 py-2.5 bg-white font-normal';

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'item';
}

function asList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function emptyVariant() {
  return { id: '', name: '', price: '' };
}

function emptyColor() {
  return { id: '', name: '', hex: '#e2e8f0', premium: 0, image: '' };
}

export default function Manufacturer() {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [robots, setRobots] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(null);
  const [groups, setGroups] = useState(TYPE_SPEC_GROUPS);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpecGroups().then(setGroups).catch(() => setGroups(TYPE_SPEC_GROUPS));
  }, []);

  useEffect(() => {
    if (!user || (user.accountType !== 'manufacturer' && user.account_type !== 'manufacturer')) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        let list = [];
        try {
          const d = await api('/api/mfr/robots', { auth: true });
          list = asList(d.robots || d);
        } catch (err) {
          if (isNotFound(err)) {
            const d = await api('/api/robots?mine=1', { auth: true });
            list = asList(d.robots);
          } else {
            throw err;
          }
        }
        if (cancelled) return;
        setRobots(list);
        setSelectedId((cur) => cur || (list[0] && list[0].id) || '');
      } catch (err) {
        if (!cancelled) {
          setError(isNotFound(err) ? 'Manufacturer CRM is not available yet.' : err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!selectedId) { setForm(null); return; }
    let cancelled = false;
    setSaved('');
    api('/api/robots/' + encodeURIComponent(selectedId))
      .then((d) => {
        if (cancelled) return;
        const robot = d.robot || d;
        const images = asList(robot.images);
        if (robot.image && !images.includes(robot.image)) images.unshift(robot.image);
        setForm({
          name: robot.name || '',
          maker: robot.maker || '',
          modelNumber: robot.modelNumber || robot.model_number || '',
          type: robot.type || 'humanoid',
          year: robot.year || '',
          specs: robot.specs && typeof robot.specs === 'object' ? { ...robot.specs } : {},
          variants: asList(robot.variants).map((v) => ({
            id: v.id || '',
            name: v.name || '',
            price: v.price != null ? String(v.price) : ''
          })),
          colors: asList(robot.colors).map((c) => ({
            id: c.id || '',
            name: c.name || '',
            hex: c.hex || '#e2e8f0',
            premium: Number(c.premium) || 0,
            image: c.image || c.photo || ''
          })),
          images,
          highlights: asList(robot.highlights),
          listPrice: robot.listPrice != null ? String(robot.listPrice) : (robot.price != null ? String(robot.price) : ''),
          discountPct: robot.discountPct != null ? String(robot.discountPct) : '0'
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  if (!ready) return <div className="max-w-xl mx-auto px-4 py-16 text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login?next=/mfr" replace />;
  if (ready && user && user.accountType !== 'manufacturer' && user.account_type !== 'manufacturer') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <h1 className="font-display font-bold text-3xl tracking-tight">Manufacturer CRM</h1>
        <p className="text-muted mt-3 text-sm">This workspace is for manufacturer accounts only.</p>
        <Link to="/" className="inline-block mt-6 text-accent font-semibold">Back to catalog</Link>
      </div>
    );
  }

  function setSpec(k, v) {
    setForm((f) => ({ ...f, specs: { ...f.specs, [k]: v } }));
  }

  async function onPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await apiUpload('/api/uploads', fd);
      const url = mediaUrl(up);
      if (url) setForm((f) => ({ ...f, images: (f.images || []).concat(url) }));
    } catch (err) {
      setError(isNotFound(err) ? 'Photo upload is not available yet.' : err.message);
    }
  }

  async function onFinishPhoto(i, e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await apiUpload('/api/uploads', fd);
      const url = mediaUrl(up);
      if (!url) return;
      setForm((f) => {
        const next = f.colors.slice();
        next[i] = { ...next[i], image: url };
        return { ...f, colors: next };
      });
    } catch (err) {
      setError(isNotFound(err) ? 'Photo upload is not available yet.' : err.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    if (!form || !selectedId) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const variants = form.variants
        .filter((v) => v.name.trim())
        .map((v, i) => ({
          id: v.id || slug(v.name) || 'v' + i,
          name: v.name.trim(),
          price: Number(v.price) || 0
        }));
      const colors = form.colors
        .filter((c) => c.name.trim())
        .map((c, i) => ({
          id: c.id || slug(c.name) || 'c' + i,
          name: c.name.trim(),
          hex: c.hex || '#e2e8f0',
          premium: Number(c.premium) || 0,
          image: c.image || undefined
        }));
      const specs = {};
      Object.entries(form.specs || {}).forEach(([k, v]) => {
        if (v != null && String(v).trim() !== '') specs[k] = String(v).trim();
      });
      const images = (form.images || []).filter(Boolean);
      await api('/api/mfr/robots/' + encodeURIComponent(selectedId), {
        method: 'PATCH',
        auth: true,
        body: {
          name: form.name.trim(),
          maker: form.maker.trim(),
          modelNumber: form.modelNumber.trim() || undefined,
          type: form.type,
          year: form.year ? Number(form.year) : undefined,
          specs,
          variants,
          colors,
          images,
          highlights: (form.highlights || []).map((h) => String(h).trim()).filter(Boolean),
          image: images[0] || undefined,
          listPrice: Number(form.listPrice),
          discountPct: Number(form.discountPct) || 0
        }
      });
      setSaved('Platform saved.');
      setRobots((prev) => prev.map((r) => r.id === selectedId ? { ...r, name: form.name, maker: form.maker } : r));
      nav('/robots/' + encodeURIComponent(selectedId));
    } catch (err) {
      setError(isNotFound(err) ? 'Manufacturer CRM is not available yet.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-[13px]">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">Manufacturer</p>
      <h1 className="font-display font-bold text-3xl tracking-tight">My Robots</h1>
      <p className="text-muted mt-2 text-sm">
        {user?.companyName ? user.companyName + ' · ' : ''}Edit specs, variants, finishes, photos, and highlights for your catalog.
      </p>
      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
      {loading ? (
        <p className="mt-8 text-muted">Loading platforms…</p>
      ) : (
        <div className="mt-8 grid lg:grid-cols-[240px_1fr] gap-8">
          <aside className="border border-line rounded-[16px] bg-white overflow-hidden h-fit">
            <div className="px-4 py-3 border-b border-line font-semibold">Your platforms</div>
            {robots.length === 0 ? (
              <p className="px-4 py-6 text-muted">No platforms yet. <Link to="/add" className="text-accent">Add a unique platform</Link>.</p>
            ) : (
              <ul>
                {robots.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={'w-full text-left px-4 py-3 border-b border-line last:border-0 ' + (r.id === selectedId ? 'bg-soft font-semibold' : 'hover:bg-soft')}
                    >
                      <span className="block truncate">{r.name}</span>
                      <span className="block text-[11px] text-dim font-normal">{r.maker} · {typeLabel(r.type)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div>
            {!form ? (
              <p className="text-muted">Select a platform to edit.</p>
            ) : (
              <form onSubmit={save} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block text-sm font-semibold">
                    <ReqLabel>Name</ReqLabel>
                    <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={field} />
                  </label>
                  <label className="block text-sm font-semibold">
                    <ReqLabel>Maker</ReqLabel>
                    <input required value={form.maker} onChange={(e) => setForm((f) => ({ ...f, maker: e.target.value }))} className={field} />
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block text-sm font-semibold">
                    <ReqLabel>Listing price (USD)</ReqLabel>
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={form.listPrice || ''}
                      onChange={(e) => setForm((f) => ({ ...f, listPrice: e.target.value }))}
                      className={field}
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Discount %
                    <input
                      type="number"
                      min="0"
                      max="99"
                      step="1"
                      value={form.discountPct || '0'}
                      onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
                      className={field}
                    />
                    <span className="block text-xs text-dim font-normal mt-1">
                      {Number(form.discountPct) > 0 && Number(form.listPrice) > 0
                        ? 'Sale price ' + Math.round(Number(form.listPrice) * (1 - Number(form.discountPct) / 100)).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
                        : 'Leave 0 for no discount. Cards show listing price, or % off + sale price.'}
                    </span>
                  </label>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <label className="block text-sm font-semibold">
                    Model number
                    <input value={form.modelNumber} onChange={(e) => setForm((f) => ({ ...f, modelNumber: e.target.value }))} className={field} />
                  </label>
                  <label className="block text-sm font-semibold">
                    Year
                    <input type="number" min="1980" max="2035" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className={field} />
                  </label>
                  <label className="block text-sm font-semibold">
                    Type
                    <input value={typeLabel(form.type)} readOnly className={field + ' bg-elevated'} />
                  </label>
                </div>

                <fieldset className="border border-line rounded-[14px] p-4 bg-white">
                  <legend className="font-display font-semibold text-sm px-1">Photos</legend>
                  <div className="flex flex-wrap gap-3">
                    {(form.images || []).map((src, i) => (
                      <div key={src + i} className="relative w-24 h-24 rounded-[10px] border border-line bg-elevated overflow-hidden">
                        <img src={imageSrc(src)} alt="" className="w-full h-full object-contain p-1" />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))}
                          className="absolute top-1 right-1 bg-white/90 text-[11px] font-semibold px-1.5 rounded"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="block text-sm font-semibold mt-3">
                    Upload photo
                    <input type="file" accept="image/*" onChange={onPhoto} className={field} />
                  </label>
                </fieldset>

                <fieldset className="border border-line rounded-[14px] p-4 bg-white">
                  <legend className="font-display font-semibold text-sm px-1">Highlights</legend>
                  <div className="space-y-2">
                    {(form.highlights || []).map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={h}
                          onChange={(e) => setForm((f) => {
                            const next = f.highlights.slice();
                            next[i] = e.target.value;
                            return { ...f, highlights: next };
                          })}
                          className={field + ' mt-0'}
                        />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, highlights: f.highlights.filter((_, idx) => idx !== i) }))}
                          className="text-red-600 font-semibold px-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, highlights: (f.highlights || []).concat('') }))}
                    className="mt-3 text-sm font-semibold text-accent"
                  >
                    Add highlight
                  </button>
                </fieldset>

                <fieldset className="border border-line rounded-[14px] p-4 bg-white">
                  <legend className="font-display font-semibold text-sm px-1">Variants</legend>
                  <div className="space-y-2">
                    {(form.variants || []).map((v, i) => (
                      <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                        <input
                          placeholder="Name"
                          value={v.name}
                          onChange={(e) => setForm((f) => {
                            const next = f.variants.slice();
                            next[i] = { ...next[i], name: e.target.value };
                            return { ...f, variants: next };
                          })}
                          className={field + ' mt-0'}
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="Price"
                          value={v.price}
                          onChange={(e) => setForm((f) => {
                            const next = f.variants.slice();
                            next[i] = { ...next[i], price: e.target.value };
                            return { ...f, variants: next };
                          })}
                          className={field + ' mt-0'}
                        />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }))}
                          className="text-red-600 font-semibold px-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, variants: (f.variants || []).concat(emptyVariant()) }))}
                    className="mt-3 text-sm font-semibold text-accent"
                  >
                    Add variant
                  </button>
                </fieldset>

                <fieldset className="border border-line rounded-[14px] p-4 bg-white">
                  <legend className="font-display font-semibold text-sm px-1">Finish</legend>
                  <p className="text-xs text-dim mb-3">Upload a photo of the robot in each finish. The listing photo switches when a buyer clicks that color.</p>
                  <div className="space-y-3">
                    {(form.colors || []).map((c, i) => (
                      <div key={i} className="border border-line rounded-[12px] p-3 space-y-2">
                        <div className="grid grid-cols-[1fr_52px_100px_auto] gap-2 items-center">
                          <input
                            placeholder="Finish name"
                            value={c.name}
                            onChange={(e) => setForm((f) => {
                              const next = f.colors.slice();
                              next[i] = { ...next[i], name: e.target.value };
                              return { ...f, colors: next };
                            })}
                            className={field + ' mt-0'}
                          />
                          <input
                            type="color"
                            value={c.hex || '#e2e8f0'}
                            onChange={(e) => setForm((f) => {
                              const next = f.colors.slice();
                              next[i] = { ...next[i], hex: e.target.value };
                              return { ...f, colors: next };
                            })}
                            className="h-10 w-full rounded-[8px] border border-line bg-white p-1"
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Premium"
                            value={c.premium}
                            onChange={(e) => setForm((f) => {
                              const next = f.colors.slice();
                              next[i] = { ...next[i], premium: e.target.value };
                              return { ...f, colors: next };
                            })}
                            className={field + ' mt-0'}
                          />
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, colors: f.colors.filter((_, idx) => idx !== i) }))}
                            className="text-red-600 font-semibold px-2"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          {c.image ? (
                            <div className="relative w-16 h-16 rounded-[8px] border border-line overflow-hidden bg-elevated">
                              <img src={imageSrc(c.image)} alt="" className="w-full h-full object-contain p-1" />
                              <button
                                type="button"
                                className="absolute top-0 right-0 bg-white/90 text-[10px] px-1"
                                onClick={() => setForm((f) => {
                                  const next = f.colors.slice();
                                  next[i] = { ...next[i], image: '' };
                                  return { ...f, colors: next };
                                })}
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-[8px] border border-dashed border-line grid place-items-center text-[10px] text-dim text-center px-1">No photo</div>
                          )}
                          <label className="text-sm font-semibold text-accent cursor-pointer">
                            Upload finish photo
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFinishPhoto(i, e)} />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, colors: (f.colors || []).concat(emptyColor()) }))}
                    className="mt-3 text-sm font-semibold text-accent"
                  >
                    Add finish
                  </button>
                </fieldset>

                <div>
                  <h2 className="font-display font-semibold text-lg mb-3">Specifications</h2>
                  <SpecGroupFields type={form.type} specs={form.specs} onChange={setSpec} groups={groups} />
                </div>

                {saved && <p className="text-green text-sm">{saved}</p>}
                <button type="submit" disabled={busy} className="or-check text-white font-semibold px-5 py-3 rounded-[12px] disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save platform'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
