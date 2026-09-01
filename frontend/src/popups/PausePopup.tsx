import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Volume2, VolumeX } from 'lucide-react';

interface PausePopupProps {
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function PausePopup({ open, onResume, onRestart, onQuit, soundEnabled, onToggleSound }: PausePopupProps) {
  return (
    <Modal open={open}>
      <div className="text-center space-y-4">
        <h2 className="font-heading text-2xl text-primary font-bold">Пауза</h2>
        <div className="space-y-2">
          <Button onClick={onResume} className="w-full">Продолжить</Button>
          <Button variant="secondary" onClick={onToggleSound} className="w-full gap-2" aria-pressed={soundEnabled}>
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            Звук: {soundEnabled ? 'включён' : 'выключен'}
          </Button>
          <Button variant="secondary" onClick={onRestart} className="w-full">Заново</Button>
          <Button variant="ghost" onClick={onQuit} className="w-full">Выйти</Button>
        </div>
      </div>
    </Modal>
  );
}
