"use client";

import { useEffect, useState } from "react";
import FormField from "./FormField";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { sanitizeUsername, validateUsername } from "@/lib/username";
import { isReservedUsernameAllowed } from "@/lib/reservedUsernames";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

type AuthWallProps = {
  onAuthenticated?: (userId: string) => void;
  ticketPluralWithArticle: string;
  variant?: "card" | "plain";
  showHeader?: boolean;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function checkUsernameAvailabilityRemote(
  value: string,
  onError: (message: string) => void,
  allowReservedForEmail?: string | null,
) {
  const cleaned = sanitizeUsername(value);
  const validation = validateUsername(cleaned, { allowReservedForEmail });
  if (!validation.valid) {
    onError(validation.error);
    return { ok: false, username: cleaned };
  }
  try {
    const res = await fetch(`/api/username/check?username=${encodeURIComponent(cleaned)}`);
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.available === false) {
      if (json?.reason === "reserved" && isReservedUsernameAllowed(cleaned, allowReservedForEmail)) {
        return { ok: true, username: validation.normalized };
      }
      const message =
        json?.reason === "reserved" ? "Este username está reservado." : "Esse @ já está a ser usado.";
      onError(message);
      return { ok: false, username: cleaned };
    }
    return { ok: true, username: validation.normalized };
  } catch (err) {
    console.error("[AuthWall] erro a verificar username", err);
    onError("Não foi possível verificar o username. Tenta novamente.");
    return { ok: false, username: cleaned };
  }
}

export default function AuthWall({
  onAuthenticated,
  ticketPluralWithArticle,
  variant = "card",
  showHeader = true,
}: AuthWallProps) {
  const [mode, setMode] = useState<"login" | "signup" | "verify">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [authOtpCooldown, setAuthOtpCooldown] = useState(0);
  const isEmailLike = (value: string) => value.includes("@");
  const allowReservedForEmail = isEmailLike(identifier) ? identifier.trim().toLowerCase() : null;
  const isLogin = mode === "login";

  useEffect(() => {
    if (authOtpCooldown <= 0) return;
    const timer = setTimeout(() => {
      setAuthOtpCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [authOtpCooldown]);

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
      console.warn("[AuthWall] syncSessionWithServer falhou", err);
    }
  }

  async function triggerOtpRetry(emailValue: string) {
    if (!emailValue || !isEmailLike(emailValue)) {
      setError("Indica um email válido para pedir um novo código.");
      return;
    }
    if (authOtpCooldown > 0) {
      setError(`Aguarda ${authOtpCooldown}s antes de pedir um novo código.`);
      return;
    }
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        const errorCode = getErrorCode(data);
        const errorMessage = getErrorMessage(data);
        if (res.status === 429 || isRateLimited(errorCode)) {
          const retryAfterHeader = res.headers.get("Retry-After");
          const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          const cooldownSeconds =
            Number.isFinite(retryAfter) && retryAfter > 0 ? Math.round(retryAfter) : 60;
          setAuthOtpCooldown(cooldownSeconds);
          setError(errorMessage ?? "Muitas tentativas. Tenta novamente dentro de alguns minutos.");
          return;
        }
        setError(errorMessage ?? "Não foi possível pedir um novo código.");
        return;
      }
      setAuthOtpCooldown(60);
      setError("Enviámos um novo código de verificação.");
    } catch (err) {
      console.error("[AuthWall] OTP retry error:", err);
      setError("Não foi possível pedir um novo código.");
    }
  }

  async function handleGoogle() {
    setSubmitting(true);
    setError(null);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      if (typeof window !== "undefined") {
        try {
          const currentPath = `${window.location.pathname}${window.location.search}`;
          localStorage.setItem("orya_post_auth_redirect", currentPath);
        } catch {}
      }
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setError(error.message ?? "Não foi possível iniciar sessão com Google.");
      }
    } catch (err) {
      console.error("[AuthWall] Google OAuth error:", err);
      setError("Não foi possível iniciar sessão com Google.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApple() {
    setSubmitting(true);
    setError(null);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      if (typeof window !== "undefined") {
        try {
          const currentPath = `${window.location.pathname}${window.location.search}`;
          localStorage.setItem("orya_post_auth_redirect", currentPath);
        } catch {}
      }
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo },
      });
      if (error) {
        setError(error.message ?? "Não foi possível iniciar sessão com Apple.");
      }
    } catch (err) {
      console.error("[AuthWall] Apple OAuth error:", err);
      setError("Não foi possível iniciar sessão com Apple.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const emailToUse = identifier.trim().toLowerCase();

      if (mode === "verify") {
        if (!identifier || !isEmailLike(identifier) || !otp.trim()) {
          setError("Indica o email e o código recebido.");
          return;
        }
        const token = otp.trim();
        let { error: verifyErr } = await supabaseBrowser.auth.verifyOtp({
          type: "signup",
          email: emailToUse,
          token,
        });
        if (verifyErr) {
          const fallback = await supabaseBrowser.auth.verifyOtp({
            type: "magiclink",
            email: emailToUse,
            token,
          });
          if (fallback.error) {
            setError(fallback.error.message || "Código inválido ou expirado.");
            setAuthOtpCooldown(0);
            return;
          }
          verifyErr = null;
        }
        await syncSessionWithServer();
        await delay(400);
        const { data: userData } = await supabaseBrowser.auth.getUser();
        if (userData?.user) onAuthenticated?.(userData.user.id);
        return;
      }

      if (!identifier || !password) {
        setError(
          isLogin
            ? "Preenche o email/username e a palavra-passe."
            : "Preenche o email e a palavra-passe.",
        );
        return;
      }

      if (mode === "login") {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
          credentials: "include",
        });
        const loginData = await loginRes.json().catch(() => null);
        if (!loginRes.ok || !loginData?.ok) {
          const errorCode = getErrorCode(loginData);
          const errorMessage = getErrorMessage(loginData);
          if (errorCode === "EMAIL_NOT_CONFIRMED") {
            const emailValue = isEmailLike(identifier) ? identifier : "";
            setMode("verify");
            setIdentifier(emailValue);
            setError(
              emailValue
                ? "Email ainda não confirmado. Reenviei-te um novo código."
                : "Email ainda não confirmado. Indica o teu email para receberes o código.",
            );
            if (emailValue) {
              await triggerOtpRetry(emailValue);
            }
            return;
          }
          if (isRateLimited(errorCode)) {
            setError(errorMessage ?? "Muitas tentativas. Tenta novamente dentro de minutos.");
            return;
          }
          setError(errorMessage ?? "Credenciais inválidas. Confirma username/email e password.");
          return;
        }

        const session = loginData?.session;
        if (session?.access_token && session?.refresh_token) {
          await supabaseBrowser.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
        await syncSessionWithServer();
      } else {
        if (password.length < 6) {
          setError("A password deve ter pelo menos 6 caracteres.");
          return;
        }
        if (password !== confirmPassword) {
          setError("As passwords não coincidem.");
          return;
        }
        if (!fullName.trim()) {
          setError("Nome é obrigatório para criar conta.");
          return;
        }
        const usernameCheck = await checkUsernameAvailabilityRemote(username, setError, allowReservedForEmail);
        if (!usernameCheck.ok) {
          setSubmitting(false);
          return;
        }

        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailToUse,
            password,
            username: usernameCheck.username,
            fullName: fullName.trim(),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          const errorCode = getErrorCode(data);
          const message = getErrorMessage(data) ?? "Não foi possível enviar o código de verificação.";
          if (isRateLimited(errorCode)) {
            const retryAfterHeader = res.headers.get("Retry-After");
            const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
            const cooldownSeconds =
              Number.isFinite(retryAfter) && retryAfter > 0 ? Math.round(retryAfter) : 60;
            setAuthOtpCooldown(cooldownSeconds);
          }
          setError(message);
          return;
        }

        setMode("verify");
        setIdentifier(emailToUse);
        setError("Enviámos um código para confirmar o email. Introduz para continuares.");
        setAuthOtpCooldown(60);
        return;
      }

      await delay(600);

      try {
        const { data: userData } = await supabaseBrowser.auth.getUser();
        if (userData?.user) {
          onAuthenticated?.(userData.user.id);
        }
      } catch (e: unknown) {
        console.warn("[AuthWall] Não foi possível ler user após login:", e);
      }
    } catch (err) {
      console.error("[AuthWall] Erro:", err);
      setError("Ocorreu um erro. Tenta novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const content = (
    <>
      {showHeader ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">
              Inicia sessão para continuar
            </h3>
            <p className="text-[11px] text-white/60 max-w-sm leading-relaxed">
              Para associar {ticketPluralWithArticle} à tua conta ORYA e evitar problemas no
              check-in, tens de estar com a sessão iniciada antes de pagar.
            </p>
          </div>
          <span className="text-[20px]">🔐</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
        {mode !== "verify" && (
          <div className="flex gap-2 text-[11px] bg-black/40 rounded-full p-1 border border-white/10 w-fit">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`px-3 py-1 rounded-full ${mode === "login" ? "bg-white text-black font-semibold" : "text-white/70"}`}
            >
              Já tenho conta
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`px-3 py-1 rounded-full ${mode === "signup" ? "bg-white text-black font-semibold" : "text-white/70"}`}
            >
              Criar conta
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 text-[12px]">
          {mode !== "verify" ? (
            <>
              <FormField
                id="auth-email"
                label={isLogin ? "Email ou username" : "Email"}
                required
                inputProps={{
                  type: isLogin ? "text" : "email",
                  value: identifier,
                  onChange: (e) => setIdentifier(e.target.value),
                  placeholder: isLogin ? "nome@exemplo.com ou @username" : "nome@exemplo.com",
                  autoComplete: isLogin ? "username" : "email",
                  autoCapitalize: "none",
                  inputMode: isLogin ? "text" : "email",
                }}
              />
              <FormField
                id="auth-password"
                label="Palavra-passe"
                required
                inputProps={{
                  type: "password",
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                  placeholder: "••••••••",
                  autoComplete: mode === "login" ? "current-password" : "new-password",
                }}
              />
              {mode === "signup" && (
                <>
                  <FormField
                    id="auth-password-confirm"
                    label="Confirmar palavra-passe"
                    required
                    inputProps={{
                      type: "password",
                      value: confirmPassword,
                      onChange: (e) => setConfirmPassword(e.target.value),
                      placeholder: "••••••••",
                      autoComplete: "new-password",
                    }}
                  />
                  <FormField
                    id="auth-full-name"
                    label="Nome completo"
                    required
                    inputProps={{
                      type: "text",
                      value: fullName,
                      onChange: (e) => setFullName(e.target.value),
                      placeholder: "O teu nome",
                      autoComplete: "name",
                    }}
                  />
                  <FormField
                    id="auth-username"
                    label="Username"
                    required
                    inputProps={{
                      type: "text",
                      value: username,
                      onChange: (e) => setUsername(e.target.value),
                      placeholder: "@teuuser",
                      autoComplete: "username",
                      autoCapitalize: "none",
                    }}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-[12px] text-white/70">
                Código enviado para{" "}
                <strong>{isEmailLike(identifier) ? identifier : "teu email"}</strong>. Introduz abaixo.
              </p>
              <FormField
                id="auth-verify-email"
                label="Email"
                required
                inputProps={{
                  type: "email",
                  value: identifier,
                  onChange: (e) => setIdentifier(e.target.value),
                  placeholder: "nome@exemplo.com",
                  autoComplete: "email",
                  autoCapitalize: "none",
                  inputMode: "email",
                }}
              />
              <FormField
                id="auth-verify-code"
                label="Código"
                required
                inputProps={{
                  type: "text",
                  maxLength: 8,
                  value: otp,
                  onChange: (e) => setOtp(e.target.value),
                  placeholder: "87612097",
                  autoComplete: "one-time-code",
                  inputMode: "numeric",
                }}
              />
              <div className="text-[11px] text-white/65">
                Se não recebeste o email, verifica a caixa de spam.
              </div>
              <div className="text-[11px] text-white/65">
                <button
                  type="button"
                  onClick={() => triggerOtpRetry(identifier)}
                  disabled={submitting || authOtpCooldown > 0}
                  className="text-[#6BFFFF] hover:text-white disabled:opacity-60 transition"
                >
                  {authOtpCooldown > 0 ? `Novo código em ${authOtpCooldown}s` : "Pedir novo código"}
                </button>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="text-[11px] text-red-300 mt-1 leading-snug">{error}</p>
        )}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-black/50 px-6 py-2.5 text-xs font-semibold text-white shadow hover:border-white/40 hover:bg-black/60 transition-colors disabled:opacity-50"
        >
          <span>Continuar com Google</span>
        </button>
        <button
          type="button"
          onClick={handleApple}
          disabled={submitting}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-black/50 px-6 py-2.5 text-xs font-semibold text-white shadow hover:border-white/40 hover:bg-black/60 transition-colors disabled:opacity-50"
        >
          <span>Continuar com Apple</span>
        </button>

        <button
          type="submit"
          disabled={submitting}
          className={`${CTA_PRIMARY} mt-2 w-full justify-center px-6 py-2.5 text-xs active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {mode === "verify"
            ? submitting
              ? "A confirmar…"
              : "Confirmar e continuar"
            : mode === "login"
            ? submitting
              ? "A entrar…"
              : "Entrar e continuar"
            : submitting
            ? "A enviar código…"
            : "Criar conta e enviar"}
        </button>
      </form>
    </>
  );

  if (variant === "plain") {
    return <div className="flex flex-col gap-4">{content}</div>;
  }

  return (
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] flex flex-col gap-4">
      {content}
    </div>
  );
}
