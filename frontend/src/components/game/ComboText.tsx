import type { AnimationPhase, SpecialType } from '@/types/game';
import { SpecialType as Special } from '@/types/game';

interface ComboTextProps {
  combo: number;
  score: number;
  phase: AnimationPhase;
  matchSize?: number;
  matchedCount?: number;
  sizeBonus?: number;
  isIntersection?: boolean;
  createdSpecial?: SpecialType;
  activatedSpecial?: SpecialType;
}

export function ComboText({
  combo,
  score,
  phase,
  matchSize = 0,
  matchedCount = 0,
  sizeBonus = 0,
  isIntersection = false,
  createdSpecial,
  activatedSpecial,
}: ComboTextProps) {
  if (phase === 'powerup' && activatedSpecial) {
    const powerUpText = activatedSpecial === Special.Helicopter
      ? 'Вертолётик летит к цели!'
      : 'Бочка взрывается!';

    return (
      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div
          className="rounded-2xl border border-primary/45 bg-black/75 px-4 py-2 text-center font-heading text-lg font-bold text-primary shadow-xl backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          {powerUpText}
        </div>
      </div>
    );
  }

  if (phase === 'match_hold' && matchSize >= 3) {
    const mainText = isIntersection
      ? `Пересечение: ${matchedCount} фишек!`
      : createdSpecial === Special.Helicopter
        ? 'Квадрат 2×2!'
        : matchSize > 3
          ? `${matchSize} в ряд!`
          : '3 в ряд';
    const specialText = createdSpecial === Special.Helicopter
      ? 'Формируется вертолётик…'
      : createdSpecial === Special.Barrel
        ? 'Формируется пороховая бочка…'
        : undefined;

    return (
      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div
          key={`match-${matchSize}-${matchedCount}-${sizeBonus}`}
          className="rounded-2xl border border-primary/45 bg-black/75 px-4 py-2 text-center shadow-xl backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="font-heading text-xl font-bold text-primary drop-shadow-lg">
            {mainText}
          </div>
          {specialText && (
            <div className="mt-0.5 text-sm font-bold text-yellow-200">
              {specialText}
            </div>
          )}
          {sizeBonus > 0 && (
            <div className="mt-0.5 text-xs font-bold text-yellow-100">
              Бонус +{sizeBonus}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'score' && createdSpecial && score > 0) {
    const readyText = createdSpecial === Special.Helicopter
      ? 'Вертолётик готов!'
      : 'Пороховая бочка готова!';

    return (
      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div
          className="rounded-2xl border border-primary/45 bg-black/75 px-4 py-2 text-center shadow-xl backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="font-heading text-xl font-bold text-primary drop-shadow-lg">
            {readyText}
          </div>
          <div className="mt-0.5 text-sm font-bold text-yellow-200">+{score}</div>
        </div>
      </div>
    );
  }

  if (phase !== 'score' || combo <= 0 || score <= 0) return null;
  const text = combo > 1 ? `+${score} ×${combo}` : `+${score}`;

  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        key={`${combo}-${score}-${sizeBonus}`}
        className="absolute flex flex-col items-center text-primary font-heading text-2xl font-bold animate-float-up drop-shadow-lg"
      >
        <span>{text}</span>
        {sizeBonus > 0 && (
          <span className="mt-0.5 text-xs text-yellow-200">включая бонус +{sizeBonus}</span>
        )}
      </div>
    </div>
  );
}
