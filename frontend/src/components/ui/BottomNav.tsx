import { useLocation, useNavigate } from 'react-router-dom';
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

const HIDDEN_PREFIXES = ['/games/match3', '/games/2048', '/games/bubbles', '/games/pet', '/shop/free-hour', '/schedule', '/account', '/legal'];

export function isBottomNavHidden(pathname: string) {
  return pathname === '/' || HIDDEN_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { progress } = useGameContext();

  if (isBottomNavHidden(location.pathname)) return null;

  const cartCount = progress.cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="bottom-nav bottom-nav--enter absolute bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border z-40">
      <div className="bottom-nav__items grid grid-cols-5 items-start">
        {tabs.map(tab => {
          const active = location.pathname === tab.path ||
            (tab.path === '/games' && location.pathname.startsWith('/games')) ||
            (tab.path === '/bathhouses' && location.pathname.startsWith('/bathhouses')) ||
            (tab.path === '/shop' && location.pathname.startsWith('/shop')) ||
            (tab.path === '/collection' && location.pathname.startsWith('/collection')) ||
            (tab.path === '/profile' && location.pathname.startsWith('/profile'));
          return (
            <button
              type="button"
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'min-w-0 min-h-12 flex flex-col items-center justify-center gap-1 px-1 py-1 rounded-lg transition-colors relative',
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
                <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
      <div className="gold-separator" />
    </div>
  );
}
