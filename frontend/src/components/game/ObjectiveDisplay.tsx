import type { Objective } from '@/types/game';
import { TOKEN_COLORS } from '@/types/game';

interface ObjectiveDisplayProps {
  objectives: Objective[];
}

export function ObjectiveDisplay({ objectives }: ObjectiveDisplayProps) {
  return (
    <div className="flex gap-3 justify-center">
      {objectives.map((obj, i) => {
        const done = obj.current >= obj.target;
        return (
          <div key={i} className="flex items-center gap-1.5 bg-dark-surface-warm/60 rounded-lg px-2.5 py-1.5">
            <img
              src={`/images/tokens/${obj.type}.svg`}
              alt={obj.type}
              className="w-5 h-5"
            />
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: done ? '#5DB879' : TOKEN_COLORS[obj.type] }}
            >
              {Math.min(obj.current, obj.target)}/{obj.target}
            </span>
          </div>
        );
      })}
    </div>
  );
}
