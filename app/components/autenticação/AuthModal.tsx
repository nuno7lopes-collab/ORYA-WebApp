"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { mutate as swrMutate } from "swr";
import type { User } from "@supabase/supabase-js";

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
  showGoogle,
}: AuthModalContentProps) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [loginOtpSending, setLoginOtpSending] = useState(false);
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpResending, setOtpResending] = useState(false);
  const [usernameHint, setUsernameHint] = useState<string | null>(null);

  const RESEND_COOLDOWN = 30;
  const isSignupBlocked = signupCooldown > 0;
  const isOnboarding = mode === "onboarding";

  const modalRef = useRef<HTMLDivElement | null>(null);

  function clearPendingVerification() {
    setOtpCooldown(0);
    setOtp("");
    setError(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("orya_pending_email");
        window.localStorage.removeItem("orya_pending_step");
        window.localStorage.removeItem("orya_otp_last_sent_at");
      } catch {
        /* ignore */
      }
    }
  }
  function hardResetAuthState() {
    clearPendingVerification();
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setLoginOtpSent(false);
    setLoginOtpSending(false);
    setOtpResending(false);
    setError(null);
    setMode("login");
  }

  function isUnconfirmedError(err: unknown) {
    if (!err) return false;
    const anyErr = err as { message?: string; status?: number; error_description?: string };
    const msg = (anyErr.message || anyErr.error_description || "").toLowerCase();
    if (!msg) return false;
    return (
      msg.includes("not confirmed") ||
      msg.includes("confirm your email") ||
      msg.includes("email_not_confirmed")
    );
  }

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

  // Recupera email pendente após reload
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pendingEmail = window.localStorage.getItem("orya_pending_email");
      const pendingStep = window.localStorage.getItem("orya_pending_step");
      const lastOtp = Number(window.localStorage.getItem("orya_otp_last_sent_at") || "0");
      const elapsed = lastOtp ? Math.floor((Date.now() - lastOtp) / 1000) : RESEND_COOLDOWN;
      const remaining = Math.max(0, RESEND_COOLDOWN - elapsed);
      if (pendingEmail && !email) setEmail(pendingEmail);
      if (pendingStep === "verify") {
        setMode("verify");
        if (remaining > 0) setOtpCooldown(remaining);
      }
    } catch {
      /* ignore */
    }
  }, [email, setEmail, setMode]);

  // Se estivermos no modo verify mas o user já estiver confirmado (sessão existente),
  // limpamos o estado pendente e fechamos o modal para não bloquear o fluxo.
  useEffect(() => {
    if (mode !== "verify") return;
    if (otpCooldown === 0) {
      setOtpCooldown(RESEND_COOLDOWN);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("orya_otp_last_sent_at", String(Date.now()));
      }
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabaseBrowser.auth.getUser();
        const supaUser = (data?.user as User | null) ?? null;
        const confirmed =
          Boolean(supaUser?.email_confirmed_at) ||
          Boolean((supaUser as { email_confirmed?: string | null } | null)?.email_confirmed) ||
          false;
        if (confirmed && !cancelled) {
          clearPendingVerification();
          setError(null);
          closeModal();
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, closeModal]);

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

  async function handleLoginOtp() {
    if (!email) {
      setError("Indica o email para receber o link de entrada.");
      return;
    }
    setLoginOtpSending(true);
    setError(null);
    setLoginOtpSent(false);
    try {
      const redirect =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { error: otpErr } = await supabaseBrowser.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirect },
      });
      if (otpErr) {
        setError(otpErr.message ?? "Não foi possível enviar o link de login.");
        setLoginOtpSending(false);
        return;
      }
      setLoginOtpSent(true);
    } catch (err) {
      console.error("[AuthModal] login OTP error:", err);
      setError("Não foi possível enviar o link de login.");
    } finally {
      setLoginOtpSending(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError("Indica o email para recuperar a password.");
      return;
    }
    setLoginOtpSending(true);
    setError(null);
    setLoginOtpSent(false);
    try {
      const redirect =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { error: resetErr } = await supabaseBrowser.auth.resetPasswordForEmail(
        email,
        { redirectTo: redirect },
      );
      if (resetErr) {
        setError(resetErr.message ?? "Não foi possível enviar recuperação de password.");
        setLoginOtpSending(false);
        return;
      }
      setLoginOtpSent(true);
    } catch (err) {
      console.error("[AuthModal] reset password error:", err);
      setError("Não foi possível enviar recuperação de password.");
    } finally {
      setLoginOtpSending(false);
    }
  }

  async function triggerResendOtp(emailToUse: string) {
    setError(null);
    setOtpResending(true);

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível reenviar o código.");
        setOtpCooldown(0);
      } else {
        setLoginOtpSent(true);
        setOtpCooldown(RESEND_COOLDOWN);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("orya_otp_last_sent_at", String(Date.now()));
          window.localStorage.setItem("orya_pending_email", emailToUse);
          window.localStorage.setItem("orya_pending_step", "verify");
        }
      }
    } catch (err) {
      console.error("triggerResendOtp error", err);
      setError("Não foi possível reenviar o código.");
      setOtpCooldown(0);
    } finally {
      setOtpResending(false);
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

      // Se a API exigir confirmação de email, volta para o modo verify
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const needsEmailConfirmation = data?.needsEmailConfirmation;
        if (needsEmailConfirmation) {
          if (typeof window !== "undefined" && email) {
            window.localStorage.setItem("orya_pending_email", email);
            window.localStorage.setItem("orya_pending_step", "verify");
          }
          setMode("verify");
          if (email) {
            await triggerResendOtp(email);
          }
          setLoading(false);
          return;
        }
        closeModal();
        router.push(redirectTo ?? "/me");
        return;
      }

      const data = await res.json();
      const onboardingDone = data?.profile?.onboardingDone;
      // Atualiza SWR para refletir o novo estado de auth/profile imediatamente
      swrMutate("/api/auth/me");

      // Sessão OK: limpa qualquer estado de verificação pendente para não reabrir o passo verify
      clearPendingVerification();

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
      const message = loginError.message || "";
      if (isUnconfirmedError(loginError)) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("orya_pending_email", emailToUse);
          window.localStorage.setItem("orya_pending_step", "verify");
        }
        setMode("verify");
        setEmail(emailToUse);
        setError("Email ainda não confirmado. Reenviei-te um novo código.");
        await triggerResendOtp(emailToUse);
      } else {
        setError(message || "Não foi possível iniciar sessão.");
      }
      setLoading(false);
      return;
    }

    await syncSessionWithServer();
    clearPendingVerification();
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

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [otpCooldown]);

  async function handleSignup() {
    setError(null);
    setLoading(true);
    setLoginOtpSent(false);

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

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Não foi possível enviar o código.");
        setLoading(false);
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("orya_pending_email", emailToUse);
        window.localStorage.setItem("orya_pending_step", "verify");
        window.localStorage.setItem("orya_otp_last_sent_at", String(Date.now()));
      }
      setOtpCooldown(RESEND_COOLDOWN);
      setEmail(emailToUse);
      setMode("verify");
    } catch (err) {
      console.warn("[AuthModal] Falhou envio de OTP custom:", err);
      setError("Não foi possível enviar o código. Tenta novamente dentro de alguns minutos.");
      setMode("signup");
      setLoading(false);
      return;
    }

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

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError("Introduce o código completo (6-8 dígitos).");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
      type: "signup",
      email: emailToUse,
      token: cleanOtp,
    });

    if (verifyError) {
      const message = verifyError.message || "Código inválido ou expirado. Verifica o email ou pede novo código.";
      setError(message);
      setOtpCooldown(0);
      setLoading(false);
      return;
    }

    await syncSessionWithServer();
    swrMutate("/api/auth/me");
    if (typeof window !== "undefined") {
      clearPendingVerification();
    }
    await finishAuthAndMaybeOnboard();
    setLoading(false);
  }

  async function handleOnboardingSave() {
    setError(null);
    setLoading(true);

    try {
      const usernameClean = username.replace(/[^A-Za-z]/g, "").slice(0, 16).trim();
      if (!usernameClean) {
        setError("O username só pode ter letras (sem espaços, números ou símbolos).");
        setLoading(false);
        return;
      }
      if (usernameClean.length > 16) {
        setError("O username pode ter no máximo 16 letras.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/profiles/save-basic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim() || null,
          username: usernameClean,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.ok === false)) {
        const msg = data?.error || "Não foi possível guardar o perfil.";
        setError(msg);
        setLoading(false);
        return;
      }

      // Atualizar cache do utilizador para refletir onboardingDone=true (evita reabrir modal)
      swrMutate("/api/auth/me", (curr: unknown) => {
        const prev = curr as
          | { user?: unknown; profile?: { onboardingDone?: boolean } }
          | undefined;
        if (prev?.profile) {
          return {
            ...prev,
            profile: { ...prev.profile, onboardingDone: true },
          };
        }
        return prev;
      }, false);
      closeModal();
      router.push(redirectTo ?? "/me");
      setLoading(false);
    } catch (err) {
      console.error("handleOnboardingSave error", err);
      setError("Ocorreu um erro ao guardar o perfil.");
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  const isSignup = mode === "signup";

  const title =
    mode === "login"
      ? "Entrar na ORYA"
      : mode === "signup"
      ? "Criar conta na ORYA"
      : mode === "verify"
      ? "Confirmar email"
      : "Completar perfil";

  const subtitle =
    mode === "login"
      ? "Acede à tua conta e continua onde ficaste."
      : mode === "signup"
      ? "Demora segundos. Depois é só viver experiências."
      : mode === "verify"
      ? "Valida o código que enviámos para o teu email."
      : "Só falta isto para ficares pronto.";


  const isPrimaryDisabled =
    loading ||
    ((mode === "login" || mode === "signup") && (!email || !password)) ||
    (mode === "signup" && (password !== confirmPassword || !confirmPassword)) ||
    (mode === "signup" && isSignupBlocked) ||
    (mode === "verify" && (!email || otp.trim().length < 6)) ||
    (mode === "onboarding" &&
      (!username.replace(/[^A-Za-z]/g, "").trim() ||
        username.replace(/[^A-Za-z]/g, "").length > 16));

  const handleClose = () => {
    hardResetAuthState();
    closeModal();
    router.push(redirectTo ?? "/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl">
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-3xl border border-white/15 bg-black/80 p-6 shadow-xl"
      >
        <div className="mb-4 space-y-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-white leading-tight">{title}</h2>
            <p className="text-sm text-white/70">{subtitle}</p>
          </div>

          {(isLogin || isSignup) && (
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-white/5 p-1 text-sm text-white/80">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-full px-3 py-2 transition ${
                  isLogin
                    ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black shadow-[0_0_16px_rgba(107,255,255,0.35)]"
                    : "hover:bg-white/10"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-full px-3 py-2 transition ${
                  isSignup
                    ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black shadow-[0_0_16px_rgba(107,255,255,0.35)]"
                    : "hover:bg-white/10"
                }`}
              >
                Criar conta
              </button>
            </div>
          )}
        </div>

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

            {showGoogle && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    const redirect =
                      typeof window !== "undefined"
                        ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
                            redirectTo ?? window.location.href,
                          )}`
                        : undefined;
                    if (typeof window !== "undefined") {
                      try {
                        window.localStorage.setItem(
                          "orya_post_auth_redirect",
                          redirectTo ?? window.location.href,
                        );
                      } catch {}
                    }
                    const { error: oauthError } =
                      await supabaseBrowser.auth.signInWithOAuth({
                        provider: "google",
                        options: { redirectTo: redirect },
                      });
                    if (oauthError) {
                      setError(
                        oauthError.message ??
                          "Não foi possível iniciar sessão com Google.",
                      );
                    }
                  } catch (err) {
                    console.error("[AuthModal] Google OAuth error:", err);
                    setError(
                      "Não foi possível iniciar sessão com Google. Tenta novamente.",
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow hover:border-white/40 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Continuar com Google
              </button>
            )}

            <p className="mt-2 text-[10px] text-white/50 leading-snug">
              Ao continuar, aceitas os termos da ORYA.
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
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="Insere o código de 6 dígitos"
            />
            <div className="mt-2 flex items-center justify-between text-[12px] text-white/65">
              <span>
                Não chegou?{" "}
                {otpCooldown > 0 ? (
                  <span className="text-white/75">Podes reenviar em {otpCooldown}s.</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (email) triggerResendOtp(email);
                    }}
                    disabled={!email || otpResending}
                    className="text-[#6BFFFF] hover:text-white transition disabled:opacity-50"
                  >
                    Reenviar código
                  </button>
                )}
              </span>
              {otpResending && <span className="text-[11px] text-white/50">A enviar…</span>}
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px] text-white/65">
              <button
                type="button"
                onClick={() => {
                  hardResetAuthState();
                  setMode("login");
                }}
                className="text-[#6BFFFF] hover:text-white transition"
              >
                Usar outro email
              </button>
            </div>
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
                  inputMode="text"
                  pattern="[A-Za-z]{0,16}"
                  value={username}
                  maxLength={16}
                  onChange={(e) =>
                    {
                      const raw = e.target.value;
                      const cleaned = raw.replace(/[^A-Za-z]/g, "").slice(0, 16);
                      if (raw !== cleaned) {
                        e.target.value = cleaned;
                      }
                      setUsername(cleaned);
                      setUsernameHint(raw !== cleaned ? "Só letras A-Z, sem espaços, máximo 16." : null);
                    }
                  }
                  className="flex-1 bg-transparent outline-none"
                  placeholder="inesmartins"
                />
              </div>
              {usernameHint && (
                <p className="mt-1 text-[10px] text-amber-300/90">{usernameHint}</p>
              )}

            <p className="mt-1 text-[10px] text-white/45 leading-snug">
              Podes alterar estes dados depois nas definições.
            </p>
          </>
        )}

        {error && (
          <div className="mt-3 space-y-2">
            <p className="text-[12px] text-red-300 leading-snug">{error}</p>
            {mode === "signup" && error.toLowerCase().includes("já tem conta") && (
              <div className="space-y-2 text-[12px] text-white/75">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10 transition"
                >
                  Ir para login
                </button>
                <button
                  type="button"
                  disabled={loginOtpSending}
                  onClick={handleLoginOtp}
                  className="w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  {loginOtpSending ? "A enviar link de login…" : "Enviar link de login por email"}
                </button>
                <button
                  type="button"
                  disabled={loginOtpSending}
                  onClick={handleResetPassword}
                  className="w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  {loginOtpSending ? "A enviar recuperação…" : "Recuperar password"}
                </button>
                {loginOtpSent && (
                  <p className="text-emerald-300 text-[11px]">
                    Verifica o teu email para o link de login/recuperação.
                  </p>
                )}
              </div>
            )}
          </div>
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
                ? "Entrar"
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

          <button
            type="button"
            onClick={isOnboarding ? undefined : handleClose}
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
