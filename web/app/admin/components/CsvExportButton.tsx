"use client";

import { useState } from "react";

type CsvExportButtonProps = {
  href: string; // endpoint that returns CSV
  label?: string;
};

export function CsvExportButton({ href, label = "Exportar CSV" }: CsvExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    try {
      setLoading(true);
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha no download");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[CsvExport] erro exportando CSV", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-50"
    >
      {loading ? "A gerar..." : label}
    </button>
  );
}
