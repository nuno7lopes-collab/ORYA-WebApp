"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
} from "react";
import { cn } from "@/lib/utils";

// Sidebar: base compacta e responsiva, sem forçar colagem ao topo/rodapé
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;
const STORAGE_KEY = "orya_sidebar_width";
const WIDTH_VAR = "var(--orya-sidebar-width, 240px)";

const clampWidth = (value: number) => Math.min(Math.max(value, MIN_WIDTH), MAX_WIDTH);

const readStoredWidth = () => {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return clampWidth(parsed);
    }
  } catch {
    /* ignore */
  }
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${STORAGE_KEY}=([^;]+)`));
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) return clampWidth(parsed);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDTH;
};

type SidebarContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  width: number;
  setWidth: (value: number) => void;
  ready: boolean;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children, defaultOpen = true }: { children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [width, setWidthState] = useState<number>(() => readStoredWidth());
  const [ready, setReady] = useState(false);

  const applyWidth = useCallback((value: number) => {
    const clamped = clampWidth(value);
    setWidthState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
      document.cookie = `${STORAGE_KEY}=${clamped}; path=/; SameSite=Lax; Max-Age=31536000`;
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--orya-sidebar-width", `${clamped}px`);
      window.dispatchEvent(new CustomEvent("orya:sidebar-width", { detail: clamped }));
    }
  }, []);

  useEffect(() => {
    applyWidth(width);
    setReady(true);
    try {
      window.dispatchEvent(new Event("orya:sidebar-ready"));
    } catch {
      /* ignore */
    }
  }, [applyWidth, width]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const setWidth = useCallback((value: number) => applyWidth(value), [applyWidth]);

  const value = useMemo(
    () => ({ open, setOpen, toggle, width, setWidth, ready }),
    [open, toggle, width, setWidth, ready],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("Sidebar components must be used within SidebarProvider");
  return ctx;
}

export function SidebarInset({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 flex flex-col min-h-screen transition-[margin,padding] duration-200 ease-out",
        "lg:pl-6 pb-6 pt-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SidebarTrigger({ className, ...props }: HTMLAttributes<HTMLButtonElement>) {
  const { toggle, open } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Fechar sidebar" : "Abrir sidebar"}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:border-white/30 hover:bg-white/10",
        className,
      )}
      {...props}
    >
      <div className="relative h-4 w-4">
        <span className="absolute inset-x-0 top-0 h-[2px] rounded-full bg-current" />
        <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-current" />
        <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-current" />
      </div>
    </button>
  );
}

export function SidebarRail({ children, className }: { children: ReactNode; className?: string }) {
  const { width, setWidth, ready, open, setOpen } = useSidebar();
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!dragStart.current) return;
      const delta = event.clientX - dragStart.current.x;
      setWidth(dragStart.current.width + delta);
    },
    [setWidth],
  );

  const stopDrag = useCallback(() => {
    dragStart.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stopDrag);
  }, [onMouseMove]);

  const startDrag = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      dragStart.current = { x: event.clientX, width };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", stopDrag);
    },
    [onMouseMove, stopDrag, width],
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        suppressHydrationWarning
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[80vw] max-w-sm flex-col overflow-hidden bg-white/5 backdrop-blur-2xl border-r border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:sticky lg:top-0 lg:min-h-screen lg:h-auto lg:max-h-none lg:flex lg:self-stretch",
          className,
        )}
        style={{
          width: WIDTH_VAR,
          minWidth: WIDTH_VAR,
          maxWidth: WIDTH_VAR,
        }}
        data-tour="sidebar-rail"
      >
        <div className="relative flex h-full min-h-full w-full flex-col overflow-y-auto pt-6 pb-8">
          {ready ? (
            children
          ) : (
            <div className="h-full w-full space-y-4 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 rounded-full bg-white/10" />
                  <div className="h-4 w-24 rounded-full bg-white/15" />
                </div>
              </div>
              <div className="h-10 w-full rounded-xl bg-white/5" />
              <div className="h-10 w-full rounded-xl bg-white/5" />
              <div className="h-10 w-3/4 rounded-xl bg-white/5" />
              <div className="h-10 w-full rounded-xl bg-white/5" />
              <div className="h-10 w-2/3 rounded-xl bg-white/5" />
            </div>
          )}
          {/* Espaçador invisível para o fundo da sidebar estender mesmo em páginas longas */}
          <div className="pointer-events-none h-[200vh] w-full" aria-hidden />
          <div
            onMouseDown={startDrag}
            className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-white/5 active:bg-white/10"
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar sidebar"
          />
        </div>
      </aside>
    </>
  );
}
