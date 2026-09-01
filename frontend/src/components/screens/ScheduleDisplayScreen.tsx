import { useParams } from 'react-router-dom';
import '@/features/schedule/schedule.css';
import { CalendarDays, MapPin, Wifi, WifiOff } from 'lucide-react';
import { ScheduleError, ScheduleEventRow, ScheduleLoading, TermburgScheduleMark } from '@/features/schedule/SchedulePrimitives';
import { useSchedule } from '@/features/schedule/useSchedule';
import { useNow } from '@/features/schedule/useNow';
import { formatScheduleDate, getEventsForDate, getZonedClock, timeToMinutes } from '@/features/schedule/scheduleTime';

export function ScheduleDisplayScreen() {
  const { locationId = '1', layout } = useParams();
  const displayLayout = layout === 'portrait' || layout === 'landscape' ? layout : 'auto';
  const { data, source, error } = useSchedule(5000);
  const now = useNow();
  const location = data?.locations.find(item => item.id === locationId) ?? data?.locations[0];
  const clock = location ? getZonedClock(now, location.timezone) : null;
  const items = data && location && clock ? getEventsForDate(data, location.id, clock.dateKey) : [];
  const nextTime = clock ? items.find(item => timeToMinutes(item.time) >= clock.minutes)?.time ?? null : null;
  const visibleItems = (() => {
    if (items.length <= 9) return items;
    const index = nextTime ? items.findIndex(item => item.time === nextTime) : -1;
    let start = index >= 0 ? Math.min(Math.max(index - 1, 0), items.length - 9) : Math.max(items.length - 9, 0);
    let end = Math.min(start + 9, items.length);

    // Keep simultaneous events together even when they cross the nine-row window.
    while (start > 0 && items[start - 1].time === items[start].time) start -= 1;
    while (end < items.length && items[end].time === items[end - 1].time) end += 1;

    return items.slice(start, end);
  })();

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
          <span>{visibleItems.length === items.length ? `${items.length} событий` : `Ближайшие ${visibleItems.length}`}</span>
        </div>
        <div className="schedule-display__events">
          {visibleItems.length > 0 ? visibleItems.map(item => (
            <ScheduleEventRow
              key={`${item.id}-${item.occurrenceDate}`}
              item={item}
              highlighted={nextTime === item.time}
              accessibilityLabel={nextTime === item.time ? `Следующее событие: ${item.time}, ${item.title}, ${item.venue}` : undefined}
              compact
            />
          )) : (
            <div className="schedule-display__empty">
              <CalendarDays size={44} />
              <h2>На сегодня событий нет</h2>
              <p>Отдыхайте и набирайтесь сил.</p>
            </div>
          )}
        </div>
          </main>
        </div>
      </div>
    </div>
  );
}
