"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type ApiEnvelope<T> =
  | { ok: true; data: T; requestId: string; correlationId: string }
  | { ok: false; errorCode: string; message: string; requestId: string; correlationId: string };

type MfaStatus = {
  enabled: boolean;
  pending?: boolean;
  updatedAt?: string | null;
  recoveryUnused?: number;
  configMissing?: boolean;
};

type MfaEnrollPayload = {
  otpauth: string;
  recoveryCodes: string[];
};

export default function MfaChallengeClient({
  redirectTo,
  adminEmail,
}: {
  redirectTo: string;
  adminEmail: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<{ loading: boolean; error?: string; data?: MfaStatus | null }>({
    loading: true,
    error: undefined,
    data: null,
  });
  const [enroll, setEnroll] = useState<MfaEnrollPayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [recoveryDownloaded, setRecoveryDownloaded] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<"success" | "error" | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [breakGlassToken, setBreakGlassToken] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const prev = document.body.getAttribute("data-nav-hidden");
    document.body.setAttribute("data-nav-hidden", "true");
    return () => {
      if (prev) {
        document.body.setAttribute("data-nav-hidden", prev);
      } else {
        document.body.removeAttribute("data-nav-hidden");
      }
    };
  }, []);

  const loadStatus = useCallback(async () => {
    setStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/mfa/status", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<MfaStatus> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setStatus({ loading: false, error: json.message ?? json.errorCode, data: null });
        return;
      }
      setStatus({ loading: false, error: undefined, data: json.data });
    } catch (err: any) {
      setStatus({ loading: false, error: err?.message ?? "Erro ao carregar", data: null });
    }
  }, []);

  const enrollMfa = useCallback(async () => {
    setEnroll(null);
    setQrDataUrl(null);
    setRecoveryDownloaded(false);
    setShowRecovery(false);
    setNotice(null);
    setNoticeKind(null);
    setStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/mfa/enroll", { method: "POST" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<MfaEnrollPayload> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setStatus({ loading: false, error: json.message ?? json.errorCode, data: null });
        setNotice(json.message ?? "Não foi possível gerar 2FA.");
        setNoticeKind("error");
        return;
      }
      setEnroll(json.data);
      setStatus((prev) => ({
        loading: false,
        error: undefined,
        data: {
          enabled: false,
          pending: true,
          updatedAt: prev.data?.updatedAt ?? null,
          recoveryUnused: prev.data?.recoveryUnused,
          configMissing: prev.data?.configMissing,
        },
      }));
      setNotice("QR gerado. Valida o código para ativar.");
      setNoticeKind("success");
    } catch (err: any) {
      setStatus({ loading: false, error: err?.message ?? "Erro ao iniciar 2FA", data: null });
    }
  }, []);

  const verifyMfa = useCallback(async () => {
    setNotice(null);
    setNoticeKind(null);
    setStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode, recoveryCode }),
      });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ ok: boolean }> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setStatus({ loading: false, error: json.message ?? json.errorCode, data: null });
        setNotice(json.message ?? "Código 2FA inválido.");
        setNoticeKind("error");
        return;
      }
      setMfaCode("");
      setRecoveryCode("");
      setNotice("2FA validado. A entrar no admin.");
      setNoticeKind("success");
      router.replace(redirectTo);
    } catch (err: any) {
      setStatus({ loading: false, error: err?.message ?? "Erro ao validar 2FA", data: null });
      setNotice(err?.message ?? "Erro ao validar 2FA");
      setNoticeKind("error");
    }
  }, [mfaCode, recoveryCode, redirectTo, router]);

  const resetMfa = useCallback(async () => {
    if (!breakGlassToken.trim()) return;
    setResetting(true);
    setNotice(null);
    setNoticeKind(null);
    try {
      const res = await fetch("/api/admin/mfa/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-orya-mfa-break-glass": breakGlassToken.trim(),
        },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<MfaEnrollPayload> | null;
      if (!json || !json.ok) {
        setNotice(json?.message ?? "Não foi possível fazer reset.");
        setNoticeKind("error");
        return;
      }
      setEnroll(json.data);
      setRecoveryDownloaded(false);
      setShowRecovery(false);
      setBreakGlassToken("");
      setStatus((prev) => ({
        loading: false,
        error: undefined,
        data: {
          enabled: false,
          pending: true,
          updatedAt: prev.data?.updatedAt ?? null,
          recoveryUnused: prev.data?.recoveryUnused,
          configMissing: prev.data?.configMissing,
        },
      }));
      setNotice("Reset de emergência concluído. Valida o novo QR para ativar.");
      setNoticeKind("success");
    } catch (err: any) {
      setNotice(err?.message ?? "Erro ao fazer reset.");
      setNoticeKind("error");
    } finally {
      setResetting(false);
    }
  }, [breakGlassToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    let cancelled = false;
    if (!enroll?.otpauth) {
      setQrDataUrl(null);
      return () => {
        cancelled = true;
      };
    }
    QRCode.toDataURL(enroll.otpauth, { margin: 1, width: 220 })
      .then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enroll?.otpauth]);

  const downloadRecovery = useCallback(() => {
    if (!enroll?.recoveryCodes?.length) return;
    const contents = enroll.recoveryCodes.join("\n");
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orya-admin-recovery.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setRecoveryDownloaded(true);
    setShowRecovery(false);
    setEnroll((prev) => (prev ? { ...prev, recoveryCodes: [] } : prev));
  }, [enroll]);

  const isReady = useMemo(() => Boolean(mfaCode.trim() || recoveryCode.trim()), [mfaCode, recoveryCode]);

  return (
    <div className="admin-shell relative min-h-screen text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(120,160,255,0.18),transparent_52%),radial-gradient(circle_at_88%_14%,rgba(140,255,214,0.12),transparent_55%),linear-gradient(160deg,rgba(7,10,18,0.98),rgba(10,14,23,0.96))]" />
        <div className="admin-grid absolute inset-0 opacity-50" />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[rgba(9,13,22,0.9)] p-6 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">Admin • Segurança</p>
              <h1 className="text-2xl font-semibold text-white/95">Verificação 2FA</h1>
              <p className="text-sm text-white/60">
                Esta área exige autenticação reforçada. Confirma o código do Google Authenticator para continuar.
              </p>
              {adminEmail && (
                <p className="text-[12px] text-white/45">
                  Conta: <span className="text-white/70">{adminEmail}</span>
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[rgba(9,13,22,0.9)] p-6 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
            {status.loading && <p className="text-sm text-white/60">A carregar estado 2FA…</p>}
            {status.error && <p className="text-sm text-rose-300">{status.error}</p>}
            {status.data?.configMissing && (
              <p className="text-sm text-amber-200">ADMIN_TOTP_ENCRYPTION_KEY em falta no servidor.</p>
            )}
            {notice && (
              <p className={`text-sm ${noticeKind === "error" ? "text-rose-300" : "text-emerald-200/80"}`}>
                {notice}
              </p>
            )}

            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">1. Enrolar 2FA</p>
                <button
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                  onClick={enrollMfa}
                  disabled={status.loading || status.data?.enabled || status.data?.pending || status.data?.configMissing}
                >
                  {status.data?.enabled
                    ? "2FA ativo"
                    : status.data?.pending
                      ? "2FA já iniciado"
                      : "Gerar QR/Chave"}
                </button>
                {status.data?.enabled && (
                  <p className="text-[11px] text-white/50">2FA já ativo. Usa o código para entrar.</p>
                )}
                {status.data?.pending && !status.data?.enabled && (
                  <p className="text-[11px] text-amber-200">
                    2FA já foi iniciado. Usa o código do teu autenticador para ativar. Para gerar novo QR, é necessário reset.
                  </p>
                )}
                {enroll && !status.data?.enabled && (
                  <div className="space-y-3 text-xs text-white/80">
                    {qrDataUrl ? (
                      <Image
                        src={qrDataUrl}
                        alt="QR Code 2FA"
                        width={176}
                        height={176}
                        className="h-44 w-44 rounded-lg border border-white/10 bg-white/5 p-2"
                        unoptimized
                      />
                    ) : (
                      <p className="text-xs text-white/60">A gerar QR…</p>
                    )}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {!recoveryDownloaded && (
                          <button
                            className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                            onClick={() => setShowRecovery((prev) => !prev)}
                          >
                            {showRecovery ? "Esconder recovery codes" : "Mostrar recovery codes"}
                          </button>
                        )}
                        <button
                          className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                          onClick={downloadRecovery}
                          disabled={recoveryDownloaded}
                        >
                          {recoveryDownloaded ? "Recovery codes guardados" : "Download recovery codes"}
                        </button>
                      </div>
                      {!recoveryDownloaded && showRecovery && (
                        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                          <p className="text-[11px] text-white/60 mb-1">Recovery codes (guardar):</p>
                          {enroll.recoveryCodes.map((code) => (
                            <div key={code} className="font-mono">{code}</div>
                          ))}
                        </div>
                      )}
                      {!recoveryDownloaded && !showRecovery && (
                        <p className="text-[11px] text-white/50">
                          Os recovery codes são mostrados apenas uma vez. Guarda-os num local seguro.
                        </p>
                      )}
                      {recoveryDownloaded && (
                        <p className="text-[11px] text-emerald-200">
                          Recovery codes guardados. Por segurança, não serão mostrados novamente.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">2. Validar</p>
                <input
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40"
                  placeholder="Código 2FA"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40"
                  placeholder="Recovery code (opcional)"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                />
                <button
                  className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                  onClick={verifyMfa}
                  disabled={status.loading || status.data?.configMissing || !isReady}
                >
                  Entrar no admin
                </button>
                <details className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                  <summary className="cursor-pointer text-[11px] uppercase tracking-[0.2em] text-rose-200">
                    Reset de emergência
                  </summary>
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-rose-200/80">
                      Usa o break-glass token apenas se perdeste o autenticador. Isto gera um novo QR e invalida o anterior.
                    </p>
                    <input
                      className="w-full rounded-lg border border-rose-300/30 bg-black/20 px-3 py-2 text-xs text-rose-100 placeholder:text-rose-200/50"
                      placeholder="Break-glass token"
                      value={breakGlassToken}
                      onChange={(e) => setBreakGlassToken(e.target.value)}
                    />
                    <button
                      className="rounded-lg border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-xs text-rose-100 hover:bg-rose-500/30 disabled:opacity-60"
                      onClick={resetMfa}
                      disabled={resetting || !breakGlassToken.trim()}
                    >
                      {resetting ? "A resetar…" : "Reset 2FA"}
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
