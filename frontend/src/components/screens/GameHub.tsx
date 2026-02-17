import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, User, Coins } from 'lucide-react';
import { useGameContext } from '@/store/GameContext';

// Positions measured from 704x1520 source image → % of image
const portals = [
  { id: '2048',    path: '/games/2048',    x: 27.3, y: 31, w: 30, h: 13, glow: 'rgba(106,171,218,0.3)' },
  { id: 'bubbles', path: '/games/bubbles', x: 73.2, y: 30.3, w: 30, h: 13, glow: 'rgba(155,126,200,0.3)' },
  { id: 'pet',     path: '/games/pet',     x: 26.3, y: 51.2, w: 33, h: 14, glow: 'rgba(212,149,106,0.3)' },
  { id: 'match3',  path: '/games/match3',  x: 74.6, y: 51.1, w: 33, h: 14, glow: 'rgba(93,184,121,0.3)' },
] as const;

export function GameHub() {
  const navigate = useNavigate();
  const { progress } = useGameContext();
  const cartCount = progress.cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="h-full relative bg-[#080c08] overflow-hidden">
      {/*
        Image wrapper — contains BOTH the image and clickable zones.
        Zones are % of this wrapper, so they always match the image.
        top: -5% shifts the whole thing up together.
      */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: '-5%',
          /* image aspect: 1520/704 = 215.9%, so height = 215.9% of width */
          paddingBottom: '215.9%',
        }}
      >
        <img
          src="/images/ui/app-bg.jpg"
          alt="Термбург"
          className="absolute inset-0 w-full h-full"
          draggable={false}
        />

        {/* Portal hotspots — positioned relative to image */}
        {portals.map((portal, i) => (
          <motion.button
            key={portal.id}
            className="absolute rounded-[50%] z-10"
            style={{
              left: `${portal.x}%`,
              top: `${portal.y}%`,
              width: `${portal.w}%`,
              height: `${portal.h}%`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            onClick={() => navigate(portal.path)}
          >
            <div
              className="absolute inset-0 rounded-[50%] animate-pulse"
              style={{ boxShadow: `0 0 18px 4px ${portal.glow}` }}
            />
          </motion.button>
        ))}

        {/* House — Termliny collection */}
        <motion.button
          className="absolute rounded-xl z-10"
          style={{
            left: '50.7%',
            top: '78.6%',
            width: '58%',
            height: '17%',
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={() => navigate('/collection')}
        >
          <div
            className="absolute inset-0 rounded-xl animate-pulse"
            style={{ boxShadow: '0 0 16px 3px rgba(218,201,154,0.2)' }}
          />
        </motion.button>
      </div>

      {/* Dark gradient for top UI */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent z-20" />

      {/* Floating UI */}
      <div className="absolute top-7 left-4 right-4 flex items-center justify-between z-30">
        <motion.div
          className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-primary/30 rounded-full px-3 py-1.5"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Coins size={14} className="text-primary" />
          <span className="text-primary font-bold text-sm">{progress.currency}</span>
        </motion.div>

        <div className="flex items-center gap-2">
          <motion.button
            className="relative bg-black/50 backdrop-blur-sm border border-white/20 rounded-full p-2.5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/shop')}
          >
            <ShoppingBag size={16} className="text-white/80" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </motion.button>
          <motion.button
            className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-full p-2.5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/profile')}
          >
            <User size={16} className="text-white/80" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
