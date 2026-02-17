import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Frown } from 'lucide-react';

interface LosePopupProps {
  open: boolean;
  onRetry: () => void;
  onMap: () => void;
}

export function LosePopup({ open, onRetry, onMap }: LosePopupProps) {
  return (
    <Modal open={open}>
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
          <Frown size={36} className="text-muted-foreground" />
        </div>
        <h2 className="font-heading text-2xl text-foreground font-bold">Не получилось</h2>
        <p className="text-muted-foreground">Ходы закончились. Попробуй ещё раз!</p>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onMap} className="flex-1">Карта</Button>
          <Button onClick={onRetry} className="flex-1">Заново</Button>
        </div>
      </div>
    </Modal>
  );
}
