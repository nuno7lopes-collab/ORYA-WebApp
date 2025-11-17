"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export default function LoginPage() {
  const searchParams = useSearchParams();

  const redirectParam = searchParams.get("redirect");
  const reason = searchParams.get("reason");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleUrl, setGoogleUrl] = useState("");

  // Mensagem contextual dependendo da razão pela qual veio para o login
  const contextMessage = (() => {
    if (reason === "checkout") {
      return "Para continuares o checkout e garantires o teu bilhete, precisas primeiro de entrar na tua conta ORYA.";
    }
    if (reason === "protected") {
      return "Esta área é reservada a utilizadores com sessão iniciada. Faz login para continuar.";
    }
    return null;
  })();

  useEffect(() => {
    if (typeof window !== "undefined" && BASE_URL) {
      // Construir URL do callback com redirect + reason (se existirem)
      const callbackUrl = new URL("/auth/callback", window.location.origin);

      if (redirectParam) {
        callbackUrl.searchParams.set("redirect", redirectParam);
      }
      if (reason) {
        callbackUrl.searchParams.set("reason", reason);
      }

      const url = `${BASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
        callbackUrl.toString(),
      )}`;

      setGoogleUrl(url);
    }
  }, [redirectParam, reason]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Preenche o email e a password.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const msg =
          (data && typeof data.error === "string" && data.error) ||
          `Não foi possível iniciar sessão (status ${res.status}).`;
        setError(msg);
        return;
      }

      // Login OK → redirecionar:
      // 1) Se houver redirect na query, usar esse URL (pode ser absoluto ou relativo).
      // 2) Caso contrário, ir para /me.
      if (redirectParam) {
        window.location.href = redirectParam;
      } else {
        window.location.href = "/me";
      }
    } catch (err) {
      console.error("[login] Erro de rede:", err);
      setError("Erro de rede. Tenta outra vez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="orya-body-bg min-h-screen w-full text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10 md:px-6 lg:px-8">
        <div className="grid w-full items-center gap-8 md:grid-cols-[1.1fr_minmax(0,1fr)]">
          {/* Lado esquerdo – copy / contexto */}
          <div className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/60">
              Entrar na ORYA
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">
              A tua conta para{" "}
              <span className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
                planos reais
              </span>{" "}
              e eventos que não ficas a ver pelos stories.
            </h1>
            <p className="max-w-md text-sm text-white/70">
              Com a tua conta ORYA vais conseguir guardar bilhetes, acompanhar
              eventos onde vais estar e, no futuro, ver quem vai aos mesmos
              sítios que tu.
            </p>

            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/55">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1">
                <span className="text-[12px]">🎟️</span> Bilhetes ligados à tua
                conta
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1">
                <span className="text-[12px]">🔐</span> Login seguro via
                Supabase
              </span>
            </div>
          </div>

          {/* Card de login */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-[#FF8AD910] via-[#9BE7FF1F] to-[#020617f2] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.9)] backdrop-blur-2xl">
            <div className="mb-4 space-y-1">
              <h2 className="text-sm font-semibold text-white/95">
                Entrar na tua conta
              </h2>
              <p className="text-[11px] text-white/65">
                Usa o teu email e password OU entra com a tua conta Google.
              </p>
            </div>

            {/* Mensagem contextual (ex: vindo do checkout) */}
            {contextMessage && (
              <div className="mb-3 rounded-xl border border-[#6BFFFF]/50 bg-[#020617] px-3 py-2 text-[11px] text-[#E5FEFF]">
                {contextMessage}
              </div>
            )}

            {/* Erro global */}
            {error && (
              <div className="mb-3 rounded-xl border border-red-400/50 bg-red-500/15 px-3 py-2 text-[11px] text-red-50">
                {error}
              </div>
            )}

            {/* Botão Google */}
            <div className="mb-4">
              {googleUrl ? (
                <a
                  href={googleUrl}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/22 bg-black/40 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:border-white/40 hover:bg-black/70"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                    <span className="text-[11px] font-bold text-black">G</span>
                  </span>
                  <span>Continuar com Google</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-black/30 px-4 py-2.5 text-sm font-medium text-white/60"
                >
                  A preparar login com Google…
                </button>
              )}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-white/15" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                ou
              </span>
              <div className="h-px flex-1 bg-white/15" />
            </div>

            {/* Form login */}
            <form
              onSubmit={handleSubmit}
              className="space-y-3 text-[13px]"
              noValidate
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[11px] font-medium text-white/75"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="nome@exemplo.com"
                  className="w-full rounded-2xl border border-white/18 bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-medium text-white/75"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-white/18 bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/55">
                <span>Em breve: recuperar password direto da app.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_30px_rgba(107,255,255,0.6)] transition-transform hover:translate-y-[0.5px] hover:brightness-110 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? "A entrar..." : "Entrar"}
              </button>
            </form>

            <p className="mt-3 text-[10px] text-white/45">
              Ao entrar, assumes que és uma pessoa fixe e não vais estragar a
              vibe dos eventos. 🤝
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}