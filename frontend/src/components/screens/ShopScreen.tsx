import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';

const packages = [
  {
    name: 'Классик', gradient: 'from-[#7FA99B] to-[#6DB4C9]',
    gems: 50, boosters: 3, lives: 0, price: 'Бесплатно',
  },
  {
    name: 'Премиум', gradient: 'from-[#C4956C] to-[#E8DCC4]',
    gems: 200, boosters: 10, lives: 5, price: '99',
  },
  {
    name: 'VIP', gradient: 'from-[#E88B5C] to-[#C4956C]',
    gems: 500, boosters: 25, lives: 15, price: '299',
  },
];

const boosters = [
  { name: 'AI-Подсказка', icon: Sparkles, color: '#6DB4C9', price: 20 },
  { name: 'Перемешать', icon: Zap, color: '#6EAA5E', price: 30 },
  { name: 'Уничтожить', icon: Star, color: '#E88B5C', price: 50 },
];

export function ShopScreen() {
  const navigate = useNavigate();
  const { progress, spendCurrency } = useGameContext();

  return (
    <div className="h-full flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-accent pt-12 pb-6 px-6 rounded-b-4xl shadow-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/menu')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-heading text-lg text-white font-bold">Магазин</h2>
          <CurrencyDisplay amount={progress.currency} light />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Packages */}
        <div>
          <h3 className="font-heading text-xl font-bold text-foreground mb-3">Наборы</h3>
          <div className="space-y-3">
            {packages.map(pkg => (
              <div key={pkg.name} className="bg-card rounded-2xl overflow-hidden shadow-md">
                <div className={`bg-gradient-to-br ${pkg.gradient} p-4`}>
                  <h4 className="text-white font-bold text-xl">{pkg.name}</h4>
                  <p className="text-white/80 text-sm mt-1">
                    {pkg.gems} гемов + {pkg.boosters} бустеров{pkg.lives ? ` + ${pkg.lives} жизней` : ''}
                  </p>
                </div>
                <div className="p-4">
                  <Button className="w-full" size="sm">
                    {pkg.price === 'Бесплатно' ? 'Забрать' : `${pkg.price} T`}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Boosters */}
        <div>
          <h3 className="font-heading text-xl font-bold text-foreground mb-3">Бустеры</h3>
          <div className="grid grid-cols-3 gap-3">
            {boosters.map(b => (
              <button
                key={b.name}
                className="bg-card rounded-2xl p-3 text-center shadow-md"
                onClick={() => spendCurrency(b.price)}
              >
                <div
                  className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center"
                  style={{ backgroundColor: b.color }}
                >
                  <b.icon size={24} className="text-white" />
                </div>
                <p className="text-xs font-bold text-foreground">{b.name}</p>
                <p className="text-xs text-termo-gold font-bold mt-1">{b.price} T</p>
              </button>
            ))}
          </div>
        </div>

        {/* NFT promo */}
        <div className="bg-gradient-to-br from-secondary to-[#D4C5A0] rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/30 flex items-center justify-center">
              <Star size={24} className="text-foreground" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-foreground">NFT-Коллекция</h4>
              <p className="text-muted-foreground text-sm">Скоро: уникальные предметы</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
