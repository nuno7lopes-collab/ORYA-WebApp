"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ORG_SHELL_GUTTER } from "@/app/org/_internal/core/layoutTokens";
import { buildOrgHref, parseOrgIdFromPathnameStrict, parseOrganizationId } from "@/lib/organizationIdUtils";

type State = "idle" | "loading" | "ok" | "error";

export default function VerifyOfficialEmailPage() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const token = search?.get("token");
  const organizationId = parseOrgIdFromPathnameStrict(pathname) ?? parseOrganizationId(search?.get("organizationId"));
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
          setMessage(json?.message || json?.error || json?.errorCode || "Não foi possível confirmar o email.");
          return;
        }
        setState("ok");
        setMessage("Email oficial confirmado.");
        setTimeout(() => {
          router.refresh();
          if (organizationId) {
            router.push(buildOrgHref(organizationId, "/overview"));
          } else {
            router.push("/org-hub/organizations");
          }
        }, 1200);
      } catch (err) {
        setState("error");
        setMessage("Erro inesperado a confirmar o email.");
      }
    };
    void confirm();
  }, [organizationId, token, router]);

  return (
    <div className={cn("org-clean-page w-full py-8 text-white", ORG_SHELL_GUTTER)} data-org-ui="clean-v1">
      <div className="org-clean-section space-y-3 p-6 text-center">
        <div className="org-clean-chip inline-flex items-center justify-center px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/78">
          Definições
        </div>
        <h1 className="text-2xl font-semibold">Verificar email oficial</h1>
        {state === "loading" && <p className="text-white/84">A confirmar token…</p>}
        {state === "ok" && <p className="text-emerald-300">Email confirmado. A redirecionar…</p>}
        {state === "error" && <p className="text-amber-300">{message || "Token inválido ou expirado."}</p>}
        <div className="flex justify-center">
          <button
            onClick={() =>
              router.push(organizationId ? buildOrgHref(organizationId, "/settings") : "/org-hub/organizations")
            }
            className="inline-flex items-center justify-center rounded-full border border-white/28 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/32"
          >
            Voltar a definições
          </button>
        </div>
      </div>
    </div>
  );
}
