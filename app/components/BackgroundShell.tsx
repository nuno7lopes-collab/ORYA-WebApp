"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BACKGROUND_CATALOG } from "@/lib/theme/catalog";

const ORG_PREFIXES = ["/org", "/org-hub"];
const EVENT_NON_SLUG_SEGMENTS = new Set(["nova"]);
const LANDING_PREFIXES = ["/landing"];
const FUNDO_1_BG_IMAGE = "linear-gradient(180deg, #0b1014 0%, #0d1320 50%, #101826 100%)";

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
  color: "#0b1014",
  image: FUNDO_1_BG_IMAGE,
  overlay: "none",
  overlayOpacity: 1,
  skeletonSurface:
    "linear-gradient(180deg, rgba(14, 18, 24, 0.96) 0%, rgba(10, 13, 18, 0.98) 100%)",
  skeletonSurfaceStrong:
    "linear-gradient(180deg, rgba(10, 13, 18, 0.98) 0%, rgba(8, 10, 14, 1) 100%)",
};

const LANDING_BG_PRESET: BackgroundPreset = {
  color: "#0b1014",
  image: FUNDO_1_BG_IMAGE,
  overlay: "none",
  overlayOpacity: 1,
  skeletonSurface:
    "linear-gradient(180deg, rgba(14, 18, 24, 0.96) 0%, rgba(10, 13, 18, 0.98) 100%)",
  skeletonSurfaceStrong:
    "linear-gradient(180deg, rgba(10, 13, 18, 0.98) 0%, rgba(8, 10, 14, 1) 100%)",
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

const BG_PRESETS: Record<BackgroundKey, BackgroundPreset> = {
  "orya-bg-user": USER_BG_PRESET,
  "orya-bg-event": USER_BG_PRESET,
  "orya-bg-org": USER_BG_PRESET,
  "orya-bg-landing": LANDING_BG_PRESET,
};

const isEventCoverRoute = (pathname: string | null) => {
  const current = pathname ?? "";
  const segments = current.split("/").filter(Boolean);
  if (segments[0] !== "eventos") return false;
  if (!segments[1]) return false;
  return !EVENT_NON_SLUG_SEGMENTS.has(segments[1]);
};

const getBackgroundClass = (pathname: string | null): BackgroundKey => {
  const current = pathname ?? "";

  if (isEventCoverRoute(current)) {
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
  const routeOverride = bgClass === "orya-bg-event" ? EVENT_BLUR_PRESET : null;

  const layerStyle: CSSProperties = routeOverride
    ? {
        backgroundColor: routeOverride.color,
        backgroundImage: routeOverride.image,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundColor: preset.color,
        backgroundImage: preset.image,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
      };

  const overlayStyle: CSSProperties = routeOverride
    ? { backgroundImage: routeOverride.overlay, opacity: routeOverride.overlayOpacity }
    : { backgroundImage: preset.overlay, opacity: preset.overlayOpacity };

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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="orya-bg-layer inset-0 z-0 pointer-events-none"
        style={layerStyle}
        aria-hidden="true"
      >
        <div className="absolute inset-0" style={overlayStyle} />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
