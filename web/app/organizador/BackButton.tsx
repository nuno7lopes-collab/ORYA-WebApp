"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  className?: string;
  hideOnRoot?: boolean;
};

export function BackButton({ className = "", hideOnRoot = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const target = useMemo(() => {
    if (!pathname?.startsWith("/organizador")) return null;
    const segments = pathname.split("/").filter(Boolean); // e.g., ["organizador", "promo", "evento", "123"]

    // Se estamos em /organizador com tabs/sections → volta ao overview ou à tab base
    if (segments.length <= 1) {
      const tab = searchParams?.get("tab");
      if (tab && tab !== "overview") {
        return `/organizador?tab=${tab}`;
      }
      return "/organizador";
    }

    // Rotas profundas → remove último segmento
    const trimmed = "/" + segments.slice(0, -1).join("/");
    return trimmed || "/organizador";
  }, [pathname, searchParams]);

  if (!target) return null;
  if (hideOnRoot && target === "/organizador" && (!searchParams?.get("tab") || searchParams.get("tab") === "overview")) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => router.push(target)}
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition ${className}`}
    >
      ← Voltar
    </button>
  );
}
