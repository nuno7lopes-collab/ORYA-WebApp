"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// LEGACY – estatísticas vivem em Bilhetes & Vendas e Finanças
export default function OrganizerStatsLegacy() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", "sales");
    router.replace(`/organizador?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-white">
      <p className="text-sm text-white/70">
        Estatísticas foram integradas em Bilhetes &amp; Vendas e Finanças. A redirecionar…
      </p>
    </div>
  );
}
