import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { LivesDisplay } from '@/components/ui/LivesDisplay';
import { LIFE_PRICE, MAX_LIVES } from '@/store/lives';
import { Frown, HeartCrack } from 'lucide-react';

interface LosePopupProps {
  open: boolean;
  lives: number;
  currency: number;
  nextLifeAt: number | null;
  onRetry: () => void;
  onBuyLife: () => void;
  onMap: () => void;
}

export function LosePopup({
  open,
  lives,
  currency,
  nextLifeAt,
  onRetry,
  onBuyLife,
  onMap,
}: LosePopupProps) {
  const hasLives = lives > 0;
  const canBuyLife = lives < MAX_LIVES && currency >= LIFE_PRICE;

  return (
    <Modal open={open}>
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto">
          {hasLives
            ? <Frown size={36} className="text-white/30" />
            : <HeartCrack size={38} className="text-rose-400" />}
        </div>
        <h2 className="font-heading text-2xl text-white font-bold">
          {hasLives ? 'Не получилось' : 'Жизни закончились'}
        </h2>
        <p className="text-white/55">
          {hasLives
            ? 'Ходы закончились. Попробуй ещё раз!'
            : 'Новая жизнь появится через 15 минут — или купи одну прямо сейчас.'}
        </p>

        <LivesDisplay
          lives={lives}
          nextLifeAt={nextLifeAt}
          showTimer
          className="mx-auto justify-center bg-rose-950/35"
        />

        {lives < MAX_LIVES && (
          <div>
            <Button variant="outline" onClick={onBuyLife} disabled={!canBuyLife} className="w-full" data-buy-life>
              Купить +1 жизнь · {LIFE_PRICE} термокоинов
            </Button>
            {!canBuyLife && (
              <p className="mt-2 text-xs font-semibold text-amber-300">
                Для покупки не хватает {LIFE_PRICE - currency} термокоинов
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onMap} className="flex-1">Карта</Button>
          <Button onClick={onRetry} disabled={!hasLives} className="flex-1">Заново</Button>
        </div>
      </div>
    </Modal>
  );
}
