import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ObjectiveDisplay } from '@/components/game/ObjectiveDisplay';
import type { LevelConfig } from '@/types/game';

interface LevelStartPopupProps {
  open: boolean;
  config: LevelConfig;
  onStart: () => void;
  onBack: () => void;
}

export function LevelStartPopup({ open, config, onStart, onBack }: LevelStartPopupProps) {
  const objectives = config.objectives.map(o => ({ ...o, current: 0 }));

  return (
    <Modal open={open}>
      <div className="text-center space-y-4">
        <h2 className="font-heading text-2xl text-primary font-bold">{config.name}</h2>
        <p className="text-white/50 text-sm">Уровень {config.id}</p>

        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wider">Собери</p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <ObjectiveDisplay objectives={objectives} />
          </div>
        </div>

        <p className="text-white/50 text-sm">{config.moves} ходов</p>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onBack} className="flex-1">Назад</Button>
          <Button onClick={onStart} className="flex-1">Играть</Button>
        </div>
      </div>
    </Modal>
  );
}
