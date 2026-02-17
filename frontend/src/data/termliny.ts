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
  unlockLevel: number;
  ability: {
    name: string;
    description: string;
  };
}

export const termliny: Termlin[] = [
  {
    id: 'yaromir',
    name: 'Банник-Яромир',
    title: 'Хранитель бань',
    image: '/images/characters/yaromir.webp',
    element: 'fire',
    mission: 'Поддерживает нужную температуру, нагоняет пар и создаёт комфортные условия.',
    history: 'Был банником у Петра I, который обещал ему построить целый город бань, но не успел. Долго скитался и мечтал, что кто-то захочет его мечту реализовать.',
    character: 'Спокойный, молчаливый, но в гневе становится огромным.',
    habits: 'Любит травяные чаи, мёд и молоко.',
    expressions: ['Ажно', 'Дородный', 'Рожено дитятко'],
    omens: 'Мужчины входят в баню с правой ноги, женщины — с левой.',
    unlockLevel: 0,
    ability: { name: 'Жар пара', description: '+1 подсказка на уровне' },
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
    unlockLevel: 10,
    ability: { name: 'Исцеление', description: '+3 хода на старте уровня' },
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
    unlockLevel: 20,
    ability: { name: 'Хитрость', description: '+25% очков за комбо' },
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
    unlockLevel: 30,
    ability: { name: 'Предвидение', description: 'Показать следующие фишки' },
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
    unlockLevel: 50,
    ability: { name: 'Мудрость', description: 'Автоподсказка каждые 10 ходов' },
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
    unlockLevel: 70,
    ability: { name: 'Удар', description: 'Уничтожить 1 фишку на поле' },
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
    unlockLevel: 100,
    ability: { name: 'Прощение', description: '1 «прощённый» ход при проигрыше' },
  },
];

export function getTermlinById(id: string): Termlin | undefined {
  return termliny.find(t => t.id === id);
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
