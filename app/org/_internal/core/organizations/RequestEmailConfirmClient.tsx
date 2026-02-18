"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import OrgHubTopNav from "@/app/org/_internal/core/organizations/OrgHubTopNav";

type Props = {
  base: "join-requests" | "exit-requests";
  requestId: string;
  token: string;
};

type State = "loading" | "ok" | "error";

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.error === "string" && obj.error) return obj.error;
  if (typeof obj.message === "string" && obj.message) return obj.message;
  if (typeof obj.errorCode === "string" && obj.errorCode) return obj.errorCode;
  return null;
}

export default function RequestEmailConfirmClient({ base, requestId, token }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setState("loading");
      setMessage(null);
      try {
        const res = await fetch(
          resolveCanonicalOrgApiPath(`/api/org-hub/groups/${base}/${requestId}/email/confirm`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(extractErrorMessage(json) ?? "Não foi possível confirmar a operação.");
        }
        if (!cancelled) {
          setState("ok");
          setMessage("Operação confirmada.");
        }
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setMessage(err instanceof Error ? err.message : "Erro inesperado.");
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [base, requestId, token]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-white md:px-6">
      <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <OrgHubTopNav />
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/75">Grupos</p>
        <h1 className="mt-1 text-2xl font-semibold">Confirmação por email</h1>
        <p className="mt-2 text-sm text-white/75">
          {state === "loading"
            ? "A confirmar a operação..."
            : state === "ok"
              ? "A operação foi confirmada."
              : "Não foi possível confirmar a operação."}
        </p>

        {message && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              state === "ok"
                ? "border-emerald-300/40 bg-emerald-400/12 text-emerald-50"
                : state === "error"
                  ? "border-red-300/35 bg-red-500/10 text-red-100"
                  : "border-white/14 bg-white/6 text-white/80"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push("/org-hub/groups")}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55"
          >
            Ir para governança
          </button>
          <Link
            href="/org-hub/organizations"
            className="rounded-full border border-white/20 bg-white/8 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/14 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55"
          >
            Ver organizações
          </Link>
        </div>
      </section>
    </div>
  );
}
