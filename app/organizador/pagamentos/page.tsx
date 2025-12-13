"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// LEGACY – conteúdo vive em Finanças & Pagamentos (tab=finance)
export default function PaymentsLegacyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", "finance");
    router.replace(`/organizador?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-white">
      <p className="text-sm text-white/70">
        Pagamentos foi integrado na tab Finanças & Pagamentos. A redirecionar…
      </p>
    </div>
  );
}
