"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthModal() {
  const modal = useAuthModal();

  if (!modal.isOpen) return null;

  const modalKey = `${modal.mode}-${modal.redirectTo ?? "none"}`;

  return <AuthModalContent key={modalKey} {...modal} />;
}

type AuthModalContentProps = ReturnType<typeof useAuthModal>;

function AuthModalContent({
  mode,
  email,
  setEmail,
  closeModal,
  setMode,
  redirectTo,
}: AuthModalContentProps) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        closeModal();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeModal]);

  async function finishAuthAndMaybeOnboard() {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        closeModal();
        if (redirectTo) router.push(redirectTo);
        return;
      }

      const data = await res.json();
      const onboardingDone = data?.profile?.onboardingDone;

      if (onboardingDone) {
        closeModal();
        if (redirectTo) router.push(redirectTo);
      } else {
        setMode("onboarding");
      }
    } catch (err) {
      console.error("finishAuthAndMaybeOnboard error", err);
      closeModal();
      if (redirectTo) router.push(redirectTo);
    }
  }

  async function handleLogin() {
    setError(null);
    setLoading(true);

    const emailToUse = (email || "").trim().toLowerCase();

    if (!emailToUse || !password) {
      setError("Preenche o email e a password.");
      setLoading(false);
      return;
    }

    const { error: loginError } = await supabaseBrowser.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    await finishAuthAndMaybeOnboard();
    setLoading(false);
  }

  async function handleSignup() {
    setError(null);
    setLoading(true);

    const emailToUse = (email || "").trim().toLowerCase();

    if (!emailToUse || !password) {
      setError("Preenche o email e a password.");
      setLoading(false);
      return;
    }

    const { error: signupError } = await supabaseBrowser.auth.signUp({
      email: emailToUse,
      password,
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    setMode("verify");
    setLoading(false);
  }

  async function handleVerify() {
    setError(null);
    setLoading(true);

    const emailToUse = (email || "").trim().toLowerCase();

    if (!emailToUse) {
      setError("Email em falta. Volta atrás e inicia sessão novamente.");
      setLoading(false);
      return;
    }

    if (!otp || otp.trim().length < 6) {
      setError("Introduce o código completo.");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
      type: "email",
      email: emailToUse,
      token: otp.trim(),
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    await finishAuthAndMaybeOnboard();
    setLoading(false);
  }

  async function handleOnboardingSave() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/profiles/save-basic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim() || null,
          username: username.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.ok === false)) {
        const msg = data?.error || "Não foi possível guardar o perfil.";
        setError(msg);
        setLoading(false);
        return;
      }

      closeModal();
      if (redirectTo) router.push(redirectTo);
      setLoading(false);
    } catch (err) {
      console.error("handleOnboardingSave error", err);
      setError("Ocorreu um erro ao guardar o perfil.");
      setLoading(false);
    }
  }

  const title =
    mode === "login"
      ? "Iniciar sessão"
      : mode === "signup"
      ? "Criar conta"
      : mode === "verify"
      ? "Confirmar email"
      : "Completar perfil";

  const isPrimaryDisabled =
    loading ||
    ((mode === "login" || mode === "signup") && (!email || !password)) ||
    (mode === "verify" && (!email || otp.trim().length < 6)) ||
    (mode === "onboarding" && !username.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl">
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-3xl border border-white/15 bg-black/80 p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>

        {(mode === "login" || mode === "signup") && (
          <>
            <label className="block text-xs text-white/70 mb-1">Email</label>
            <input
              type="email"
              value={email ?? ""}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="nome@exemplo.com"
            />

            <label className="mt-3 block text-xs text-white/70 mb-1">
              Palavra-passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="••••••••"
            />

            <p className="mt-2 text-[10px] text-white/50 leading-snug">
              Ao continuar, aceitas os termos da ORYA. Podes terminar sessão
              quando quiseres.
            </p>
          </>
        )}

        {mode === "verify" && (
          <>
            <p className="text-sm text-white/80 mb-2">
              Enviámos um código de confirmação para <strong>{email}</strong>.
            </p>
            <label className="block text-xs text-white/70 mb-1">Código</label>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="123456"
            />
          </>
        )}

        {mode === "onboarding" && (
          <>
            <p className="text-sm text-white/75 mb-3">
              Bem-vindo(a)! Só faltam estes dados para concluíres o teu perfil.
            </p>

            <label className="block text-xs text-white/70 mb-1">
              Nome completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="Ex.: Inês Martins"
            />

            <label className="mt-3 block text-xs text-white/70 mb-1">
              Username público
            </label>
            <div className="flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white">
              <span className="text-white/40 mr-1">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                placeholder="ines.martins"
              />
            </div>

            <p className="mt-1 text-[10px] text-white/45 leading-snug">
              Podes alterar estes dados depois nas definições.
            </p>
          </>
        )}

        {error && (
          <p className="mt-3 text-[12px] text-red-300 leading-snug">{error}</p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {(mode === "login" || mode === "signup") && (
            <button
              type="button"
              disabled={isPrimaryDisabled}
              onClick={mode === "login" ? handleLogin : handleSignup}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] disabled:opacity-50"
            >
              {loading
                ? "A processar…"
                : mode === "login"
                ? "Entrar na ORYA"
                : "Criar conta"}
            </button>
          )}

          {mode === "verify" && (
            <button
              type="button"
              disabled={isPrimaryDisabled}
              onClick={handleVerify}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] disabled:opacity-50"
            >
              {loading ? "A validar…" : "Confirmar código"}
            </button>
          )}

          {mode === "onboarding" && (
            <button
              type="button"
              disabled={isPrimaryDisabled}
              onClick={handleOnboardingSave}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] disabled:opacity-50"
            >
              {loading ? "A guardar…" : "Guardar e continuar"}
            </button>
          )}

          {(mode === "login" || mode === "signup") && (
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-[11px] text-white/70 hover:text-white"
            >
              {mode === "login"
                ? "Ainda não tens conta? Cria uma agora."
                : "Já tens conta? Inicia sessão."}
            </button>
          )}

          <button
            type="button"
            onClick={closeModal}
            className="text-[11px] text-white/50 hover:text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
