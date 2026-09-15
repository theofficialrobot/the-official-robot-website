import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { conditionLabel, fetchRobotsByIds, imageSrc, itemConditionLabel, money, typeLabel } from '../api';
import Stars from '../components/Stars';
import { useWatchCompare } from '../WatchCompareContext';

const PREFERRED_SPECS = [
  'Height', 'Standing Height', 'Standing Envelope', 'Size',
  'Weight', 'Operating Weight',
  'Degrees of Freedom', 'DOF',
  'Payload', 'Payload Capacity',
  'Max Speed', 'Speed',
  'Battery / Runtime', 'Battery', 'Runtime',
  'Fingers', 'Depth Rating', 'Flight Time'
];

function specValue(robot, key) {
  const specs = robot.specs || {};
  const found = Object.keys(specs).find((k) => k.toLowerCase() === key.toLowerCase());
  return found ? String(specs[found]) : '';
}

function specRows(robots) {
  const rows = [];
  const used = new Set();
  for (const key of PREFERRED_SPECS) {
    const values = robots.map((r) => specValue(r, key));
    if (values.some(Boolean)) {
      rows.push({ key, values });
      used.add(key.toLowerCase());
    }
  }
  const extras = [];
  robots.forEach((r) => {
    Object.keys(r.specs || {}).forEach((k) => {
      if (!used.has(k.toLowerCase()) && !extras.some((e) => e.toLowerCase() === k.toLowerCase())) {
        extras.push(k);
      }
    });
  });
  extras.slice(0, 10).forEach((key) => {
    rows.push({ key, values: robots.map((r) => specValue(r, key)) });
  });
  return rows;
}

export default function Compare() {
  const { compare, toggleCompare, clearCompare } = useWatchCompare();
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!compare.length) {
      setRobots([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    fetchRobotsByIds(compare)
      .then((list) => { if (!cancelled) setRobots(list); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [compare]);

  const rows = useMemo(() => specRows(robots), [robots]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">Compare</h1>
          <p className="text-muted text-sm mt-1">Up to 3 listings, side by side.</p>
        </div>
        {robots.length > 0 && (
          <button type="button" onClick={clearCompare} className="text-sm font-semibold text-muted hover:text-ink">
            Clear compare
          </button>
        )}
      </div>

      {loading && <p className="text-muted mt-8">Loading comparison…</p>}
      {!loading && robots.length === 0 && (
        <p className="text-muted mt-8">
          Select up to 3 listings to compare. <Link to="/" className="text-accent">Browse the catalog</Link>
        </p>
      )}

      {robots.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <div className="min-w-[640px] grid gap-px bg-line border border-line rounded-or overflow-hidden" style={{ gridTemplateColumns: `9rem repeat(${robots.length}, minmax(0, 1fr))` }}>
            <div className="bg-accent-deep text-white p-3 text-xs font-semibold uppercase tracking-wide">Listing</div>
            {robots.map((r, i) => (
              <div key={r.id} className={(i % 2 === 0 ? 'bg-white text-ink' : 'bg-accent-deep text-white') + ' p-3'}>
                <Link to={'/robots/' + encodeURIComponent(r.id)} className={'block no-underline ' + (i % 2 === 0 ? 'text-ink' : 'text-white')}>
                  <div className={'h-28 rounded-[10px] grid place-items-center overflow-hidden ' + (i % 2 === 0 ? 'bg-elevated' : 'bg-black/20')}>
                    {r.image ? (
                      <img
                        src={imageSrc(r.image)}
                        alt=""
                        width={224}
                        height={112}
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    ) : null}
                  </div>
                  <div className="font-display font-semibold mt-2 leading-snug">{r.name}</div>
                  <Stars
                    value={r.ratingAvg ?? r.rating_avg}
                    count={Number(r.ratingCount ?? r.rating_count) || 0}
                    className={'mt-1 ' + (i % 2 === 0 ? '' : '[&_.text-dim]:text-white/70')}
                    size="text-[12px]"
                  />
                </Link>
                <button type="button" onClick={() => toggleCompare(r.id)} className={'mt-2 text-xs ' + (i % 2 === 0 ? 'text-muted hover:text-ink' : 'text-white/80 hover:text-white')}>
                  Remove
                </button>
              </div>
            ))}

            <Row
              label="Price"
              values={robots.map((r) => {
                const list = r.listPrice != null ? r.listPrice : r.price;
                const pct = Number(r.discountPct) || 0;
                if (pct > 0 && list > r.price) return '-' + pct + '% ' + money(r.price);
                return money(r.price);
              })}
              bold
            />
            <Row
              label="Condition"
              values={robots.map((r) => {
                const base = conditionLabel(r.condition);
                const item = (r.condition === 'used' || r.condition === 'like_new')
                  ? itemConditionLabel(r.itemCondition || r.item_condition)
                  : '';
                return item ? base + ' · ' + item : base;
              })}
            />
            <Row label="Type" values={robots.map((r) => typeLabel(r.type) || r.type)} />
            <Row label="Maker" values={robots.map((r) => r.maker || '—')} />
            {robots.some((r) => r.year) && (
              <Row label="Year" values={robots.map((r) => r.year || '—')} />
            )}
            {rows.map((row) => (
              <Row key={row.key} label={row.key} values={row.values.map((v) => v || '—')} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, values, bold }) {
  return (
    <>
      <div className="bg-accent-deep text-white p-3 text-sm font-medium">{label}</div>
      {values.map((v, i) => (
        <div
          key={label + i}
          className={
            (i % 2 === 0 ? 'bg-white text-ink' : 'bg-accent-deep text-white') +
            ' p-3 text-sm ' +
            (bold ? 'font-display font-bold' : '')
          }
        >
          {v}
        </div>
      ))}
    </>
  );
}
