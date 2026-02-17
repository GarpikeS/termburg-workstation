import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Droplets, Sparkles } from 'lucide-react';

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/menu'), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#7FA99B] to-[#4A7C59] cursor-pointer relative overflow-hidden"
      onClick={() => navigate('/menu')}
    >
      {/* Floating decorative icons */}
      <motion.div
        className="absolute top-[30%] left-[15%] text-white/20"
        animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Droplets size={64} />
      </motion.div>
      <motion.div
        className="absolute top-[25%] right-[15%] text-white/20"
        animate={{ y: [0, -15, 0], rotate: [0, -10, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <Sparkles size={48} />
      </motion.div>

      {/* Logo */}
      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center shadow-2xl">
          <Droplets size={64} className="text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white font-heading">Термлины</h1>
          <p className="text-white/90 text-lg mt-2 px-8">Wellness match-3 игра</p>
        </div>
      </motion.div>

      {/* Loading dots */}
      <div className="absolute bottom-16 flex gap-3">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-white rounded-full"
            animate={{ scale: [0.8, 1, 0.8], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}
