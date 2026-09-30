import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '@/features/schedule/schedule.css';
import { CalendarDays, MapPin, Maximize2 } from 'lucide-react';
import { ScheduleError, ScheduleEventRow, ScheduleLoading, TermburgScheduleMark } from '@/features/schedule/SchedulePrimitives';
import { useSchedule } from '@/features/schedule/useSchedule';
import { useNow } from '@/features/schedule/useNow';
import {
  formatScheduleDate,
  getEventsForDate,
  getHighlightedItem,
  getNextScheduleDay,
  getRemainingScheduleItems,
  getZonedClock,
} from '@/features/schedule/scheduleTime';

const LANDSCAPE_EVENT_LIMIT = 12;
const PORTRAIT_EVENT_LIMIT = 9;

export function ScheduleDisplayScreen() {
  const { locationId = '1', layout } = useParams();
  const displayLayout = layout === 'portrait' || layout === 'landscape' ? layout : 'auto';
  const displayEventLimit = layout === 'portrait' ? PORTRAIT_EVENT_LIMIT : LANDSCAPE_EVENT_LIMIT;
  const { data, error } = useSchedule(5000);
  const now = useNow();
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const location = data?.locations.find(item => item.id === locationId) ?? data?.locations[0];
  const clock = location ? getZonedClock(now, location.timezone) : null;
  const items = data && location && clock ? getEventsForDate(data, location.id, clock.dateKey) : [];
  const remainingItems = clock ? getRemainingScheduleItems(items, clock.minutes) : items;
  const nextScheduleDay = data && location && clock && remainingItems.length === 0
    ? getNextScheduleDay(data, location.id, clock.dateKey)
    : null;
  const displayedDateKey = nextScheduleDay?.dateKey ?? clock?.dateKey ?? '';
  const displayedItems = nextScheduleDay?.items ?? remainingItems;
  const showingFutureDay = Boolean(nextScheduleDay);
  const highlighted = clock
    ? getHighlightedItem(displayedItems, showingFutureDay ? -1 : clock.minutes)
    : null;
  const highlightedTime = highlighted?.item?.time ?? null;
  const visibleItems = displayedItems.slice(0, displayEventLimit);
  const dayIsFinished = items.length > 0 && remainingItems.length === 0;

  const enterFullscreen = useCallback(async () => {
    if (document.fullscreenElement || !document.fullscreenEnabled) return;
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      // Browsers normally require a remote-control click or key press first.
    }
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      setFullscreenSupported(document.fullscreenEnabled);
      setFullscreenActive(Boolean(document.fullscreenElement));
    };
    const enterOnFirstInteraction = () => void enterFullscreen();

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    window.addEventListener('pointerdown', enterOnFirstInteraction, { once: true });
    window.addEventListener('keydown', enterOnFirstInteraction, { once: true });
    void enterFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      window.removeEventListener('pointerdown', enterOnFirstInteraction);
      window.removeEventListener('keydown', enterOnFirstInteraction);
    };
  }, [enterFullscreen]);

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
            </div>
            <div className="schedule-display__title">
              <div>
                <span>{showingFutureDay ? 'Ближайшие события в Термбурге' : 'Сегодня в Термбурге'}</span>
                <h1>Расписание<br className="schedule-display__title-break" /> мероприятий</h1>
                <p><MapPin size={20} />{location.city}</p>
              </div>
            </div>
          </header>

          <main className="schedule-display__main">
            <div className="schedule-display__date-line">
              <div><CalendarDays size={26} /><span>{formatScheduleDate(displayedDateKey)}</span></div>
              <span>{visibleItems.length === displayedItems.length ? `${displayedItems.length} событий` : `Ближайшие ${visibleItems.length}`}</span>
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
      {fullscreenSupported && !fullscreenActive ? (
        <button className="schedule-display__fullscreen" type="button" onClick={() => void enterFullscreen()}>
          <Maximize2 size={22} />
          На весь экран
        </button>
      ) : null}
    </div>
  );
}
