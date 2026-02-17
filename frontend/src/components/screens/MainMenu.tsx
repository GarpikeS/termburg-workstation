import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { getCharacterById } from '@/data/characters';

export function MainMenu() {
  const navigate = useNavigate();
  const { progress } = useGameContext();
  const character = getCharacterById(progress.selectedCharacter);

  return (
    <div className="h-full flex flex-col items-center justify-center bg-game-bg px-4">
      <div className="absolute top-4 right-4">
        <CurrencyDisplay amount={progress.currency} />
      </div>

      <div className="space-y-8 text-center">
        <h1 className="font-heading text-4xl text-primary">Термлины</h1>

        {character && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-dark-surface-warm border-2 border-primary/30 overflow-hidden">
              <img src={character.image} alt={character.name} className="w-full h-full object-cover" />
            </div>
            <span className="text-white/60 text-sm">{character.name}</span>
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={() => navigate('/map')} className="w-48">
            Играть
          </Button>
          <Button variant="secondary" onClick={() => navigate('/shop')} className="w-48">
            Магазин
          </Button>
        </div>
      </div>
    </div>
  );
}
