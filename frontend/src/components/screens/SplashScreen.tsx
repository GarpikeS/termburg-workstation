import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Droplets, Sparkles } from 'lucide-react';

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/games'), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="h-full flex flex-col items-center justify-center bg-dark-surface cursor-pointer relative overflow-hidden ornament-pattern"
      onClick={() => navigate('/games')}
    >
      {/* Decorative floating icons */}
      <motion.div
        className="absolute top-[25%] left-[12%] text-primary/15"
        animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Droplets size={56} />
      </motion.div>
      <motion.div
        className="absolute top-[20%] right-[12%] text-primary/15"
        animate={{ y: [0, -15, 0], rotate: [0, -10, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <Sparkles size={42} />
      </motion.div>
      <motion.div
        className="absolute bottom-[30%] left-[25%] text-primary/10"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        <Droplets size={32} />
      </motion.div>

      {/* Gold top line */}
      <div className="absolute top-0 left-0 right-0 gold-separator" />

      {/* Logo */}
      <motion.div
        className="flex flex-col items-center gap-5 relative z-10"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Термбург logo */}
        <img
          src="/images/ui/splash-logo.svg"
          alt="Термбург"
          className="w-28 h-28"
        />
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary font-heading tracking-[0.15em]">
            ТЕРМБУРГ
          </h1>
          <p className="text-white/60 text-base mt-1 font-heading tracking-[0.2em]">
            ТЕРМЛИНЫ
          </p>
          <p className="text-white/30 text-[10px] mt-2 italic">
            Стресс долой — семья с тобой!
          </p>
        </div>
      </motion.div>

      {/* Loading dots */}
      <div className="absolute bottom-16 flex gap-3">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-primary rounded-full"
            animate={{ scale: [0.6, 1, 0.6], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>

      {/* Gold bottom line */}
      <div className="absolute bottom-0 left-0 right-0 gold-separator" />
    </div>
  );
}
