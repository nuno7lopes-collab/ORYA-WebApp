"use client";

import { CsvExportButton } from "./CsvExportButton";

type AdminTopActionsProps = {
  showTicketsExport?: boolean;
  showPaymentsExport?: boolean;
};

export function AdminTopActions({ showTicketsExport, showPaymentsExport }: AdminTopActionsProps) {
  if (!showTicketsExport && !showPaymentsExport) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {showTicketsExport && (
        <CsvExportButton href="/api/admin/tickets/export" label="Exportar CSV Bilhetes" />
      )}
      {showPaymentsExport && (
        <CsvExportButton href="/api/admin/payments/export" label="Exportar CSV Pagamentos" />
      )}
    </div>
  );
}
