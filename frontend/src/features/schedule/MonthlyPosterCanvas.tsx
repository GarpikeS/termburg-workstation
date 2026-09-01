import { MapPin } from 'lucide-react';
import { TermburgScheduleMark } from './SchedulePrimitives';
import { formatPosterEventDate, formatPosterMonth, getPosterProgramLines } from './monthlyPoster';
import type { MonthlyPoster, ScheduleLocation } from './types';

export function MonthlyPosterCanvas({ poster, location, preview = false }: {
  poster: MonthlyPoster;
  location: ScheduleLocation;
  preview?: boolean;
}) {
  const events = [...poster.events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <article className="monthly-poster" aria-label={`Афиша праздников на ${formatPosterMonth(poster.month)}`}>
      <header className="monthly-poster__header">
        <div className="monthly-poster__brand">
          <TermburgScheduleMark />
          <span><MapPin size={18} aria-hidden="true" />{location.city}</span>
        </div>
        <div className="monthly-poster__headline">
          <span>Главные праздники в Термбурге</span>
          <h1>Афиша месяца</h1>
          <strong>{formatPosterMonth(poster.month)}</strong>
        </div>
        <span className="monthly-poster__sun" aria-hidden="true" />
      </header>

      <section className="monthly-poster__events" data-count={events.length}>
        {events.map((event, index) => {
          const date = formatPosterEventDate(event.date);
          const program = getPosterProgramLines(event.program);
          return (
            <article className="monthly-poster-event" key={event.id}>
              <div className="monthly-poster-event__date">
                <strong>{date.day}</strong>
                <span>{date.month}</span>
                <small>{date.weekday}</small>
              </div>
              <div className={`monthly-poster-event__image ${event.imageDataUrl ? '' : 'is-empty'}`}>
                {event.imageDataUrl
                  ? <img src={event.imageDataUrl} alt="" />
                  : <><span aria-hidden="true">≈</span><small>{preview ? 'Добавьте фото' : 'Термбург'}</small></>}
              </div>
              <div className="monthly-poster-event__content">
                <span className="monthly-poster-event__number">Праздник {String(index + 1).padStart(2, '0')}</span>
                <h2>{event.title.trim() || (preview ? 'Название праздника' : 'Скоро расскажем')}</h2>
                {program.length > 0 ? (
                  <ul>{program.map((line, lineIndex) => <li key={`${event.id}-${lineIndex}`}>{line}</li>)}</ul>
                ) : (
                  <p>{preview ? 'Здесь появится расписание праздника' : 'Программа появится совсем скоро'}</p>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <footer className="monthly-poster__footer">
        <span>Тепло, вода и новые впечатления</span>
        <strong>termburg.ru</strong>
      </footer>
    </article>
  );
}
