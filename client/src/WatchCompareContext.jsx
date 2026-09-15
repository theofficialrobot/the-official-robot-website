import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const WATCH_KEY = 'or_watch_v1';
const COMPARE_KEY = 'or_compare_v1';
const COMPARE_MAX = 3;
const WatchCompareContext = createContext(null);

function loadIds(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map(String).filter(Boolean))];
  } catch {
    return [];
  }
}

export function WatchCompareProvider({ children }) {
  const [watch, setWatch] = useState(() => loadIds(WATCH_KEY));
  const [compare, setCompare] = useState(() => loadIds(COMPARE_KEY).slice(0, COMPARE_MAX));

  useEffect(() => {
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(watch)); } catch { /* ignore */ }
  }, [watch]);

  useEffect(() => {
    try { localStorage.setItem(COMPARE_KEY, JSON.stringify(compare)); } catch { /* ignore */ }
  }, [compare]);

  const value = useMemo(() => ({
    watch,
    compare,
    watchCount: watch.length,
    compareCount: compare.length,
    isWatched(id) { return watch.includes(String(id)); },
    isCompared(id) { return compare.includes(String(id)); },
    toggleWatch(id) {
      const sid = String(id || '');
      if (!sid) return;
      setWatch((prev) => prev.includes(sid) ? prev.filter((x) => x !== sid) : prev.concat([sid]));
    },
    toggleCompare(id) {
      const sid = String(id || '');
      if (!sid) return;
      setCompare((prev) => {
        if (prev.includes(sid)) return prev.filter((x) => x !== sid);
        if (prev.length >= COMPARE_MAX) return prev;
        return prev.concat([sid]);
      });
    },
    removeWatch(id) { setWatch((prev) => prev.filter((x) => x !== String(id))); },
    removeCompare(id) { setCompare((prev) => prev.filter((x) => x !== String(id))); },
    clearWatch() { setWatch([]); },
    clearCompare() { setCompare([]); }
  }), [watch, compare]);

  return <WatchCompareContext.Provider value={value}>{children}</WatchCompareContext.Provider>;
}

export function useWatchCompare() {
  const ctx = useContext(WatchCompareContext);
  if (!ctx) throw new Error('useWatchCompare outside provider');
  return ctx;
}
