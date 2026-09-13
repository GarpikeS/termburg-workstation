import type { Ref } from 'react';
import { TermburgScheduleMark } from './SchedulePrimitives';
import { formatPosterEventDate, formatPosterMonth, formatPosterMonthParts, getPosterProgramLines } from './monthlyPoster';
import type { MonthlyPoster, ScheduleLocation } from './types';

function PosterProgramLine({ line }: { line: string }) {
  const match = line.match(/^(\d{1,2}:\d{2})\s*[—–-]\s*(.+)$/);
  return (
    <li>
      <span className="monthly-poster-event__program-mark" aria-hidden="true">◆</span>
      {match
        ? <><time>{match[1]}</time><span>{match[2]}</span></>
        : <span className="monthly-poster-event__program-copy">{line}</span>}
    </li>
  );
}

export function MonthlyPosterCanvas({ poster, location, preview = false, elementRef }: {
  poster: MonthlyPoster;
  location: ScheduleLocation;
  preview?: boolean;
  elementRef?: Ref<HTMLElement>;
}) {
  const events = [...poster.events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);
  const monthTitle = formatPosterMonthParts(poster.month);
  const city = location.city.replace(/^г\.\s*/i, '');

  return (
    <article className="monthly-poster" data-count={events.length} ref={elementRef} aria-label={`Афиша праздников на ${formatPosterMonth(poster.month)}`}>
      <header className="monthly-poster__header">
        <div className="monthly-poster__brand">
          <TermburgScheduleMark />
        </div>
        <div className="monthly-poster__headline">
          <h1>Афиша месяца</h1>
          <strong><span>{monthTitle.month}</span> <span>{monthTitle.year}</span></strong>
        </div>
        <div className="monthly-poster__city"><span>{city}</span></div>
      </header>

      <section className="monthly-poster__events" data-count={events.length}>
        {events.map(event => {
          const date = formatPosterEventDate(event.date);
          const program = getPosterProgramLines(event.program);
          const title = event.title.trim();
          const titleClass = title.length > 56 ? 'is-extra-long' : title.length > 36 ? 'is-long' : '';
          return (
            <article className="monthly-poster-event" key={event.id}>
              <div className="monthly-poster-event__content">
                <div className="monthly-poster-event__date">
                  <strong>{date.day}</strong>
                  <span>{date.month}</span>
                  <small>{date.weekday}</small>
                </div>
                <h2 className={titleClass}>{title || (preview ? 'Название праздника' : 'Скоро расскажем')}</h2>
                {program.length > 0 ? (
                  <ul>{program.map((line, lineIndex) => <PosterProgramLine key={`${event.id}-${lineIndex}`} line={line} />)}</ul>
                ) : (
                  <p>{preview ? 'Здесь появится расписание праздника' : 'Программа появится совсем скоро'}</p>
                )}
              </div>
              <div className={`monthly-poster-event__image ${event.imageDataUrl ? '' : 'is-empty'}`}>
                {event.imageDataUrl
                  ? <img src={event.imageDataUrl} alt="" />
                  : <><span aria-hidden="true">≈</span><small>{preview ? 'Добавьте фото' : 'Термбург'}</small></>}
              </div>
            </article>
          );
        })}
      </section>

      <footer className="monthly-poster__footer">
        <span aria-hidden="true">◆</span>
      </footer>
    </article>
  );
}
