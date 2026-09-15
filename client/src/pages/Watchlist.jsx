import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRobotsByIds } from '../api';
import { useWatchCompare } from '../WatchCompareContext';
import RobotCard from '../components/RobotCard';

export default function Watchlist() {
  const { watch, compareCount } = useWatchCompare();
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!watch.length) {
      setRobots([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    fetchRobotsByIds(watch)
      .then((list) => { if (!cancelled) setRobots(list); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [watch]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">Watchlist</h1>
          <p className="text-muted text-sm mt-1">Saved locally on this device.</p>
        </div>
        {compareCount > 0 && (
          <Link to="/compare" className="text-sm font-semibold text-accent">Compare ({compareCount}) →</Link>
        )}
      </div>
      {loading && <p className="text-muted mt-8">Loading saved listings…</p>}
      {!loading && robots.length === 0 && (
        <p className="text-muted mt-8">
          No saved listings yet. <Link to="/" className="text-accent">Browse the catalog</Link>
        </p>
      )}
      {robots.length > 0 && (
        <div className="mt-8 grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
          {robots.map((r, i) => <RobotCard key={r.id} robot={r} index={i} />)}
        </div>
      )}
    </div>
  );
}
