"use client";

import Link from "next/link";

export default function OrganizerScanPlaceholder() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12 text-center text-white">
      <div className="max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Scanner</p>
        <h1 className="text-2xl font-semibold">Scanner em breve</h1>
        <p className="text-white/70">
          Estamos a otimizar o check-in dedicado para organizadores. Em breve vais poder validar bilhetes aqui.
        </p>
        <div className="flex justify-center">
          <Link
            href="/organizador"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01]"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
