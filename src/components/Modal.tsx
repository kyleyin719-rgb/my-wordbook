import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  closeLabel?: string;
  dialogClassName?: string;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let scrollLockCount = 0;
let bodyOverflowBeforeLock = '';

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  closeLabel = 'Close dialog',
  dialogClassName = ''
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) return;

    const rememberFocusedElement = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) previouslyFocusedRef.current = event.target;
    };
    const rememberPointerTarget = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button, a, input, select, textarea, [tabindex]') : null;
      if (target) previouslyFocusedRef.current = target;
    };

    if (document.activeElement instanceof HTMLElement) previouslyFocusedRef.current = document.activeElement;
    document.addEventListener('focusin', rememberFocusedElement);
    document.addEventListener('pointerdown', rememberPointerTarget, true);
    return () => {
      document.removeEventListener('focusin', rememberFocusedElement);
      document.removeEventListener('pointerdown', rememberPointerTarget, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = previouslyFocusedRef.current;
    lockBodyScroll();

    const focusDialog = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (activeElement && dialogRef.current?.contains(activeElement)) return;
      const preferredTarget = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]');
      const firstTarget = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (preferredTarget ?? firstTarget ?? dialogRef.current)?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(element => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [dismissible, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-layer"
      onPointerDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-dialog ${dialogClassName}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label={closeLabel}
            className="modal-close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}
