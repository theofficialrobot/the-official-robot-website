import { useWatchCompare } from '../WatchCompareContext';

export default function WatchCompareButtons({ id, className = '' }) {
  const { isWatched, isCompared, toggleWatch, toggleCompare, compareCount } = useWatchCompare();
  const watched = isWatched(id);
  const compared = isCompared(id);
  const compareLocked = !compared && compareCount >= 3;

  return (
    <div className={'flex flex-wrap gap-2 ' + className}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatch(id); }}
        className={
          'text-[11px] font-semibold px-2.5 py-1 rounded-md border ' +
          (watched ? 'bg-accent text-white border-accent' : 'bg-white text-accent border-accent hover:bg-[var(--accent-dim)]')
        }
      >
        {watched ? 'Watching' : 'Watch'}
      </button>
      <button
        type="button"
        disabled={compareLocked}
        title={compareLocked ? 'Compare up to 3 listings' : 'Add to compare'}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(id); }}
        className={
          'text-[11px] font-semibold px-2.5 py-1 rounded-md border disabled:opacity-40 ' +
          (compared ? 'bg-purple text-white border-purple' : 'bg-white text-purple border-purple hover:bg-[rgba(var(--purple-rgb),0.08)]')
        }
      >
        {compared ? 'Compared' : 'Compare'}
      </button>
    </div>
  );
}
