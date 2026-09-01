import { CalendarDays, ExternalLink, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MonthlyPosterCanvas } from './MonthlyPosterCanvas';
import {
  MAX_POSTER_EVENTS,
  MIN_POSTER_EVENTS,
  compressPosterImage,
  createMonthlyPoster,
  createMonthlyPosterEvent,
  formatPosterMonth,
} from './monthlyPoster';
import type { MonthlyPoster, MonthlyPosterEvent, ScheduleLocation } from './types';

interface MonthlyPosterStudioProps {
  location: ScheduleLocation;
  posters: MonthlyPoster[];
  onChange: (posters: MonthlyPoster[]) => void;
  onNotice: (notice: { tone: 'success' | 'warning' | 'error'; text: string }) => void;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthlyPosterStudio({ location, posters, onChange, onNotice }: MonthlyPosterStudioProps) {
  const [month, setMonth] = useState(currentMonthValue);
  const storedPoster = useMemo(
    () => posters.find(item => item.locationId === location.id && item.month === month),
    [location.id, month, posters],
  );
  const poster = storedPoster ?? createMonthlyPoster(location.id, month);

  const updatePoster = (next: MonthlyPoster) => {
    onChange([
      ...posters.filter(item => item.id !== next.id && !(item.locationId === next.locationId && item.month === next.month)),
      next,
    ]);
  };

  const updateEvent = (eventId: string, patch: Partial<MonthlyPosterEvent>) => {
    updatePoster({
      ...poster,
      events: poster.events.map(item => item.id === eventId ? { ...item, ...patch } : item),
    });
  };

  const addEvent = () => {
    if (poster.events.length >= MAX_POSTER_EVENTS) return;
    updatePoster({
      ...poster,
      events: [...poster.events, createMonthlyPosterEvent(month, Math.min(28, 1 + poster.events.length * 7))],
    });
  };

  const removeEvent = (eventId: string) => {
    if (poster.events.length <= MIN_POSTER_EVENTS) return;
    if (!window.confirm('Удалить этот праздник из афиши месяца?')) return;
    updatePoster({ ...poster, events: poster.events.filter(item => item.id !== eventId) });
  };

  const uploadImage = async (eventId: string, file?: File) => {
    if (!file) return;
    try {
      const imageDataUrl = await compressPosterImage(file);
      updateEvent(eventId, { imageDataUrl });
      onNotice({ tone: 'success', text: 'Фото добавлено и сжато для афиши.' });
    } catch (error) {
      onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Не удалось добавить фото.' });
    }
  };

  return (
    <div className="monthly-poster-studio">
      <section className="monthly-poster-studio__topbar">
        <div>
          <span>Квадратный макет 1 × 1 метр</span>
          <h2>Афиша на {formatPosterMonth(month)}</h2>
          <p>Только крупные праздники месяца. Обычные занятия и ежедневное расписание сюда не добавляются.</p>
        </div>
        <div className="monthly-poster-studio__actions">
          <label className="schedule-admin-field">
            <span>Месяц афиши</span>
            <input type="month" value={month} onChange={event => setMonth(event.target.value || currentMonthValue())} />
          </label>
          <a className="schedule-admin-primary" href={`/schedule/poster/${location.id}?month=${month}`} target="_blank" rel="noreferrer">
            Открыть для печати<ExternalLink size={16} />
          </a>
        </div>
      </section>

      <div className="monthly-poster-studio__preview">
        <MonthlyPosterCanvas poster={poster} location={location} preview />
      </div>

      <section className="monthly-poster-form" aria-labelledby="monthly-poster-form-title">
        <header className="monthly-poster-form__header">
          <span className="schedule-admin-form__icon"><CalendarDays size={21} /></span>
          <div>
            <span>Праздничный календарь</span>
            <h2 id="monthly-poster-form-title">Праздники месяца</h2>
            <p>Добавьте от 2 до 5 крупных праздников. Для каждого укажите только его собственную короткую программу.</p>
          </div>
          <strong>{poster.events.length} из {MAX_POSTER_EVENTS}</strong>
        </header>

        <div className="monthly-poster-form__events">
          {poster.events.map((event, index) => (
            <fieldset className="monthly-poster-form__event" key={event.id}>
              <legend>Праздник {index + 1}</legend>
              <div className="monthly-poster-form__event-grid">
                <label className="schedule-admin-field">
                  <span>Дата</span>
                  <input type="date" value={event.date} min={`${month}-01`} max={`${month}-31`} onChange={input => updateEvent(event.id, { date: input.target.value })} />
                </label>
                <label className="schedule-admin-field monthly-poster-form__title-field">
                  <span>Название праздника</span>
                  <input type="text" value={event.title} maxLength={70} onChange={input => updateEvent(event.id, { title: input.target.value })} placeholder="Например: День рождения Термбурга" />
                </label>
                <label className="schedule-admin-field monthly-poster-form__program-field">
                  <span>Расписание праздника</span>
                  <textarea value={event.program} maxLength={500} rows={5} onChange={input => updateEvent(event.id, { program: input.target.value })} placeholder={'13:00 — Открытие праздника\n14:00 — Семейная программа\n15:30 — Пенное шоу'} />
                  <small>Не вставляйте расписание обычного дня. Оставьте 3–4 главных пункта именно этого праздника.</small>
                </label>
                <div className="monthly-poster-form__image-field">
                  <span>Тематическая картинка</span>
                  <div className={event.imageDataUrl ? 'has-image' : ''}>
                    {event.imageDataUrl ? <img src={event.imageDataUrl} alt="Предпросмотр загруженной картинки" /> : <ImagePlus size={28} aria-hidden="true" />}
                    <label className="schedule-admin-secondary">
                      <ImagePlus size={16} />{event.imageDataUrl ? 'Заменить' : 'Загрузить'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={input => { void uploadImage(event.id, input.target.files?.[0]); input.target.value = ''; }} />
                    </label>
                    {event.imageDataUrl && <button type="button" className="monthly-poster-form__remove-image" onClick={() => updateEvent(event.id, { imageDataUrl: undefined })} aria-label={`Убрать картинку праздника ${index + 1}`}><X size={16} /></button>}
                  </div>
                </div>
              </div>
              <button type="button" className="monthly-poster-form__remove-event" onClick={() => removeEvent(event.id)} disabled={poster.events.length <= MIN_POSTER_EVENTS} title={poster.events.length <= MIN_POSTER_EVENTS ? 'В афише должно быть минимум два события' : undefined}>
                <Trash2 size={16} />Удалить праздник
              </button>
            </fieldset>
          ))}
        </div>

        <footer className="monthly-poster-form__footer">
          <p>{poster.events.length >= MAX_POSTER_EVENTS ? 'Достигнут максимум: 5 праздников в одном месяце.' : 'Квадратный формат 1 × 1 метр не меняется при добавлении праздников.'}</p>
          <button type="button" className="schedule-admin-primary" onClick={addEvent} disabled={poster.events.length >= MAX_POSTER_EVENTS}><Plus size={18} />Добавить праздник</button>
        </footer>
      </section>
    </div>
  );
}
