import { useState } from 'react';
import '@/features/schedule/schedule.css';
import { useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Printer, RotateCcw, Rows3 } from 'lucide-react';
import { ScheduleError, ScheduleEventRow, ScheduleLoading, ScheduleWaves, TermburgScheduleMark } from '@/features/schedule/SchedulePrimitives';
import { useSchedule } from '@/features/schedule/useSchedule';
import { useNow } from '@/features/schedule/useNow';
import {
  DAY_LABELS,
  DAY_LABELS_SHORT,
  addDays,
  formatScheduleDate,
  getEventsForDate,
  getZonedClock,
  isClosedScheduleItem,
  startOfIsoWeek,
  timeToMinutes,
} from '@/features/schedule/scheduleTime';
import type { ScheduleData, ScheduleItem, ScheduleViewMode } from '@/features/schedule/types';

type PrintOrientation = 'portrait' | 'landscape';
type PrintViewMode = Exclude<ScheduleViewMode, 'month'>;

export function SchedulePrintScreen() {
  const { locationId = '1' } = useParams();
  const { data, error } = useSchedule();
  const now = useNow(60000);
  const location = data?.locations.find(item => item.id === locationId) ?? data?.locations[0];
  const clock = location ? getZonedClock(now, location.timezone) : null;
  const [view, setView] = useState<PrintViewMode>('day');
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait');
  const [dateKey, setDateKey] = useState('');

  if (error && !data) return <ScheduleError message={error} />;
  if (!data || !location || !clock) return <ScheduleLoading />;

  const activeDate = dateKey || clock.dateKey;
  const weekItems = view === 'week' ? getWeekSummaryItems(data, location.id, activeDate) : [];
  const eventCount = view === 'day'
    ? getEventsForDate(data, location.id, activeDate).length
    : weekItems.length;
  const handleViewChange = (nextView: PrintViewMode) => {
    setView(nextView);
    if (nextView === 'week') setOrientation('landscape');
  };

  return (
    <div className={`schedule-print-studio schedule-print-studio--${orientation} schedule-print-studio--${view}`}>
      <style>{`@media print { @page { size: A4 ${orientation}; margin: 0; } }`}</style>
      <aside className="schedule-print-controls" aria-label="Настройки печати">
        <div>
          <span className="schedule-kicker">Студия печати</span>
          <h1>Готовый макет</h1>
          <p>Выберите вид и ориентацию, затем отправьте на печать или сохраните в PDF.</p>
        </div>
        <label>
          <span>Период</span>
          <select value={view} onChange={event => handleViewChange(event.target.value as PrintViewMode)}>
            <option value="day">День</option>
            <option value="week">Неделя</option>
          </select>
        </label>
        <label>
          <span>Дата</span>
          <input type="date" value={activeDate} onChange={event => setDateKey(event.target.value)} />
        </label>
        <fieldset>
          <legend>Ориентация</legend>
          <div className="schedule-print-orientation">
            <button
              type="button"
              className={orientation === 'portrait' ? 'is-active' : ''}
              aria-disabled={view === 'week'}
              title={view === 'week' ? 'Недельный макет подготовлен для горизонтального A4' : undefined}
              onClick={() => {
                if (view !== 'week') setOrientation('portrait');
              }}
            >
              <Rows3 size={18} />Вертикаль
            </button>
            <button type="button" className={orientation === 'landscape' ? 'is-active' : ''} onClick={() => setOrientation('landscape')}><RotateCcw size={18} />Горизонталь</button>
          </div>
          {view === 'week' && <p className="schedule-print-orientation__hint" role="status">Неделя автоматически помещается на горизонтальный A4.</p>}
        </fieldset>
        <button type="button" className="schedule-admin-primary" onClick={() => window.print()}><Printer size={19} />Печать / PDF</button>
      </aside>

      <main className="schedule-print-preview">
        <div className="schedule-paper">
          <PrintHeader locationCity={location.city} view={view} dateKey={activeDate} eventCount={eventCount} />
          {view === 'day' && <PrintDay data={data} locationId={location.id} dateKey={activeDate} />}
          {view === 'week' && <PrintWeek items={weekItems} />}
          <footer className="schedule-paper__footer">
            <ScheduleWaves />
            <span>Расписание может измениться · Актуальная версия в приложении</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function PrintHeader({
  locationCity,
  view,
  dateKey,
  eventCount,
}: {
  locationCity: string;
  view: PrintViewMode;
  dateKey: string;
  eventCount: number;
}) {
  const titles: Record<PrintViewMode, string> = {
    day: 'Расписание мероприятий',
    week: 'Расписание на неделю',
  };
  const kickers: Record<PrintViewMode, string> = {
    day: 'Сегодня в Термбурге',
    week: 'Неделя в Термбурге',
  };
  const weekday = formatScheduleDate(dateKey, { weekday: 'long' });
  const eventWord = view === 'week' ? 'программа' : 'событие';
  const eventCountLabel = `${eventCount} ${pluralize(eventCount, eventWord)}`;

  return (
    <>
      <header className="schedule-paper__header">
        <svg className="schedule-paper__header-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect width="100" height="100" fill="#07345b" />
        </svg>
        <div className="schedule-paper__headline">
          <span>{kickers[view]}</span>
          <h1>{titles[view]}</h1>
          <p><MapPin size={15} />{locationCity}</p>
        </div>
        <TermburgScheduleMark />
      </header>
      {view === 'day' && (
        <div className="schedule-paper__date-line">
          <div><CalendarDays size={22} /><span>{weekday}</span></div>
          <span>{eventCountLabel}</span>
        </div>
      )}
    </>
  );
}

function PrintDay({ data, locationId, dateKey }: PrintViewProps) {
  const items = getEventsForDate(data, locationId, dateKey);
  return (
    <div className="schedule-paper-events schedule-paper-events--day">
      {items.length > 0 ? items.map(item => (
        <ScheduleEventRow key={`${item.id}-${dateKey}`} item={item} compact />
      )) : <PrintEmpty />}
    </div>
  );
}

function PrintWeek({ items }: { items: WeekSummaryItem[] }) {
  if (items.length === 0) return <PrintEmpty />;

  const splitIndex = Math.ceil(items.length / 2);
  const columns = [items.slice(0, splitIndex), items.slice(splitIndex)];

  return (
    <div className={`schedule-paper-week-summary ${items.length > 24 ? 'schedule-paper-week-summary--dense' : ''}`}>
      {columns.map((column, columnIndex) => (
        <section className="schedule-paper-week-summary__column" key={columnIndex} aria-label={`Часть ${columnIndex + 1} недельного расписания`}>
          <div className="schedule-paper-week-summary__labels" aria-hidden="true">
            <span>Время</span>
            <span>Мероприятие и площадка</span>
            <span>Дни · цена</span>
          </div>
          <div className="schedule-paper-week-summary__rows">
            {column.map(({ item, dayIndexes }) => (
              <WeekSummaryRow item={item} dayIndexes={dayIndexes} key={getWeekItemKey(item)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function WeekSummaryRow({ item, dayIndexes }: WeekSummaryItem) {
  const closed = isClosedScheduleItem(item);
  const dayNames = dayIndexes.map(index => DAY_LABELS[index]).join(', ');
  const dayTokens = getWeekDayTokens(dayIndexes);

  return (
    <article className={`schedule-week-summary-event ${closed ? 'schedule-week-summary-event--closed' : ''}`}>
      <time>{closed ? 'Закрыто' : item.time}</time>
      <div className="schedule-week-summary-event__content">
        <h3>{item.title}</h3>
        <p><MapPin size={12} aria-hidden="true" />{item.venue || 'Площадка уточняется'}</p>
      </div>
      <div className="schedule-week-summary-event__meta">
        <div className="schedule-week-summary-event__days" aria-label={`Дни проведения: ${dayNames}`}>
          {dayTokens.map(token => <span aria-hidden="true" key={token}>{token}</span>)}
        </div>
        {!closed && (
          <span className="schedule-week-summary-event__price">
            {item.priceKind === 'free' ? 'Бесплатно' : item.price ? `+${item.price} ₽` : 'Платно'}
          </span>
        )}
      </div>
    </article>
  );
}

function getWeekSummaryItems(data: ScheduleData, locationId: string, dateKey: string): WeekSummaryItem[] {
  const start = startOfIsoWeek(dateKey);
  const groups = new Map<string, WeekSummaryItem>();

  for (let index = 0; index < 7; index += 1) {
    const occurrenceDate = addDays(start, index);
    for (const item of getEventsForDate(data, locationId, occurrenceDate)) {
      const key = getWeekItemKey(item);
      const existing = groups.get(key);
      if (existing) {
        if (!existing.dayIndexes.includes(index)) existing.dayIndexes.push(index);
      } else {
        groups.set(key, { item, dayIndexes: [index] });
      }
    }
  }

  return [...groups.values()].sort((left, right) => {
    const timeDifference = timeToMinutes(left.item.time) - timeToMinutes(right.item.time);
    if (timeDifference !== 0) return timeDifference;
    return left.item.title.localeCompare(right.item.title, 'ru');
  });
}

function getWeekItemKey(item: ScheduleItem) {
  return [
    item.time,
    item.endTime ?? '',
    item.title,
    item.venue,
    item.details ?? '',
    item.priceKind,
    item.price ?? '',
    isClosedScheduleItem(item) ? 'closed' : 'open',
  ].join('\u0001');
}

function getWeekDayTokens(dayIndexes: number[]) {
  if (dayIndexes.length === 7) return ['Ежедневно'];
  const isConsecutive = dayIndexes.every((day, index) => index === 0 || day === dayIndexes[index - 1] + 1);
  if (dayIndexes.length >= 3 && isConsecutive) {
    return [`${DAY_LABELS_SHORT[dayIndexes[0]]}–${DAY_LABELS_SHORT[dayIndexes[dayIndexes.length - 1]]}`];
  }
  return dayIndexes.map(index => DAY_LABELS_SHORT[index]);
}

function pluralize(count: number, singular: string) {
  const lastTwo = count % 100;
  const last = count % 10;
  const forms = singular === 'программа'
    ? ['программа', 'программы', 'программ']
    : ['событие', 'события', 'событий'];
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function PrintEmpty() {
  return <div className="schedule-print-empty"><CalendarDays size={24} /><span>Особых событий нет</span></div>;
}

interface PrintViewProps {
  data: ScheduleData;
  locationId: string;
  dateKey: string;
}

interface WeekSummaryItem {
  item: ScheduleItem;
  dayIndexes: number[];
}
