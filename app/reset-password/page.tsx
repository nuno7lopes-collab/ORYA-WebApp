"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Stage = "checking" | "ready" | "error" | "done";
const mapAuthErrorMessage = (message: string | null | undefined) => {
  if (!message) return message;
  const normalized = message.toLowerCase();
  if (
    normalized.includes("password is known to be weak") ||
    normalized.includes("weak and easy to guess") ||
    normalized.includes("weak_password")
  ) {
    return "A password não foi aceite pelo sistema de autenticação.";
  }
  return message;
};

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const tokenFromUrl = useMemo(
    () =>
      searchParams.get("code") ||
      searchParams.get("token") ||
      searchParams.get("access_token") ||
      null,
    [searchParams],
  );
  const refreshFromUrl = useMemo(() => searchParams.get("refresh_token"), [searchParams]);
  const hashParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.hash.replace(/^#/, ""));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setStage("checking");
      setError(null);

      const errorDesc =
        hashParams.get("error_description") ||
        hashParams.get("error") ||
        hashParams.get("error_code") ||
        null;
      if (errorDesc) {
        setError("Link inválido ou expirado. Pede um novo email de recuperação.");
        setStage("error");
        return;
      }

      let token: string | null = tokenFromUrl;
      let refreshToken: string | null = refreshFromUrl;

      if (typeof window !== "undefined" && !token) {
        token =
          hashParams.get("code") ||
          hashParams.get("token") ||
          hashParams.get("access_token");
      }
      if (typeof window !== "undefined" && !refreshToken) {
        refreshToken = hashParams.get("refresh_token");
      }

      if (!token) {
        if (!cancelled) {
          setError("Link inválido ou expirado. Pede novo email de recuperação.");
          setStage("error");
        }
        return;
      }

      try {
        const { error: sessionError } = refreshToken
          ? await supabaseBrowser.auth.setSession({
              access_token: token,
              refresh_token: refreshToken,
            })
          : await supabaseBrowser.auth.exchangeCodeForSession(token);

        if (sessionError) {
          throw sessionError;
        }
        if (!cancelled) {
          setStage("ready");
        }
      } catch (err) {
        console.error("[reset-password] exchange/setSession error", err);
        if (!cancelled) {
          setError("Link inválido ou expirado. Pede novo email de recuperação.");
          setStage("error");
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [tokenFromUrl, hashParams]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      setError("A password deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As passwords não coincidem.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabaseBrowser.auth.updateUser({ password });
      if (updateError) {
        setError(mapAuthErrorMessage(updateError.message) || "Não foi possível atualizar a password.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setStage("done");
      setTimeout(() => router.replace("/"), 1200);
    } catch (err) {
      console.error("[reset-password] update error", err);
      setError("Não foi possível atualizar a password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#7cf2ff]/20 blur-[120px]" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-[#ff7ddb]/15 blur-[140px]" />
        <div className="absolute bottom-[-60px] left-[30%] h-72 w-72 rounded-full bg-[#7b7bff]/12 blur-[120px]" />
      </div>

      <div className="relative orya-page-width flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-[0_30px_110px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:px-10 md:py-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/75">
            Recuperar acesso
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white">Escolhe a tua nova password</h1>
          <p className="mt-2 text-sm text-white/65">
            Link seguro com validade curta. Define uma password com pelo menos 6 caracteres.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            {stage === "checking" && (
              <p className="text-sm text-white/70">A validar o link de recuperação…</p>
            )}

            {stage === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-red-300">{error}</p>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition"
                >
                  Voltar ao início
                </button>
              </div>
            )}

            {(stage === "ready" || stage === "done") && (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs text-white/70">Nova password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#7cf2ff] focus:ring-1 focus:ring-[#7cf2ff]"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/70">Confirmar password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#7cf2ff] focus:ring-1 focus:ring-[#7cf2ff]"
                    placeholder="••••••••"
                  />
                </div>

                {error && !success && (
                  <p className="text-sm text-red-300">{error}</p>
                )}

                {success && (
                  <p className="text-sm text-emerald-300">
                    Password atualizada. Estamos a levar-te para a tua conta…
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#7cf2ff] via-[#7b7bff] to-[#ff7ddb] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_26px_rgba(124,242,255,0.35)] transition hover:scale-[1.01] disabled:opacity-60"
                  >
                    {loading ? "A guardar…" : "Guardar nova password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center text-white">
          <p className="text-sm text-white/70">A carregar…</p>
        </main>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
