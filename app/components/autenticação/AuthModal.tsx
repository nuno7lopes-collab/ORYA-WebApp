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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [signupCooldown, setSignupCooldown] = useState(0);

  const isSignupBlocked = signupCooldown > 0;
  const isOnboarding = mode === "onboarding";

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        !isOnboarding
      ) {
        closeModal();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeModal, isOnboarding]);

  async function syncSessionWithServer() {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const access_token = data.session?.access_token;
      const refresh_token = data.session?.refresh_token;
      if (!access_token || !refresh_token) return;
      await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
        credentials: "include",
      });
    } catch (err) {
      console.warn("syncSessionWithServer failed", err);
    }
  }

  async function finishAuthAndMaybeOnboard() {
    try {
      // Garantir que o servidor tem a sessão atualizada antes de pedir /api/auth/me
      await syncSessionWithServer();

      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        closeModal();
        router.push(redirectTo ?? "/me");
        return;
      }

      const data = await res.json();
      const onboardingDone = data?.profile?.onboardingDone;

      if (onboardingDone) {
        closeModal();
        router.push(redirectTo ?? "/me");
      } else {
        setMode("onboarding");
      }
    } catch (err) {
      console.error("finishAuthAndMaybeOnboard error", err);
      closeModal();
      router.push(redirectTo ?? "/me");
    }
  }

  async function handleLogin() {
    setError(null);
    setLoading(true);

    const identifier = (email || "").trim().toLowerCase();

    if (!identifier || !password) {
      setError("Preenche o email/username e a password.");
      setLoading(false);
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
        setLoading(false);
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
      setLoading(false);
      return;
    }

    await syncSessionWithServer();
    await finishAuthAndMaybeOnboard();
    setLoading(false);
  }

  useEffect(() => {
    if (signupCooldown <= 0) return;
    const t = setInterval(() => {
      setSignupCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [signupCooldown]);

  async function handleSignup() {
    setError(null);
    setLoading(true);

    const emailToUse = (email || "").trim().toLowerCase();

    if (!emailToUse || !password || !confirmPassword) {
      setError("Preenche o email e ambas as passwords.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("As passwords não coincidem.");
      setLoading(false);
      return;
    }

    const { data: signupData, error: signupError } = await supabaseBrowser.auth.signUp({
      email: emailToUse,
      password,
    });

    if (signupError) {
      const message = signupError.message || "Não foi possível criar a conta.";
      const isRateLimit =
        message.toLowerCase().includes("rate limit") ||
        message.toLowerCase().includes("too many requests");

      if (isRateLimit) {
        setSignupCooldown(60);
        setError(
          "Recebeste emails a mais num curto espaço de tempo. Tenta novamente daqui a 1 minuto.",
        );
      } else {
        setError(message);
      }
      setLoading(false);
      return;
    }

    // Se o Supabase não requer confirmar email, vem logo com session
    if (signupData?.session) {
      await syncSessionWithServer();
      await finishAuthAndMaybeOnboard();
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

    await syncSessionWithServer();
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
      router.push(redirectTo ?? "/me");
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
    (mode === "signup" && (password !== confirmPassword || !confirmPassword)) ||
    (mode === "signup" && isSignupBlocked) ||
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
            <label className="block text-xs text-white/70 mb-1">Email ou username</label>
            <input
              type="text"
              value={email ?? ""}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="nome@exemplo.com ou @username"
            />

            <label className="mt-3 block text-xs text-white/70 mb-1">
              Palavra-passe
            </label>
            <div className="flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="flex-1 bg-transparent text-sm text-white outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[11px] text-white/70 hover:text-white"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {mode === "signup" && (
              <>
                <label className="mt-3 block text-xs text-white/70 mb-1">
                  Confirmar palavra-passe
                </label>
                <div className="flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    className="flex-1 bg-transparent text-sm text-white outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="text-[11px] text-white/70 hover:text-white"
                  >
                    {showConfirmPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </>
            )}

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

        {mode === "signup" && isSignupBlocked && (
          <p className="mt-2 text-[11px] text-white/60">
            Aguardar {signupCooldown}s para tentar novamente.
          </p>
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
            onClick={isOnboarding ? undefined : closeModal}
            disabled={isOnboarding}
            className="text-[11px] text-white/50 hover:text-white disabled:opacity-60"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
