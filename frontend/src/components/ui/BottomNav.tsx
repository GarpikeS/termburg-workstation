import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Gamepad2, ShoppingBag, Users, User, Building2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useGameContext } from '@/store/GameContext';

const tabs = [
  { path: '/games', icon: Gamepad2, label: 'Игры' },
  { path: '/bathhouses', icon: Building2, label: 'Термбурги' },
  { path: '/shop', icon: ShoppingBag, label: 'Магазин', badge: true },
  { path: '/collection', icon: Users, label: 'Термлины' },
  { path: '/profile', icon: User, label: 'Профиль' },
];

const HIDDEN_PREFIXES = ['/games/match3', '/games/2048', '/games/bubbles', '/games/pet'];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { progress } = useGameContext();

  const hidden = location.pathname === '/' ||
    HIDDEN_PREFIXES.some(p => location.pathname.startsWith(p));

  if (hidden) return null;

  const cartCount = progress.cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border z-40"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
    >
      <div className="flex items-center justify-around px-4 py-3">
        {tabs.map(tab => {
          const active = location.pathname === tab.path ||
            (tab.path === '/games' && location.pathname.startsWith('/games')) ||
            (tab.path === '/bathhouses' && location.pathname.startsWith('/bathhouses')) ||
            (tab.path === '/shop' && location.pathname.startsWith('/shop')) ||
            (tab.path === '/collection' && location.pathname.startsWith('/collection'));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors relative',
                active ? 'text-primary' : 'text-white/50 hover:text-white/80',
              )}
            >
              <div className="relative">
                <tab.icon size={20} />
                {tab.badge && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
              {active && (
                <motion.div
                  className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full"
                  layoutId="activeTab"
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="gold-separator" />
    </motion.div>
  );
}
