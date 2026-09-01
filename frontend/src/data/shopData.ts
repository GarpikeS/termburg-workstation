import { GAME_NAMES } from './gameNames.ts';

export interface Product {
  id: string;
  category: 'tickets' | 'merch' | 'boosters';
  name: string;
  description: string;
  price: number;
  currency: 'rub' | 'coins';
  badge?: string;
  image: string;
  action?: 'weekly-reward';
  gameLabel?: string;
}

export const products: Product[] = [
  // Билеты
  {
    id: 'ticket-free',
    category: 'tickets',
    name: 'Бесплатный час',
    description: 'Один час свободного посещения Термбурга',
    price: 50,
    currency: 'coins',
    badge: '7 дней',
    image: '/images/shop/ticket-free.svg',
    action: 'weekly-reward',
  },
  {
    id: 'ticket-vip',
    category: 'tickets',
    name: 'VIP — бесплатное посещение',
    description: 'Бесплатное посещение термального комплекса в любой день, включая выходные',
    price: 5000,
    currency: 'coins',
    badge: 'VIP',
    image: '/images/shop/ticket-vip.svg',
  },
  // Мерч
  {
    id: 'merch-hat',
    category: 'merch',
    name: 'Банная шапка',
    description: 'Фирменная банная шапка Термбурга',
    price: 6000,
    currency: 'coins',
    image: '/images/shop/merch-bath-hat.webp',
  },
  // Бустеры
  {
    id: 'booster-hint',
    category: 'boosters',
    name: 'Подсказка',
    description: `Подсветить лучший ход в «${GAME_NAMES.match3}е»`,
    price: 20,
    currency: 'coins',
    image: '/images/shop/booster-hint.svg',
    gameLabel: `${GAME_NAMES.match3} · 3 в ряд`,
  },
  {
    id: 'booster-shuffle',
    category: 'boosters',
    name: 'Перемешать',
    description: `Перемешать все фишки в «${GAME_NAMES.match3}е»`,
    price: 30,
    currency: 'coins',
    image: '/images/shop/booster-shuffle.svg',
    gameLabel: `${GAME_NAMES.match3} · 3 в ряд`,
  },
  {
    id: 'booster-bomb',
    category: 'boosters',
    name: 'Взрыв',
    description: `Уничтожить выбранную область 3×3 в «${GAME_NAMES.match3}е»`,
    price: 50,
    currency: 'coins',
    image: '/images/shop/booster-bomb.svg',
    gameLabel: `${GAME_NAMES.match3} · 3 в ряд`,
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id);
}

export function getProductsByCategory(category: Product['category']): Product[] {
  return products.filter(p => p.category === category);
}
