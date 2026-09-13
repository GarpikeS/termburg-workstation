import type { MonthlyPoster, MonthlyPosterEvent } from './types';

export const MIN_POSTER_EVENTS = 1;
export const MAX_POSTER_EVENTS = 6;

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

export function formatPosterMonthParts(month: string) {
  const value = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(value.getTime())) return { month: month.toLocaleUpperCase('ru-RU'), year: '' };
  return {
    month: new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(value).toLocaleUpperCase('ru-RU'),
    year: new Intl.DateTimeFormat('ru-RU', { year: 'numeric' }).format(value),
  };
}

export function formatPosterEventDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) {
    return { day: '—', month: '', weekday: '' };
  }
  const dateParts = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).formatToParts(value);
  return {
    day: dateParts.find(part => part.type === 'day')?.value ?? '—',
    month: dateParts.find(part => part.type === 'month')?.value ?? '',
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

const SUPPORTED_POSTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SUPPORTED_POSTER_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function isSupportedPosterImage(file: File) {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('ru-RU') ?? '';
  return SUPPORTED_POSTER_IMAGE_TYPES.has(file.type.toLocaleLowerCase('ru-RU'))
    || SUPPORTED_POSTER_IMAGE_EXTENSIONS.has(extension);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Не удалось прочитать изображение.'));
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
    reader.readAsDataURL(file);
  });
}

export async function compressPosterImage(file: File) {
  if (!isSupportedPosterImage(file)) throw new Error('Выберите изображение PNG, JPG или WebP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Исходное изображение больше 15 МБ.');

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
    element.src = sourceDataUrl;
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
}
