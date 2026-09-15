export default function Stars({ value = 0, count = null, className = '', size = 'text-[11px]' }) {
  const numeric = Number(value) || 0;
  const rounded = Math.round(numeric);
  return (
    <span className={'inline-flex items-center gap-1 min-w-0 ' + className} aria-label={numeric.toFixed(1) + ' stars' + (count != null ? ', ' + count + ' ratings' : '')}>
      <span className={'inline-flex tracking-tight leading-none ' + size}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= rounded ? 'text-accent' : 'text-dim'}>★</span>
        ))}
      </span>
      {count != null && (
        <span className="text-dim tabular-nums truncate">
          {count ? numeric.toFixed(1) + ' ' : ''}({count})
        </span>
      )}
    </span>
  );
}
