"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type State = "idle" | "loading" | "ok" | "error";

export default function VerifyOfficialEmailPage() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search?.get("token");
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
        const res = await fetch("/api/organizador/organizations/settings/official-email/confirm", {
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
        setTimeout(() => router.push("/organizador?tab=settings"), 1200);
      } catch (err) {
        setState("error");
        setMessage("Erro inesperado a confirmar o email.");
      }
    };
    void confirm();
  }, [token, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#050712] via-[#090f2b] to-[#0b132d] px-4 text-white">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-black/50 p-6 text-center shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
        <h1 className="text-2xl font-semibold">Verificar email oficial</h1>
        {state === "loading" && <p className="text-white/70">A confirmar token…</p>}
        {state === "ok" && <p className="text-emerald-300">Email confirmado. A redirecionar…</p>}
        {state === "error" && <p className="text-amber-300">{message || "Token inválido ou expirado."}</p>}
        <div className="flex justify-center">
          <button
            onClick={() => router.push("/organizador?tab=settings")}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:border-white/35"
          >
            Voltar ao dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
