import { Sparkles } from 'lucide-react';
import { useGameContext } from '@/store/GameContext';
import { getTermlinById, ELEMENT_COLORS } from '@/data/termliny';

type GameKey = 'match3' | 'game2048' | 'bubbles' | 'pet';

export function CharacterAbilityBar({ game }: { game: GameKey }) {
  const { progress } = useGameContext();
  const character = getTermlinById(progress.selectedCharacter);
  if (!character) return null;

  const color = ELEMENT_COLORS[character.element] ?? '#BA9B4F';
  const abilityText = character.ability[game];
  if (!abilityText) return null;

  return (
    <div
      className="character-ability-bar flex items-center gap-3 px-4 py-3 border-t bg-black/50 backdrop-blur-sm"
      style={{ borderColor: `${color}30` }}
    >
      <img
        src={character.image}
        alt={character.name}
        className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
        style={{ borderColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} style={{ color }} className="flex-shrink-0" />
          <span className="text-sm font-bold" style={{ color }}>
            {character.ability.name}
          </span>
        </div>
        <p className="text-white/50 text-xs mt-0.5">{abilityText}</p>
      </div>
    </div>
  );
}
