import React, { useEffect, useState } from 'react';
import { TOAST_EVENT, type ToastItem } from '../../lib/toast';
import { Notice } from './Notice';

/** Renders toasts pushed via lib/toast as a fixed stack (top-right). */
export const ToastHost: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const item = (e as CustomEvent<ToastItem>).detail;
      if (!item) return;
      setItems((prev) => [...prev.slice(-3), item]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== item.id)), 5000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="v-card-in" style={{ boxShadow: 'var(--shadow-visitors-card)', borderRadius: 12, background: '#fff' }}>
          <Notice tone={t.tone} onDismiss={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}>
            {t.text}
          </Notice>
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
