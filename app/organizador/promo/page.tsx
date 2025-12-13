"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// LEGACY – promo codes vivem agora dentro da tab Marketing (section=promos)
export default function PromoCodesLegacyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", "marketing");
    params.set("section", "promos");
    router.replace(`/organizador?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-white">
      <p className="text-sm text-white/70">
        A área de códigos promocionais vive agora em Marketing. A redirecionar…
      </p>
    </div>
  );
}
