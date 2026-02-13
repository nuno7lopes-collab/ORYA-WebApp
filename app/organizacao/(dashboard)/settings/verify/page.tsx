"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ORG_SHELL_GUTTER } from "@/app/organizacao/layoutTokens";
import { appendOrganizationIdToHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type State = "idle" | "loading" | "ok" | "error";

export default function VerifyOfficialEmailPage() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search?.get("token");
  const organizationId = parseOrganizationId(search?.get("organizationId"));
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Token em falta. Usa o link mais recente do email.");
      return;
    }
    const confirm = async () => {
      try {
        setState("loading");
        const res = await fetch(resolveCanonicalOrgApiPath("/api/org-hub/organizations/settings/official-email/confirm"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          setState("error");
          setMessage(json?.error || "Não foi possível confirmar o email.");
          return;
        }
        setState("ok");
        setMessage("Email oficial confirmado.");
        setTimeout(() => {
          router.refresh();
          router.push(appendOrganizationIdToHref("/organizacao", organizationId));
        }, 1200);
      } catch (err) {
        setState("error");
        setMessage("Erro inesperado a confirmar o email.");
      }
    };
    void confirm();
  }, [token, router]);

  return (
    <div className={cn("w-full py-8 text-white", ORG_SHELL_GUTTER)}>
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3">
        <div className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          Definições
        </div>
        <h1 className="text-2xl font-semibold">Verificar email oficial</h1>
        {state === "loading" && <p className="text-white/70">A confirmar token…</p>}
        {state === "ok" && <p className="text-emerald-300">Email confirmado. A redirecionar…</p>}
        {state === "error" && <p className="text-amber-300">{message || "Token inválido ou expirado."}</p>}
        <div className="flex justify-center">
          <button
            onClick={() => router.push(appendOrganizationIdToHref("/organizacao/settings", organizationId))}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:border-white/35"
          >
            Voltar a definições
          </button>
        </div>
      </div>
    </div>
  );
}
