import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ShoppingCart, Ticket, ShoppingBag, Sparkles } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { Button } from '@/components/ui/Button';
import { useGameContext } from '@/store/GameContext';
import { getProductsByCategory, type Product } from '@/data/shopData';
import { cn } from '@/utils/cn';

const tabs = [
  { key: 'tickets' as const, label: 'Билеты', icon: Ticket },
  { key: 'merch' as const, label: 'Мерч', icon: ShoppingBag },
  { key: 'boosters' as const, label: 'Бустеры', icon: Sparkles },
];

export function ShopScreen() {
  const navigate = useNavigate();
  const { progress, addToCart, spendCurrency } = useGameContext();
  const [activeTab, setActiveTab] = useState<Product['category']>('tickets');

  const items = getProductsByCategory(activeTab);
  const cartCount = progress.cart.reduce((s, c) => s + c.quantity, 0);
  const isMerch = activeTab === 'merch';

  const handleBuy = (product: Product) => {
    if (product.currency === 'coins') {
      spendCurrency(product.price);
    } else {
      addToCart(product.id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Магазин</h2>
          <div className="flex items-center gap-3">
            <CurrencyDisplay amount={progress.currency} />
            <button onClick={() => navigate('/shop/cart')} className="relative text-white/50 hover:text-primary transition-colors">
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="gold-separator" />

      {/* Tabs */}
      <div className="px-5 py-3">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-white/5 text-white/50 border border-white/10',
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-2">
        {isMerch ? (
          /* Grid layout for merch */
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="aspect-square flex items-center justify-center p-4 bg-white/3">
                  <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-xs text-white/90 truncate">{item.name}</h4>
                  <p className="text-primary font-bold text-sm mt-1">{item.price} ₽</p>
                  <Button size="sm" className="w-full mt-2" onClick={() => handleBuy(item)}>
                    В корзину
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* List layout for tickets & boosters */
          <div className="space-y-3">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-white/3 flex items-center justify-center p-2">
                    <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white/90">{item.name}</h4>
                      {item.badge && (
                        <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs mt-1">{item.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-primary font-bold text-sm">
                        {item.price === 0 ? 'Бесплатно' : item.currency === 'rub' ? `${item.price} ₽` : `${item.price} T`}
                      </p>
                      <Button size="sm" onClick={() => handleBuy(item)}>
                        {item.currency === 'coins' ? 'Купить' : 'В корзину'}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
