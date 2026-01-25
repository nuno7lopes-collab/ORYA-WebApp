"use client";

import { useEffect } from "react";

const APPLE_MAPKIT_SRC = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";

export function AppleMapsLoader() {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof window === "undefined") return;
      if ((window as any).mapkit) return;

      const res = await fetch("/api/maps/apple-token");
      const data = await res.json().catch(() => null);
      if (!data?.ok || !data?.token) return;

      const script = document.createElement("script");
      script.src = APPLE_MAPKIT_SRC;
      script.async = true;
      script.onload = () => {
        if (cancelled) return;
        const mapkit = (window as any).mapkit;
        if (!mapkit) return;
        try {
          mapkit.init({
            authorizationCallback: (done: (token: string) => void) => done(data.token),
          });
        } catch {
          // ignore
        }
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
