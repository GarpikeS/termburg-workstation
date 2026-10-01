import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '@/features/schedule/schedule.css';
import '@/features/schedule/scheduleDisplay.css';
import { CalendarDays, MapPin, Maximize2 } from 'lucide-react';
import { ScheduleError, ScheduleLoading, TermburgScheduleMark } from '@/features/schedule/SchedulePrimitives';
import { ScheduleTvEvent } from '@/features/schedule/ScheduleTvEvent';
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
  const [portraitViewport, setPortraitViewport] = useState(() => window.matchMedia('(orientation: portrait)').matches);
  const displayLayout = layout === 'portrait' || layout === 'landscape'
    ? layout
    : portraitViewport ? 'portrait' : 'landscape';
  const displayEventLimit = displayLayout === 'portrait' ? PORTRAIT_EVENT_LIMIT : LANDSCAPE_EVENT_LIMIT;
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

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const syncOrientation = () => setPortraitViewport(query.matches);
    query.addEventListener('change', syncOrientation);
    return () => query.removeEventListener('change', syncOrientation);
  }, []);

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
    <div className="schedule-tv-stage">
      <div className={`schedule-tv-frame schedule-tv-frame--${displayLayout}`}>
        <div className="schedule-tv">
          <header className="schedule-tv__header">
            <div className="schedule-tv__title">
              <span>{showingFutureDay ? 'Ближайшие события в Термбурге' : 'Сегодня в Термбурге'}</span>
              <h1>Расписание<br /> мероприятий</h1>
              <p><MapPin aria-hidden="true" />{location.city}</p>
            </div>
            <TermburgScheduleMark />
            <div className="schedule-tv__clock">
              <strong aria-label={`${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`}>
                {String(clock.hour).padStart(2, '0')}<i>:</i>{String(clock.minute).padStart(2, '0')}
              </strong>
              <span>{location.shortName}</span>
            </div>
          </header>

          <main className="schedule-tv__main">
            <div className="schedule-tv__date-line">
              <div><CalendarDays aria-hidden="true" /><span>{formatScheduleDate(displayedDateKey)}</span></div>
              <span>{visibleItems.length === displayedItems.length ? `${displayedItems.length} событий` : `Ближайшие ${visibleItems.length}`}</span>
            </div>
            <div className="schedule-tv__events">
              {visibleItems.length > 0 ? visibleItems.map(item => (
                <ScheduleTvEvent
                  key={`${item.id}-${item.occurrenceDate}`}
                  item={item}
                  highlighted={highlightedTime === item.time}
                  accessibilityLabel={highlightedTime === item.time ? `${highlighted?.status === 'now' ? 'Сейчас идёт' : 'Следующее событие'}: ${item.time}, ${item.title}, ${item.venue}` : undefined}
                />
              )) : (
                <div className="schedule-tv__empty">
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
        <button className="schedule-tv__fullscreen" type="button" onClick={() => void enterFullscreen()}>
          <Maximize2 size={22} />
          На весь экран
        </button>
      ) : null}
    </div>
  );
}
