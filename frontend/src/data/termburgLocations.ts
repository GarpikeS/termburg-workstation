export interface TermburgLocation {
  id: number;
  city: string;
  name: string;
  address: string;
  phone: string;
  workHours: string;
  workHoursNote?: string;
  website: string;
  color: string;
  features: string[];
}

export const termburgLocations: TermburgLocation[] = [
  {
    id: 1,
    city: 'г. Москва',
    name: 'Термбург',
    address: 'ул. Гурьянова, 30 (ТЦ Сёрф Плаза, 2 этаж)',
    phone: '+7 (495) 191-64-38',
    workHours: 'Ежедневно: 09:00–23:00',
    workHoursNote: 'Первый понедельник месяца — санитарный день',
    website: 'https://termburg.ru',
    color: '#7AAFCF',
    features: ['Термальные ванны', 'Парные', 'Детская зона', 'Спа-процедуры'],
  },
  {
    id: 2,
    city: 'г. Зеленогорск',
    name: 'Термбург',
    address: 'ул. Парковая, 23',
    phone: '+7 (902) 990-70-70',
    workHours: 'Пн–чт 10:00–21:00 · Пт 10:00–22:00',
    workHoursNote: 'Сб–вс 09:00–22:00',
    website: 'https://termburg45.ru',
    color: '#6FB88E',
    features: [
      '3 бассейна',
      'Открытый бассейн',
      'Парные и хаммам',
      'SPA и массаж',
      'Детская зона',
      'Кафе',
    ],
  },
];

// Метро поблизости
export const nearbyMetro = {
  1: ['Печатники', 'Текстильщики'],
};
