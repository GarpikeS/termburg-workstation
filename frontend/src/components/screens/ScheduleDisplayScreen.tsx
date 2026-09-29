import { useParams } from 'react-router-dom';
import '@/features/schedule/schedule.css';
import { CalendarDays, MapPin, Wifi, WifiOff } from 'lucide-react';
import { ScheduleError, ScheduleEventRow, ScheduleLoading, TermburgScheduleMark } from '@/features/schedule/SchedulePrimitives';
import { useSchedule } from '@/features/schedule/useSchedule';
import { useNow } from '@/features/schedule/useNow';
import {
  formatScheduleDate,
  getEventsForDate,
  getHighlightedItem,
  getRemainingScheduleItems,
  getZonedClock,
} from '@/features/schedule/scheduleTime';

const DISPLAY_EVENT_LIMIT = 9;

export function ScheduleDisplayScreen() {
  const { locationId = '1', layout } = useParams();
  const displayLayout = layout === 'portrait' || layout === 'landscape' ? layout : 'auto';
  const { data, source, error } = useSchedule(5000);
  const now = useNow();
  const location = data?.locations.find(item => item.id === locationId) ?? data?.locations[0];
  const clock = location ? getZonedClock(now, location.timezone) : null;
  const items = data && location && clock ? getEventsForDate(data, location.id, clock.dateKey) : [];
  const remainingItems = clock ? getRemainingScheduleItems(items, clock.minutes) : items;
  const highlighted = clock ? getHighlightedItem(remainingItems, clock.minutes) : null;
  const highlightedTime = highlighted?.item?.time ?? null;
  const visibleItems = remainingItems.slice(0, DISPLAY_EVENT_LIMIT);
  const dayIsFinished = items.length > 0 && remainingItems.length === 0;

  if (error && !data) return <ScheduleError message={error} />;
  if (!data || !location || !clock) return <ScheduleLoading />;

  return (
    <div className="schedule-display-stage">
      <div className={`schedule-display-frame schedule-display-frame--${displayLayout}`}>
        <div className="schedule-display">
          <header className="schedule-display__header">
        <div className="schedule-display__brand">
          <div className="schedule-display__brand-stack">
            <TermburgScheduleMark />
            <div className="schedule-display__brand-clock">
              <strong aria-label={`${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`}>
                <span>{String(clock.hour).padStart(2, '0')}</span><i>:</i><span>{String(clock.minute).padStart(2, '0')}</span>
              </strong>
              <span>{location.shortName}</span>
            </div>
          </div>
          <span className={`schedule-display__sync ${source === 'server' || source === 'official' ? 'is-online' : 'is-offline'}`}>
            {source === 'server' || source === 'official' ? <Wifi size={20} /> : <WifiOff size={20} />}
            {source === 'server' || source === 'official' ? 'Онлайн' : 'Нет связи'}
          </span>
        </div>
        <div className="schedule-display__title">
          <div>
            <span>Сегодня в Термбурге</span>
            <h1>Расписание<br className="schedule-display__title-break" /> мероприятий</h1>
            <p><MapPin size={20} />{location.city}</p>
          </div>
        </div>
          </header>

          <main className="schedule-display__main">
        <div className="schedule-display__date-line">
          <div><CalendarDays size={26} /><span>{formatScheduleDate(clock.dateKey)}</span></div>
          <span>{visibleItems.length === remainingItems.length ? `${remainingItems.length} событий` : `Ближайшие ${visibleItems.length}`}</span>
        </div>
        <div className="schedule-display__events">
          {visibleItems.length > 0 ? visibleItems.map(item => (
            <ScheduleEventRow
              key={`${item.id}-${item.occurrenceDate}`}
              item={item}
              highlighted={highlightedTime === item.time}
              accessibilityLabel={highlightedTime === item.time ? `${highlighted?.status === 'now' ? 'Сейчас идёт' : 'Следующее событие'}: ${item.time}, ${item.title}, ${item.venue}` : undefined}
              compact
            />
          )) : (
            <div className="schedule-display__empty">
              <CalendarDays size={44} />
              <h2>{dayIsFinished ? 'Все мероприятия на сегодня завершились' : 'На сегодня событий нет'}</h2>
              <p>{dayIsFinished ? 'Будем ждать вас завтра.' : 'Отдыхайте и набирайтесь сил.'}</p>
            </div>
          )}
        </div>
          </main>
        </div>
      </div>
    </div>
  );
}
