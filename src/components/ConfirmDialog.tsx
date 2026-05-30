import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type ConfirmTone = 'danger' | 'warning' | 'neutral';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmState extends Required<ConfirmOptions> {
  resolve: (confirmed: boolean) => void;
}

const toneStyles: Record<ConfirmTone, {
  icon: string;
  confirm: string;
}> = {
  danger: {
    icon: 'bg-red-100 text-red-600',
    confirm: 'bg-red-600 text-white hover:bg-red-700',
  },
  warning: {
    icon: 'bg-amber-100 text-amber-700',
    confirm: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  neutral: {
    icon: 'bg-indigo-100 text-indigo-700',
    confirm: 'bg-indigo-600 text-white hover:bg-indigo-700',
  },
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const stateRef = useRef<ConfirmState | null>(null);

  const close = useCallback((confirmed: boolean) => {
    const current = stateRef.current;
    if (!current) return;

    stateRef.current = null;
    setState(null);
    current.resolve(confirmed);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const nextState: ConfirmState = {
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        tone: options.tone || 'neutral',
        resolve,
      };

      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const dialog = useMemo(() => {
    if (!state) return null;

    const styles = toneStyles[state.tone];

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          <div className="flex items-start gap-4 p-6">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-950">
                  {state.title}
                </h2>
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="-mr-1 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 text-gray-600">
                {state.message}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <button
              type="button"
              onClick={() => close(false)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              {state.cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${styles.confirm}`}
              autoFocus
            >
              {state.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }, [close, state]);

  return { confirm, dialog };
}
