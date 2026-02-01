"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

type ApiEnvelope<T> =
  | { ok: true; data: T; requestId: string; correlationId: string }
  | { ok: false; errorCode: string; message: string; requestId: string; correlationId: string };

type InfraStatus = {
  stackName: string;
  status: string;
  updatedAt?: string;
  outputs?: Record<string, string>;
  services?: Array<Record<string, unknown>>;
};

type ActionResult = {
  action: string;
  requestId: string;
  correlationId: string;
  payload: Record<string, unknown>;
  ok: boolean;
};

type InfraCostSummary = {
  source?: "cost-explorer" | "budgets";
  currency?: string;
  total?: number;
  byService?: Array<{ service: string; amount: number }>;
  daily?: Array<{ date: string; amount: number }>;
  note?: string;
  cached?: boolean;
  cacheAgeSeconds?: number;
};

type InfraUsageSummary = {
  clusters?: Array<{ name: string; status: string }>;
  services?: Array<{ name: string; status: string; desired: number; running: number }>;
  loadBalancers?: Array<{ name: string; dns: string; scheme: string }>;
  notes?: string[];
};

type InfraAlertsSummary = {
  budgets?: Array<{ name: string; limit: string; unit: string; timeUnit: string }>;
  alarms?: Array<{ name: string; state: string; reason?: string }>;
};

type MfaStatus = {
  enabled: boolean;
  updatedAt?: string | null;
  recoveryUnused?: number;
  configMissing?: boolean;
};

const secretGroups = ["all", "app", "supabase", "payments", "apple", "email", "admin"] as const;
const secretEnvs = ["all", "prod", "dev"] as const;

export default function InfraClient({
  initialEnv,
  infraReadOnly,
}: {
  initialEnv: "prod" | "test";
  infraReadOnly: boolean;
}) {
  const [status, setStatus] = useState<{ loading: boolean; error?: string; data?: InfraStatus | null }>({
    loading: false,
    error: undefined,
    data: null,
  });
  const [action, setAction] = useState<ActionResult | null>(null);
  const [withAlb, setWithAlb] = useState(true);
  const [enableWorker, setEnableWorker] = useState(false);
  const [secretEnv, setSecretEnv] = useState<(typeof secretEnvs)[number]>("prod");
  const [secretGroup, setSecretGroup] = useState<(typeof secretGroups)[number]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const currentEnv = initialEnv;
  const [targetEnv, setTargetEnv] = useState<"prod" | "test">(initialEnv);
  const [confirmProd, setConfirmProd] = useState("");
  const [cost, setCost] = useState<{ loading: boolean; error?: string; data?: InfraCostSummary | null }>({
    loading: false,
    error: undefined,
    data: null,
  });
  const [usage, setUsage] = useState<{ loading: boolean; error?: string; data?: InfraUsageSummary | null }>({
    loading: false,
    error: undefined,
    data: null,
  });
  const [alerts, setAlerts] = useState<{ loading: boolean; error?: string; data?: InfraAlertsSummary | null }>({
    loading: false,
    error: undefined,
    data: null,
  });
  const [mfaStatus, setMfaStatus] = useState<{ loading: boolean; error?: string; data?: MfaStatus | null }>({
    loading: false,
    error: undefined,
    data: null,
  });
  const [mfaEnroll, setMfaEnroll] = useState<{ otpauth: string; recoveryCodes: string[] } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [recoveryDownloaded, setRecoveryDownloaded] = useState(false);
  const [mfaNotice, setMfaNotice] = useState<string | null>(null);
  const [mfaNoticeKind, setMfaNoticeKind] = useState<"success" | "error" | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const didInitialLoad = useRef(false);

  const loadStatus = useCallback(async () => {
    setStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/infra/status", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<InfraStatus> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setStatus({ loading: false, error: json.message ?? json.errorCode, data: null });
        setAction({
          action: "status",
          ok: false,
          requestId: json.requestId,
          correlationId: json.correlationId,
          payload: json as any,
        });
        return;
      }
      setStatus({ loading: false, error: undefined, data: json.data });
      setAction({ action: "status", ok: true, requestId: json.requestId, correlationId: json.correlationId, payload: json.data });
    } catch (err: any) {
      setStatus({ loading: false, error: err?.message ?? "Erro ao carregar", data: null });
    }
  }, []);

  const callAction = useCallback(
    async (name: string, path: string, body?: Record<string, unknown>) => {
      if (busy) return;
      if (targetEnv === "prod" && confirmProd.trim() !== "PROD") {
        setAction({
          action: name,
          ok: false,
          requestId: "n/a",
          correlationId: "n/a",
          payload: { message: "Confirmação PROD em falta. Escreve PROD para continuar." },
        });
        return;
      }
      setBusy(name);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetEnv, confirmProd, mfaCode, recoveryCode, ...(body ?? {}) }),
        });
        const json = (await res.json().catch(() => null)) as ApiEnvelope<Record<string, unknown>> | null;
        if (!json) throw new Error("Resposta inválida");
        setAction({
          action: name,
          ok: json.ok,
          requestId: json.requestId,
          correlationId: json.correlationId,
          payload: json.ok ? json.data : { errorCode: json.errorCode, message: json.message },
        });
        if (name === "deploy" || name === "start" || name === "resume" || name === "soft_pause") {
          await loadStatus();
        }
      } catch (err: any) {
        setAction({
          action: name,
          ok: false,
          requestId: "n/a",
          correlationId: "n/a",
          payload: { message: err?.message ?? "Erro" },
        });
      } finally {
        setBusy(null);
      }
    },
    [busy, loadStatus, targetEnv, confirmProd],
  );

  const outputs = useMemo(() => status.data?.outputs ?? {}, [status.data]);

  const loadCost = useCallback(async (force = false) => {
    setCost((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const url = force ? "/api/admin/infra/cost/summary?refresh=1" : "/api/admin/infra/cost/summary";
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<InfraCostSummary> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setCost({ loading: false, error: json.message ?? json.errorCode, data: null });
        return;
      }
      setCost({ loading: false, error: undefined, data: json.data });
    } catch (err: any) {
      setCost({ loading: false, error: err?.message ?? "Erro ao carregar", data: null });
    }
  }, []);

  const loadUsage = useCallback(async () => {
    setUsage((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/infra/usage/summary", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<InfraUsageSummary> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setUsage({ loading: false, error: json.message ?? json.errorCode, data: null });
        return;
      }
      setUsage({ loading: false, error: undefined, data: json.data });
    } catch (err: any) {
      setUsage({ loading: false, error: err?.message ?? "Erro ao carregar", data: null });
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlerts((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/infra/alerts/status", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<InfraAlertsSummary> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setAlerts({ loading: false, error: json.message ?? json.errorCode, data: null });
        return;
      }
      setAlerts({ loading: false, error: undefined, data: json.data });
    } catch (err: any) {
      setAlerts({ loading: false, error: err?.message ?? "Erro ao carregar", data: null });
    }
  }, []);

  const loadMfa = useCallback(async () => {
    setMfaStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/mfa/status", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<MfaStatus> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setMfaStatus({ loading: false, error: json.message ?? json.errorCode, data: null });
        return;
      }
      setMfaStatus({ loading: false, error: undefined, data: json.data });
    } catch (err: any) {
      setMfaStatus({ loading: false, error: err?.message ?? "Erro ao carregar", data: null });
    }
  }, []);

  const enrollMfa = useCallback(async () => {
    setMfaEnroll(null);
    setQrDataUrl(null);
    setRecoveryDownloaded(false);
    setMfaNotice(null);
    setMfaNoticeKind(null);
    setMfaStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/mfa/enroll", { method: "POST" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ otpauth: string; recoveryCodes: string[] }> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setMfaStatus({ loading: false, error: json.message ?? json.errorCode, data: null });
        return;
      }
      setMfaEnroll(json.data);
      setMfaStatus((prev) => ({ ...prev, loading: false }));
      setMfaNotice("QR gerado. Valida o código para ativar.");
      setMfaNoticeKind("success");
    } catch (err: any) {
      setMfaStatus({ loading: false, error: err?.message ?? "Erro ao iniciar 2FA", data: null });
    }
  }, []);

  const verifyMfa = useCallback(async () => {
    setMfaStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    setMfaNotice(null);
    setMfaNoticeKind(null);
    try {
      const res = await fetch("/api/admin/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode, recoveryCode }),
      });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ ok: boolean; usedRecovery?: boolean }> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setMfaStatus({ loading: false, error: json.message ?? json.errorCode, data: null });
        setMfaNotice(json.message ?? "Código 2FA inválido.");
        setMfaNoticeKind("error");
        return;
      }
      setMfaCode("");
      setRecoveryCode("");
      setMfaEnroll(null);
      setQrDataUrl(null);
      setRecoveryDownloaded(false);
      await loadMfa();
      setMfaNotice("2FA validado com sucesso.");
      setMfaNoticeKind("success");
    } catch (err: any) {
      setMfaStatus({ loading: false, error: err?.message ?? "Erro ao validar 2FA", data: null });
      setMfaNotice(err?.message ?? "Erro ao validar 2FA");
      setMfaNoticeKind("error");
    }
  }, [mfaCode, recoveryCode, loadMfa]);

  const resetMfa = useCallback(async () => {
    if (!mfaCode) {
      setMfaStatus((prev) => ({ ...prev, error: "Código 2FA obrigatório para reset." }));
      setMfaNotice("Código 2FA obrigatório para reset.");
      setMfaNoticeKind("error");
      return;
    }
    setMfaEnroll(null);
    setQrDataUrl(null);
    setRecoveryDownloaded(false);
    setMfaNotice(null);
    setMfaNoticeKind(null);
    setMfaStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/mfa/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode }),
      });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ otpauth: string; recoveryCodes: string[] }> | null;
      if (!json) throw new Error("Resposta inválida");
      if (!json.ok) {
        setMfaStatus({ loading: false, error: json.message ?? json.errorCode, data: null });
        setMfaNotice(json.message ?? "Código 2FA inválido.");
        setMfaNoticeKind("error");
        return;
      }
      setMfaEnroll(json.data);
      setMfaCode("");
      setRecoveryCode("");
      setMfaStatus((prev) => ({ ...prev, loading: false }));
      setMfaNotice("2FA resetado. Usa o novo QR e valida o código.");
      setMfaNoticeKind("success");
    } catch (err: any) {
      setMfaStatus({ loading: false, error: err?.message ?? "Erro ao resetar 2FA", data: null });
      setMfaNotice(err?.message ?? "Erro ao resetar 2FA");
      setMfaNoticeKind("error");
    }
  }, [mfaCode]);

  useEffect(() => {
    let cancelled = false;
    if (!mfaEnroll?.otpauth) {
      setQrDataUrl(null);
      return () => {
        cancelled = true;
      };
    }
    QRCode.toDataURL(mfaEnroll.otpauth, { margin: 1, width: 220 })
      .then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mfaEnroll?.otpauth]);

  const downloadRecovery = useCallback(() => {
    if (!mfaEnroll?.recoveryCodes?.length) return;
    const contents = mfaEnroll.recoveryCodes.join("\n");
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orya-recovery-${currentEnv}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setRecoveryDownloaded(true);
  }, [mfaEnroll, currentEnv]);

  useEffect(() => {
    loadMfa();
  }, [loadMfa]);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    loadStatus();
    loadCost();
    loadUsage();
    loadAlerts();
  }, [loadStatus, loadCost, loadUsage, loadAlerts]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Infra</p>
            <h2 className="text-sm font-semibold text-white/90">Estado</h2>
            <p className="mt-1 text-xs text-white/60">
              Ambiente atual: <span className="font-semibold text-white/90">{currentEnv.toUpperCase()}</span>
            </p>
            {infraReadOnly && (
              <p className="mt-2 text-xs text-amber-100/80">
                Infra em modo apenas leitura. Ações de deploy/pausa/rotação estão desativadas por agora.
              </p>
            )}
          </div>
          <button
            className="rounded-xl border border-white/20 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10"
            onClick={loadStatus}
          >
            Atualizar status
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Stack</p>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
              <p>Stack: {status.data?.stackName ?? "-"}</p>
              <p>Status: {status.data?.status ?? "-"}</p>
              <p>Atualizado: {status.data?.updatedAt ? new Date(status.data.updatedAt).toLocaleString() : "-"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Outputs</p>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80 space-y-1">
              <p>ALB: {outputs.LoadBalancerDNS ?? "-"}</p>
              <p>WebURL: {outputs.WebURL ?? "-"}</p>
              <p>TaskRole: {outputs.TaskRoleArn ?? "-"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Services</p>
          <div className="grid gap-3 md:grid-cols-2">
            {(status.data?.services ?? []).length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                Sem serviços detectados.
              </div>
            )}
            {(status.data?.services ?? []).map((svc, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                <p>Service: {String(svc.serviceName ?? "-")}</p>
                <p>Status: {String(svc.status ?? "-")}</p>
                <p>Desired: {String(svc.desiredCount ?? "-")}</p>
                <p>Running: {String(svc.runningCount ?? "-")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Infra</p>
              <h3 className="text-sm font-semibold text-white/90">Custos</h3>
              <p className="mt-1 text-xs text-white/60">Cost Explorer (MTD + diário)</p>
            </div>
            <button
              className="rounded-xl border border-white/20 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10"
              onClick={() => loadCost(true)}
            >
              Atualizar agora
            </button>
          </div>
          {cost.loading && <p className="text-xs text-white/60">A carregar…</p>}
          {cost.error && <p className="text-xs text-rose-300">{cost.error}</p>}
          {!cost.loading && !cost.error && !cost.data && <p className="text-xs text-white/60">Sem dados.</p>}
          {cost.data && (
            <div className="space-y-2 text-xs text-white/80">
              <p>
                Total MTD: {cost.data.total?.toFixed(2) ?? "-"} {cost.data.currency ?? ""}
                {cost.data.source ? (
                  <span className="ml-2 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-white/60">
                    {cost.data.source}
                  </span>
                ) : null}
                {cost.data.cached ? (
                  <span className="ml-2 rounded-md border border-emerald-400/40 px-2 py-0.5 text-[10px] text-emerald-200/80">
                    cached{typeof cost.data.cacheAgeSeconds === "number" ? ` • ${cost.data.cacheAgeSeconds}s` : ""}
                  </span>
                ) : null}
              </p>
              {cost.data.note && <p className="text-[11px] text-amber-100/70">{cost.data.note}</p>}
              <div className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-white/5 p-2">
                {(cost.data.byService ?? []).slice(0, 8).map((row) => (
                  <div key={row.service} className="flex items-center justify-between">
                    <span>{row.service}</span>
                    <span>{row.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Infra</p>
              <h3 className="text-sm font-semibold text-white/90">Uso</h3>
              <p className="mt-1 text-xs text-white/60">ECS/ALB (snapshot)</p>
            </div>
            <button
              className="rounded-xl border border-white/20 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10"
              onClick={loadUsage}
            >
              Atualizar
            </button>
          </div>
          {usage.loading && <p className="text-xs text-white/60">A carregar…</p>}
          {usage.error && <p className="text-xs text-rose-300">{usage.error}</p>}
          {!usage.loading && !usage.error && !usage.data && <p className="text-xs text-white/60">Sem dados.</p>}
          {usage.data && (
            <div className="space-y-2 text-xs text-white/80">
              <p>Clusters: {(usage.data.clusters ?? []).length}</p>
              <p>Services: {(usage.data.services ?? []).length}</p>
              <p>ALBs: {(usage.data.loadBalancers ?? []).length}</p>
              {(usage.data.notes ?? []).length ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/60">
                  {(usage.data.notes ?? []).map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Infra</p>
              <h3 className="text-sm font-semibold text-white/90">Alertas</h3>
              <p className="mt-1 text-xs text-white/60">Budgets + CloudWatch</p>
            </div>
            <button
              className="rounded-xl border border-white/20 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10"
              onClick={loadAlerts}
            >
              Atualizar
            </button>
          </div>
          {alerts.loading && <p className="text-xs text-white/60">A carregar…</p>}
          {alerts.error && <p className="text-xs text-rose-300">{alerts.error}</p>}
          {!alerts.loading && !alerts.error && !alerts.data && <p className="text-xs text-white/60">Sem dados.</p>}
          {alerts.data && (
            <div className="space-y-2 text-xs text-white/80">
              <p>Budgets: {(alerts.data.budgets ?? []).length}</p>
              <p>Alarms: {(alerts.data.alarms ?? []).length}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Segurança</p>
            <h3 className="text-sm font-semibold text-white/90">2FA (Google Auth)</h3>
            <p className="mt-1 text-xs text-white/60">Obrigatório para ações de infra.</p>
          </div>
          <button
            className="rounded-xl border border-white/20 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10"
            onClick={loadMfa}
          >
            Atualizar
          </button>
        </div>
        {mfaStatus.loading && <p className="text-xs text-white/60">A carregar…</p>}
        {mfaStatus.error && <p className="text-xs text-rose-300">{mfaStatus.error}</p>}
        {mfaStatus.data?.configMissing && (
          <p className="text-xs text-amber-300">ADMIN_TOTP_ENCRYPTION_KEY em falta.</p>
        )}
        {mfaNotice && (
          <p className={`text-xs ${mfaNoticeKind === "error" ? "text-rose-300" : "text-emerald-200/80"}`}>
            {mfaNotice}
          </p>
        )}
        {mfaStatus.data && (
          <p className="text-xs text-white/80">
            Estado: <span className="font-semibold">{mfaStatus.data.enabled ? "ATIVO" : "INATIVO"}</span>{" "}
            {typeof mfaStatus.data.recoveryUnused === "number" && (
              <span className="text-white/60">({mfaStatus.data.recoveryUnused} recovery codes)</span>
            )}
          </p>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Enrolar 2FA</p>
            <button
              className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
              onClick={enrollMfa}
              disabled={mfaStatus.loading || mfaStatus.data?.enabled || mfaStatus.data?.configMissing}
            >
              {mfaStatus.data?.enabled ? "2FA ativo" : "Gerar QR/Chave"}
            </button>
            {mfaStatus.data?.enabled && (
              <p className="text-[11px] text-white/50">2FA ativo. Para novo QR, faz reset.</p>
            )}
            {mfaStatus.data?.enabled && (
              <button
                className="rounded-lg border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 hover:bg-rose-500/20"
                onClick={resetMfa}
                disabled={mfaStatus.loading || mfaStatus.data?.configMissing}
              >
                Reset 2FA (gera novo QR)
              </button>
            )}
            {mfaEnroll && !mfaStatus.data?.enabled && (
              <div className="space-y-2 text-xs text-white/80">
                <div className="flex flex-col gap-2">
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
                  <p className="break-all text-[11px] text-white/60">otpauth: {mfaEnroll.otpauth}</p>
                </div>
                <button
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                  onClick={downloadRecovery}
                  disabled={recoveryDownloaded}
                >
                  {recoveryDownloaded ? "Recovery codes guardados" : "Download recovery codes"}
                </button>
                {!recoveryDownloaded && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <p className="text-[11px] text-white/60 mb-1">Recovery codes (guardar):</p>
                    {mfaEnroll.recoveryCodes.map((code) => (
                      <div key={code}>{code}</div>
                    ))}
                  </div>
                )}
                {recoveryDownloaded && (
                  <p className="text-[11px] text-emerald-200/80">
                    Guardado. Estes códigos não voltam a ser mostrados.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Validar 2FA</p>
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
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20"
              onClick={verifyMfa}
              disabled={mfaStatus.loading || mfaStatus.data?.configMissing}
            >
              {mfaStatus.data?.enabled ? "Validar código" : "Ativar / Verificar"}
            </button>
          </div>
        </div>
      </div>

      {!infraReadOnly && (
        <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Controlos</p>
          <h3 className="mb-4 text-sm font-semibold text-white/90">Operações</h3>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <label className="inline-flex items-center gap-2">
              <span>Target</span>
              <select
                className="rounded-md bg-white/10 px-2 py-1 text-sm text-white"
                value={targetEnv}
                onChange={(e) => setTargetEnv(e.target.value as "prod" | "test")}
              >
                <option value="prod">PROD</option>
                <option value="test">TEST</option>
              </select>
            </label>
            {targetEnv === "prod" && (
              <label className="inline-flex items-center gap-2">
                <span>Confirmação</span>
                <input
                  className="rounded-md bg-white/10 px-2 py-1 text-xs text-white placeholder:text-white/40"
                  placeholder="Escreve PROD"
                  value={confirmProd}
                  onChange={(e) => setConfirmProd(e.target.value)}
                />
              </label>
            )}
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={withAlb} onChange={(e) => setWithAlb(e.target.checked)} />
              Criar ALB
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={enableWorker} onChange={(e) => setEnableWorker(e.target.checked)} />
              Worker (Spot)
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20"
              onClick={() => callAction("start", "/api/admin/infra/start", { withAlb, enableWorker })}
              disabled={!!busy}
            >
              Start Prod
            </button>
            <button
              className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
              onClick={() => callAction("soft_pause", "/api/admin/infra/soft-pause")}
              disabled={!!busy}
            >
              Soft Pause Prod
            </button>
            <button
              className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 hover:bg-rose-500/20"
              onClick={() => callAction("hard_pause", "/api/admin/infra/hard-pause")}
              disabled={!!busy}
            >
              Hard Pause Prod
            </button>
            <button
              className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-100 hover:bg-sky-500/20"
              onClick={() => callAction("resume", "/api/admin/infra/resume", { withAlb, enableWorker })}
              disabled={!!busy}
            >
              Resume Prod
            </button>
            <button
              className="rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-100 hover:bg-indigo-500/20"
              onClick={() => callAction("deploy", "/api/admin/infra/deploy", { withAlb, enableWorker })}
              disabled={!!busy}
            >
              Deploy Release
            </button>
            <button
              className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm text-white/90 hover:bg-white/15"
              onClick={() => callAction("migrate", "/api/admin/infra/migrate")}
              disabled={!!busy}
            >
              Run Migrations
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Rotate Secrets</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-sm text-white"
                    value={secretEnv}
                    onChange={(e) => setSecretEnv(e.target.value as typeof secretEnvs[number])}
                  >
                    {secretEnvs.map((env) => (
                      <option key={env} value={env}>
                        {env}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-sm text-white"
                    value={secretGroup}
                    onChange={(e) => setSecretGroup(e.target.value as typeof secretGroups[number])}
                  >
                    {secretGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm text-white/90 hover:bg-white/15"
                    onClick={() =>
                      callAction("rotate_secrets", "/api/admin/infra/rotate-secrets", {
                        env: secretEnv,
                        group: secretGroup,
                      })
                    }
                    disabled={!!busy}
                  >
                    Rotacionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!infraReadOnly && (
        <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Última operação</p>
          {action ? (
            <div className="mt-3 space-y-2 text-sm text-white/80">
              <p>Action: {action.action}</p>
              <p>OK: {String(action.ok)}</p>
              <p>requestId: {action.requestId}</p>
              <p>correlationId: {action.correlationId}</p>
              <pre className="max-h-60 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                {JSON.stringify(action.payload, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/60">Nenhuma ação executada nesta sessão.</p>
          )}
        </div>
      )}
    </div>
  );
}
