import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, { type = 'info', timeout = 3500 } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, message, type }]);
    if (timeout) setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), timeout);
    return id;
  }, []);

  const api = {
    info: (m, o) => push(m, { ...o, type: 'info' }),
    success: (m, o) => push(m, { ...o, type: 'success' }),
    error: (m, o) => push(m, { ...o, type: 'error', timeout: 6000 }),
    warn: (m, o) => push(m, { ...o, type: 'warn' }),
    dismiss: (id) => setItems((prev) => prev.filter((t) => t.id !== id)),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
        {items.map((t) => (
          <div key={t.id} onClick={() => api.dismiss(t.id)}
               style={{
                 background: { info: '#1d2531', success: '#1d7a4a', error: '#c24a4a', warn: '#c4922a' }[t.type],
                 color: '#fff', padding: '12px 16px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
                 boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                 animation: 'toast-in 0.2s ease-out',
               }}>
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in { from { transform: translateX(100%); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error('ToastProvider missing');
  return v;
}

// window 전역에서도 호출 가능하게 — Promise-based confirm 대체
let _toast = null;
export function registerGlobalToast(t) { _toast = t; }
export function toast(msg, opts) {
  if (_toast) return _toast.info(msg, opts);
  console.log('[toast]', msg);
}
