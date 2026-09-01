import { ArrowLeft, Printer } from 'lucide-react';
import '@/features/schedule/schedule.css';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MonthlyPosterCanvas } from '@/features/schedule/MonthlyPosterCanvas';
import { ScheduleError, ScheduleLoading } from '@/features/schedule/SchedulePrimitives';
import { formatPosterMonth } from '@/features/schedule/monthlyPoster';
import { useSchedule } from '@/features/schedule/useSchedule';

function initialMonthValue() {
  const queryMonth = new URLSearchParams(window.location.search).get('month');
  if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth)) return queryMonth;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function SchedulePosterScreen() {
  const { locationId = '1' } = useParams();
  const { data, error } = useSchedule(30000);
  const [month, setMonth] = useState(initialMonthValue);
  const location = data?.locations.find(item => item.id === locationId);
  const poster = useMemo(
    () => data?.monthlyPosters.find(item => item.locationId === locationId && item.month === month),
    [data, locationId, month],
  );

  if (error && !data) return <ScheduleError message={error} />;
  if (!data) return <ScheduleLoading />;
  if (!location) return <ScheduleError message="Комплекс не найден." />;

  return (
    <div className="schedule-poster-page">
      <header className="schedule-poster-page__controls">
        <a href="/schedule/admin"><ArrowLeft size={18} />В редактор</a>
        <label><span>Месяц</span><input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
        <button type="button" onClick={() => window.print()} disabled={!poster}><Printer size={18} />Печать 1 × 1 м / PDF</button>
      </header>
      <main className="schedule-poster-page__preview">
        {poster
          ? <MonthlyPosterCanvas poster={poster} location={location} />
          : <section className="schedule-poster-page__empty"><h1>Афиша на {formatPosterMonth(month)} пока не заполнена</h1><p>Откройте раздел «Афиша месяца» в редакторе и добавьте от 2 до 5 крупных праздников.</p><a href="/schedule/admin">Перейти в редактор</a></section>}
      </main>
    </div>
  );
}
