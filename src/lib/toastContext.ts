import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error';
export type ToastContextValue = (message: string, tone?: ToastTone) => void;

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error('ToastProvider is missing');
  return showToast;
}
