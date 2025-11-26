"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function StaffLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, isLoading } = useUser();
  const { openModal } = useAuthModal();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = search.get("redirectTo") || "/staff/eventos";

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(redirectTo);
    }
  }, [user, isLoading, router, redirectTo]);

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (!identifier || !password) {
        setError("Preenche email/username e password.");
        return;
      }
      let emailToUse = identifier;
      if (!identifier.includes("@")) {
        const res = await fetch("/api/auth/resolve-identifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data?.email) {
          setError("Credenciais inválidas. Confirma username/email e password.");
          return;
        }
        emailToUse = data.email;
      }

      const { error: loginError } = await supabaseBrowser.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      router.replace(redirectTo);
    } catch (err) {
      console.error("staff/login error", err);
      setError("Não foi possível iniciar sessão.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <p>A carregar a tua sessão…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Modo Staff ORYA</h1>
          <p className="text-sm text-white/70">
            Entra com a tua conta ORYA para aceder à área de staff e fazer o
            check-in dos participantes nos eventos onde tens permissão.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            placeholder="email@exemplo.com ou @username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            placeholder="Palavra-passe"
          />
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={handleLogin}
          className="w-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "A entrar…" : "Entrar com a minha conta ORYA"}
        </button>

        <button
          type="button"
          onClick={() => openModal({ mode: "login", redirectTo })}
          className="w-full text-[12px] text-white/70 underline underline-offset-4"
        >
          Preferes usar o modal standard?
        </button>
      </div>
    </div>
  );
}
