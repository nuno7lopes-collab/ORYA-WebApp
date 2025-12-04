// app/me/edit/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

type SaveBasicResponse = {
  ok: boolean;
  profile?: {
    id: string;
    username: string | null;
    fullName: string | null;
    onboardingDone: boolean;
  } | null;
  error?: string;
};

export default function EditProfilePage() {
  const sanitizeUsername = (value: string) =>
    value.replace(/[^A-Za-z]/g, "").slice(0, 16);

  const router = useRouter();
  const { user, profile, isLoading, mutate } = useUser();
  const { openModal } = useAuthModal();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [usernameHint, setUsernameHint] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Preenche o formulário quando o perfil estiver carregado
  useEffect(() => {
    if (!isLoading && !user) {
      // Se alguém chegar aqui sem sessão, mandamos para login
      openModal({ mode: "login", redirectTo: "/me/edit", showGoogle: true });
      router.push("/");
      return;
    }

    if (profile) {
      setFullName(profile.fullName ?? "");
      setUsername(sanitizeUsername(profile.username ?? ""));
    }
  }, [isLoading, user, profile, openModal, router]);

  async function checkUsernameAvailability(value: string) {
    const trimmed = sanitizeUsername(value).toLowerCase();

    if (!trimmed) {
      setUsernameAvailable(null);
      return;
    }

    // Se não mudou em relação ao username atual, consideramos disponível
    if (trimmed === (profile?.username ?? "")) {
      setUsernameAvailable(true);
      return;
    }

    try {
      setCheckingUsername(true);
      const res = await fetch("/api/profiles/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      if (!res.ok) {
        setUsernameAvailable(null);
        return;
      }

      const json = (await res.json()) as { available: boolean };
      setUsernameAvailable(json.available);
    } catch (err) {
      console.error("Erro a verificar username:", err);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedUsername = sanitizeUsername(username).toLowerCase();

    if (!trimmedUsername) {
      setErrorMsg("Escolhe um username só com letras (máx. 16).");
      return;
    }

    if (usernameAvailable === false) {
      setErrorMsg("Esse username já está a ser usado.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/profiles/save-basic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim() || null,
          username: trimmedUsername,
        }),
      });

      if (!res.ok) {
        setErrorMsg("Erro a guardar o perfil.");
        setSaving(false);
        return;
      }

      const json = (await res.json()) as SaveBasicResponse;

      if (!json.ok) {
        setErrorMsg(json.error || "Erro a guardar o perfil.");
        setSaving(false);
        return;
      }

      setSuccessMsg("Perfil atualizado!");

      // Atualiza o cache do /api/auth/me
      await mutate();

      setTimeout(() => {
        router.push("/me");
      }, 800);
    } catch (err) {
      console.error("Erro inesperado ao guardar perfil:", err);
      setErrorMsg("Erro inesperado ao guardar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen orya-body-bg text-white flex items-center justify-center">
        <p className="text-white/60 text-sm">A carregar o teu perfil…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen orya-body-bg text-white pb-24">
      <div className="max-w-xl mx-auto px-5 pt-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Editar perfil
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Ajusta o teu nome e username dentro da ORYA.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/me")}
            className="hidden sm:inline-flex items-center gap-2 text-[11px] text-white/55 hover:text-white/85"
          >
            ← Voltar à conta
          </button>
        </header>

        {/* Mensagens */}
        {errorMsg && (
          <div className="mb-4 p-3 border border-red-500/40 bg-red-500/10 rounded-lg text-red-200 text-sm">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 border border-emerald-500/40 bg-emerald-500/10 rounded-lg text-emerald-200 text-sm">
            {successMsg}
          </div>
        )}

        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-slate-950/85 to-slate-950 backdrop-blur-xl p-6 shadow-[0_14px_34px_rgba(15,23,42,0.8)]">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <label className="text-white/70 text-sm">Nome completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60 text-sm"
                placeholder="Como te chamas?"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white/70 text-sm">Username</label>
              <input
                type="text"
                inputMode="text"
                pattern="[A-Za-z]{0,16}"
                value={username}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cleaned = sanitizeUsername(raw);
                  if (raw !== cleaned) {
                    e.target.value = cleaned;
                  }
                  setUsername(cleaned);
                  setUsernameHint(
                    raw !== cleaned ? "Só letras (A-Z), sem espaços, máximo 16." : null,
                  );
                  setUsernameAvailable(null);
                }}
                onBlur={(e) => checkUsernameAvailability(e.target.value)}
                maxLength={16}
                className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60 text-sm"
                placeholder="Escolhe o teu @username"
              />
              {usernameHint && (
                <p className="text-[11px] text-amber-300 mt-1">{usernameHint}</p>
              )}
              <p className="text-[11px] text-white/55 mt-1">
                Este será o link do teu perfil público (ex.: orya.app/@teuusername).
              </p>
              {checkingUsername && (
                <p className="text-[11px] text-white/60 mt-1">
                  A verificar disponibilidade…
                </p>
              )}
              {usernameAvailable === false && !checkingUsername && (
                <p className="text-[11px] text-red-300 mt-1">
                  Esse username já está usado.
                </p>
              )}
              {usernameAvailable && !checkingUsername && (
                <p className="text-[11px] text-emerald-300 mt-1">
                  Username disponível ✔
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/me")}
                className="inline-flex justify-center px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-xs font-medium text-white/80 hover:border-white/40 hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] shadow-[0_0_22px_#1646F577] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
