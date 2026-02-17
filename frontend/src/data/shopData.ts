export interface Product {
  id: string;
  category: 'tickets' | 'merch' | 'boosters';
  name: string;
  description: string;
  price: number;
  currency: 'rub' | 'coins';
  badge?: string;
  image: string;
}

export const products: Product[] = [
  // Билеты
  {
    id: 'ticket-free',
    category: 'tickets',
    name: 'Бесплатный час',
    description: 'Один час свободного посещения Термбурга',
    price: 0,
    currency: 'coins',
    badge: 'Бесплатно',
    image: '/images/shop/ticket-free.svg',
  },
  {
    id: 'ticket-vip',
    category: 'tickets',
    name: 'VIP-час',
    description: 'Час в VIP-зоне с премиальными услугами',
    price: 500,
    currency: 'rub',
    badge: 'VIP',
    image: '/images/shop/ticket-vip.svg',
  },
  // Мерч
  {
    id: 'merch-tshirt',
    category: 'merch',
    name: 'Футболка Термлины',
    description: 'Хлопковая футболка с принтом персонажей',
    price: 1490,
    currency: 'rub',
    image: '/images/shop/merch-tshirt.svg',
  },
  {
    id: 'merch-mug',
    category: 'merch',
    name: 'Кружка Термбург',
    description: 'Керамическая кружка с логотипом',
    price: 590,
    currency: 'rub',
    image: '/images/shop/merch-mug.svg',
  },
  {
    id: 'merch-towel',
    category: 'merch',
    name: 'Полотенце',
    description: 'Банное полотенце с вышивкой Термбург',
    price: 890,
    currency: 'rub',
    image: '/images/shop/merch-towel.svg',
  },
  {
    id: 'merch-bag',
    category: 'merch',
    name: 'Сумка',
    description: 'Тканевая сумка-шоппер с принтом',
    price: 490,
    currency: 'rub',
    image: '/images/shop/merch-bag.svg',
  },
  // Бустеры
  {
    id: 'booster-hint',
    category: 'boosters',
    name: 'Подсказка',
    description: 'Показать лучший ход на поле',
    price: 20,
    currency: 'coins',
    image: '/images/shop/booster-hint.svg',
  },
  {
    id: 'booster-shuffle',
    category: 'boosters',
    name: 'Перемешать',
    description: 'Перемешать все фишки на поле',
    price: 30,
    currency: 'coins',
    image: '/images/shop/booster-shuffle.svg',
  },
  {
    id: 'booster-bomb',
    category: 'boosters',
    name: 'Взрыв',
    description: 'Уничтожить область 3×3',
    price: 50,
    currency: 'coins',
    image: '/images/shop/booster-bomb.svg',
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id);
}

export function getProductsByCategory(category: Product['category']): Product[] {
  return products.filter(p => p.category === category);
}
