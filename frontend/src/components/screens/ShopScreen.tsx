import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { getUnlockedCharacters } from '@/data/characters';
import { cn } from '@/utils/cn';

export function ShopScreen() {
  const navigate = useNavigate();
  const { progress, selectCharacter } = useGameContext();
  const unlockedChars = getUnlockedCharacters(progress.currentLevel);

  return (
    <div className="h-full flex flex-col bg-game-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => navigate('/menu')}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-dark-surface-warm/60 text-white/70 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="font-heading text-lg text-white">Персонажи</h2>
        <CurrencyDisplay amount={progress.currency} />
      </div>

      {/* Characters */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-2">
          {unlockedChars.map(char => {
            const isSelected = progress.selectedCharacter === char.id;
            return (
              <button
                key={char.id}
                onClick={() => selectCharacter(char.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl transition-all',
                  isSelected
                    ? 'bg-primary/20 border-2 border-primary'
                    : 'bg-dark-surface-warm border-2 border-transparent hover:border-primary/30',
                )}
              >
                <div className="w-16 h-16 rounded-full bg-dark-surface overflow-hidden">
                  <img src={char.image} alt={char.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-white font-heading text-sm">{char.name}</span>
                <span className="text-white/40 text-xs text-center">{char.description}</span>
                {isSelected && (
                  <span className="text-primary text-xs font-medium">Выбран</span>
                )}
              </button>
            );
          })}
        </div>

        {unlockedChars.length < 7 && (
          <p className="text-white/30 text-xs text-center mt-4">
            Проходи уровни, чтобы открыть новых персонажей
          </p>
        )}
      </div>

      <div className="px-4 pb-4">
        <Button onClick={() => navigate('/menu')} className="w-full">
          Назад в меню
        </Button>
      </div>
    </div>
  );
}
