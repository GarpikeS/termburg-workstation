export interface TermburgLocation {
  id: number;
  city: string;
  name: string;
  address: string;
  phone: string;
  workHours: string;
  color: string;
  features: string[];
}

export const termburgLocations: TermburgLocation[] = [
  {
    id: 1,
    city: 'Москва',
    name: 'Термбург',
    address: 'ул. Гурьянова, 30 (ТЦ Сёрф Плаза, 2 этаж)',
    phone: '+7 (909) 167-47-46',
    workHours: 'Пн-Вс: 09:00 - 23:00',
    color: '#7AAFCF',
    features: ['Термальные ванны', 'Парные', 'Детская зона', 'Спа-процедуры'],
  },
];

// Метро поблизости
export const nearbyMetro = {
  1: ['Печатники', 'Текстильщики'],
};
