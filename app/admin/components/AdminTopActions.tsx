"use client";

import Link from "next/link";
import { CsvExportButton } from "./CsvExportButton";

type AdminTopActionsProps = {
  showTicketsExport?: boolean;
  showPaymentsExport?: boolean;
};

export function AdminTopActions({ showTicketsExport, showPaymentsExport }: AdminTopActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <Link
        href="/admin/organizadores"
        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
      >
        Organizadores
      </Link>
      <Link
        href="/admin/eventos"
        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
      >
        Eventos
      </Link>
      <Link
        href="/admin/payments"
        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
      >
        Pagamentos
      </Link>
      <Link
        href="/admin/tickets"
        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
      >
        Bilhetes
      </Link>
      <Link
        href="/admin/settings"
        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
      >
        Configurações
      </Link>
      {showTicketsExport && <CsvExportButton href="/api/admin/tickets/export" label="Export CSV Tickets" />}
      {showPaymentsExport && <CsvExportButton href="/api/admin/payments/export" label="Export CSV Pagamentos" />}
    </div>
  );
}
