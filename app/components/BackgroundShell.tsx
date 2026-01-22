"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BACKGROUND_CATALOG } from "@/lib/theme/catalog";

const ORG_PREFIXES = ["/organizacao"];
const EVENT_PREFIXES = ["/eventos/", "/resale/", "/inscricoes/"];
const EVENT_EDITOR_PREFIXES = [
  "/organizacao/eventos/",
  "/organizacao/torneios/",
  "/organizacao/padel/torneios/",
  "/organizacao/padel/mix/",
];
const LANDING_PREFIXES = ["/landing"];

type BackgroundKey = "orya-bg-user" | "orya-bg-event" | "orya-bg-org" | "orya-bg-landing";

type BackgroundPreset = {
  color: string;
  image: string;
  overlay: string;
  overlayOpacity: number;
  skeletonSurface: string;
  skeletonSurfaceStrong: string;
};

const USER_BG_PRESET: BackgroundPreset = {
  color: "#0b1020",
  image:
    "radial-gradient(circle at 18% 18%, rgba(110, 140, 255, 0.28), transparent 55%), radial-gradient(circle at 78% 22%, rgba(255, 122, 205, 0.2), transparent 55%), radial-gradient(circle at 35% 85%, rgba(72, 255, 229, 0.12), transparent 60%), linear-gradient(160deg, #0a0f1e 0%, #0f1428 48%, #0b1020 100%)",
  overlay:
    "linear-gradient(180deg, rgba(10, 12, 24, 0.15) 0%, rgba(6, 8, 18, 0.6) 58%, rgba(4, 6, 14, 0.92) 100%)",
  overlayOpacity: 0.92,
  skeletonSurface:
    "radial-gradient(circle at 20% 18%, rgba(110, 140, 255, 0.2), transparent 55%), radial-gradient(circle at 86% 16%, rgba(255, 122, 205, 0.16), transparent 60%), linear-gradient(160deg, rgba(12, 18, 34, 0.86) 0%, rgba(7, 10, 22, 0.95) 58%, rgba(5, 8, 16, 0.99) 100%)",
  skeletonSurfaceStrong:
    "radial-gradient(circle at 20% 18%, rgba(110, 140, 255, 0.14), transparent 55%), radial-gradient(circle at 86% 16%, rgba(255, 122, 205, 0.12), transparent 60%), linear-gradient(160deg, rgba(10, 16, 30, 0.92) 0%, rgba(6, 9, 18, 0.98) 60%, rgba(4, 6, 12, 1) 100%)",
};

const LANDING_BG_PRESET: BackgroundPreset = {
  color: "#010103",
  image:
    "linear-gradient(90deg, rgba(255, 95, 215, 0.38) 0%, rgba(122, 77, 255, 0.48) 35%, rgba(76, 109, 255, 0.42) 70%, rgba(255, 95, 215, 0.38) 100%)",
  overlay:
    "radial-gradient(circle at 20% 50%, rgba(255, 95, 215, 0.22), transparent 60%), radial-gradient(circle at 80% 50%, rgba(76, 109, 255, 0.22), transparent 60%), radial-gradient(circle at 50% 20%, rgba(94, 246, 255, 0.16), transparent 55%), radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 0%, rgba(1, 1, 3, 0.82) 60%, rgba(0, 0, 0, 0.98) 100%)",
  overlayOpacity: 1,
  skeletonSurface:
    "linear-gradient(160deg, rgba(6, 6, 10, 0.96) 0%, rgba(3, 3, 6, 0.99) 100%)",
  skeletonSurfaceStrong:
    "linear-gradient(160deg, rgba(4, 4, 8, 0.98) 0%, rgba(2, 2, 5, 1) 100%)",
};

type BackgroundLayerPreset = Pick<BackgroundPreset, "color" | "image" | "overlay" | "overlayOpacity">;

const getCatalogLayerPreset = (id: string): BackgroundLayerPreset | null => {
  const preset = BACKGROUND_CATALOG.find((item) => item.id === id);
  if (!preset) return null;
  return {
    color: preset.color,
    image: preset.image,
    overlay: preset.overlay,
    overlayOpacity: preset.overlayOpacity,
  };
};

const EVENT_BLUR_PRESET = getCatalogLayerPreset("event-cover-blur");
const LANDING_FLOW_PRESET = getCatalogLayerPreset("landing-flow");

const BG_PRESETS: Record<BackgroundKey, BackgroundPreset> = {
  "orya-bg-user": USER_BG_PRESET,
  "orya-bg-event": USER_BG_PRESET,
  "orya-bg-org": USER_BG_PRESET,
  "orya-bg-landing": LANDING_BG_PRESET,
};

const isEventBlurRoute = (pathname: string | null) => {
  const current = pathname ?? "";
  if (current === "/eventos" || current === "/eventos/") return false;
  if (EVENT_PREFIXES.some((route) => current.startsWith(route))) return true;
  return EVENT_EDITOR_PREFIXES.some((route) => current.startsWith(route));
};

const getBackgroundClass = (pathname: string | null): BackgroundKey => {
  const current = pathname ?? "";

  if (isEventBlurRoute(current)) {
    return "orya-bg-event";
  }

  if (ORG_PREFIXES.some((route) => current.startsWith(route))) {
    return "orya-bg-org";
  }

  if (LANDING_PREFIXES.some((route) => current.startsWith(route))) {
    return "orya-bg-landing";
  }

  return "orya-bg-user";
};

export function BackgroundShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bgClass = getBackgroundClass(pathname);
  const preset = BG_PRESETS[bgClass];
  const routeOverride =
    bgClass === "orya-bg-landing"
      ? LANDING_FLOW_PRESET
      : bgClass === "orya-bg-event"
        ? EVENT_BLUR_PRESET
        : null;

  const layerStyle: CSSProperties =
    routeOverride
      ? {
          backgroundColor: routeOverride.color,
          backgroundImage: routeOverride.image,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {
          backgroundColor: `var(--theme-bg-color, ${preset.color})`,
          backgroundImage: `var(--theme-bg-image, ${preset.image})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "center",
        };

  const overlayStyle: CSSProperties =
    routeOverride
      ? { backgroundImage: routeOverride.overlay, opacity: routeOverride.overlayOpacity }
      : {
          backgroundImage: `var(--theme-bg-overlay, ${preset.overlay})`,
          opacity: `var(--theme-bg-overlay-opacity, ${preset.overlayOpacity})`,
        };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const classList = body.classList;
    classList.remove("orya-bg-user", "orya-bg-event", "orya-bg-org", "orya-bg-landing");
    classList.add(bgClass);
    body.dataset.oryaBg = bgClass;
    return () => {
      classList.remove(bgClass);
      if (body.dataset.oryaBg === bgClass) {
        delete body.dataset.oryaBg;
      }
    };
  }, [bgClass]);

  return (
    <div className="relative min-h-screen flex flex-col">
      <div
        className="orya-bg-layer inset-0 z-0 pointer-events-none"
        style={layerStyle}
        aria-hidden="true"
      >
        <div className="absolute inset-0" style={overlayStyle} />
      </div>
      <div className="relative z-10 min-h-screen flex flex-col">{children}</div>
    </div>
  );
}
