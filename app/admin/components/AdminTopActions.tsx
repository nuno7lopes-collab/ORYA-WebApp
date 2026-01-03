"use client";

import Link from "next/link";
import { CsvExportButton } from "./CsvExportButton";

type AdminTopActionsProps = {
  showTicketsExport?: boolean;
  showPaymentsExport?: boolean;
};

export function AdminTopActions({ showTicketsExport, showPaymentsExport }: AdminTopActionsProps) {
  const linkBase =
    "inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 transition hover:border-white/25 hover:bg-white/10";

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <Link href="/admin/organizacoes" className={linkBase}>
        Organizações
      </Link>
      <Link href="/admin/eventos" className={linkBase}>
        Eventos
      </Link>
      <Link href="/admin/payments" className={linkBase}>
        Pagamentos
      </Link>
      <Link href="/admin/refunds" className={linkBase}>
        Refunds
      </Link>
      <Link href="/admin/tickets" className={linkBase}>
        Bilhetes
      </Link>
      <Link href="/admin/settings" className={linkBase}>
        Configurações
      </Link>
      {showTicketsExport && (
        <CsvExportButton href="/api/admin/tickets/export" label="Export CSV Tickets" />
      )}
      {showPaymentsExport && (
        <CsvExportButton href="/api/admin/payments/export" label="Export CSV Pagamentos" />
      )}
    </div>
  );
}
