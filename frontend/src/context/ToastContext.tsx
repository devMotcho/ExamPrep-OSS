import { useTranslation } from 'react-i18next';
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

// ── Individual Toast Item ────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error:   <AlertCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info:    <Info size={18} />,
};


interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  // Auto-dismiss
  useEffect(() => {
    const duration = toast.duration ?? 4000;
    timerRef.current = setTimeout(() => handleDismiss(), duration);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const getTitle = () => {
    switch (toast.type) {
      case 'success': return t('toast.success', 'Success');
      case 'error': return t('toast.error', 'Error');
      case 'warning': return t('toast.warning', 'Warning');
      case 'info': return 'Information';
      default: return 'Notification';
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success': return 'border-emerald-500/30';
      case 'error': return 'border-red-500/30';
      case 'warning': return 'border-amber-500/30';
      case 'info': return 'border-blue-500/30';
      default: return 'border-border/30';
    }
  };

  const getIconColor = () => {
    switch (toast.type) {
      case 'success': return 'text-emerald-500';
      case 'error': return 'text-red-500';
      case 'warning': return 'text-amber-500';
      case 'info': return 'text-blue-500';
      default: return 'text-foreground';
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 w-full md:max-w-sm rounded-xl px-4 py-3 shadow-lg',
        'transition-all duration-300 ease-in-out bg-card border',
        getBorderColor(),
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
      role="alert"
    >
      <span className={cn("shrink-0", getIconColor())}>
        {ICONS[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{getTitle()}</p>
        <p className="text-xs text-muted-foreground">{toast.message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity focus:outline-none"
        aria-label={t('toast.dismiss', 'Dismiss')}
      >
        <X size={14} className="text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
};

// ── Toaster (portal-style stack in bottom-right) ─────────────────────────────

const Toaster: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed z-[9999] flex flex-col gap-3 items-stretch md:items-end pointer-events-none top-[calc(var(--sat)+0.75rem)] inset-x-3 md:top-auto md:inset-x-auto md:bottom-6 md:right-6"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};

// ── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...opts, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};
