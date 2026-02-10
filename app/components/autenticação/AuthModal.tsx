"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { mutate as swrMutate } from "swr";
import type { User } from "@supabase/supabase-js";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { useUser } from "@/app/hooks/useUser";
import { sanitizeUsername, validateUsername, USERNAME_RULES_HINT } from "@/lib/username";
import { isReservedUsernameAllowed } from "@/lib/reservedUsernames";
import { INTEREST_MAX_SELECTION, INTEREST_OPTIONS, normalizeInterestSelection, type InterestId } from "@/lib/interests";
import InterestIcon from "@/app/components/interests/InterestIcon";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

const isStableErrorCode = (value: unknown) =>
  typeof value === "string" && /^[A-Z0-9_]+$/.test(value);

const getErrorCode = (payload: any) => {
  if (!payload) return null;
  const candidate = payload.errorCode ?? payload.code ?? payload.error ?? null;
  return isStableErrorCode(candidate) ? String(candidate) : null;
};

const getErrorMessage = (payload: any) => {
  if (!payload) return null;
  if (typeof payload.message === "string" && payload.message) return payload.message;
  if (typeof payload.error === "string" && payload.error) return payload.error;
  return null;
};

const isRateLimited = (code: string | null) =>
  code === "RATE_LIMITED" || code === "THROTTLED";

export default function AuthModal() {
  const modal = useAuthModal();

  if (!modal.isOpen) return null;

  return <AuthModalContent {...modal} />;
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
  dismissible,
}: AuthModalContentProps) {
  const router = useRouter();
  const { profile, user } = useUser();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [loginOtpSending, setLoginOtpSending] = useState(false);
  const [resetPasswordSending, setResetPasswordSending] = useState(false);
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [verifyOtpSent, setVerifyOtpSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [onboardingInterests, setOnboardingInterests] = useState<InterestId[]>([]);
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "reserved" | "error"
  >("idle");

  const isSignupBlocked = signupCooldown > 0;
  const isOnboarding = mode === "onboarding";
  const isEmailLike = (value: string) => EMAIL_REGEX.test(value.trim().toLowerCase());
  const allowReservedForEmail = isEmailLike(email ?? "")
    ? email.trim().toLowerCase()
    : isEmailLike(user?.email ?? "")
      ? user?.email?.trim().toLowerCase() ?? null
      : null;

  const modalRef = useRef<HTMLDivElement | null>(null);

  function clearPendingVerification() {
    setOtp("");
    setError(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("orya_pending_email");
        window.localStorage.removeItem("orya_pending_step");
        window.localStorage.removeItem("orya_otp_last_sent_at");
        window.localStorage.removeItem("orya_otp_type");
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
    setVerifyOtpSent(false);
    setLoginOtpSending(false);
    setResetPasswordSending(false);
    setResetEmailSent(false);
    setOnboardingInterests([]);
    setError(null);
    setMode("login");
  }

  async function triggerOtpRetry(emailValue: string) {
    if (!emailValue || !isEmailLike(emailValue)) {
      setError("Indica um email válido para pedir um novo código.");
      return;
    }
    if (signupCooldown > 0) {
      setError(`Aguarda ${signupCooldown}s para pedir um novo código.`);
      return;
    }
    setLoginOtpSending(true);
    setError(null);
    setVerifyOtpSent(false);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const errorCode = getErrorCode(json);
        const errorMessage = getErrorMessage(json);
        if (res.status === 429 || isRateLimited(errorCode)) {
          const retryAfterHeader = res.headers.get("Retry-After");
          const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          const cooldownSeconds =
            Number.isFinite(retryAfter) && retryAfter > 0 ? Math.round(retryAfter) : 60;
          setSignupCooldown(cooldownSeconds);
          setError(errorMessage ?? "Muitas tentativas. Tenta novamente dentro de alguns minutos.");
        } else {
          setError(mapAuthErrorMessage(errorMessage) ?? "Não foi possível pedir um novo código.");
        }
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("orya_pending_email", emailValue);
        window.localStorage.setItem("orya_pending_step", "verify");
        window.localStorage.setItem(
          "orya_otp_type",
          json?.otpType === "magiclink" ? "magiclink" : "signup",
        );
      }
      setVerifyOtpSent(true);
    } catch (err) {
      console.error("[AuthModal] OTP retry error:", err);
      setError("Não foi possível pedir um novo código.");
    } finally {
      setLoginOtpSending(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        !isOnboarding &&
        dismissible
      ) {
        closeModal();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeModal, dismissible, isOnboarding]);

  useEffect(() => {
    if (mode !== "reset") {
      setResetEmailSent(false);
    }
    if (mode === "reset") {
      setLoginOtpSent(false);
    }
    if (mode !== "verify") {
      setVerifyOtpSent(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "onboarding") {
      setOnboardingInterests(
        normalizeInterestSelection(profile?.favouriteCategories ?? []),
      );
    }
  }, [mode, profile?.favouriteCategories]);

  // Recupera email pendente após reload
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pendingEmail = window.localStorage.getItem("orya_pending_email");
      const pendingStep = window.localStorage.getItem("orya_pending_step");
      if (pendingEmail && !email) setEmail(pendingEmail);
      if (pendingStep === "verify") {
        setMode("verify");
      }
    } catch {
      /* ignore */
    }
  }, [email, setEmail, setMode]);

  useEffect(() => {
    if (!isOnboarding || !profile) return;
    if (!fullName.trim() && profile.fullName) {
      setFullName(profile.fullName);
    }
    if (!username && profile.username) {
      const cleaned = sanitizeUsername(profile.username);
      setUsername(cleaned);
      const validation = validateUsername(cleaned, { allowReservedForEmail });
      setUsernameHint(validation.valid ? null : validation.error);
      setUsernameStatus("idle");
    }
  }, [isOnboarding, profile, fullName, username]);

  // Se estivermos no modo verify mas o user já estiver confirmado (sessão existente),
  // limpamos o estado pendente e fechamos o modal para não bloquear o fluxo.
  useEffect(() => {
    if (mode !== "verify") return;
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
    if (!email || !isEmailLike(email)) {
      setError("Indica um email válido para receber o link de entrada.");
      return;
    }
    setLoginOtpSending(true);
    setError(null);
    setLoginOtpSent(false);
    try {
      const redirect =
        typeof window !== "undefined"
          ? (() => {
              const currentPath = `${window.location.pathname}${window.location.search}`;
              const safeRedirect = sanitizeRedirectPath(redirectTo ?? currentPath, "/");
              try {
                window.localStorage.setItem("orya_post_auth_redirect", safeRedirect);
              } catch {}
              return `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(
                safeRedirect
              )}`;
            })()
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
    if (!email || !isEmailLike(email)) {
      setError("Indica um email válido para recuperar a password.");
      return;
    }
    setResetPasswordSending(true);
    setError(null);
    setLoginOtpSent(false);
    setResetEmailSent(false);
    try {
      const res = await fetch("/api/auth/password/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false) {
      const errorMessage = getErrorMessage(data);
      setError(mapAuthErrorMessage(errorMessage) ?? "Não foi possível enviar recuperação de password.");
      setResetPasswordSending(false);
      return;
    }
      setResetEmailSent(true);
    } catch (err) {
      console.error("[AuthModal] reset password error:", err);
      setError("Não foi possível enviar recuperação de password.");
    } finally {
      setResetPasswordSending(false);
    }
  }

  async function finishAuthAndMaybeOnboard() {
    const safeRedirect = sanitizeRedirectPath(redirectTo, "/me");
    try {
      // Garantir que o servidor tem a sessão atualizada antes de pedir /api/auth/me
      await syncSessionWithServer();

      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);
      const needsEmailConfirmation = data?.needsEmailConfirmation;
      if (needsEmailConfirmation) {
        const candidateEmail =
          (email && isEmailLike(email) ? email : "") ||
          (typeof data?.user?.email === "string" && isEmailLike(data.user.email) ? data.user.email : "");
        if (typeof window !== "undefined" && candidateEmail) {
          window.localStorage.setItem("orya_pending_email", candidateEmail);
          window.localStorage.setItem("orya_pending_step", "verify");
        }
        setMode("verify");
        setVerifyOtpSent(false);
        if (candidateEmail) {
          await triggerOtpRetry(candidateEmail);
        }
        setLoading(false);
        return;
      }

      if (!res.ok) {
        closeModal();
        router.push(safeRedirect);
        return;
      }

      const onboardingDone = data?.profile?.onboardingDone;
      // Atualiza SWR para refletir o novo estado de auth/profile imediatamente
      swrMutate("/api/auth/me");

      // Sessão OK: limpa qualquer estado de verificação pendente para não reabrir o passo verify
      clearPendingVerification();

      if (onboardingDone) {
        closeModal();
        router.push(safeRedirect);
      } else {
        setMode("onboarding");
      }
    } catch (err) {
      console.error("finishAuthAndMaybeOnboard error", err);
      closeModal();
      router.push(sanitizeRedirectPath(redirectTo, "/me"));
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

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
      credentials: "include",
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      const errorCode = getErrorCode(data);
      const errorMessage = getErrorMessage(data);
      if (errorCode === "EMAIL_NOT_CONFIRMED") {
        const emailValue = isEmailLike(identifier) ? identifier : "";
        if (typeof window !== "undefined" && emailValue) {
          window.localStorage.setItem("orya_pending_email", emailValue);
          window.localStorage.setItem("orya_pending_step", "verify");
        }
        setMode("verify");
        setEmail(emailValue);
        setVerifyOtpSent(false);
        setError(
          emailValue
            ? "Email ainda não confirmado. Reenviei-te um novo código."
            : "Email ainda não confirmado. Indica o teu email para receberes o código."
        );
        if (emailValue) {
          await triggerOtpRetry(emailValue);
        }
      } else if (isRateLimited(errorCode)) {
        setError(errorMessage ?? "Muitas tentativas. Tenta novamente dentro de minutos.");
      } else {
        setError(errorMessage ?? "Credenciais inválidas. Confirma username/email e password.");
      }
      setLoading(false);
      return;
    }

    const session = data?.session;
    if (session?.access_token && session?.refresh_token) {
      await supabaseBrowser.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

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

    if (password.length < 6) {
      setError("A password deve ter pelo menos 6 caracteres.");
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
        const errorCode = getErrorCode(json);
        const errorMessage = getErrorMessage(json);
        if (res.status === 429 || isRateLimited(errorCode)) {
          const retryAfterHeader = res.headers.get("Retry-After");
          const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          const cooldownSeconds =
            Number.isFinite(retryAfter) && retryAfter > 0 ? Math.round(retryAfter) : 60;
          setSignupCooldown(cooldownSeconds);
          setError(errorMessage ?? "Muitas tentativas. Tenta novamente dentro de alguns minutos.");
        } else {
          setError(mapAuthErrorMessage(errorMessage) ?? "Não foi possível enviar o código.");
        }
        setLoading(false);
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("orya_pending_email", emailToUse);
        window.localStorage.setItem("orya_pending_step", "verify");
        window.localStorage.setItem(
          "orya_otp_type",
          json?.otpType === "magiclink" ? "magiclink" : "signup",
        );
      }
      setEmail(emailToUse);
      setVerifyOtpSent(false);
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

    if (!emailToUse || !isEmailLike(emailToUse)) {
      setError("Indica o teu email para validares o código.");
      setLoading(false);
      return;
    }

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError("Introduce o código completo (6-8 dígitos).");
      setLoading(false);
      return;
    }

    const storedType =
      typeof window !== "undefined" ? window.localStorage.getItem("orya_otp_type") : null;
    const preferredType =
      storedType === "magiclink" ? "magiclink" : "signup";
    const fallbackType =
      preferredType === "signup" ? "magiclink" : "signup";

    let { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
      type: preferredType as any,
      email: emailToUse,
      token: cleanOtp,
    });

    if (verifyError) {
      const fallback = await supabaseBrowser.auth.verifyOtp({
        type: fallbackType as any,
        email: emailToUse,
        token: cleanOtp,
      });
      if (!fallback.error) {
        verifyError = null;
        if (typeof window !== "undefined") {
          window.localStorage.setItem("orya_otp_type", fallbackType);
        }
      } else {
        verifyError = fallback.error;
      }
    }

    if (verifyError) {
      const message = verifyError.message || "Código inválido ou expirado. Verifica o email e tenta novamente.";
      setError(message);
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

  async function checkUsernameAvailability(
    currentUsername: string,
  ): Promise<"available" | "taken" | "reserved" | "error" | "invalid"> {
    const trimmed = sanitizeUsername(currentUsername);
    if (!trimmed) {
      setUsernameHint(USERNAME_RULES_HINT);
      setUsernameStatus("idle");
      return "invalid";
    }

    const validation = validateUsername(trimmed, { allowReservedForEmail });
    if (!validation.valid) {
      setUsernameHint(validation.error);
      setUsernameStatus("error");
      return "invalid";
    }

    setUsernameHint(null);
    setUsernameStatus("checking");
    try {
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(trimmed)}`);

      if (!res.ok) {
        setUsernameStatus("error");
        setUsernameHint("Não foi possível verificar o username.");
        return "error";
      }

      const data = (await res.json()) as { available?: boolean; reason?: string };
      const available = Boolean(data?.available);
      if (!available && data?.reason === "reserved") {
        if (isReservedUsernameAllowed(trimmed, allowReservedForEmail)) {
          setUsernameStatus("available");
          setUsernameHint(null);
          return "available";
        }
        setUsernameStatus("reserved");
        setUsernameHint("Este username está reservado.");
        return "reserved";
      }
      setUsernameStatus(available ? "available" : "taken");
      return available ? "available" : "taken";
    } catch (e) {
      console.error("Erro a verificar username:", e);
      setUsernameStatus("error");
      setUsernameHint("Não foi possível verificar o username.");
      return "error";
    }
  }

  async function handleOnboardingSave() {
    setError(null);
    setLoading(true);

    try {
      const interestSelection = normalizeInterestSelection(onboardingInterests);
      const trimmedName = fullName.trim();
      const usernameClean = sanitizeUsername(username);
      const validation = validateUsername(usernameClean, { allowReservedForEmail });

      if (!trimmedName || !validation.valid) {
        setError(validation.valid ? "Preenche o nome e o username." : validation.error);
        setLoading(false);
        return;
      }

      const availability = await checkUsernameAvailability(usernameClean);
      if (availability === "error") {
        setError("Não foi possível verificar o username.");
        setLoading(false);
        return;
      }
      if (availability === "reserved") {
        setError("Este username está reservado.");
        setLoading(false);
        return;
      }
      if (availability === "taken") {
        setError("Este @ já está a ser usado — escolhe outro.");
        setLoading(false);
        return;
      }
      if (availability !== "available") {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/profiles/save-basic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: trimmedName,
          username: validation.normalized,
          favouriteCategories: interestSelection,
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
            profile: {
              ...prev.profile,
              onboardingDone: true,
              favouriteCategories: interestSelection,
            },
          };
        }
        return prev;
      }, false);
      closeModal();
      router.push(sanitizeRedirectPath(redirectTo, "/me"));
      setLoading(false);
    } catch (err) {
      console.error("handleOnboardingSave error", err);
      setError("Ocorreu um erro ao guardar o perfil.");
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isAuthEmailSending = loginOtpSending || resetPasswordSending;
  const isOtpRetryBlocked = signupCooldown > 0;
  const onboardingUsername = sanitizeUsername(username);
  const onboardingValidation = validateUsername(onboardingUsername, { allowReservedForEmail });
  const isOnboardingReady =
    Boolean(fullName.trim()) &&
    onboardingValidation.valid &&
    onboardingInterests.length > 0;

  const title =
    mode === "login"
      ? "Entrar na ORYA"
      : mode === "signup"
      ? "Criar conta na ORYA"
      : mode === "verify"
      ? "Confirmar email"
      : mode === "reset"
      ? "Recuperar acesso"
      : "Completar perfil";

  const subtitle =
    mode === "login"
      ? "Acede à tua conta e continua onde ficaste."
      : mode === "signup"
      ? "Demora segundos. Depois é só viver eventos."
      : mode === "verify"
      ? "Valida o código que enviámos para o teu email."
      : mode === "reset"
      ? "Enviaremos um link seguro para redefinires a palavra-passe."
      : "Só falta isto para ficares pronto.";


  const isPrimaryDisabled =
    loading ||
    ((mode === "login" || mode === "signup") && (!email || !password)) ||
    (mode === "signup" && password.length < 6) ||
    (mode === "signup" && (password !== confirmPassword || !confirmPassword)) ||
    (mode === "signup" && isSignupBlocked) ||
    (mode === "verify" && (!email || !isEmailLike(email) || otp.trim().length < 6)) ||
    (mode === "reset" && (!email || !email.trim())) ||
    (mode === "onboarding" && !isOnboardingReady);

  const handleClose = () => {
    if (!dismissible || isOnboarding) return;
    hardResetAuthState();
    closeModal();
    router.push(sanitizeRedirectPath(redirectTo, "/"));
  };

  const canClose = !isOnboarding && dismissible;

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
                    ? `${CTA_PRIMARY} px-3 py-2`
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
                    ? `${CTA_PRIMARY} px-3 py-2`
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
            <label className="block text-xs text-white/70 mb-1">
              {mode === "login" ? "Email ou username" : "Email"}
            </label>
            <input
              type={mode === "login" ? "text" : "email"}
              value={email ?? ""}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
                setLoginOtpSent(false);
                setSignupCooldown(0);
                setVerifyOtpSent(false);
              }}
              autoComplete={mode === "login" ? "username" : "email"}
              autoCapitalize="none"
              inputMode={mode === "login" ? "text" : "email"}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder={mode === "login" ? "nome@exemplo.com ou @username" : "nome@exemplo.com"}
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
                autoComplete={mode === "login" ? "current-password" : "new-password"}
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

            {mode === "login" && (
              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  disabled={isPrimaryDisabled}
                  onClick={handleLogin}
                  className={`${CTA_PRIMARY} w-full justify-center px-4 py-2.5 text-[13px] disabled:opacity-50`}
                >
                  {loading ? "A processar…" : "Entrar"}
                </button>
                <div className="flex items-center justify-between text-[11px] text-white/70">
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    disabled={isAuthEmailSending}
                    className="text-left text-[11px] text-white/70 hover:text-white disabled:opacity-60"
                  >
                    Esqueceste a palavra-passe?
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-white/35">
                  <span className="h-px flex-1 bg-white/10" />
                  ou
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              </div>
            )}

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
                    autoComplete="new-password"
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

            {(mode === "login" || mode === "signup") && showGoogle && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    const redirect =
                      typeof window !== "undefined"
                        ? `${window.location.origin}/auth/callback`
                        : undefined;
                    if (typeof window !== "undefined") {
                      try {
                        const currentPath = `${window.location.pathname}${window.location.search}`;
                        window.localStorage.setItem(
                          "orya_post_auth_redirect",
                          redirectTo ?? currentPath,
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
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow hover:border-white/40 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[11px] font-bold text-black">
                  G
                </span>
                Continuar com Google
              </button>
            )}

            {(mode === "login" || mode === "signup") && showGoogle && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    const redirect =
                      typeof window !== "undefined"
                        ? `${window.location.origin}/auth/callback`
                        : undefined;
                    if (typeof window !== "undefined") {
                      try {
                        const currentPath = `${window.location.pathname}${window.location.search}`;
                        window.localStorage.setItem(
                          "orya_post_auth_redirect",
                          redirectTo ?? currentPath,
                        );
                      } catch {}
                    }
                    const { error: oauthError } =
                      await supabaseBrowser.auth.signInWithOAuth({
                        provider: "apple",
                        options: { redirectTo: redirect },
                      });
                    if (oauthError) {
                      setError(
                        oauthError.message ??
                          "Não foi possível iniciar sessão com Apple.",
                      );
                    }
                  } catch (err) {
                    console.error("[AuthModal] Apple OAuth error:", err);
                    setError(
                      "Não foi possível iniciar sessão com Apple. Tenta novamente.",
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow hover:border-white/40 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[11px] font-bold text-black">
                  
                </span>
                Continuar com Apple
              </button>
            )}

            {mode === "login" && loginOtpSent && (
              <span className="mt-2 block text-emerald-300 text-[11px]">Email enviado.</span>
            )}

            <p className="mt-3 text-[10px] text-white/50 leading-snug">
              Ao continuar, aceitas os termos.
            </p>
          </>
        )}

        {mode === "verify" && (
          <>
            <p className="text-sm text-white/80 mb-2">
              Código enviado para{" "}
              <strong>{isEmailLike(email) ? email : "teu email"}</strong>.
            </p>
            <label className="block text-xs text-white/70 mb-1">Email</label>
            <input
              type="email"
              value={email ?? ""}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
                setLoginOtpSent(false);
                setVerifyOtpSent(false);
              }}
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="nome@exemplo.com"
            />
            <label className="block text-xs text-white/70 mb-1">Código</label>
            <input
              type="text"
              maxLength={8}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value);
                setVerifyOtpSent(false);
              }}
              autoComplete="one-time-code"
              inputMode="numeric"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="Código de 6 dígitos"
            />
            <div className="mt-2 text-[12px] text-white/65">
              Se não recebeste o email, verifica a caixa de spam.
            </div>
            <div className="mt-3 flex items-center justify-between text-[12px] text-white/65">
              <button
                type="button"
                onClick={() => triggerOtpRetry(email ?? "")}
                disabled={loginOtpSending || isOtpRetryBlocked || !email || !isEmailLike(email)}
                className="text-left text-[#6BFFFF] hover:text-white disabled:opacity-60 transition"
              >
                {loginOtpSending
                  ? "A pedir novo código…"
                  : isOtpRetryBlocked
                    ? `Novo código em ${signupCooldown}s`
                    : "Pedir novo código"}
              </button>
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
            {verifyOtpSent && (
              <p className="mt-2 text-[11px] text-emerald-300">
                Novo código enviado. Verifica o email.
              </p>
            )}
          </>
        )}

        {mode === "reset" && (
          <>
            <div className="mt-1 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80">
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 2a5 5 0 0 0-5 5v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5m-3 7V7a3 3 0 0 1 6 0v2z"
                  />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-center text-sm text-white/75">
              Indica o teu email para enviarmos o link de recuperação.
            </p>
            <label className="mt-4 block text-xs text-white/70 mb-1">Email</label>
            <input
              type="email"
              value={email ?? ""}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="nome@exemplo.com"
            />
            <button
              type="button"
              onClick={handleLoginOtp}
              disabled={isAuthEmailSending || !email}
              className="mt-3 text-[11px] text-white/65 hover:text-white disabled:opacity-60"
            >
              {loginOtpSending ? "A enviar link…" : "Entrar com link por email"}
            </button>
            {resetEmailSent && (
              <p className="mt-3 text-center text-[11px] text-emerald-300">
                Se existir uma conta, enviámos o link de recuperação.
              </p>
            )}
            {loginOtpSent && (
              <p className="mt-3 text-center text-[11px] text-emerald-300">
                Se existir uma conta, enviámos o link de login.
              </p>
            )}
          </>
        )}

        {mode === "onboarding" && (
          <>
            <p className="text-sm text-white/75 mb-3">
              Bem-vindo! Só faltam estes dados para concluíres o teu perfil.
            </p>

            <label className="block text-xs text-white/70 mb-1">
              Nome completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
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
                  pattern="[A-Za-z0-9._]{0,30}"
                  value={username}
                  maxLength={30}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const cleaned = sanitizeUsername(raw);
                    setUsername(cleaned);
                    const validation = validateUsername(cleaned, { allowReservedForEmail });
                    setUsernameHint(validation.valid ? null : validation.error);
                    setUsernameStatus("idle");
                  }}
                  onBlur={() => checkUsernameAvailability(username)}
                  autoComplete="username"
                  autoCapitalize="none"
                  className="flex-1 bg-transparent outline-none"
                  placeholder="ines.martins"
                />
              </div>
              {usernameHint && (
                <p className="mt-1 text-[10px] text-amber-300/90">{usernameHint}</p>
              )}
              {usernameStatus === "checking" && (
                <p className="mt-1 text-[10px] text-white/60">A verificar disponibilidade...</p>
              )}
              {usernameStatus === "available" && username && (
                <p className="mt-1 text-[10px] text-emerald-300">Este username está disponível.</p>
              )}
              {usernameStatus === "taken" && (
                <p className="mt-1 text-[10px] text-red-300">Este username já existe, escolhe outro.</p>
              )}
              {usernameStatus === "reserved" && (
                <p className="mt-1 text-[10px] text-red-300">Este username está reservado.</p>
              )}
              {usernameStatus === "error" && !usernameHint && (
                <p className="mt-1 text-[10px] text-red-300">Não foi possível verificar o username.</p>
              )}

            <p className="mt-1 text-[10px] text-white/45 leading-snug">
              Podes alterar estes dados nas definições.
            </p>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>Interesses</span>
                <span className="text-[10px] text-white/50">
                  {onboardingInterests.length}/{INTEREST_MAX_SELECTION}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => {
                  const isActive = onboardingInterests.includes(interest.id);
                  const isLimitReached =
                    !isActive && onboardingInterests.length >= INTEREST_MAX_SELECTION;
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      disabled={isLimitReached}
                      onClick={() => {
                        setOnboardingInterests((prev) => {
                          if (prev.includes(interest.id)) {
                            return prev.filter((item) => item !== interest.id);
                          }
                          if (prev.length >= INTEREST_MAX_SELECTION) return prev;
                          return [...prev, interest.id];
                        });
                      }}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        isActive
                          ? "border-[#6BFFFF]/50 bg-[#6BFFFF]/15 text-[#d9ffff]"
                          : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                      } ${isLimitReached ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <InterestIcon id={interest.id} className="h-3 w-3" />
                      {interest.label}
                    </button>
                  );
                })}
              </div>
              {onboardingInterests.length === 0 && (
                <p className="text-[10px] text-white/45">
                  Escolhe pelo menos um interesse para personalizarmos a tua experiência.
                </p>
              )}
            </div>
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
                  disabled={isAuthEmailSending}
                  onClick={handleLoginOtp}
                  className="w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  {loginOtpSending ? "A enviar link de login…" : "Enviar link de login por email"}
                </button>
                <button
                  type="button"
                  disabled={isAuthEmailSending}
                  onClick={handleResetPassword}
                  className="w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  {resetPasswordSending ? "A enviar recuperação…" : "Recuperar password"}
                </button>
                {loginOtpSent && (
                  <p className="text-emerald-300 text-[11px]">
                    Verifica o teu email.
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
          {mode === "signup" && (
            <button
              type="button"
              disabled={isPrimaryDisabled}
              onClick={handleSignup}
              className={`${CTA_PRIMARY} w-full justify-center px-4 py-2.5 text-[13px] disabled:opacity-50`}
            >
              {loading
                ? "A processar…"
                : "Criar conta"}
            </button>
          )}

          {mode === "verify" && (
            <button
              type="button"
              disabled={isPrimaryDisabled}
              onClick={handleVerify}
              className={`${CTA_PRIMARY} w-full justify-center px-4 py-2.5 text-[13px] disabled:opacity-50`}
            >
              {loading ? "A validar…" : "Confirmar código"}
            </button>
          )}

          {mode === "reset" && (
            <button
              type="button"
              disabled={isPrimaryDisabled || isAuthEmailSending}
              onClick={handleResetPassword}
              className={`${CTA_PRIMARY} w-full justify-center px-4 py-2.5 text-[13px] disabled:opacity-50`}
            >
              {resetPasswordSending ? "A enviar recuperação…" : "Enviar link de recuperação"}
            </button>
          )}

          {mode === "onboarding" && (
            <button
              type="button"
              disabled={isPrimaryDisabled}
              onClick={handleOnboardingSave}
              className={`${CTA_PRIMARY} w-full justify-center px-4 py-2.5 text-[13px] disabled:opacity-50`}
            >
              {loading ? "A guardar…" : "Guardar e continuar"}
            </button>
          )}

          {mode === "reset" && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-[11px] text-white/60 hover:text-white"
            >
              Voltar ao login
            </button>
          )}

          <button
            type="button"
            onClick={canClose ? handleClose : undefined}
            disabled={!canClose}
            className="text-[11px] text-white/50 hover:text-white disabled:opacity-60"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
