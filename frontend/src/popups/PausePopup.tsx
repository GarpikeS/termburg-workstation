import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface PausePopupProps {
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PausePopup({ open, onResume, onRestart, onQuit }: PausePopupProps) {
  return (
    <Modal open={open}>
      <div className="text-center space-y-4">
        <h2 className="font-heading text-2xl text-primary font-bold">Пауза</h2>
        <div className="space-y-2">
          <Button onClick={onResume} className="w-full">Продолжить</Button>
          <Button variant="secondary" onClick={onRestart} className="w-full">Заново</Button>
          <Button variant="ghost" onClick={onQuit} className="w-full">Выйти</Button>
        </div>
      </div>
    </Modal>
  );
}
