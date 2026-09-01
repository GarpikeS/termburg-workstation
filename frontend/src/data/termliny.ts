import type { PlayerProgress } from '../types/game.ts';
import { getPetLevel } from '../engine/engine-pet/petEngine.ts';

export interface TermlinAbility {
  name: string;
  description: string;
  match3?: string;
  game2048?: string;
  bubbles?: string;
  pet?: string;
}

export type TermlinUnlockSource = 'match3' | 'game2048' | 'bubbles' | 'pet';

export interface TermlinUnlockRequirement {
  source: TermlinUnlockSource;
  target: number;
  label: string;
}

export interface Termlin {
  id: string;
  name: string;
  title: string;
  image: string;
  element: string;
  mission: string;
  history: string;
  character: string;
  habits: string;
  expressions: string[];
  omens: string;
  unlockRequirements: TermlinUnlockRequirement[];
  isLegendary?: boolean;
  ability: TermlinAbility;
}

export const termliny: Termlin[] = [
  {
    id: 'yaromir',
    name: 'Банник-Яромир',
    title: 'Главный хранитель Термбурга',
    image: '/images/characters/yaromir.webp',
    element: 'fire',
    mission: 'Поддерживает нужную температуру, нагоняет пар и создаёт комфортные условия.',
    history: 'Был банником у Петра I, который обещал ему построить целый город бань, но не успел. Долго скитался и мечтал, что кто-то захочет его мечту реализовать. Благодаря чёрным петухам узнал про Термбург и привёл сюда жить всю семью.',
    character: 'Спокойный, молчаливый, но в гневе становится огромным. Мудрый лидер, к которому идут за советом все Термлины.',
    habits: 'Любит травяные чаи, мёд и молоко. Еженедельно посещает ГлинВил.',
    expressions: ['Ажно', 'Дородный', 'Рожено дитятко'],
    omens: 'Мужчины входят в баню с правой ноги, женщины — с левой.',
    unlockRequirements: [],
    isLegendary: true,
    ability: {
      name: 'Жар пара',
      description: 'Мастер всех стихий — бонус во всех играх',
      match3: '+1 подсказка и +2 хода',
      game2048: '+10% к очкам за слияние',
      bubbles: '+3 выстрела на уровне',
      pet: 'Питомец теряет статы на 30% медленнее',
    },
  },
  {
    id: 'valkiriya',
    name: 'Банная Бабушка Валькирия',
    title: 'Дух исцеления',
    image: '/images/characters/valkiriya.webp',
    element: 'herb',
    mission: 'Спасает от болезней, облегчает страдания слабых.',
    history: 'Давно замужем за Яромиром, поддерживала его мечту о городе бань. Вместе с ним перебралась в Термбург.',
    character: 'Добрая, покладистая, мудрая, хороший психолог.',
    habits: 'Часто чихает из-за работы с травами. Готовит целебные настойки.',
    expressions: ['Хухря', 'Запуклить', 'Жандобиться'],
    omens: 'Попросите у неё помощь в избавлении от недугов.',
    unlockRequirements: [
      { source: 'match3', target: 3, label: 'Пройди 3 уровня Хоровода' },
    ],
    ability: {
      name: 'Исцеление',
      description: 'Восстанавливает силы',
      match3: '+3 хода на старте уровня',
      game2048: 'Одна «вторая жизнь» при проигрыше',
      bubbles: '+2 выстрела',
      pet: '+10 к восстановлению при уходе',
    },
  },
  {
    id: 'pereslav',
    name: 'Домовой Переслав',
    title: 'Хранитель комплекса',
    image: '/images/characters/pereslav.webp',
    element: 'home',
    mission: 'Охраняет весь комплекс Термбург.',
    history: 'Странствовал рядом с Яромиром, последовал в Термбург помощником.',
    character: 'Весёлый, шумный, обидчивый, быстро движется и говорит.',
    habits: 'Любит анекдоты и смех. Может организовать сюрпризы гостям.',
    expressions: ['Засельщина', 'Доселева', 'Чадо'],
    omens: 'Не любит ругань и мусор.',
    unlockRequirements: [
      { source: 'game2048', target: 1000, label: 'Набери 1 000 очков в Славиче' },
    ],
    ability: {
      name: 'Хитрость',
      description: 'Множитель очков',
      match3: '+25% очков за комбо',
      game2048: '+15% к финальному счёту',
      bubbles: '+20% очков за лопнутые шарики',
      pet: '+2 монеты за действие',
    },
  },
  {
    id: 'kazimir',
    name: 'Дворовой Казимир',
    title: 'Хранитель террасы',
    image: '/images/characters/kazimir.webp',
    element: 'wind',
    mission: 'Охраняет открытую террасу.',
    history: 'Часто исчезал и появлялся, попадал в неприятности, но друзья всегда спасали.',
    character: 'Скрытный, хитрый, умный, любит козни.',
    habits: 'Слабость к конфетам «Белочка» и пиву. В плохую погоду ворчит.',
    expressions: ['Бельмес', 'Годы годуй', 'Фыркалка'],
    omens: 'Не берите его шар с предсказаниями!',
    unlockRequirements: [
      { source: 'bubbles', target: 3, label: 'Пройди 3 уровня Бирюлек' },
    ],
    ability: {
      name: 'Предвидение',
      description: 'Видит наперёд',
      match3: 'Подсветить лучший следующий ход',
      game2048: 'Подсветка лучшего хода',
      bubbles: 'Показать траекторию отскока',
      pet: 'Предупреждение о падении статов',
    },
  },
  {
    id: 'vedagor',
    name: 'Кот Ведагор',
    title: 'Исполнитель желаний',
    image: '/images/characters/vedagor.webp',
    element: 'wisdom',
    mission: 'Волшебный кот, исполняет желания.',
    history: 'Странствовал, посещал друзей. Увидев древо жизни, решил остаться в Термбурге.',
    character: 'Уравновешенный, философ, медлительный, любит детей.',
    habits: 'Медитирует, много читает, рассказывает сказки детям.',
    expressions: ['Мурмики'],
    omens: 'Прошепчите желание ему на ухо и обойдите трижды по часовой стрелке.',
    unlockRequirements: [
      { source: 'pet', target: 3, label: 'Достигни 3-го уровня привязанности в Пестуне' },
    ],
    ability: {
      name: 'Мудрость',
      description: 'Автоматические подсказки',
      match3: 'Автоподсказка каждые 10 ходов',
      game2048: 'Показывает оптимальный угол',
      bubbles: 'Подсветка одноцветных групп',
      pet: 'Статы падают на 15% медленнее',
    },
  },
  {
    id: 'milovan',
    name: 'Кот Люб Милован',
    title: 'Защитник брака',
    image: '/images/characters/milovan.webp',
    element: 'love',
    mission: 'Охраняет брачное ложе как семейную святыню.',
    history: 'Заколдованный юноша, колдунья забрала память. Нашла его Леля.',
    character: 'Ретивый, вспыльчивый, молодой, мощный, заботливый.',
    habits: 'Чтит традиции, учится у Ведагора. Тайно влюблён в Лелю.',
    expressions: ['Глаголить', 'Без пены', 'Глупендяй'],
    omens: 'Попросите восстановить отношения.',
    unlockRequirements: [
      { source: 'match3', target: 10, label: 'Пройди 10 уровней Хоровода' },
      { source: 'bubbles', target: 5, label: 'Пройди 5 уровней Бирюлек' },
    ],
    ability: {
      name: 'Удар',
      description: 'Разрушительная сила',
      match3: 'Уничтожить 1 фишку на поле',
      game2048: 'Удалить наименьший тайл',
      bubbles: 'Взрывная волна (3 шарика)',
      pet: '+15 к счастью за действие',
    },
  },
  {
    id: 'lelya',
    name: 'Берегиня Леля',
    title: 'Защитница детей',
    image: '/images/characters/lelya.webp',
    element: 'water',
    mission: 'Охраняет маленьких детей возле воды.',
    history: 'Дочь Яромира и Валькирии. Следовала за родителями, видела парня у реки, уехала с ними в Термбург.',
    character: 'Добрая, наивная, улыбчивая, любит солнце и цветы.',
    habits: 'Готовит пироги, рукодельница, ухаживает за растениями.',
    expressions: ['Батюшка', 'Матушка'],
    omens: 'Просите помощь в обучении плаванию. День Берегини — 15 июля.',
    unlockRequirements: [
      { source: 'match3', target: 20, label: 'Пройди 20 уровней Хоровода' },
      { source: 'game2048', target: 3000, label: 'Набери 3 000 очков в Славиче' },
      { source: 'bubbles', target: 10, label: 'Пройди 10 уровней Бирюлек' },
      { source: 'pet', target: 5, label: 'Достигни 5-го уровня привязанности в Пестуне' },
    ],
    ability: {
      name: 'Прощение',
      description: 'Второй шанс',
      match3: '1 «прощённый» ход при проигрыше',
      game2048: 'Отмена последнего хода',
      bubbles: 'Промах не считается выстрелом',
      pet: 'Питомец не может упасть ниже 10%',
    },
  },
];

export function getTermlinById(id: string): Termlin | undefined {
  return termliny.find(t => t.id === id);
}

function completedMatch3Levels(progress: PlayerProgress): number {
  return Object.values(progress.levels).filter(level => level.completed).length;
}

export function getTermlinUnlockValue(
  requirement: TermlinUnlockRequirement,
  progress: PlayerProgress,
): number {
  switch (requirement.source) {
    case 'match3':
      return completedMatch3Levels(progress);
    case 'game2048':
      return progress.best2048Score;
    case 'bubbles':
      return progress.bubbleLevelsCompleted;
    case 'pet':
      return progress.pet ? getPetLevel(progress.pet) : 0;
  }
}

export function isTermlinRequirementMet(
  requirement: TermlinUnlockRequirement,
  progress: PlayerProgress,
): boolean {
  return getTermlinUnlockValue(requirement, progress) >= requirement.target;
}

export function isTermlinUnlocked(termlin: Termlin, progress: PlayerProgress): boolean {
  return progress.unlockedCharacters.includes(termlin.id)
    || termlin.unlockRequirements.every(requirement => isTermlinRequirementMet(requirement, progress));
}

export function syncTermlinUnlocks(progress: PlayerProgress): PlayerProgress {
  const unlocked = termliny
    .filter(termlin => isTermlinUnlocked(termlin, progress))
    .map(termlin => termlin.id);
  const current = new Set(progress.unlockedCharacters);
  const hasChanges = unlocked.some(id => !current.has(id));
  return hasChanges
    ? { ...progress, unlockedCharacters: [...new Set([...progress.unlockedCharacters, ...unlocked])] }
    : progress;
}

export const ELEMENT_COLORS: Record<string, string> = {
  fire: '#D4956A',
  herb: '#5DB879',
  home: '#A0784C',
  wind: '#6AABDA',
  wisdom: '#9B7EC8',
  love: '#E87CA0',
  water: '#6AABDA',
};
