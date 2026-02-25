import { motion } from 'motion/react';
import { MapPin, Phone, Clock, Sparkles } from 'lucide-react';
import { termburgLocations } from '@/data/termburgLocations';

export function BathhousesScreen() {
  return (
    <div className="h-full flex flex-col bg-dark-surface overflow-hidden">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="gold-separator mb-4" />
        <h1 className="font-heading text-xl font-bold text-primary tracking-[0.1em]">
          ТЕРМБУРГИ
        </h1>
        <p className="text-white/40 text-xs mt-1">Наши термальные комплексы</p>
      </div>

      <div className="gold-separator" />

      {/* Locations list */}
      <div className="flex-1 overflow-y-auto phone-scroll px-4 py-4 pb-28">
        {termburgLocations.map((location, idx) => (
          <motion.div
            key={location.id}
            className="relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            {/* Color accent top bar */}
            <div
              className="h-2 w-full"
              style={{ backgroundColor: location.color }}
            />

            {/* Header with logo */}
            <div className="p-4 pb-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${location.color}30` }}
                >
                  <span className="text-2xl">🏛️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-white/10 text-white/50"
                    >
                      {location.city}
                    </span>
                  </div>
                  <h3 className="text-white text-base font-semibold mt-1">
                    {location.name}
                  </h3>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="px-4 pb-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-white/70 text-sm leading-tight">
                  {location.address}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Phone size={14} className="text-primary flex-shrink-0" />
                <a
                  href={`tel:${location.phone.replace(/[\s()-]/g, '')}`}
                  className="text-white/70 text-sm hover:text-primary transition-colors"
                >
                  {location.phone}
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Clock size={14} className="text-primary flex-shrink-0" />
                <p className="text-white/70 text-sm">
                  {location.workHours}
                </p>
              </div>

              {/* Features */}
              <div className="pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {location.features.map((feature, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/60"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom action */}
            <div className="px-4 pb-4">
              <a
                href="https://termburg.ceosivaev.ru"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{
                  backgroundColor: `${location.color}`,
                  color: '#1a1a1a',
                }}
              >
                <Sparkles size={16} />
                <span>Перейти на сайт</span>
              </a>
            </div>
          </motion.div>
        ))}

        {/* Promo banner */}
        <motion.div
          className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-4 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-primary font-semibold text-sm mb-1">
            Стресс долой — семья с тобой!
          </p>
          <p className="text-white/50 text-xs">
            Термбург — семейный термальный комплекс с множеством бань, бассейнов и зон отдыха для всей семьи.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
