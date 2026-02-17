import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';

const packages = [
  { name: 'Классик', gems: 50, boosters: 3, lives: 0, price: 'Бесплатно' },
  { name: 'Премиум', gems: 200, boosters: 10, lives: 5, price: '99' },
  { name: 'VIP', gems: 500, boosters: 25, lives: 15, price: '299' },
];

const boosters = [
  { name: 'AI-Подсказка', icon: Sparkles, color: '#6AABDA', price: 20 },
  { name: 'Перемешать', icon: Zap, color: '#5DB879', price: 30 },
  { name: 'Уничтожить', icon: Star, color: '#D4956A', price: 50 },
];

export function ShopScreen() {
  const navigate = useNavigate();
  const { progress, spendCurrency } = useGameContext();

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/menu')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Магазин</h2>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-5">
        {/* Packages */}
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-primary mb-3">Наборы</h3>
          <div className="space-y-3">
            {packages.map(pkg => (
              <div key={pkg.name} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4">
                  <h4 className="text-white font-bold text-base">{pkg.name}</h4>
                  <p className="text-white/40 text-xs mt-1">
                    {pkg.gems} гемов + {pkg.boosters} бустеров{pkg.lives ? ` + ${pkg.lives} жизней` : ''}
                  </p>
                  <Button className="w-full mt-3" size="sm">
                    {pkg.price === 'Бесплатно' ? 'Забрать' : `${pkg.price} T`}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="gold-separator" />

        {/* Boosters */}
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-primary mb-3">Бустеры</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {boosters.map(b => (
              <button
                key={b.name}
                className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-3 text-center transition-all"
                onClick={() => spendCurrency(b.price)}
              >
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ backgroundColor: `${b.color}20` }}
                >
                  <b.icon size={22} style={{ color: b.color }} />
                </div>
                <p className="text-xs font-medium text-white/80">{b.name}</p>
                <p className="text-xs text-primary font-bold mt-1">{b.price} T</p>
              </button>
            ))}
          </div>
        </div>

        <div className="gold-separator" />

        {/* NFT promo */}
        <div className="bg-white/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Star size={18} className="text-primary" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm text-white/90">NFT-Коллекция</h4>
              <p className="text-white/40 text-xs">Скоро: уникальные предметы</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
