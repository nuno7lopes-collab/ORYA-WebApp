"use client";

import { useEffect, useState } from "react";

type TicketQrBoxProps = {
  qrToken: string | null;
  purchaseId: string;
};

const REFRESH_INTERVAL_MS = 15_000; // 15s

export default function TicketQrBox({ qrToken, purchaseId }: TicketQrBoxProps) {
  const [refreshKey, setRefreshKey] = useState(() => Date.now());

  useEffect(() => {
    if (!qrToken) return;

    const id = setInterval(() => {
      setRefreshKey(Date.now());
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [qrToken]);

  if (!qrToken) {
    return (
      <div
        className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-2xl border border-white/20 orya-skeleton-surface animate-pulse"
        aria-busy="true"
        aria-label="A carregar o QR do bilhete ORYA"
      >
        <div className="h-24 w-24 rounded-lg bg-white/15" />
        <p className="px-3 text-center text-[10px] text-white/70">
          A gerar o QR code deste bilhete… mantém esta página aberta.
        </p>
      </div>
    );
  }

  const qrSrc = `/api/qr/${qrToken}?t=${purchaseId}&r=${refreshKey}`;

  return (
    <div className="animate-[fadeIn_0.4s_ease-out]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrSrc}
        alt="QR Code ORYA"
        className="mx-auto h-64 w-64 rounded-2xl bg-white p-4 shadow-[0_0_45px_rgba(107,255,255,0.35)] border border-white/20 object-contain"
      />
    </div>
  );
}
