"use client";

import { useEffect, useState } from "react";

type TicketLiveQrProps = {
  qrToken: string;
};

export default function TicketLiveQr({ qrToken }: TicketLiveQrProps) {
  const [refreshKey, setRefreshKey] = useState(() => Date.now());
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // Evitar hydration mismatch
  useEffect(() => {
    // Montamos o componente depois da hidratação para evitar desencontros entre SSR e cliente
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      setLoadedAt(null);
      setRefreshKey(Date.now());
    }, 15000);

    return () => clearInterval(interval);
  }, [mounted]);

  // Antes de montar no cliente → placeholder estático (SSR-safe)
  if (!mounted) {
    return (
      <div className="w-64 h-64 rounded-xl bg-white/10 animate-pulse" />
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <img
        key={refreshKey}
        src={`/api/qr/${qrToken}?r=${refreshKey}`}
        alt="QR Code ORYA"
        aria-label="Código QR do bilhete ORYA"
        loading="eager"
        className={`w-64 h-64 rounded-xl bg-white p-4 transition-opacity duration-500 ${
          loadedAt ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoadedAt(Date.now())}
      />

      <p className="text-[11px] text-white/50 font-medium">
        QR atualiza a cada 15s
      </p>
    </div>
  );
}
