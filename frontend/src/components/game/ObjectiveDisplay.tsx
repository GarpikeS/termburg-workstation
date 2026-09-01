import type { Objective } from '@/types/game';
import { TOKEN_COLORS } from '@/types/game';
import { TokenIcon } from '@/components/ui/TokenIcon';

interface ObjectiveDisplayProps {
  objectives: Objective[];
}

export function ObjectiveDisplay({ objectives }: ObjectiveDisplayProps) {
  return (
    <div className="flex gap-3 justify-center">
      {objectives.map((obj, i) => {
        const done = obj.current >= obj.target;
        const color = TOKEN_COLORS[obj.type];
        return (
          <div key={i} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: `${color}30` }}
            >
              <TokenIcon type={obj.type} className="h-5 w-5" />
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: done ? '#5DB879' : '#D9CBA1' }}
            >
              {Math.min(obj.current, obj.target)}/{obj.target}
            </span>
          </div>
        );
      })}
    </div>
  );
}
