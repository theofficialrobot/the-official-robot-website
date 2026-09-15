import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import RobotCard from '../components/RobotCard';

export default function Listings() {
  const { user, ready } = useAuth();
  const [robots, setRobots] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isMfr = (user?.accountType || user?.account_type) === 'manufacturer';

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const path = isMfr ? '/api/mfr/robots' : '/api/robots?mine=1';
    api(path, { auth: true })
      .then((d) => setRobots(d.robots || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, isMfr]);

  if (ready && !user) return <Navigate to="/login?next=/listings" replace />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">Listings</h1>
          <p className="text-muted mt-1 text-[13px]">
            {isMfr
              ? (user?.companyName ? user.companyName + ' · ' : '') + 'All robots for your brand, including catalog platforms.'
              : 'Robots you have listed for sale.'}
          </p>
        </div>
        <Link to="/add" className="or-check text-white text-sm font-semibold px-4 py-2 rounded-[10px] no-underline">
          List a robot
        </Link>
      </div>
      {error && <p className="text-red-600 mt-4">{error}</p>}
      {loading && <p className="mt-8 text-muted">Loading listings…</p>}
      {!loading && robots.length === 0 && (
        <p className="mt-8 text-muted text-sm">No listings yet. <Link to="/add" className="text-accent">Add a listing</Link>.</p>
      )}
      {!loading && robots.length > 0 && (
        <div className="mt-8 grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
          {robots.map((r, i) => <RobotCard key={r.id} robot={r} index={i} />)}
        </div>
      )}
    </div>
  );
}
