"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ORG_PREFIXES = ["/organizacao"];
const EVENT_PREFIXES = ["/eventos/", "/resale/", "/inscricoes/"];

type BackgroundKey = "orya-bg-user" | "orya-bg-event" | "orya-bg-org";

type BackgroundPreset = {
  color: string;
  image: string;
  overlay: string;
  overlayOpacity: number;
  skeletonSurface: string;
  skeletonSurfaceStrong: string;
};

const USER_BG_PRESET: BackgroundPreset = {
  color: "#05060a",
  image:
    "linear-gradient(180deg, rgba(120, 215, 255, 0.22) 0%, rgba(20, 40, 90, 0.12) 20%, rgba(5, 8, 16, 0) 38%), radial-gradient(circle at 14% 16%, rgba(107, 255, 255, 0.26), transparent 48%), radial-gradient(circle at 84% 14%, rgba(255, 0, 200, 0.16), transparent 52%), radial-gradient(circle at 50% 86%, rgba(22, 70, 245, 0.24), transparent 58%), linear-gradient(160deg, #05060a 0%, #0b0f1f 45%, #060812 100%)",
  overlay:
    "linear-gradient(180deg, rgba(120, 210, 255, 0.12) 0%, rgba(5, 8, 16, 0.45) 48%, rgba(3, 5, 10, 0.85) 100%), radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.12), transparent 38%)",
  overlayOpacity: 0.88,
  skeletonSurface:
    "radial-gradient(circle at 20% 18%, rgba(107, 255, 255, 0.16), transparent 55%), radial-gradient(circle at 86% 16%, rgba(255, 0, 200, 0.14), transparent 60%), linear-gradient(160deg, rgba(14, 24, 42, 0.82) 0%, rgba(7, 12, 22, 0.94) 58%, rgba(5, 8, 16, 0.98) 100%)",
  skeletonSurfaceStrong:
    "radial-gradient(circle at 20% 18%, rgba(107, 255, 255, 0.12), transparent 55%), radial-gradient(circle at 86% 16%, rgba(255, 0, 200, 0.1), transparent 60%), linear-gradient(160deg, rgba(10, 18, 32, 0.9) 0%, rgba(6, 10, 18, 0.97) 60%, rgba(4, 6, 12, 1) 100%)",
};

const BG_PRESETS: Record<BackgroundKey, BackgroundPreset> = {
  "orya-bg-user": USER_BG_PRESET,
  "orya-bg-event": USER_BG_PRESET,
  "orya-bg-org": USER_BG_PRESET,
};

const getBackgroundClass = (pathname: string | null): BackgroundKey => {
  const current = pathname ?? "";

  if (ORG_PREFIXES.some((route) => current.startsWith(route))) {
    return "orya-bg-org";
  }

  if (current === "/eventos" || current === "/eventos/") {
    return "orya-bg-user";
  }

  if (EVENT_PREFIXES.some((route) => current.startsWith(route))) {
    return "orya-bg-event";
  }

  return "orya-bg-user";
};

export function BackgroundShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bgClass = getBackgroundClass(pathname);
  const preset = BG_PRESETS[bgClass];

  const layerStyle: CSSProperties = {
    backgroundColor: preset.color,
    backgroundImage: preset.image,
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  const overlayStyle: CSSProperties = {
    backgroundImage: preset.overlay,
    opacity: preset.overlayOpacity,
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const classList = body.classList;
    classList.remove("orya-bg-user", "orya-bg-event", "orya-bg-org");
    classList.add(bgClass);
    body.dataset.oryaBg = bgClass;
    return () => {
      classList.remove(bgClass);
      if (body.dataset.oryaBg === bgClass) {
        delete body.dataset.oryaBg;
      }
    };
  }, [bgClass]);

  const shellStyle: CSSProperties = {
    ["--orya-skeleton-surface" as keyof CSSProperties]: preset.skeletonSurface,
    ["--orya-skeleton-surface-strong" as keyof CSSProperties]: preset.skeletonSurfaceStrong,
  };

  return (
    <div className="relative min-h-screen flex flex-col" style={shellStyle}>
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
