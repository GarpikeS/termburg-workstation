import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  children: ReactNode;
  className?: string;
  onClose?: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({ open, children, className, onClose, ariaLabel, ariaLabelledBy, ariaDescribedBy }: ModalProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = rootRef.current;
    const siblings = root?.parentElement
      ? [...root.parentElement.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== root)
      : [];
    const siblingState = siblings.map(element => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }));
    for (const sibling of siblings) {
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const firstFocusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .find(element => element.getClientRects().length > 0);
      (firstFocusable ?? panel).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .filter(element => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown);
      for (const { element, inert, ariaHidden } of siblingState) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  const content = (
    <AnimatePresence>
      {open && (
        <div ref={rootRef} className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose ? () => onCloseRef.current?.() : undefined}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? 'Диалог')}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            tabIndex={-1}
            className={cn(
              'relative z-10 max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-dark-surface-warm p-6 shadow-2xl',
              className,
            )}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return content;
  const appScreen = document.querySelector('.phone-screen');
  return appScreen ? createPortal(content, appScreen) : content;
}
