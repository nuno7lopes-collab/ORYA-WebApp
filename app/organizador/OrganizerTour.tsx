"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

type Step = {
  id: string;
  title: string;
  body: string;
  anchor?: string;
  ctaLabel?: string;
  ctaAction?: { type: "navigate" | "next"; href?: string };
};

const steps: Step[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao painel de organizador",
    body: "Vamos guiar-te pelos pontos chave para lançares o teu primeiro evento em minutos.",
    ctaLabel: "Começar",
    ctaAction: { type: "next" },
  },
  {
    id: "org-switcher",
    title: "Organizações e troca rápida",
    body: "Aqui mudas entre organizações, crias uma nova ou voltas ao modo utilizador.",
    anchor: "[data-tour='org-switcher-button']",
    ctaLabel: "Seguinte",
    ctaAction: { type: "next" },
  },
  {
    id: "create-event",
    title: "Criar evento",
    body: "Usa templates de Padel ou eventos gerais e publica em minutos.",
    anchor: "[data-tour='criar-evento']",
    ctaLabel: "Seguinte",
    ctaAction: { type: "next" },
  },
  {
    id: "finance",
    title: "Finanças & Stripe",
    body: "Liga o Stripe/Connect, acompanha receita, payouts e alertas.",
    anchor: "[data-tour='finance']",
    ctaLabel: "Seguinte",
    ctaAction: { type: "next" },
  },
  {
    id: "marketing",
    title: "Marketing & códigos",
    body: "Códigos promocionais, boosts e partilha de links para vender mais rápido.",
    anchor: "[data-tour='marketing']",
    ctaLabel: "Seguinte",
    ctaAction: { type: "next" },
  },
  {
    id: "staff",
    title: "Equipa & acessos",
    body: "Convida staff, define papéis e controla quem faz check-in.",
    anchor: "[data-tour='staff']",
    ctaLabel: "Seguinte",
    ctaAction: { type: "next" },
  },
  {
    id: "overview",
    title: "KPIs e resumo",
    body: "Acompanha vendas, receita líquida e próximos passos logo no resumo.",
    anchor: "[data-tour='overview']",
    ctaLabel: "Seguinte",
    ctaAction: { type: "next" },
  },
  {
    id: "finish",
    title: "Pronto para lançar",
    body: "Completa Stripe, cria o evento e convida a equipa. Estamos aqui se precisares.",
    ctaLabel: "Terminar tour",
    ctaAction: { type: "next" },
  },
];

const TOUR_KEY = "orya_org_tour_seen_v2";
const TOUR_PROGRESS_KEY = "orya_org_tour_step_v2";
const TOUR_EVENT = "orya:startTour";
const SIDEBAR_WIDTH_EVENT = "orya:sidebar-width";
const SIDEBAR_READY_EVENT = "orya:sidebar-ready";

const anchorSelectors = (anchor?: string) => {
  if (!anchor) return [] as string[];
  const list = [anchor];
  if (anchor === "[data-tour='org-switcher']" || anchor === "[data-tour='org-switcher-button']") {
    list.push("[data-tour='org-switcher-button']", "[data-tour='org-switcher']");
  }
  // Fallback apenas quando há anchor definido
  list.push("[data-tour='sidebar-rail']");
  return list;
};

type OrganizerTourProps = {
  organizerId?: number | null;
};

export function OrganizerTour({ organizerId }: OrganizerTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);

  const tourKey = useMemo(
    () => (organizerId ? `${TOUR_KEY}:${organizerId}` : TOUR_KEY),
    [organizerId],
  );
  const progressKey = useMemo(
    () => (organizerId ? `${TOUR_PROGRESS_KEY}:${organizerId}` : TOUR_PROGRESS_KEY),
    [organizerId],
  );

  const shouldShow = mounted && open;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
      const seen = typeof window !== "undefined" ? localStorage.getItem(tourKey) : "1";
      if (!seen) {
        const savedStep = typeof window !== "undefined" ? Number(localStorage.getItem(progressKey)) : 0;
        if (Number.isFinite(savedStep) && savedStep > 0 && savedStep < steps.length) {
          setIndex(savedStep);
        }
        setOpen(true);
      }
      const handler = () => {
        localStorage.removeItem(tourKey);
        localStorage.removeItem(progressKey);
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
      const id = requestAnimationFrame(() => {
        setAnchorRect(null);
        setAnchorEl(null);
      });
      return () => cancelAnimationFrame(id);
    }

    let stopped = false;
    let observer: ResizeObserver | null = null;

    const tryResolve = () => {
      if (!shouldShow || stopped) return;
      const el = document.querySelector(step.anchor!);
      if (el) {
        const rect = el.getBoundingClientRect();
        setAnchorRect(rect);
        setAnchorEl(el);
        observer = new ResizeObserver(() => {
          const nextRect = el.getBoundingClientRect();
          setAnchorRect(nextRect);
        });
        observer.observe(el);
      } else {
        setAnchorRect(null);
        setAnchorEl(null);
        requestAnimationFrame(tryResolve);
      }
    };

    tryResolve();

    return () => {
      stopped = true;
      if (observer) observer.disconnect();
    };
  }, [shouldShow, step.anchor, pathname]);

  const goNext = () => {
    trackEvent("organizer_tour_next", { step: index });
    if (index < steps.length - 1) {
      setIndex((v) => {
        const next = v + 1;
        localStorage.setItem(progressKey, String(next));
        return next;
      });
    } else {
      finish();
    }
  };

  const finish = () => {
    trackEvent("organizer_tour_finish");
    localStorage.setItem(tourKey, "1");
    localStorage.removeItem(progressKey);
    setOpen(false);
  };

  useEffect(() => {
    if (shouldShow && anchorRect && step.anchor) {
      const selectors = anchorSelectors(step.anchor);
      const el = selectors.map((sel) => document.querySelector(sel)).find(Boolean);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [anchorRect, shouldShow, step.anchor]);

  useEffect(() => {
    if (!shouldShow) return;
    const handler = () => {
      if (!step.anchor) return;
      const el = document.querySelector(step.anchor);
      if (!el) return;
      setAnchorRect(el.getBoundingClientRect());
      setAnchorEl(el);
    };
    window.addEventListener(SIDEBAR_WIDTH_EVENT, handler);
    window.addEventListener(SIDEBAR_READY_EVENT, handler);
    return () => {
      window.removeEventListener(SIDEBAR_WIDTH_EVENT, handler);
      window.removeEventListener(SIDEBAR_READY_EVENT, handler);
    };
  }, [shouldShow, step.anchor]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.getElementById("tour-highlight-style")) {
      const style = document.createElement("style");
      style.id = "tour-highlight-style";
      style.textContent =
        ".tour-highlight-ring{position:relative;box-shadow:0 0 0 3px rgba(107,255,255,0.6),0 0 24px rgba(107,255,255,0.35);border-radius:14px;z-index:9999;}";
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!shouldShow) return;
    if (!anchorEl) return;
    anchorEl.classList.add("tour-highlight-ring");
    return () => {
      anchorEl.classList.remove("tour-highlight-ring");
    };
  }, [anchorEl, shouldShow, step.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finish();
      }
    };
    if (!shouldShow) return;
    window.addEventListener("keydown", onKey);
    return () => {
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
    const centerX = anchorRect.left + anchorRect.width / 2;
    const preferRight = centerX < viewport.width / 2;

    // Horizontal positioning: prefer ao lado do alvo, senão centra próximo
    if (preferRight) {
      cardLeft = Math.min(viewport.width - cardWidth - margin, anchorRect.right + margin);
    } else {
      cardLeft = Math.max(margin, anchorRect.left - cardWidth - margin);
    }

    // Vertical positioning: centrar relativamente ao alvo, com limites
    cardTop = Math.max(
      margin,
      Math.min(viewport.height - estimatedHeight - margin, anchorRect.top + anchorRect.height / 2 - estimatedHeight / 2),
    );

    const arrowX = preferRight
      ? Math.max(12, Math.min(cardWidth - 12, anchorRect.left - cardLeft))
      : Math.max(12, Math.min(cardWidth - 12, anchorRect.right - cardLeft));
    const arrowY = Math.max(12, Math.min(estimatedHeight - 12, anchorRect.top + anchorRect.height / 2 - cardTop));
    arrowPos = { x: arrowX, y: arrowY, side: preferRight ? "left" : "right" };
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
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(107,255,255,0.09),rgba(0,0,0,0)),rgba(5,9,21,0.7)] backdrop-blur-[9px] backdrop-saturate-[1.4]" />
      {highlightRect && (
        <div
          className="pointer-events-none absolute rounded-2xl"
          style={{
            left: highlightRect.left,
            top: highlightRect.top,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: "0 0 0 2px rgba(107,255,255,0.75), 0 0 24px rgba(107,255,255,0.35)",
            background: "radial-gradient(circle at center, rgba(107,255,255,0.08), rgba(7,11,19,0))",
          }}
        />
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
            className="absolute h-3 w-3 rotate-45 border border-white/15 bg-black/80"
            style={{
              left:
                arrowPos.side === "left"
                  ? -6
                  : arrowPos.side === "right"
                  ? cardWidth - 10
                  : Math.min(cardWidth - 10, Math.max(10, arrowPos.x - 6)),
              top:
                arrowPos.side === "top"
                  ? arrowPos.y
                  : arrowPos.side === "bottom"
                  ? undefined
                  : Math.min(estimatedHeight - 10, Math.max(10, arrowPos.y - 6)),
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
            {step.ctaLabel ? (
              <button
                onClick={() => {
                  if (step.ctaAction?.type === "navigate" && step.ctaAction.href) {
                    router.push(step.ctaAction.href);
                  }
                  goNext();
                }}
                className="rounded-full bg-white text-black px-4 py-1.5 font-semibold hover:scale-[1.01] active:scale-95 transition"
              >
                {step.ctaLabel}
              </button>
            ) : (
              <button
                onClick={goNext}
                className="rounded-full bg-white text-black px-4 py-1.5 font-semibold hover:scale-[1.01] active:scale-95 transition"
              >
                {index === steps.length - 1 ? "Terminar" : "Seguinte"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
