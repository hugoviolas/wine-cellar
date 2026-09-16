'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ToastContextValue } from './interfaces/toast-context-value.interface';
import type { ToastMessage } from './interfaces/toast-message.interface';
import type { ReactElement } from 'react';

const ToastContext = createContext<ToastContextValue | null>(null);

/** Affiche une confirmation ou une erreur en popup temporaire (4s). */
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast doit être utilisé sous ToastProvider');
  }
  return ctx;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }): ReactElement => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const push = useCallback((type: ToastMessage['type'], text: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, type, text }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value: ToastContextValue = {
    success: (text) => push('success', text),
    error: (text) => push('error', text),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded px-4 py-2 text-sm shadow-md text-cream ${
              t.type === 'success' ? 'bg-forest' : 'bg-red-700'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
