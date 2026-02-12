"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type PushToastOptions = {
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  pushToast: (message: string, options?: PushToastOptions) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClass: Record<ToastVariant, string> = {
  success: "border-emerald-400/50 bg-emerald-500/15 text-emerald-50",
  error: "border-red-400/50 bg-red-500/15 text-red-50",
  warning: "border-amber-300/60 bg-amber-500/15 text-amber-50",
  info: "border-cyan-300/50 bg-cyan-500/15 text-cyan-50",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, options?: PushToastOptions) => {
      if (!message || !message.trim()) return;
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const variant = options?.variant ?? "error";
      const durationMs = Number.isFinite(options?.durationMs) ? Math.max(1200, Number(options?.durationMs)) : 4200;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismissToast(id), durationMs);
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast,
      dismissToast,
    }),
    [dismissToast, pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-[calc(var(--org-topbar-height,0px)+12px)] z-[80] flex max-w-[92vw] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
              toneClass[toast.variant],
            )}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider.");
  }
  return ctx;
}
