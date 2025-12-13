"use client";

import Link from "next/link";

export function OrganizationActions({ organizerId }: { organizerId: number }) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Gestão da organização</h3>
        <p className="text-[12px] text-white/70">
          Transferências, convites e saída movidos para a página de Staff. Apagar organização está em Definições.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/organizador/staff${organizerId ? `?organizerId=${organizerId}` : ""}`}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:opacity-90"
        >
          Abrir Staff
        </Link>
        <Link
          href="/organizador/settings"
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          Ir a Definições
        </Link>
      </div>
    </div>
  );
}
