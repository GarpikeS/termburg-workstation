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

  // Don't show on splash or game screens
  if (location.pathname === '/' || location.pathname.startsWith('/game/')) return null;

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
    >
      <div className="flex items-center justify-around px-6 py-4 max-w-md mx-auto">
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors relative',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon size={22} />
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
    </motion.div>
  );
}
