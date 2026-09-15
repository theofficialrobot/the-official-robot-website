import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  api,
  apiUpload,
  conditionLabel,
  itemConditionLabel,
  FALLBACK_WARRANTY_PLANS,
  fetchCatalog,
  imageSrc,
  isNotFound,
  isUnverifiedError,
  mediaUrl,
  money,
  warrantyAmount,
  warrantyTermPriceLabel
} from '../api';
import { needsVerification, useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import EmailVerifyNotice from '../components/EmailVerifyNotice';
import PriceBlock from '../components/PriceBlock';
import ReqLabel from '../components/ReqLabel';
import RobotCard from '../components/RobotCard';
import WatchCompareButtons from '../components/WatchCompareButtons';
import { groupedSpecRows, isUndisclosed, loadSpecGroups, pickMiniSpecs, TYPE_SPEC_GROUPS } from '../specGroups';

function asList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function when(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sameUser(review, user) {
  if (!review || !user) return false;
  return String(review.userId ?? review.user_id) === String(user.id);
}

function StarRow({ value, className = '' }) {
  const v = Math.round(Number(value) || 0);
  return (
    <span className={'inline-flex tracking-tight ' + className} aria-label={(value || 0) + ' stars'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= v ? 'text-accent' : 'text-dim'}>★</span>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          aria-label={n + ' star' + (n === 1 ? '' : 's')}
          onClick={() => onChange(n)}
          className={'text-2xl leading-none ' + (n <= value ? 'text-accent' : 'text-dim hover:text-accent')}
        >
          ★
        </button>
      ))}
    </div>
  );
}

async function mergeRelated(current, seed, type) {
  const out = [];
  const seen = new Set([String(current)]);
  for (const r of seed || []) {
    if (!r || !r.id || seen.has(String(r.id))) continue;
    seen.add(String(r.id));
    out.push(r);
    if (out.length >= 21) return out;
  }
  if (out.length >= 21 || !type) return out;
  try {
    const more = await api('/api/robots?type=' + encodeURIComponent(type) + '&limit=21');
    for (const r of more.robots || []) {
      if (!r || !r.id || seen.has(String(r.id))) continue;
      seen.add(String(r.id));
      out.push(r);
      if (out.length >= 21) break;
    }
  } catch {
    /* keep seed related */
  }
  return out;
}

function RelatedCarousel({ robots }) {
  const scroller = useRef(null);

  function scroll(dir) {
    const root = scroller.current;
    if (!root) return;
    const card = root.querySelector('[data-related-card]');
    if (!card) return;
    const styles = getComputedStyle(root);
    const gap = parseFloat(styles.columnGap || styles.gap) || 12;
    root.scrollBy({ left: dir * (card.getBoundingClientRect().width + gap), behavior: 'smooth' });
  }

  return (
    <section className="mt-12">
      <h2 className="font-display font-semibold text-xl mb-4">Products related to this item</h2>
      <div className="relative">
        <button
          type="button"
          aria-label="Previous related"
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-line shadow-or text-lg font-semibold text-ink hover:border-accent"
        >
          ‹
        </button>
        <div ref={scroller} className="flex flex-nowrap gap-3 overflow-x-hidden scroll-smooth px-11">
          {robots.map((r, i) => (
            <div key={r.id} data-related-card className="w-[148px] sm:w-[160px] shrink-0">
              <RobotCard robot={r} index={i} />
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Next related"
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-line shadow-or text-lg font-semibold text-ink hover:border-accent"
        >
          ›
        </button>
      </div>
    </section>
  );
}

export default function RobotDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { add } = useCart();
  const nav = useNavigate();
  const [robot, setRobot] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [canReviewReason, setCanReviewReason] = useState('sign_in');
  const [groups, setGroups] = useState(TYPE_SPEC_GROUPS);
  const [plans, setPlans] = useState(FALLBACK_WARRANTY_PLANS);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState(null);
  const [variant, setVariant] = useState('');
  const [colorId, setColorId] = useState('');
  const [warrantyId, setWarrantyId] = useState('3yr');
  const [mainIdx, setMainIdx] = useState(0);
  const [preferFinishPhoto, setPreferFinishPhoto] = useState(true);
  const [added, setAdded] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewFiles, setReviewFiles] = useState([]);
  const [reviewError, setReviewError] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRating, setEditRating] = useState(5);
  const [editBody, setEditBody] = useState('');
  const [editPhotos, setEditPhotos] = useState([]);
  const [editFiles, setEditFiles] = useState([]);
  const [editBusy, setEditBusy] = useState(false);

  function applyPayload(d, resetVariant = false) {
    const next = d && d.robot;
    if (!next) return;
    setRobot(next);
    if (resetVariant) {
      setVariant((next.variants && next.variants[0] && next.variants[0].id) || '');
      setColorId((next.colors && next.colors[0] && next.colors[0].id) || '');
    }
    setReviews(asList(d.reviews || next.reviews));
    setCanReview(!!(d.canReview ?? next.canReview));
    setCanReviewReason(d.canReviewReason || next.canReviewReason || '');
  }

  useEffect(() => {
    loadSpecGroups().then(setGroups).catch(() => setGroups(TYPE_SPEC_GROUPS));
    fetchCatalog().then((d) => {
      if (d.warrantyPlans?.length) setPlans(d.warrantyPlans);
    });
  }, []);

  useEffect(() => {
    setRobot(null);
    setMainIdx(0);
    setPreferFinishPhoto(true);
    setBought(null);
    setAdded(false);
    setUnverified(false);
    setReviewError('');
    setEditingId(null);
    const rid = encodeURIComponent(id);
    api('/api/robots/' + rid + '?related=21', user ? { auth: true } : undefined)
      .then(async (d) => {
        applyPayload(d, true);
        const bot = d.robot;
        const rel = await mergeRelated(bot && bot.id, d.related, bot && bot.type);
        setRelated(rel);
        if (!asList(d.reviews || d.robot?.reviews).length) {
          api('/api/robots/' + rid + '/reviews')
            .then((r) => setReviews(asList(r.reviews || r)))
            .catch(() => {});
        }
      })
      .catch((e) => setError(e.message));
  }, [id, user && user.id]);

  async function reload() {
    const d = await api('/api/robots/' + encodeURIComponent(id) + '?related=21', user ? { auth: true } : undefined);
    applyPayload(d, false);
    if (d.related) {
      const rel = await mergeRelated(d.robot && d.robot.id, d.related, d.robot && d.robot.type);
      setRelated(rel);
    }
  }

  async function buy() {
    if (!user) {
      nav('/login?next=' + encodeURIComponent('/robots/' + id));
      return;
    }
    if (needsVerification(user)) {
      setUnverified(true);
      setError('Verify your email to buy.');
      return;
    }
    setBuying(true);
    setError('');
    setUnverified(false);
    try {
      const d = await api('/api/robots/' + encodeURIComponent(id) + '/buy', {
        method: 'POST',
        auth: true,
        body: { variant, warrantyId }
      });
      setBought(d.order);
    } catch (e) {
      if (isUnverifiedError(e)) {
        setUnverified(true);
        setError('Verify your email to buy.');
      } else {
        setError(e.message);
      }
    } finally {
      setBuying(false);
    }
  }

  async function uploadReviewPhotos(files) {
    const photos = [];
    for (const file of files.slice(0, 6)) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const up = await apiUpload('/api/uploads?kind=reviews', fd);
        const url = mediaUrl(up);
        if (url) photos.push(url);
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    }
    return photos;
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!user) {
      nav('/login?next=' + encodeURIComponent('/robots/' + id));
      return;
    }
    if (needsVerification(user)) {
      setUnverified(true);
      setReviewError('Verify your email to review.');
      return;
    }
    setReviewBusy(true);
    setReviewError('');
    setUnverified(false);
    try {
      const photos = await uploadReviewPhotos(reviewFiles);
      const d = await api('/api/robots/' + encodeURIComponent(id) + '/reviews', {
        method: 'POST',
        auth: true,
        body: { rating, body: reviewBody.trim(), photos }
      });
      if (d.review) setReviews((prev) => [d.review, ...prev.filter((r) => r.id !== d.review.id)]);
      try { await reload(); } catch { /* keep optimistic */ }
      setReviewBody('');
      setReviewFiles([]);
      setRating(5);
    } catch (err) {
      if (isUnverifiedError(err)) {
        setUnverified(true);
        setReviewError('Verify your email to review.');
      } else if (isNotFound(err)) {
        setReviewError('Reviews are not available yet.');
      } else {
        setReviewError(err.message);
      }
    } finally {
      setReviewBusy(false);
    }
  }

  function startEdit(rev) {
    setEditingId(rev.id);
    setEditRating(Number(rev.rating) || 5);
    setEditBody(rev.body || rev.text || '');
    setEditPhotos(asList(rev.photos));
    setEditFiles([]);
    setReviewError('');
  }

  async function saveEdit(e, reviewId) {
    e.preventDefault();
    setEditBusy(true);
    setReviewError('');
    try {
      const extra = await uploadReviewPhotos(editFiles);
      const photos = editPhotos.concat(extra);
      const d = await api('/api/robots/' + encodeURIComponent(id) + '/reviews/' + encodeURIComponent(reviewId), {
        method: 'PATCH',
        auth: true,
        body: { rating: editRating, body: editBody.trim(), photos }
      });
      if (d.review) {
        setReviews((prev) => prev.map((r) => r.id === d.review.id ? d.review : r));
      } else {
        setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, rating: editRating, body: editBody.trim(), photos } : r));
      }
      try { await reload(); } catch { /* keep optimistic */ }
      setEditingId(null);
    } catch (err) {
      setReviewError(isNotFound(err) ? 'Editing reviews is not available yet.' : err.message);
    } finally {
      setEditBusy(false);
    }
  }

  const variants = asList(robot && robot.variants);
  const colors = asList(robot && robot.colors);
  const highlights = asList(robot && robot.highlights);
  const selectedVariant = variants.find((v) => v.id === variant) || variants[0];
  const selectedColor = colors.find((c) => c.id === colorId) || colors[0];
  const configPrice = selectedVariant && Number.isFinite(Number(selectedVariant.price))
    ? Number(selectedVariant.price)
    : Number(robot && robot.price) || 0;
  const finishPrice = Number(selectedColor && selectedColor.premium) || 0;
  const coveragePrice = warrantyAmount(configPrice, 1, warrantyId, plans);
  const estimated = configPrice + finishPrice + coveragePrice;
  const showPriceRows = variants.length > 0 || colors.length > 0;
  const miniSpecs = useMemo(() => pickMiniSpecs(robot || {}), [robot]);
  const specGroups = useMemo(() => groupedSpecRows(robot || {}, groups), [robot, groups]);
  const gallery = useMemo(() => {
    const imgs = [];
    const seen = new Set();
    function push(src) {
      if (!src) return;
      const s = String(src);
      if (seen.has(s)) return;
      seen.add(s);
      imgs.push(s);
    }
    push(robot && robot.image);
    asList(robot && robot.images).forEach(push);
    return imgs;
  }, [robot]);
  const galleryPhoto = gallery[Math.min(mainIdx, Math.max(gallery.length - 1, 0))] || (robot && robot.image);
  const finishPhoto = selectedColor && (selectedColor.image || selectedColor.photo);
  const mainPhoto = (preferFinishPhoto && finishPhoto) || galleryPhoto;
  const cpo = robot && robot.condition === 'cpo';
  const ratingAvg = robot && (robot.ratingAvg ?? robot.rating_avg);
  const ratingCount = robot && (robot.ratingCount ?? robot.rating_count ?? reviews.length);
  const showAvg = robot && ratingCount > 0 && ratingAvg != null;
  const ownReview = user && reviews.some((r) => sameUser(r, user));

  if (error && !robot) {
    return <div className="max-w-3xl mx-auto px-4 py-16"><p className="text-red-600">{error}</p><Link to="/" className="text-accent">Back to catalog</Link></div>;
  }
  if (!robot) return <div className="max-w-3xl mx-auto px-4 py-16 text-muted">Loading listing…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-[13px]">
      <Link to="/" className="text-sm font-semibold text-accent no-underline">← Marketplace</Link>

      <div className="mt-4 grid lg:grid-cols-[minmax(280px,360px)_1fr] gap-8 items-start">
        <div>
          <div className="rounded-[16px] border border-line overflow-hidden bg-white shadow-or">
            <div className="h-72 sm:h-80 grid place-items-center or-check relative overflow-hidden">
              {selectedColor && selectedColor.hex && !finishPhoto && (
                <div className="absolute inset-0 z-[1] mix-blend-multiply opacity-[0.18]" style={{ background: selectedColor.hex }} />
              )}
              {mainPhoto ? (
                <img
                  src={imageSrc(mainPhoto)}
                  alt=""
                  width={720}
                  height={320}
                  loading="eager"
                  decoding="async"
                  className="max-h-full max-w-full object-contain p-4 drop-shadow-lg relative z-[2]"
                />
              ) : (
                <span className="text-7xl relative z-[2]">{robot.icon || '🤖'}</span>
              )}
              {cpo && (
                <span className="absolute top-3 left-3 z-[3] text-[11px] font-bold uppercase tracking-wide bg-green text-white px-3 py-1.5 rounded-full shadow">
                  {conditionLabel(robot.condition)}
                </span>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-3 py-2.5 border-t border-line bg-white">
                {gallery.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => { setMainIdx(i); setPreferFinishPhoto(false); }}
                    className={
                      'w-14 h-14 shrink-0 rounded-[8px] border overflow-hidden bg-elevated grid place-items-center ' +
                      (i === mainIdx ? 'border-accent ring-2 ring-[var(--accent-dim)]' : 'border-line')
                    }
                  >
                    <img src={imageSrc(src)} alt="" className="max-h-full max-w-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
            {miniSpecs.length > 0 && (
              <div className="robot-card-specs p-4 pb-5 border-t border-line">
                {miniSpecs.map(([k, v]) => {
                  const empty = isUndisclosed(v);
                  return (
                    <div key={k} className={'robot-card-spec' + (empty ? ' is-empty' : '')}>
                      <div className="k">{k}</div>
                      <div className="v">{empty ? 'Not disclosed' : String(v)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <span className={
              'text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ' +
              (cpo ? 'bg-green text-white' : 'bg-[var(--accent-dim)] text-accent')
            }>
              {conditionLabel(robot.condition)}
            </span>
            {(robot.condition === 'used' || robot.condition === 'like_new') && itemConditionLabel(robot.itemCondition || robot.item_condition) && (
              <span className="text-[11px] font-bold uppercase tracking-wide bg-elevated text-muted px-2 py-1 rounded-full">
                {itemConditionLabel(robot.itemCondition || robot.item_condition)}
              </span>
            )}
            <span className="text-[11px] font-bold uppercase tracking-wide bg-elevated text-muted px-2 py-1 rounded-full capitalize">{robot.type}</span>
            {robot.source === 'catalog' && (
              <span className="text-[11px] font-bold uppercase tracking-wide bg-elevated text-muted px-2 py-1 rounded-full">Official catalog</span>
            )}
            <WatchCompareButtons id={robot.id} />
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight">{robot.name}</h1>
          <p className="text-muted mt-1">
            {robot.maker}
            {robot.year ? ' · ' + robot.year : ''}
            {robot.modelNumber ? ' · ' + robot.modelNumber : ''}
            {' · Sold by '}
            {robot.sellerName || 'member'}
          </p>
          {showAvg && (
            <div className="mt-2 flex items-center gap-2">
              <StarRow value={ratingAvg} />
              <span className="text-muted">{Number(ratingAvg).toFixed(1)} · {ratingCount} review{ratingCount === 1 ? '' : 's'}</span>
            </div>
          )}
          {(robot.uniqueSummary || robot.shortDesc) && (
            <p className="mt-4 leading-relaxed text-muted bg-soft border border-line rounded-[12px] px-3.5 py-3 border-l-[3px] border-l-accent">
              {robot.uniqueSummary || robot.shortDesc}
            </p>
          )}

          {showPriceRows ? (
            <div className="mt-6">
              {variants.length > 0 && (
                <label className="flex items-center justify-between gap-4 py-2.5 border-b border-line text-sm">
                  <span className="text-muted">Configuration</span>
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="border border-line rounded-[10px] px-3 py-1.5 bg-white font-semibold max-w-[60%]"
                  >
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} — {money(v.price)}</option>
                    ))}
                  </select>
                </label>
              )}
              {colors.length > 0 && (
                <div className="flex items-center justify-between gap-4 py-2.5 border-b border-line text-sm">
                  <span className="text-muted">Finish</span>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {colors.map((c) => (
                      <button
                        key={c.id || c.name}
                        type="button"
                        title={c.name + (c.premium ? ' (+' + money(c.premium) + ')' : ' — included')}
                        onClick={() => { setColorId(c.id); setPreferFinishPhoto(true); }}
                        className={'w-7 h-7 rounded-full border-2 ' + (colorId === c.id ? 'border-ink scale-110' : 'border-white shadow')}
                        style={{ background: c.hex || '#e2e8f0' }}
                      />
                    ))}
                    <span className="font-semibold tabular-nums">{money(finishPrice)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between py-2.5 border-b border-line text-sm">
                <span className="text-muted">Accessories</span>
                <span className="font-semibold tabular-nums">{money(0)}</span>
              </div>
              <label className="flex items-center justify-between gap-4 py-2.5 border-b border-line text-sm">
                <span className="text-muted">Coverage</span>
                <select
                  value={warrantyId}
                  onChange={(e) => setWarrantyId(e.target.value)}
                  className="border border-line rounded-[10px] px-3 py-1.5 bg-white font-semibold max-w-[60%]"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {warrantyTermPriceLabel(p, warrantyAmount(configPrice, 1, p.id, plans))}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-baseline justify-between pt-4 mt-1">
                <span className="text-muted">Estimated total</span>
                <span className="font-display font-bold text-3xl text-accent tabular-nums">{money(estimated)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <PriceBlock robot={{ ...robot, price: configPrice }} size="detail" />
              <label className="flex items-center justify-between gap-4 py-2.5 mt-3 border-b border-line text-sm">
                <span className="text-muted">Coverage</span>
                <select
                  value={warrantyId}
                  onChange={(e) => setWarrantyId(e.target.value)}
                  className="border border-line rounded-[10px] px-3 py-1.5 bg-white font-semibold max-w-[60%]"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {warrantyTermPriceLabel(p, warrantyAmount(configPrice, 1, p.id, plans))}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {highlights.length > 0 && (
            <ul className="mt-5 space-y-1">
              {highlights.map((h) => (
                <li key={h} className="relative pl-4 text-[13px] text-muted leading-snug before:content-['▸'] before:absolute before:left-0 before:text-accent before:text-[11px]">
                  {h}
                </li>
              ))}
            </ul>
          )}

          {unverified && <EmailVerifyNotice className="mt-4" />}
          {error && !unverified && <p className="mt-3 text-red-600 text-sm">{error}</p>}
          {bought ? (
            <p className="mt-5 p-4 rounded-[14px] bg-green-50 text-green border border-green-200 text-sm">
              Buy request #{bought.id} received. We will confirm landed cost, financing, and warranty attach on quote.
            </p>
          ) : (
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => { add(robot, { variant, warrantyId }); setAdded(true); }}
                className="or-check w-full text-white font-semibold py-3.5 rounded-[12px]"
              >
                {added ? 'Added to cart' : 'Add to cart'}
              </button>
              <button type="button" onClick={buy} disabled={buying} className="or-grad w-full text-white font-semibold py-3 rounded-[12px] disabled:opacity-60">
                {user ? (buying ? 'Submitting…' : 'Buy now') : 'Sign in to buy now'}
              </button>
              <button
                type="button"
                onClick={() => {
                  add(robot, { variant, warrantyId });
                  nav(user ? '/cart' : '/login?next=/cart');
                }}
                className="or-grad w-full text-white font-semibold py-3 rounded-[12px]"
              >
                Request financing
              </button>
              {added && (
                <Link to="/cart" className="block text-center text-sm font-semibold text-accent pt-1">
                  In cart — attach warranty →
                </Link>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-dim">Prices are estimates. Financing is spread + fee. Service and Official Robot protection plans attach on quote.</p>
        </div>
      </div>

      {robot.inspectionNotes && (
        <section className="mt-10 border border-line rounded-[16px] bg-soft p-5">
          <h2 className="font-display font-semibold text-lg mb-2">Inspection notes</h2>
          {cpo && <p className="text-xs font-bold uppercase tracking-wide text-green mb-2">{conditionLabel(robot.condition)}</p>}
          <p className="text-sm text-muted whitespace-pre-wrap">{robot.inspectionNotes}</p>
        </section>
      )}

      <section className="mt-10 rounded-[16px] border border-line bg-white p-6 sm:p-8 shadow-sm">
        <div className="text-[0.72rem] font-display font-semibold uppercase tracking-[0.12em] text-accent mb-2">About this platform</div>
        {robot.specsIntro && (
          <p className="text-[15px] text-ink leading-relaxed pb-4 mb-4 border-b border-line max-w-[72ch]">{robot.specsIntro}</p>
        )}
        {specGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="or-specs-table w-full">
              <tbody>
                {specGroups.map((g) => (
                  <FragmentGroup key={g.name} group={g} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">Detailed specifications confirmed on formal quote.</p>
        )}
      </section>

      <section className="mt-12 max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <h2 className="font-display font-semibold text-xl">Reviews</h2>
          {showAvg && (
            <div className="flex items-center gap-2 text-muted">
              <StarRow value={ratingAvg} />
              <span>{Number(ratingAvg).toFixed(1)} · {ratingCount}</span>
            </div>
          )}
        </div>

        {user ? (
          needsVerification(user) ? (
            <EmailVerifyNotice className="mb-5" />
          ) : ownReview ? null : canReview ? (
            <form onSubmit={submitReview} className="mb-6 border border-line rounded-[16px] bg-white p-4 space-y-3">
              <StarPicker value={rating} onChange={setRating} />
              <label className="block text-sm font-semibold">
                <ReqLabel>Review</ReqLabel>
                <textarea
                  required
                  minLength={3}
                  rows={3}
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  placeholder="How does this platform run in the real world?"
                  className="mt-1 w-full border border-line rounded-[10px] px-3 py-2.5 font-normal"
                />
              </label>
              <label className="block text-[12px] font-semibold text-muted">
                Photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setReviewFiles(Array.from(e.target.files || []).slice(0, 6))}
                  className="mt-1 block w-full text-[12px]"
                />
              </label>
              {reviewError && !editingId && <p className="text-red-600">{reviewError}</p>}
              <button type="submit" disabled={reviewBusy} className="or-check text-white font-semibold px-4 py-2 rounded-[10px] disabled:opacity-60">
                {reviewBusy ? 'Posting…' : 'Post review'}
              </button>
            </form>
          ) : (
            <p className="text-muted mb-5">
              {canReviewReason === 'own_listing'
                ? 'You cannot review your own listing.'
                : 'Only members with a confirmed purchase of this robot can write a review.'}
            </p>
          )
        ) : (
          <p className="text-muted mb-5">
            <Link to={'/login?next=' + encodeURIComponent('/robots/' + id)} className="text-accent font-semibold">Sign in</Link> to leave a review.
          </p>
        )}

        {reviews.length === 0 ? (
          <p className="text-muted">No reviews yet.</p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((rev, i) => {
              const photos = asList(rev.photos);
              const mine = sameUser(rev, user);
              const editing = editingId === rev.id;
              return (
                <li key={rev.id || i} className="border border-line rounded-[16px] bg-white p-4">
                  {editing ? (
                    <form onSubmit={(e) => saveEdit(e, rev.id)} className="space-y-3">
                      <StarPicker value={editRating} onChange={setEditRating} />
                      <textarea
                        required
                        minLength={3}
                        rows={3}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full border border-line rounded-[10px] px-3 py-2.5"
                      />
                      {editPhotos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {editPhotos.map((src) => (
                            <button
                              type="button"
                              key={src}
                              onClick={() => setEditPhotos((p) => p.filter((x) => x !== src))}
                              className="relative w-20 h-20 rounded-[10px] overflow-hidden border border-line bg-elevated"
                              title="Remove photo"
                            >
                              <img src={imageSrc(src)} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setEditFiles(Array.from(e.target.files || []).slice(0, 6))}
                        className="block w-full text-[12px]"
                      />
                      {reviewError && editingId && <p className="text-red-600">{reviewError}</p>}
                      <div className="flex gap-2">
                        <button type="submit" disabled={editBusy} className="or-check text-white font-semibold px-4 py-2 rounded-[10px] disabled:opacity-60">
                          {editBusy ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 font-semibold text-muted">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <StarRow value={rev.rating} />
                        <span className="font-semibold">{rev.userName || rev.name || 'Member'}</span>
                        {rev.createdAt || rev.created_at ? <span className="text-dim">{when(rev.createdAt || rev.created_at)}</span> : null}
                        {mine && (
                          <button type="button" onClick={() => startEdit(rev)} className="ml-auto text-sm font-semibold text-accent">
                            Edit
                          </button>
                        )}
                      </div>
                      {rev.body || rev.text ? <p className="mt-2 whitespace-pre-wrap leading-relaxed">{rev.body || rev.text}</p> : null}
                      {photos.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {photos.map((src) => (
                            <a key={src} href={imageSrc(src)} target="_blank" rel="noreferrer" className="w-20 h-20 rounded-[10px] overflow-hidden border border-line bg-elevated">
                              <img src={imageSrc(src)} alt="" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {related.length > 0 && <RelatedCarousel robots={related} />}
    </div>
  );
}

function FragmentGroup({ group }) {
  return (
    <>
      <tr className="spec-group">
        <th colSpan={2}>{group.name}</th>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.key} className={row.empty ? 'spec-empty' : undefined}>
          <th>{row.key}</th>
          <td>{row.value}</td>
        </tr>
      ))}
    </>
  );
}
