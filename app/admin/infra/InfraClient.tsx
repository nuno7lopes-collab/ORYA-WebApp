"use client";

import { useCallback, useMemo, useState } from "react";

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

const secretGroups = ["all", "app", "supabase", "payments", "apple", "email", "admin"] as const;
const secretEnvs = ["all", "prod", "dev"] as const;

export default function InfraClient() {
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
      setBusy(name);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
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
    [busy, loadStatus],
  );

  const outputs = useMemo(() => status.data?.outputs ?? {}, [status.data]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Infra</p>
            <h2 className="text-sm font-semibold text-white/90">Estado & Ações</h2>
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

      <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Controlos</p>
        <h3 className="mb-4 text-sm font-semibold text-white/90">Operações</h3>

        <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
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
    </div>
  );
}
