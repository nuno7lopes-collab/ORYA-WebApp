"use client";

import { useEffect } from "react";

const APPLE_MAPKIT_SRC = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
const MAPKIT_READY_EVENT = "orya:apple-mapkit-ready";

export function AppleMapsLoader() {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof window === "undefined") return;
      const readyMapkit = (window as any).mapkit;
      if (readyMapkit?.Map) {
        window.dispatchEvent(new CustomEvent(MAPKIT_READY_EVENT));
        return;
      }

      const res = await fetch("/api/maps/apple-token");
      const data = await res.json().catch(() => null);
      if (!data?.ok || !data?.token) return;

      const initMapkit = () => {
        const mapkit = (window as any).mapkit;
        if (!mapkit) return;
        try {
          mapkit.init({
            authorizationCallback: (done: (token: string) => void) => done(data.token),
          });
          window.dispatchEvent(new CustomEvent(MAPKIT_READY_EVENT));
        } catch {
          // ignore
        }
      };

      const existingScript = document.querySelector<HTMLScriptElement>('script[data-orya-mapkit="1"]');
      if (existingScript) {
        if ((window as any).mapkit?.Map) {
          initMapkit();
          return;
        }
        existingScript.addEventListener("load", initMapkit, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = APPLE_MAPKIT_SRC;
      script.async = true;
      script.dataset.oryaMapkit = "1";
      script.onload = () => {
        if (cancelled) return;
        initMapkit();
      };
      document.head.appendChild(script);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
