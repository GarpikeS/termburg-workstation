import type { Objective } from '@/types/game';
import { TOKEN_COLORS } from '@/types/game';
import { Droplets, Leaf, Mountain, Wind, Flame, TreeDeciduous } from 'lucide-react';
import type { ComponentType } from 'react';

const GEM_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  water: Droplets, leaf: Leaf, stone: Mountain,
  steam: Wind, fire: Flame, wood: TreeDeciduous,
};

interface ObjectiveDisplayProps {
  objectives: Objective[];
}

export function ObjectiveDisplay({ objectives }: ObjectiveDisplayProps) {
  return (
    <div className="flex gap-3 justify-center">
      {objectives.map((obj, i) => {
        const done = obj.current >= obj.target;
        const Icon = GEM_ICONS[obj.type];
        return (
          <div key={i} className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: TOKEN_COLORS[obj.type] }}
            >
              {Icon && <Icon size={12} />}
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: done ? '#6EAA5E' : 'white' }}
            >
              {Math.min(obj.current, obj.target)}/{obj.target}
            </span>
          </div>
        );
      })}
    </div>
  );
}
