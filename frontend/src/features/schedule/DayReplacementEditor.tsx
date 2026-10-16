import { useState } from 'react';
import { changeDayEvent, countDayReplacements, getDayReplacementRows, getPendingDayReplacement, isDayReplacementDate, resetDayReplacements } from './dayReplacement';
import { addDays, formatScheduleDate, getZonedClock, isClosedScheduleItem } from './scheduleTime';
import type { ScheduleData, ScheduleItem, ScheduleLocation } from './types';
import type { DayEventPatch } from './dayReplacement';
import './day-replacement.css';

interface Props {
  data: ScheduleData;
  location: ScheduleLocation;
  readOnly: boolean;
  onChange: (data: ScheduleData) => void;
  onNotice: (notice: { tone: 'success' | 'warning' | 'error'; text: string }) => void;
  onOpenExceptions: (date: string) => void;
}

export function DayReplacementEditor({ data, location, readOnly, onChange, onNotice, onOpenExceptions }: Props) {
  const [date, setDate] = useState(() => getZonedClock(new Date(), location.timezone).dateKey);
  const rows = getDayReplacementRows(data, location.id, date);
  const changed = countDayReplacements(data, location.id, date);
  const closed = rows.some(isClosedScheduleItem);
  const change = (item: ScheduleItem, patch: DayEventPatch) => {
    if (readOnly) return;
    try {
      const next = changeDayEvent(data, location.id, date, item.id, item.isException, patch);
      if (next !== data) onChange(next);
    } catch (error) {
      onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Не удалось изменить событие.' });
    }
  };
  const reset = (id?: string) => {
    if (readOnly || !window.confirm(id
      ? 'Вернуть обычное событие на эту дату? Остальные мероприятия не изменятся.'
      : `Сбросить замены на ${formatScheduleDate(date)}? Дополнительные разовые события останутся. Для применения потребуется сохранить расписание.`)) return;
    onChange(resetDayReplacements(data, location.id, date, id));
    onNotice({ tone: 'warning', text: 'Замены сброшены в черновике. Нажмите «Сохранить и показать всем», чтобы применить.' });
  };

  return <div className="schedule-day-editor">
    <div className="schedule-day-editor__heading">
      <div><h2>Заменить программу на один день</h2><p>{location.name} · {location.city}</p></div>
      <div className="schedule-day-editor__date">
        <button type="button" className="schedule-admin-secondary" aria-label="Предыдущий день" disabled={!isDayReplacementDate(date)} onClick={() => setDate(addDays(date, -1))}>←</button>
        <label className="schedule-admin-field"><span>Дата замены</span><input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label>
        <button type="button" className="schedule-admin-secondary" aria-label="Следующий день" disabled={!isDayReplacementDate(date)} onClick={() => setDate(addDays(date, 1))}>→</button>
      </div>
    </div>
    <div className="schedule-day-editor__help">
      <strong>Меняйте только нужные мероприятия — остальные останутся как были.</strong>
      <p>Правки относятся только к выбранной дате. Обычная неделя, другие даты и комплексы не меняются. Затем нажмите «Сохранить и показать всем» внизу.</p>
      <p>{location.id === 'test' ? 'Тестовые изменения не публикуются для гостей.' : location.id === '2'
        ? 'На сайте Зеленогорска замены появятся после отправки расписания на сайт.'
        : 'Замены работают в программе, на её экранах и в печати. Сайт Москвы пока показывает обычную неделю.'}</p>
    </div>
    {readOnly && <p role="status">Для изменения опубликованного дня требуется право публикации расписания.</p>}
    {isDayReplacementDate(date) ? <>
      <div className="schedule-day-editor__summary">
        <div><strong>{formatScheduleDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><span>{rows.length} мероприятий · {changed} замен</span></div>
        <button type="button" className="schedule-admin-secondary" disabled={readOnly || changed === 0} onClick={() => reset()}>Сбросить замены на эту дату</button>
      </div>
      {closed ? <p role="status">На эту дату комплекс закрыт: {rows[0]?.title}. Сначала измените санитарный день в «Особых датах».</p>
        : <div className="schedule-day-editor__rows">{rows.map(item => {
          const replacement = 'replacesEventId' in item && Boolean(item.replacesEventId);
          const pending = getPendingDayReplacement(data, item);
          const key = `${item.isException ? 'exception' : 'weekly'}-${item.id}`;
          // Use the recurring ID for stable focus while the first edit creates an exception.
          const stableKey = replacement ? `weekly-${(item as { replacesEventId: string }).replacesEventId}` : key;
          return <article className={`schedule-day-editor__row ${replacement ? 'is-replaced' : ''}`} key={stableKey}>
            <div className="schedule-day-editor__row-heading"><strong>{item.time || 'Время не задано'} · {replacement ? 'Замена на эту дату' : item.isException ? 'Разовое событие' : 'Обычная программа'}</strong>
              {replacement && <button type="button" className="schedule-admin-secondary" disabled={readOnly} onClick={() => reset(item.id)}>Вернуть обычное событие</button>}</div>
            {pending && <p role="status">Есть неопубликованный черновик замены. Проверьте его в «Особых датах».</p>}
            <fieldset disabled={readOnly || Boolean(pending)} className="schedule-day-editor__fields">
              <label className="schedule-admin-field schedule-day-editor__title"><span>Название мероприятия</span><input value={item.title} maxLength={500} onChange={event => change(item, { title: event.target.value })} /></label>
              <label className="schedule-admin-field"><span>Начало</span><input type="time" value={item.time} onChange={event => change(item, { time: event.target.value })} /></label>
              <label className="schedule-admin-field"><span>Окончание</span><input type="time" value={item.endTime ?? ''} onChange={event => change(item, { endTime: event.target.value || undefined })} /></label>
              <label className="schedule-admin-field schedule-day-editor__venue"><span>Место</span><input value={item.venue} maxLength={500} onChange={event => change(item, { venue: event.target.value })} /></label>
              <label className="schedule-admin-field"><span>Стоимость</span><select value={item.priceKind} onChange={event => change(item, { priceKind: event.target.value as 'free' | 'paid' })}><option value="free">Бесплатно</option><option value="paid">Платно</option></select></label>
              {item.priceKind === 'paid' && <label className="schedule-admin-field"><span>Цена, ₽</span><input type="number" min="0" value={item.price ?? ''} onChange={event => change(item, { price: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>}
            </fieldset>
            <details className="schedule-day-editor__details"><summary>Дополнительные сведения</summary><label className="schedule-admin-field"><span>Детали мероприятия</span><textarea disabled={readOnly || Boolean(pending)} rows={2} value={item.details ?? ''} onChange={event => change(item, { details: event.target.value })} /></label></details>
          </article>;
        })}</div>}
      {!closed && rows.length === 0 && <p>На эту дату пока нет опубликованных мероприятий. Добавьте разовое событие в «Особых датах».</p>}
      <button type="button" className="schedule-admin-secondary" onClick={() => onOpenExceptions(date)}>Открыть особые даты · добавить отдельное событие</button>
    </> : <p role="status">Выберите корректную дату, чтобы увидеть программу дня.</p>}
  </div>;
}
