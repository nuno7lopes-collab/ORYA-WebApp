"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ORG_PREFIXES = ["/organizador", "/admin", "/staff", "/live"];
const EVENT_PREFIXES = ["/eventos/", "/resale/", "/inscricoes/"];
const ORG_EXCEPTIONS = ["/eventos/nova"];

type BackgroundKey = "orya-bg-user" | "orya-bg-event" | "orya-bg-org";

type BackgroundPreset = {
  color: string;
  image: string;
  overlay: string;
  overlayOpacity: number;
};

const BG_PRESETS: Record<BackgroundKey, BackgroundPreset> = {
  "orya-bg-user": {
    color: "#05060a",
    image:
      "radial-gradient(circle at 14% 18%, rgba(107, 255, 255, 0.18), transparent 46%), radial-gradient(circle at 82% 16%, rgba(255, 0, 200, 0.12), transparent 50%), radial-gradient(circle at 50% 85%, rgba(22, 70, 245, 0.18), transparent 55%), linear-gradient(160deg, #05060a 0%, #0b0f1f 45%, #060812 100%)",
    overlay:
      "linear-gradient(180deg, rgba(5, 6, 12, 0.2) 0%, rgba(3, 5, 10, 0.55) 55%, rgba(3, 5, 10, 0.85) 100%), radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.08), transparent 40%)",
    overlayOpacity: 0.9,
  },
  "orya-bg-event": {
    color: "#05060a",
    image:
      "radial-gradient(circle at 20% 20%, rgba(107, 255, 255, 0.22), transparent 48%), radial-gradient(circle at 78% 18%, rgba(22, 70, 245, 0.22), transparent 52%), radial-gradient(circle at 55% 82%, rgba(255, 0, 200, 0.1), transparent 56%), linear-gradient(150deg, #05060a 0%, #0a0f21 40%, #05060a 100%)",
    overlay:
      "linear-gradient(180deg, rgba(2, 4, 10, 0.25) 0%, rgba(2, 4, 10, 0.6) 55%, rgba(2, 4, 10, 0.9) 100%), radial-gradient(circle at 65% 15%, rgba(255, 255, 255, 0.06), transparent 45%)",
    overlayOpacity: 0.9,
  },
  "orya-bg-org": {
    color: "#05060a",
    image:
      "radial-gradient(circle at 18% 18%, rgba(107, 255, 255, 0.16), transparent 50%), radial-gradient(circle at 82% 28%, rgba(255, 0, 200, 0.1), transparent 52%), radial-gradient(circle at 50% 84%, rgba(22, 70, 245, 0.16), transparent 58%), linear-gradient(170deg, #05060a 0%, #0a0f1d 45%, #05060a 100%)",
    overlay:
      "linear-gradient(180deg, rgba(3, 5, 12, 0.25) 0%, rgba(3, 5, 12, 0.6) 60%, rgba(3, 5, 12, 0.88) 100%), radial-gradient(circle at 35% 10%, rgba(255, 255, 255, 0.05), transparent 42%)",
    overlayOpacity: 0.88,
  },
};

const getBackgroundClass = (pathname: string | null): BackgroundKey => {
  const current = pathname ?? "";

  if (ORG_EXCEPTIONS.some((route) => current.startsWith(route))) {
    return "orya-bg-org";
  }

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
    backgroundAttachment: "fixed",
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

  return (
    <div className="relative min-h-screen flex flex-col">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={layerStyle}
        aria-hidden="true"
      >
        <div className="absolute inset-0" style={overlayStyle} />
      </div>
      <div className="relative z-10 min-h-screen flex flex-col">{children}</div>
    </div>
  );
}
