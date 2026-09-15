import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, TYPES, CONDITIONS } from '../api';
import RobotCard from '../components/RobotCard';

function typeFromSearch(params) {
  const t = params.get('type');
  if (t === null) return params.get('q') ? '' : 'humanoid';
  if (TYPES.some((x) => x.id === t)) return t;
  return 'humanoid';
}

export default function Home() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [type, setType] = useState(() => typeFromSearch(params));
  const [condition, setCondition] = useState('');
  const [robots, setRobots] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debounced, setDebounced] = useState(q);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setOffset(0); }, [debounced, type, condition]);

  useEffect(() => {
    const next = typeFromSearch(params);
    setType((cur) => (cur === next ? cur : next));
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (debounced) params.set('q', debounced);
    if (type) params.set('type', type);
    if (condition) params.set('condition', condition);
    params.set('limit', '48');
    params.set('offset', String(offset));
    api('/api/robots?' + params.toString())
      .then((d) => {
        if (cancelled) return;
        setRobots((prev) => offset === 0 ? d.robots : prev.concat(d.robots));
        setCount(d.count);
        setError('');
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, type, condition, offset]);

  const subtitle = useMemo(() => {
    if (loading) return 'Loading catalog…';
    return count.toLocaleString() + ' listings · new and used · listed by exact model';
  }, [loading, count]);

  return (
    <div>
      <section className="mx-10 sm:mx-16 lg:mx-24 xl:mx-32 pt-10 pb-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent bg-[var(--accent-dim)] border border-[rgba(var(--accent-rgb),0.18)] rounded-full px-3 py-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-bright" /> Huntington Beach · Global catalog
        </p>
        <h1 className="font-display font-bold text-3xl tracking-tight leading-tight">
          The official market for the <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(120deg, var(--accent), var(--purple), var(--accent-bright))' }}>robot age</span>
        </h1>
        <p className="mt-3 text-muted text-sm">
          Buy and sell humanoid, quadruped, aerial, and marine platforms — new, like new, certified pre-owned, and used. Liquidity by exact SKU, not generic “robot dog” listings.
        </p>
        {type === 'hand' && (
          <p className="mt-3 text-xs text-dim">Hands are parts and accessories, listed by SKU.</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCondition(c.id)}
              className={'px-3 py-1.5 rounded-full text-xs font-semibold border ' + (condition === c.id ? 'bg-accent text-white border-accent' : 'bg-white text-muted border-line')}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-dim">{subtitle}</p>
      </section>

      <section className="px-4 sm:px-6 pb-16">
        {error && <p className="text-red-600 mb-4">{error}</p>}
        {loading && <p className="text-muted">Loading platforms…</p>}
        {!loading && robots.length === 0 && (
          <p className="text-muted">No listings match that search. Try a maker name or a spec keyword.</p>
        )}
        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
          {robots.map((r, i) => <RobotCard key={r.id} robot={r} index={i} />)}
        </div>
        {robots.length < count && (
          <div className="mt-8 text-center">
            <button type="button" onClick={() => setOffset(robots.length)} className="border border-line rounded-[12px] px-5 py-2.5 font-semibold bg-white hover:border-accent">
              Load more ({robots.length} of {count})
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
