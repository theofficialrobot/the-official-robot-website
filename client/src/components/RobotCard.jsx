import { Link } from 'react-router-dom';
import { conditionLabel, imageSrc, itemConditionLabel } from '../api';
import PriceBlock from './PriceBlock';
import Stars from './Stars';
import WatchCompareButtons from './WatchCompareButtons';

export default function RobotCard({ robot, index = 0 }) {
  const checkered = index % 2 === 1;
  const cpo = robot.condition === 'cpo';
  return (
    <article className="group rounded-[10px] border border-line overflow-hidden bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-or transition flex flex-col min-w-0">
      <Link
        to={'/robots/' + encodeURIComponent(robot.id)}
        className="block no-underline text-ink flex-1 min-w-0"
      >
        <div
          className={'relative h-28 sm:h-32 grid place-items-center overflow-hidden ' + (checkered ? 'or-check' : 'bg-white')}
        >
          {robot.image ? (
            <img
              src={imageSrc(robot.image)}
              alt=""
              width={220}
              height={128}
              loading="lazy"
              decoding="async"
              className="relative z-[1] max-h-full max-w-full object-contain p-2 drop-shadow-md"
            />
          ) : (
            <span className="text-2xl">{robot.icon || '🤖'}</span>
          )}
          <span
            className={
              'absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full z-[1] ' +
              (cpo ? 'bg-green text-white shadow' : 'bg-white/90 text-ink')
            }
          >
            {conditionLabel(robot.condition)}
            {(robot.condition === 'used' || robot.condition === 'like_new') && itemConditionLabel(robot.itemCondition || robot.item_condition)
              ? ' · ' + itemConditionLabel(robot.itemCondition || robot.item_condition)
              : ''}
          </span>
        </div>
        <div className="p-2 pb-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-dim truncate">{robot.maker || robot.type}</div>
          <h3 className="font-display font-semibold text-[11px] leading-snug mt-0.5 line-clamp-2 min-h-[2rem]">{robot.name}</h3>
          <Stars
            value={robot.ratingAvg ?? robot.rating_avg}
            count={Number(robot.ratingCount ?? robot.rating_count) || 0}
            className="mt-0.5"
            size="text-[10px]"
          />
          <div className="mt-1">
            <PriceBlock robot={robot} />
          </div>
        </div>
      </Link>
      <WatchCompareButtons id={robot.id} className="px-2 pb-2" />
    </article>
  );
}
