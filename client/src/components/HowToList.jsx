import { useState } from 'react';

const STEPS = [
  { n: 1, title: 'Create an account and complete verification' },
  { n: 2, title: 'Choose a catalog SKU or add a unique platform, then upload photos' },
  { n: 3, title: 'Set condition and price, then publish' }
];

function StepPhoto({ n }) {
  const [srcI, setSrcI] = useState(0);
  const jpgs = ['/imagine_images/how-to-' + n + '.jpg', '/how-to-' + n + '.jpg'];
  if (srcI >= jpgs.length) {
    return (
      <div className="absolute inset-0 grid place-items-center or-check">
        <span className="font-display font-bold text-white/90 text-2xl">{n}</span>
      </div>
    );
  }
  return (
    <picture>
      {srcI === 0 && <source srcSet={'/imagine_images/how-to-' + n + '.webp'} type="image/webp" />}
      <img
        src={jpgs[srcI]}
        alt=""
        width={640}
        height={360}
        loading="lazy"
        decoding="async"
        onError={() => setSrcI((i) => i + 1)}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </picture>
  );
}

export default function HowToList({ compact = false, className = '' }) {
  return (
    <section className={className}>
      <h2 className={compact
        ? 'font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-dim mb-2'
        : 'font-display font-semibold text-sm tracking-tight text-ink mb-3'}
      >
        How to list
      </h2>
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {STEPS.map((s) => (
          <li key={s.n} className="border border-line rounded-[12px] bg-white overflow-hidden shadow-sm">
            <div className={'relative bg-elevated overflow-hidden ' + (compact ? 'h-14 sm:h-[4.5rem]' : 'h-24 sm:h-32')}>
              <StepPhoto n={s.n} />
              <span className="absolute top-1.5 left-1.5 z-[1] min-w-[1.25rem] h-5 px-1 rounded-full or-check text-[10px] font-bold grid place-items-center">
                {s.n}
              </span>
            </div>
            <p className={'px-2 py-2 leading-snug text-muted ' + (compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs')}>
              {s.title}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
