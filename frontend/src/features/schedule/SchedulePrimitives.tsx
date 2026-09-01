import { CalendarX2, Clock3, MapPin, TicketCheck } from 'lucide-react';
import type { ScheduleItem } from './types';
import { isClosedScheduleItem } from './scheduleTime';

export function TermburgScheduleMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`schedule-mark ${compact ? 'schedule-mark--compact' : ''}`} aria-label="Термбург">
      <img
        className="schedule-mark__logo"
        src="/images/brand/termburg-logo.svg"
        alt="Термбург — термальный комплекс"
      />
    </div>
  );
}

export function ScheduleWaves({ className = '' }: { className?: string }) {
  return (
    <svg className={`schedule-waves ${className}`} viewBox="0 0 240 42" fill="none" aria-hidden="true">
      <path d="M0 8c12-10 24-10 36 0s24 10 36 0 24-10 36 0 24 10 36 0 24-10 36 0 24 10 36 0 24-10 36 0" />
      <path d="M0 25c12-10 24-10 36 0s24 10 36 0 24-10 36 0 24 10 36 0 24-10 36 0 24 10 36 0 24-10 36 0" />
    </svg>
  );
}

export function PriceBadge({ item, compact = false }: { item: ScheduleItem; compact?: boolean }) {
  if (item.priceKind === 'free') {
    return (
      <span className={`schedule-price schedule-price--free ${compact ? 'schedule-price--compact' : ''}`}>
        Бесплатно
      </span>
    );
  }
  return (
    <span className={`schedule-price schedule-price--paid ${compact ? 'schedule-price--compact' : ''}`}>
      <TicketCheck size={compact ? 11 : 13} aria-hidden="true" />
      {item.price ? `+${item.price} ₽` : 'Платно'}
    </span>
  );
}

export function ScheduleEventRow({
  item,
  highlighted,
  status,
  accessibilityLabel,
  compact = false,
}: {
  item: ScheduleItem;
  highlighted?: boolean;
  status?: 'now' | 'next' | null;
  accessibilityLabel?: string;
  compact?: boolean;
}) {
  const closed = isClosedScheduleItem(item);
  return (
    <article
      className={`schedule-event ${highlighted ? 'schedule-event--highlighted' : ''} ${closed ? 'schedule-event--closed' : ''} ${compact ? 'schedule-event--compact' : ''}`}
      aria-label={accessibilityLabel}
    >
      <div className="schedule-event__time">
        {closed ? <CalendarX2 size={compact ? 16 : 19} aria-hidden="true" /> : <Clock3 size={compact ? 13 : 15} aria-hidden="true" />}
        <strong>{closed ? 'Закрыто' : item.time}</strong>
        {!closed && item.endTime && <span>— {item.endTime}</span>}
      </div>
      <div className="schedule-event__body">
        {highlighted && status && (
          <span className="schedule-event__status">
            <span aria-hidden="true" />
            {status === 'now' ? 'Сейчас идёт' : 'Ближайшее'}
          </span>
        )}
        <h3>{item.title}</h3>
        {item.venue && <p className="schedule-event__venue"><MapPin size={compact ? 12 : 14} aria-hidden="true" />{item.venue}</p>}
        {!compact && item.details && <p className="schedule-event__details">{item.details}</p>}
        {!closed && <PriceBadge item={item} compact={compact} />}
      </div>
    </article>
  );
}

export function ScheduleLoading() {
  return (
    <div className="schedule-state" role="status">
      <span className="schedule-spinner" aria-hidden="true" />
      <h2>Загружаем расписание</h2>
      <p>Обновляем данные комплекса.</p>
    </div>
  );
}

export function ScheduleError({ message }: { message: string }) {
  return (
    <div className="schedule-state schedule-state--error" role="alert">
      <h2>Расписание не загрузилось</h2>
      <p>{message}</p>
    </div>
  );
}
