import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AlephMark, { AlephDefs } from '../AlephMark';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { useWatchCompare } from '../WatchCompareContext';

const THEMES = ['cyan-purple', 'yellow-brown', 'magenta-orange', 'yellow-green'];
const THEME_LABELS = {
  'cyan-purple': 'Cyan → Purple',
  'yellow-brown': 'Yellow → Brown',
  'magenta-orange': 'Magenta → Orange',
  'yellow-green': 'Bright Yellow-Green'
};

const TYPE_TABS = [
  { id: 'humanoid', label: 'Humanoid', icon: '🤖' },
  { id: 'hand', label: 'Hands', icon: '🖐️' },
  { id: 'campanionoid', label: 'Campanionoid', icon: '🐕' },
  { id: 'aerial', label: 'Aerial', icon: '🛸' },
  { id: 'water', label: 'Water', icon: '🌊' }
];

function cycleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const i = THEMES.indexOf(cur);
  const next = THEMES[(i + 1) % THEMES.length];
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('or_theme_v1', next); } catch { /* ignore */ }
  return next;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { watchCount, compareCount } = useWatchCompare();
  const loc = useLocation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(() => params.get('q') || '');
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'cyan-purple');
  const markVariant = (
    loc.pathname.startsWith('/sell') ||
    loc.pathname.startsWith('/add') ||
    loc.pathname.startsWith('/cart') ||
    loc.pathname.startsWith('/account') ||
    loc.pathname.startsWith('/kyc') ||
    loc.pathname.startsWith('/mfr') ||
    loc.pathname.startsWith('/robots/') ||
    loc.pathname.startsWith('/admin')
  ) ? 'store' : 'home';

  useEffect(() => {
    setQ(params.get('q') || '');
  }, [params]);

  const activeType = loc.pathname === '/'
    ? (params.get('type') === null
      ? (params.get('q') ? '' : 'humanoid')
      : params.get('type'))
    : params.get('type');

  function submitSearch(e) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    nav({ pathname: '/', search: next.toString() });
    setOpen(false);
  }

  function typeHref(id) {
    const next = new URLSearchParams();
    next.set('type', id);
    if (q.trim()) next.set('q', q.trim());
    return '/?' + next.toString();
  }

  const links = [
    { to: '/sell', label: 'Sell' },
    ...(user ? [{ to: '/listings', label: 'Listings' }] : []),
    ...(user?.accountType === 'manufacturer' || user?.account_type === 'manufacturer' ? [{ to: '/mfr', label: 'My Robots' }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'CRM' }] : []),
    { to: '/account', label: 'Orders' }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <AlephDefs />
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl">
        <div className="border-b border-line">
          <div className="w-full px-4 sm:px-6 h-[60px] flex items-center gap-3 overflow-hidden">
            <Link to="/" className="flex items-center gap-2.5 shrink-0 text-ink no-underline">
              <span
                role="button"
                tabIndex={0}
                className={
                  markVariant === 'store'
                    ? 'logo-mark-store w-[34px] h-[34px] grid place-items-center shrink-0 rounded-[10px] overflow-hidden'
                    : 'logo-mark-home w-9 h-9 grid place-items-center shrink-0 bg-transparent p-0 border-0'
                }
                title={'Theme: ' + THEME_LABELS[theme] + ' — click to change'}
                aria-label="Change color theme"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTheme(cycleTheme()); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setTheme(cycleTheme());
                  }
                }}
              >
                <AlephMark variant={markVariant} className={markVariant === 'store' ? 'w-[22px] h-[22px]' : 'w-7 h-7'} />
              </span>
              <span className="font-display font-bold text-[15px] tracking-tight truncate hidden sm:inline">The Official Robot™</span>
            </Link>

            <form className="nav-search m-0 min-w-[10rem] flex-1" role="search" onSubmit={submitSearch}>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search models, makers, specs…"
                aria-label="Search robots"
              />
              <button type="submit" className="nav-search-btn">Search</button>
            </form>

            <div className="flex items-center gap-1 shrink-0 h-full">
            <nav className="hidden md:flex items-center flex-nowrap gap-0.5 h-full overflow-x-auto overflow-y-hidden whitespace-nowrap">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    'inline-flex items-center h-8 px-2.5 rounded-[10px] text-[13px] font-semibold no-underline whitespace-nowrap ' +
                    (isActive ? 'text-ink bg-elevated' : 'text-muted hover:text-ink hover:bg-elevated')
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <NavLink to="/watchlist" title="Watchlist" className="relative inline-flex items-center h-8 px-2.5 rounded-[10px] text-[13px] font-semibold text-muted no-underline hover:text-ink whitespace-nowrap">
                Watch
                {watchCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-elevated text-ink text-[10px] grid place-items-center">{watchCount}</span>
                )}
              </NavLink>
              {compareCount > 0 && (
                <NavLink to="/compare" className="relative inline-flex items-center h-8 px-2.5 rounded-[10px] text-[13px] font-semibold text-muted no-underline hover:text-ink whitespace-nowrap">
                  Compare
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-elevated text-ink text-[10px] grid place-items-center">{compareCount}</span>
                </NavLink>
              )}
              <NavLink to="/cart" className="relative inline-flex items-center h-8 px-2.5 rounded-[10px] text-[13px] font-semibold text-muted no-underline hover:text-ink whitespace-nowrap">
                Cart
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] grid place-items-center">{count}</span>
                )}
              </NavLink>
              {user ? (
                <button type="button" onClick={logout} className="inline-flex items-center h-8 px-2.5 rounded-[10px] text-[13px] font-semibold text-muted hover:text-ink whitespace-nowrap">
                  Sign out
                </button>
              ) : (
                <>
                  <NavLink to="/login" className="inline-flex items-center h-8 px-2.5 rounded-[10px] text-[13px] font-semibold text-muted no-underline hover:text-ink whitespace-nowrap">
                    Sign in
                  </NavLink>
                  <NavLink to="/register" className="or-grad inline-flex items-center h-8 text-white text-[13px] font-semibold px-3 rounded-[10px] no-underline shadow-or whitespace-nowrap">
                    Create account
                  </NavLink>
                </>
              )}
            </nav>

            <button
              type="button"
              className="md:hidden w-[42px] h-[42px] rounded-[10px] border border-line bg-white grid place-items-center shrink-0"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="flex flex-col gap-1">
                <span className="block w-[18px] h-0.5 bg-ink" />
                <span className="block w-[18px] h-0.5 bg-ink" />
                <span className="block w-[18px] h-0.5 bg-ink" />
              </span>
            </button>
            </div>
          </div>
          {open && (
            <div className="md:hidden border-t border-line bg-white px-4 py-3 flex flex-col gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="px-3 py-3 rounded-[10px] font-semibold text-ink no-underline">
                  {l.label}
                </NavLink>
              ))}
              <NavLink to="/watchlist" onClick={() => setOpen(false)} className="px-3 py-3 rounded-[10px] font-semibold text-ink no-underline">
                Watchlist{watchCount > 0 ? ` (${watchCount})` : ''}
              </NavLink>
              {compareCount > 0 && (
                <NavLink to="/compare" onClick={() => setOpen(false)} className="px-3 py-3 rounded-[10px] font-semibold text-ink no-underline">
                  Compare ({compareCount})
                </NavLink>
              )}
              <NavLink to="/cart" onClick={() => setOpen(false)} className="px-3 py-3 rounded-[10px] font-semibold text-ink no-underline">
                Cart{count > 0 ? ` (${count})` : ''}
              </NavLink>
              {user ? (
                <button type="button" onClick={() => { logout(); setOpen(false); }} className="text-left px-3 py-3 font-semibold">
                  Sign out
                </button>
              ) : (
                <>
                  <NavLink to="/login" onClick={() => setOpen(false)} className="px-3 py-3 font-semibold no-underline text-ink">Sign in</NavLink>
                  <NavLink to="/register" onClick={() => setOpen(false)} className="or-grad text-white text-center font-semibold px-3 py-3 rounded-[10px] no-underline">
                    Create account
                  </NavLink>
                </>
              )}
            </div>
          )}
        </div>

        <div className="sub-nav-bar">
          <div className="sub-nav-inner px-4 sm:px-6">
            <div className="sub-nav-label">Type</div>
            {TYPE_TABS.map((t) => (
              <Link
                key={t.id}
                to={typeHref(t.id)}
                className={'sub-nav-item' + (activeType === t.id ? ' selected' : '')}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-gradient-to-b from-white to-soft mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid gap-10 md:grid-cols-4 mb-10">
            <div className="md:col-span-1">
              <div className="font-display font-bold mb-3">The Official Robot™</div>
              <p className="text-[13px] text-muted max-w-xs leading-relaxed">
                Global marketplace for humanoid, quadruped, aerial, and marine robots — new, pre-owned, and listed by exact model. Huntington Beach, California.
              </p>
              <a className="inline-block mt-3 text-sm font-semibold text-accent no-underline" href="mailto:hello@theofficialrobot.com">hello@theofficialrobot.com</a>
            </div>
            <div>
              <h5 className="font-display text-[0.72rem] uppercase tracking-[0.14em] mb-4">Marketplace</h5>
              <ul className="space-y-2 text-[13px] text-muted">
                <li><Link className="hover:text-accent no-underline text-muted" to="/">Catalog</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/add">Sell a robot</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/watchlist">Watchlist</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/compare">Compare</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/cart">Cart</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/listings">Listings</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/account">Orders</Link></li>
                {(user?.accountType === 'manufacturer' || user?.account_type === 'manufacturer') && (
                  <li><Link className="hover:text-accent no-underline text-muted" to="/mfr">My Robots</Link></li>
                )}
                {user?.role === 'admin' && (
                  <li><Link className="hover:text-accent no-underline text-muted" to="/admin">CRM</Link></li>
                )}
              </ul>
            </div>
            <div>
              <h5 className="font-display text-[0.72rem] uppercase tracking-[0.14em] mb-4">Services</h5>
              <ul className="space-y-2 text-[13px] text-muted">
                <li><Link className="hover:text-accent no-underline text-muted" to="/financing">Financing</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/service">Service &amp; repair</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/warranty">Warranty</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/news">News</Link></li>
                <li><Link className="hover:text-accent no-underline text-muted" to="/partners">Partners</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-display text-[0.72rem] uppercase tracking-[0.14em] mb-4">Company</h5>
              <ul className="space-y-2 text-[13px] text-muted">
                <li>Huntington Beach, California</li>
                <li>Authorized distribution</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-5 border-t border-line text-xs text-dim">
            <span>© 2026 The Official Robot™. All rights reserved.</span>
            <span>Largest used-robot market in the making.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
