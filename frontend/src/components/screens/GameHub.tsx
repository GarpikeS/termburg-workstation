import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useGameContext } from '@/store/GameContext';

// Positions measured from 768x1344 source image → % of image
const portals = [
  { id: 'slavich',  path: '/games/2048',    x: 26, y: 36, w: 28, h: 18, glow: 'rgba(106,171,218,0.4)' },  // Славич - голубой (вверх на 1/5)
  { id: 'biryulki', path: '/games/bubbles', x: 74, y: 36, w: 28, h: 18, glow: 'rgba(180,130,220,0.4)' },  // Бирюльки - фиолетовый (вверх на 1/5)
  { id: 'pestun',   path: '/games/pet',     x: 26, y: 65, w: 28, h: 18, glow: 'rgba(80,60,40,0.4)' },     // Пестун - зафиксирован
  { id: 'horovod',  path: '/games/match3',  x: 74, y: 65, w: 28, h: 18, glow: 'rgba(93,200,140,0.4)' },   // Хоровод - зафиксирован
] as const;

export function GameHub() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

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
          top: '-8%',
          /* image aspect: 768x1344 → 1344/768 = 175% */
          paddingBottom: '175%',
        }}
      >
        <img
          src="/images/ui/app-bg.png"
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
            <motion.div
              className="absolute rounded-[50%]"
              style={{
                inset: '-20%',
                background: `radial-gradient(ellipse at center, ${portal.glow} 0%, transparent 70%)`,
              }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.button>
        ))}

        {/* House — Termliny collection (избушка) */}
        <motion.button
          className="absolute z-10"
          style={{
            left: '50%',
            top: '87%',
            width: '70%',
            height: '27%',
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={() => navigate('/collection')}
        >
          <motion.div
            className="absolute rounded-[30%]"
            style={{
              inset: '-15%',
              background: 'radial-gradient(ellipse at center, rgba(255,200,100,0.25) 0%, transparent 70%)',
            }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.button>
      </div>

      {/* Dark gradient for top UI */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent z-20" />

      {/* Floating UI - веники */}
      <div className="absolute top-7 left-4 right-4 flex items-center justify-start z-30">
        <motion.div
          className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-primary/30 rounded-full px-3 py-1.5"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="text-base">🌿</span>
          <span className="text-primary font-bold text-sm">{progress.currency}</span>
        </motion.div>
      </div>
    </div>
  );
}
