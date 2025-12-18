"use client";

import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";

type Step = {
  title: string;
  body: string;
  anchor?: string;
};

const steps: Step[] = [
  {
    title: "Bem-vindo ao painel de organizador",
    body: "Aqui geres eventos, vendas, finanças e marketing num só lugar.",
  },
  {
    title: "Criar evento",
    body: "Começa sempre aqui. Usa templates de Padel ou eventos gerais e publica em minutos.",
    anchor: "[data-tour='criar-evento']",
  },
  {
    title: "Finanças & Stripe",
    body: "Liga o Stripe, acompanha receita e payouts. Se precisares de atenção, mostramos-te logo aqui.",
    anchor: "[data-tour='finance']",
  },
  {
    title: "Marketing & códigos",
    body: "Códigos promocionais e boosts para encher eventos mais rápido.",
    anchor: "[data-tour='marketing']",
  },
  {
    title: "Voltar à experiência de utilizador",
    body: "Podes ver sempre como o público vê os teus eventos e inscrições.",
    anchor: "[data-tour='user-experience']",
  },
];

const TOUR_KEY = "orya_org_tour_seen_v1";
const TOUR_EVENT = "orya:startTour";

export function OrganizerTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const shouldShow = mounted && open;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
      const seen = typeof window !== "undefined" ? localStorage.getItem(TOUR_KEY) : "1";
      if (!seen) setOpen(true);
      const handler = () => {
        localStorage.removeItem(TOUR_KEY);
        setIndex(0);
        setOpen(true);
      };
      window.addEventListener(TOUR_EVENT, handler);
      return () => window.removeEventListener(TOUR_EVENT, handler);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === "undefined") return;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const step = useMemo(() => steps[index], [index]);
  const isMobile = viewport.width < 768 && viewport.width > 0;

  useEffect(() => {
    if (!shouldShow) return;
    if (!step.anchor) {
      const id = requestAnimationFrame(() => setAnchorRect(null));
      return () => cancelAnimationFrame(id);
      return;
    }
    const el = document.querySelector(step.anchor);
    if (!el) {
      const id = requestAnimationFrame(() => setAnchorRect(null));
      return () => cancelAnimationFrame(id);
      return;
    }
    const rect = el.getBoundingClientRect();
    const id = requestAnimationFrame(() => setAnchorRect(rect));
    const observer = new ResizeObserver(() => {
      const nextRect = el.getBoundingClientRect();
      setAnchorRect(nextRect);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [shouldShow, step.anchor]);

  const goNext = () => {
    trackEvent("organizer_tour_next", { step: index });
    if (index < steps.length - 1) {
      setIndex((v) => v + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    trackEvent("organizer_tour_finish");
    localStorage.setItem(TOUR_KEY, "1");
    setOpen(false);
  };

  useEffect(() => {
    if (shouldShow && anchorRect && step.anchor) {
      const el = document.querySelector(step.anchor);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [anchorRect, shouldShow, step.anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finish();
      }
    };
    if (shouldShow) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKey);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [shouldShow]);

  useEffect(() => {
    if (!shouldShow) return;
    if (step.anchor !== "[data-tour='user-experience']") return;
    const el = document.querySelector(step.anchor);
    if (!el) return;
    const details = el.closest("details");
    if (!details) return;
    const hadOpen = details.hasAttribute("open");
    details.setAttribute("open", "true");
    return () => {
      if (!hadOpen) details.removeAttribute("open");
    };
  }, [shouldShow, step.anchor]);

  if (!shouldShow) return null;

  const cardWidth = isMobile ? viewport.width - 32 : Math.min(480, viewport.width - 32);
  const margin = 16;
  const estimatedHeight = isMobile ? 260 : 240;
  let cardLeft = (viewport.width - cardWidth) / 2;
  let cardTop = isMobile ? viewport.height - estimatedHeight - 24 : 96;
  let arrowPos: { x: number; y: number; side: "top" | "bottom" | "left" | "right" } | null = null;

  if (!isMobile && anchorRect) {
    const spaceBelow = viewport.height - anchorRect.bottom - margin;
    const spaceAbove = anchorRect.top - margin;
    const centerX = anchorRect.left + anchorRect.width / 2;
    cardLeft = Math.max(margin, Math.min(viewport.width - cardWidth - margin, centerX - cardWidth / 2));
    if (spaceBelow >= estimatedHeight) {
      cardTop = anchorRect.bottom + margin;
      arrowPos = { x: Math.min(cardWidth - 32, Math.max(32, centerX - cardLeft)), y: -12, side: "top" };
    } else if (spaceAbove >= estimatedHeight) {
      cardTop = Math.max(margin, anchorRect.top - estimatedHeight - margin);
      arrowPos = { x: Math.min(cardWidth - 32, Math.max(32, centerX - cardLeft)), y: estimatedHeight - 4, side: "bottom" };
    } else {
      cardTop = Math.max(margin, Math.min(viewport.height - estimatedHeight - margin, anchorRect.bottom + margin));
      arrowPos = { x: Math.min(cardWidth - 32, Math.max(32, centerX - cardLeft)), y: -12, side: "top" };
    }
  }

  const highlightPadding = 12;
  const highlightRect =
    anchorRect && viewport.width && viewport.height
      ? {
          left: Math.max(0, anchorRect.left - highlightPadding),
          top: Math.max(0, anchorRect.top - highlightPadding),
          width: Math.min(anchorRect.width + highlightPadding * 2, viewport.width - Math.max(0, anchorRect.left - highlightPadding)),
          height: Math.min(
            anchorRect.height + highlightPadding * 2,
            viewport.height - Math.max(0, anchorRect.top - highlightPadding)
          ),
        }
      : null;

  const rightWidth =
    highlightRect && viewport.width ? Math.max(0, viewport.width - (highlightRect.left + highlightRect.width)) : 0;
  const bottomHeight =
    highlightRect && viewport.height ? Math.max(0, viewport.height - (highlightRect.top + highlightRect.height)) : 0;

  return (
    <div className="fixed inset-0 z-[99] pointer-events-auto">
      {highlightRect ? (
        <>
          <div
            className="pointer-events-none absolute left-0 top-0 w-full bg-[radial-gradient(circle_at_30%_20%,rgba(107,255,255,0.09),rgba(0,0,0,0)),rgba(5,9,21,0.7)] backdrop-blur-[9px] backdrop-saturate-[1.4]"
            style={{ height: highlightRect.top }}
          />
          <div
            className="pointer-events-none absolute bg-[radial-gradient(circle_at_30%_20%,rgba(107,255,255,0.09),rgba(0,0,0,0)),rgba(5,9,21,0.7)] backdrop-blur-[9px] backdrop-saturate-[1.4]"
            style={{ left: 0, top: highlightRect.top, width: highlightRect.left, height: highlightRect.height }}
          />
          <div
            className="pointer-events-none absolute bg-[radial-gradient(circle_at_30%_20%,rgba(107,255,255,0.09),rgba(0,0,0,0)),rgba(5,9,21,0.7)] backdrop-blur-[9px] backdrop-saturate-[1.4]"
            style={{
              left: highlightRect.left + highlightRect.width,
              top: highlightRect.top,
              width: rightWidth,
              height: highlightRect.height,
            }}
          />
          <div
            className="pointer-events-none absolute left-0 bg-[radial-gradient(circle_at_30%_20%,rgba(107,255,255,0.09),rgba(0,0,0,0)),rgba(5,9,21,0.7)] backdrop-blur-[9px] backdrop-saturate-[1.4]"
            style={{ top: highlightRect.top + highlightRect.height, width: "100%", height: bottomHeight }}
          />
          {!isMobile && (
            <div
              className="absolute rounded-2xl pointer-events-none"
              style={{
                left: highlightRect.left,
                top: highlightRect.top,
                width: highlightRect.width,
                height: highlightRect.height,
                boxShadow: "0 0 0 1px rgba(107,255,255,0.45), 0 0 28px rgba(107,255,255,0.28)",
                background: "radial-gradient(circle at center, rgba(107,255,255,0.12), rgba(7,11,19,0))",
              }}
            />
          )}
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(107,255,255,0.09),rgba(0,0,0,0)),rgba(5,9,21,0.7)] backdrop-blur-[9px] backdrop-saturate-[1.4]" />
      )}
      <div
        className="absolute rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl p-5 shadow-[0_30px_120px_rgba(0,0,0,0.7)] pointer-events-auto"
        style={{
          width: cardWidth,
          left: cardLeft,
          top: cardTop,
          maxHeight: isMobile ? "70vh" : "60vh",
          overflow: "auto",
        }}
      >
        {!isMobile && arrowPos && (
          <div
            className={`absolute h-3 w-3 rotate-45 border border-white/15 bg-black/80`}
            style={{
              left: arrowPos.side === "top" || arrowPos.side === "bottom" ? arrowPos.x - 6 : arrowPos.side === "left" ? -6 : cardWidth - 10,
              top: arrowPos.side === "top" ? arrowPos.y : arrowPos.side === "bottom" ? undefined : cardTop + estimatedHeight / 2,
              bottom: arrowPos.side === "bottom" ? -6 : undefined,
            }}
          />
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Tour</p>
            <h3 className="text-lg font-semibold text-white">{step.title}</h3>
            <p className="text-sm text-white/80">{step.body}</p>
          </div>
          <button
            onClick={finish}
            className="text-white/60 hover:text-white rounded-full p-1 transition"
            aria-label="Fechar tour"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between text-[12px] text-white/60">
          <span>
            Passo {index + 1} / {steps.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={finish}
              className="rounded-full border border-white/20 px-3 py-1 text-white/75 hover:bg-white/10"
            >
              Saltar
            </button>
            <button
              onClick={goNext}
              className="rounded-full bg-white text-black px-4 py-1.5 font-semibold hover:scale-[1.01] active:scale-95 transition"
            >
              {index === steps.length - 1 ? "Terminar" : "Seguinte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
