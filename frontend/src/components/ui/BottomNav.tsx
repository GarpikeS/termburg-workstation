import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Play, Map, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/utils/cn';

const tabs = [
  { path: '/menu', icon: Play, label: 'Игра' },
  { path: '/map', icon: Map, label: 'Карта' },
  { path: '/shop', icon: ShoppingBag, label: 'Магазин' },
  { path: '/profile', icon: User, label: 'Профиль' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === '/' || location.pathname.startsWith('/game/')) return null;

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border z-40"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
    >
      <div className="flex items-center justify-around px-4 py-3">
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors relative',
                active ? 'text-primary' : 'text-white/50 hover:text-white/80',
              )}
            >
              <tab.icon size={20} />
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
