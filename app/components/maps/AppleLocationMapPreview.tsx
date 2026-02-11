"use client";

import { useEffect, useRef, useState } from "react";

type AppleLocationMapPreviewProps = {
  lat: number;
  lng: number;
  label: string;
};

export function AppleLocationMapPreview({ lat, lng, label }: AppleLocationMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const mapsUrl = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(label)}`;

  useEffect(() => {
    const root = mapRef.current;
    if (!root) return;

    const mapkit = (window as unknown as { mapkit?: any }).mapkit;
    if (!mapkit?.Map || !mapkit?.Coordinate || !mapkit?.CoordinateRegion || !mapkit?.CoordinateSpan) {
      setShowFallback(true);
      return;
    }

    setShowFallback(false);
    let map: any = null;
    try {
      root.innerHTML = "";
      const center = new mapkit.Coordinate(lat, lng);
      map = new mapkit.Map(root, {
        isRotationEnabled: false,
        isPitchEnabled: false,
        showsMapTypeControl: false,
        showsCompass: mapkit.FeatureVisibility?.Hidden,
      });
      map.region = new mapkit.CoordinateRegion(center, new mapkit.CoordinateSpan(0.014, 0.014));
      map.addAnnotation(new mapkit.MarkerAnnotation(center, { title: label || "Local do evento" }));
    } catch {
      setShowFallback(true);
    }

    return () => {
      try {
        map?.destroy?.();
      } catch {
        // ignore
      }
      if (root) root.innerHTML = "";
    };
  }, [lat, lng, label]);

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
