import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ObjectiveDisplay } from '@/components/game/ObjectiveDisplay';
import type { LevelConfig } from '@/types/game';
import { getCharacterById } from '@/data/characters';

interface LevelStartPopupProps {
  open: boolean;
  config: LevelConfig;
  onStart: () => void;
  onBack: () => void;
}

export function LevelStartPopup({ open, config, onStart, onBack }: LevelStartPopupProps) {
  const character = getCharacterById(config.characterId);
  const objectives = config.objectives.map(o => ({ ...o, current: 0 }));

  return (
    <Modal open={open}>
      <div className="text-center space-y-4">
        <h2 className="font-heading text-2xl text-primary">Уровень {config.id}</h2>

        {character && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-dark-surface-warm overflow-hidden">
              <img src={character.image} alt={character.name} className="w-full h-full object-cover" />
            </div>
            <span className="text-white/70 text-sm">{character.name}</span>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-white/50 text-xs uppercase tracking-wider">Собери</p>
          <ObjectiveDisplay objectives={objectives} />
        </div>

        <p className="text-white/50 text-sm">{config.moves} ходов</p>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onBack} className="flex-1">
            Назад
          </Button>
          <Button onClick={onStart} className="flex-1">
            Играть
          </Button>
        </div>
      </div>
    </Modal>
  );
}
