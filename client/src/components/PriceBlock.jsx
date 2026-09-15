import { money, priceInfo } from '../api';

export default function PriceBlock({ robot, size = 'card' }) {
  const { sale, list, discount, hasDiscount } = priceInfo(robot);
  const compact = size === 'card';
  if (hasDiscount) {
    return (
      <div className={compact ? 'leading-tight' : 'leading-snug'}>
        <div className={'flex items-baseline gap-1.5 flex-wrap ' + (compact ? '' : 'gap-2')}>
          <span className={'font-bold text-red-600 ' + (compact ? 'text-[12px]' : 'text-2xl font-display')}>
            -{discount}%
          </span>
          <span className={'font-bold text-red-600 ' + (compact ? 'text-[13px] font-display' : 'text-3xl font-display')}>
            {money(sale)}
          </span>
        </div>
        <div className={'text-dim ' + (compact ? 'text-[9px] mt-0.5' : 'text-sm mt-1')}>
          List Price: <s>{money(list)}</s>
        </div>
      </div>
    );
  }
  return (
    <div className={compact ? 'leading-tight' : 'leading-snug'}>
      <div className={'text-dim ' + (compact ? 'text-[9px]' : 'text-sm')}>Listing price</div>
      <div className={'font-display font-bold text-accent ' + (compact ? 'text-[12px]' : 'text-3xl')}>
        {money(sale)}
      </div>
    </div>
  );
}
