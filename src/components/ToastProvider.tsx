import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext, type ToastContextValue, type ToastTone } from '../lib/toastContext';

type ToastState = { id: number; message: string; tone: ToastTone } | null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<number | undefined>(undefined);
  const nextId = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showToast = useCallback<ToastContextValue>((message, tone = 'success') => {
    window.clearTimeout(timer.current);
    setToast({ id: ++nextId.current, message, tone });
    timer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  return <ToastContext.Provider value={showToast}>
    {children}
    {toast ? <div key={toast.id} className={`book-toast ${toast.tone === 'error' ? 'book-toast-error' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'} aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}>{toast.message}</div> : null}
  </ToastContext.Provider>;
}
