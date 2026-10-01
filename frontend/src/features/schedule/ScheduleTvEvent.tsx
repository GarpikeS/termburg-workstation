import { MapPin } from 'lucide-react';
import { isClosedScheduleItem } from './scheduleTime';
import type { ScheduleItem } from './types';

// The TV uses its own row layout: editor/print styles must not change its geometry.
export function ScheduleTvEvent({
  item,
  highlighted,
  accessibilityLabel,
}: {
  item: ScheduleItem;
  highlighted?: boolean;
  accessibilityLabel?: string;
}) {
  const closed = isClosedScheduleItem(item);
  return (
    <article
      className={`schedule-tv-event${highlighted ? ' schedule-tv-event--highlighted' : ''}`}
      aria-label={accessibilityLabel}
    >
      <div className={`schedule-tv-event__time${closed ? ' schedule-tv-event__time--closed' : ''}`}>
        <strong>{closed ? 'Закрыто' : item.time}</strong>
        {!closed && item.endTime && <span>до {item.endTime}</span>}
      </div>
      <div className="schedule-tv-event__body">
        <h3 title={item.title}>{item.title}</h3>
        <div className="schedule-tv-event__meta">
          <p className="schedule-tv-event__venue" title={item.venue}>
            {item.venue && <MapPin aria-hidden="true" />}
            <span>{item.venue}</span>
          </p>
          {!closed && (
            <span className={`schedule-tv-event__price schedule-tv-event__price--${item.priceKind}`}>
              {item.priceKind === 'free' ? 'Бесплатно' : item.price ? `+${item.price} ₽` : 'Платно'}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
