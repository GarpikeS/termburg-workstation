import { useMemo, useState } from 'react';
import '@/features/schedule/schedule.css';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { ScheduleError, ScheduleEventRow, ScheduleLoading, ScheduleWaves } from '@/features/schedule/SchedulePrimitives';
import { useSchedule } from '@/features/schedule/useSchedule';
import { useNow } from '@/features/schedule/useNow';
import {
  DAY_LABELS_SHORT,
  addDays,
  addMonths,
  formatScheduleDate,
  getEventsForDate,
  getHighlightedItem,
  getMonthGrid,
  getNextScheduleItem,
  getZonedClock,
  startOfIsoWeek,
} from '@/features/schedule/scheduleTime';
import type { SchedulePriceKind, ScheduleViewMode } from '@/features/schedule/types';

type PriceFilter = 'all' | SchedulePriceKind;

export function ScheduleMobileScreen() {
  const { locationId = '1' } = useParams();
  const navigate = useNavigate();
  const { data, error } = useSchedule();
  const now = useNow();
  const [view, setView] = useState<ScheduleViewMode>('day');
  const [filter, setFilter] = useState<PriceFilter>('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [expandedWeekDay, setExpandedWeekDay] = useState<string | null>(null);

  const location = data?.locations.find(item => item.id === locationId) ?? data?.locations[0];
  const clock = location ? getZonedClock(now, location.timezone) : null;

  const dateKey = selectedDate || clock?.dateKey || new Date().toISOString().slice(0, 10);
  const weekStart = startOfIsoWeek(dateKey);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const dayItems = data && location
    ? getEventsForDate(data, location.id, dateKey).filter(item => filter === 'all' || item.priceKind === filter)
    : [];
  const highlighted = clock?.dateKey === dateKey ? getHighlightedItem(dayItems, clock.minutes) : { item: null, status: null };
  const next = data && location && clock
    ? getNextScheduleItem(data, location.id, clock.dateKey, clock.minutes)
    : null;

  if (error && !data) return <ScheduleError message={error} />;
  if (!data || !location || !clock) return <ScheduleLoading />;

  return (
    <div className="schedule-mobile">
      <header className="schedule-mobile__hero">
        <div className="schedule-mobile__topline">
          <button type="button" className="schedule-icon-button" onClick={() => navigate('/bathhouses')} aria-label="Назад к комплексам">
            <ChevronLeft size={22} />
          </button>
          <div className="schedule-mobile__brand" aria-label={`Термбург, ${location.city}`}>
            <img src="/images/brand/termburg-fish-96-v2.webp" alt="" aria-hidden="true" width="48" height="48" />
            <span>
              <strong>Термбург</strong>
              <small>{location.city}</small>
            </span>
          </div>
          <span className="schedule-mobile__topline-spacer" aria-hidden="true" />
        </div>
        <div className="schedule-mobile__title-row">
          <div>
            <span className="schedule-kicker">Живое расписание</span>
            <h1>Что сегодня?</h1>
            <p><MapPin size={13} /> {location.name}</p>
          </div>
          <div className="schedule-mobile__clock" aria-label={`Время ${clock.hour}:${clock.minute}`}>
            <strong>{String(clock.hour).padStart(2, '0')}:{String(clock.minute).padStart(2, '0')}</strong>
            <span>{location.shortName}</span>
          </div>
        </div>
        <ScheduleWaves />
      </header>

      <main className="schedule-mobile__content">
        {next && (
          <motion.section className="schedule-next-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="schedule-next-card__meta">
              <span>{next.status === 'now' ? 'Сейчас идёт' : next.dayOffset === 0 ? 'Ближайшее' : `Через ${next.dayOffset} дн.`}</span>
              <strong>{next.item.time}</strong>
            </div>
            <h2>{next.item.title}</h2>
            <p>{next.item.venue}</p>
          </motion.section>
        )}

        <div className="schedule-segmented" aria-label="Вид расписания">
          {([['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={view === value ? 'is-active' : ''}
              onClick={() => {
                setView(value);
                if (value === 'week' && view !== 'week') setExpandedWeekDay(dateKey);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {view !== 'month' && (
          <div className="schedule-date-strip" aria-label="Выбор даты">
            {weekDates.map((key, index) => {
              const isToday = key === clock.dateKey;
              return (
                <button
                  type="button"
                  key={key}
                  className={`${key === dateKey ? 'is-active' : ''} ${isToday ? 'is-today' : ''}`}
                  onClick={() => {
                    setSelectedDate(key);
                    if (view === 'week') setExpandedWeekDay(key);
                  }}
                >
                  <span>{DAY_LABELS_SHORT[index]}</span>
                  <strong>{Number(key.slice(8, 10))}</strong>
                  {isToday && <i aria-label="Сегодня" />}
                </button>
              );
            })}
          </div>
        )}

        {view === 'day' && (
          <section className="schedule-day-view">
            <div className="schedule-section-heading">
              <div>
                <span>{formatScheduleDate(dateKey, { month: 'long', year: 'numeric' })}</span>
                <h2>{formatScheduleDate(dateKey)}</h2>
              </div>
              <CalendarDays size={22} />
            </div>
            <div className="schedule-filter-row">
              {([['all', 'Все'], ['free', 'Бесплатно'], ['paid', 'Платно']] as const).map(([value, label]) => (
                <button type="button" key={value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
            <div className="schedule-event-list">
              {dayItems.length > 0 ? dayItems.map(item => (
                <ScheduleEventRow
                  key={`${item.id}-${item.occurrenceDate}`}
                  item={item}
                  highlighted={highlighted.item?.id === item.id}
                  status={highlighted.item?.id === item.id ? highlighted.status : null}
                />
              )) : <EmptyDay />}
            </div>
          </section>
        )}

        {view === 'week' && (
          <section className="schedule-week-view">
            <div className="schedule-section-heading">
              <div><span>Базовая неделя</span><h2>С {formatScheduleDate(weekStart, { day: 'numeric', month: 'long' })}</h2></div>
              <CalendarDays size={22} />
            </div>
            {weekDates.map(key => {
              const items = getEventsForDate(data, location.id, key).filter(item => filter === 'all' || item.priceKind === filter);
              const isExpanded = expandedWeekDay === key;
              const panelId = `schedule-week-day-${key}`;
              return (
                <article className={`schedule-week-day ${isExpanded ? 'is-expanded' : ''}`} key={key}>
                  <button
                    type="button"
                    className="schedule-week-day__heading"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    onClick={() => setExpandedWeekDay(isExpanded ? null : key)}
                  >
                    <h3>{formatScheduleDate(key)}</h3>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                  <div className="schedule-week-day__events" id={panelId} hidden={!isExpanded}>
                    {items.length > 0 ? items.map(item => <ScheduleEventRow key={`${item.id}-${key}`} item={item} compact />) : <p className="schedule-week-day__empty">Нет событий</p>}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {view === 'month' && (
          <MonthView data={data} locationId={location.id} dateKey={dateKey} selectedDate={selectedDate} onSelect={setSelectedDate} />
        )}
      </main>
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="schedule-empty-day">
      <CalendarDays size={28} />
      <h3>На этот день событий нет</h3>
      <p>Выберите другую дату.</p>
    </div>
  );
}

function MonthView({
  data,
  locationId,
  dateKey,
  selectedDate,
  onSelect,
}: {
  data: NonNullable<ReturnType<typeof useSchedule>['data']>;
  locationId: string;
  dateKey: string;
  selectedDate: string;
  onSelect: (dateKey: string) => void;
}) {
  const cells = getMonthGrid(dateKey);
  const activeDate = selectedDate || dateKey;
  const exceptions = data.exceptions.filter(item => item.locationId === locationId && item.published && item.date.slice(0, 7) === dateKey.slice(0, 7));
  const specialDates = new Set(exceptions.map(item => item.date));
  const selectedItems = getEventsForDate(data, locationId, activeDate);
  return (
    <section className="schedule-month-view">
      <div className="schedule-section-heading schedule-month-heading">
        <div><span>Календарь событий</span><h2>{formatScheduleDate(dateKey, { month: 'long', year: 'numeric' })}</h2></div>
        <div className="schedule-month-heading__controls">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => onSelect(addMonths(activeDate, -1))}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Следующий месяц" onClick={() => onSelect(addMonths(activeDate, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="schedule-month-grid">
        {DAY_LABELS_SHORT.map(label => <span className="schedule-month-grid__weekday" key={label}>{label}</span>)}
        {cells.map(cell => {
          const hasSpecialEvent = specialDates.has(cell.dateKey);
          return (
            <button
              type="button"
              key={cell.dateKey}
              className={`${cell.inMonth ? '' : 'is-muted'} ${activeDate === cell.dateKey ? 'is-active' : ''}`}
              aria-label={`${formatScheduleDate(cell.dateKey)}${hasSpecialEvent ? ', есть особое событие' : ''}`}
              aria-pressed={activeDate === cell.dateKey}
              onClick={() => onSelect(cell.dateKey)}
            >
              <span>{cell.day}</span>
              {hasSpecialEvent && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="schedule-month-note">
        <strong>Выберите дату</strong>
        <span>Точка отмечает особое событие. Ниже показывается полное расписание выбранного дня.</span>
      </div>
      <div className="schedule-month-selection">
        <span>Расписание на день</span>
        <h3>{formatScheduleDate(activeDate)}</h3>
      </div>
      <div className="schedule-event-list">
        {selectedItems.length > 0
          ? selectedItems.map(item => <ScheduleEventRow key={`${item.id}-${activeDate}`} item={item} />)
          : <EmptyDay />}
      </div>
    </section>
  );
}
