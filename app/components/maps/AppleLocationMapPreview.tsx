"use client";

import { useEffect, useRef, useState } from "react";

type AppleLocationMapPreviewProps = {
  lat: number;
  lng: number;
  label: string;
};

const MAPKIT_READY_EVENT = "orya:apple-mapkit-ready";

export function AppleLocationMapPreview({ lat, lng, label }: AppleLocationMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const markerRef = useRef<any | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const mapsUrl = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(label)}`;

  useEffect(() => {
    const root = mapRef.current;
    if (!root) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const renderMap = () => {
      if (cancelled) return false;
      const mapkit = (window as unknown as { mapkit?: any }).mapkit;
      if (!mapkit?.Map || !mapkit?.Coordinate || !mapkit?.CoordinateRegion || !mapkit?.CoordinateSpan) {
        return false;
      }

      try {
        if (!mapInstanceRef.current) {
          root.innerHTML = "";
          mapInstanceRef.current = new mapkit.Map(root, {
            isRotationEnabled: false,
            isPitchEnabled: false,
            showsMapTypeControl: false,
            showsCompass: mapkit.FeatureVisibility?.Hidden,
          });
        }

        const center = new mapkit.Coordinate(lat, lng);
        mapInstanceRef.current.region = new mapkit.CoordinateRegion(center, new mapkit.CoordinateSpan(0.014, 0.014));

        if (markerRef.current) {
          mapInstanceRef.current.removeAnnotation?.(markerRef.current);
        }
        markerRef.current = new mapkit.MarkerAnnotation(center, { title: label || "Local do evento" });
        mapInstanceRef.current.addAnnotation?.(markerRef.current);
        setShowFallback(false);
        return true;
      } catch {
        return false;
      }
    };

    const tryRender = () => {
      if (renderMap()) return;
      retryCount += 1;
      if (retryCount >= 8) {
        setShowFallback(true);
        return;
      }
      retryTimer = setTimeout(tryRender, 250);
    };

    tryRender();
    const handleReady = () => {
      retryCount = 0;
      tryRender();
    };
    window.addEventListener(MAPKIT_READY_EVENT, handleReady);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener(MAPKIT_READY_EVENT, handleReady);
    };
  }, [lat, lng, label]);

  useEffect(() => {
    return () => {
      try {
        mapInstanceRef.current?.destroy?.();
      } catch {
        // ignore
      }
      mapInstanceRef.current = null;
      markerRef.current = null;
      if (mapRef.current) mapRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-white/12 bg-black/35">
      <div
        ref={mapRef}
        className="h-48 w-full bg-[radial-gradient(circle_at_20%_20%,rgba(107,255,255,0.18),transparent_45%),linear-gradient(140deg,#0d1422,#0a0d16)]"
      />
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2 text-[11px] text-white/65">
        <span>Pré-visualização do local</span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-2 py-1 font-semibold text-white/80 hover:border-white/40"
        >
          Abrir no Apple Maps
        </a>
      </div>
      {showFallback && (
        <p className="px-3 pb-3 text-[11px] text-white/60">
          O preview interativo não está disponível neste browser, mas o local já está selecionado.
        </p>
      )}
    </div>
  );
}
