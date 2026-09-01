import type { MonthlyPoster, MonthlyPosterEvent } from './types';

export const MIN_POSTER_EVENTS = 2;
export const MAX_POSTER_EVENTS = 5;

function safeDay(month: string, day: number) {
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function createMonthlyPosterEvent(month: string, day = 1): MonthlyPosterEvent {
  return {
    id: `poster-event-${crypto.randomUUID()}`,
    date: safeDay(month, day),
    title: '',
    program: '',
  };
}

export function createMonthlyPoster(locationId: string, month: string): MonthlyPoster {
  return {
    id: `poster-${locationId}-${month}`,
    locationId,
    month,
    events: [
      createMonthlyPosterEvent(month, 1),
      createMonthlyPosterEvent(month, 15),
    ],
  };
}

export function formatPosterMonth(month: string) {
  const value = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(value.getTime())) return month;
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
    .format(value)
    .replace(/^./, letter => letter.toUpperCase());
}

export function formatPosterEventDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) {
    return { day: '—', month: '', weekday: '' };
  }
  return {
    day: new Intl.DateTimeFormat('ru-RU', { day: '2-digit' }).format(value),
    month: new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(value).replace('.', ''),
    weekday: new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(value),
  };
}

export function getPosterProgramLines(program: string) {
  return program
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export async function compressPosterImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Выберите файл изображения.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Исходное изображение больше 15 МБ.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
      element.src = objectUrl;
    });
    const maxWidth = 900;
    const maxHeight = 620;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Не удалось подготовить изображение.');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/webp', 0.76);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
