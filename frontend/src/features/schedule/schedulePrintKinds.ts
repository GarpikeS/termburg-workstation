import type { ScheduleItem } from './types';

export type SchedulePrintKind = 'steam' | 'kids';

const STEAM_EVENT_PATTERN = /(парени|париль|пропар|банн(?:ый|ая|ое)\s+(?:ритуал|церемони))/iu;
const KIDS_EVENT_PATTERN = /(детск|для\s+детей|реб[её]н|малыш|семейн)/iu;

export function getSchedulePrintKinds(item: Pick<ScheduleItem, 'title' | 'venue' | 'details'>): SchedulePrintKind[] {
  const searchableText = [item.title, item.venue, item.details]
    .filter(Boolean)
    .join(' ');
  const kinds: SchedulePrintKind[] = [];
  if (STEAM_EVENT_PATTERN.test(searchableText)) kinds.push('steam');
  if (KIDS_EVENT_PATTERN.test(searchableText)) kinds.push('kids');
  return kinds;
}

export function schedulePrintKindLabel(kind: SchedulePrintKind) {
  return kind === 'steam' ? 'Парение' : 'Детям';
}
