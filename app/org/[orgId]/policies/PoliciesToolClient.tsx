"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { isPoliciesAllowedView, type PoliciesAllowedView } from "@/lib/domainBoundaries";
import { cn } from "@/lib/utils";

type PoliciesToolClientProps = {
  orgId: number;
  initialView: PoliciesAllowedView;
};

type OrganizationPolicyType = "FLEXIBLE" | "MODERATE" | "RIGID" | "CUSTOM";
type WindowPreset = "none" | "0" | "60" | "180" | "720" | "1440" | "2880" | "10080" | "custom";

type PolicyItem = {
  id: number;
  name: string;
  policyType: OrganizationPolicyType;
  allowCancellation: boolean;
  cancellationWindowMinutes: number | null;
  cancellationPenaltyBps: number;
  allowReschedule: boolean;
  rescheduleWindowMinutes: number | null;
};

type PoliciesResponse = {
  items: PolicyItem[];
};

type PolicyDraft = {
  name: string;
  policyType: OrganizationPolicyType;
  allowCancellation: boolean;
  cancellationWindowPreset: WindowPreset;
  cancellationWindowCustom: string;
  allowReschedule: boolean;
  rescheduleWindowPreset: WindowPreset;
  rescheduleWindowCustom: string;
};

type StorePolicyMode = "NO_RETURNS" | "WINDOW_DAYS";

type StorePolicyResponse = {
  storeFeatureEnabled: boolean;
  hasStore: boolean;
  storeStatus: string | null;
  appliesToCheckout: boolean;
  policy: {
    supportEmail: string | null;
    supportPhone: string | null;
    legalUrl: string | null;
    termsUrl: string | null;
    privacyPolicy: string | null;
    returnPolicy: string | null;
    returnPolicyMode: StorePolicyMode | null;
    returnWindowDays: number | null;
  };
};

type StorePolicyDraft = {
  returnPolicyMode: StorePolicyMode;
  returnWindowDays: string;
};

const swrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 2,
} as const;

function unwrapEnvelope(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const asRecord = payload as Record<string, unknown>;
  if (asRecord.data && typeof asRecord.data === "object") return asRecord.data;
  if (asRecord.result && typeof asRecord.result === "object") return asRecord.result;
  return payload;
}

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const payload = await res.json().catch(() => null);
  const unwrapped = unwrapEnvelope(payload) as Record<string, unknown> | null;
  const topLevel = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const hasErrorFlag = topLevel?.ok === false || unwrapped?.ok === false;
  if (!res.ok || hasErrorFlag) {
    const errorCode =
      (unwrapped?.error as string | undefined) ??
      (topLevel?.error as string | undefined) ??
      `HTTP_${res.status}`;
    throw new Error(errorCode);
  }
  return (unwrapped ?? payload) as T;
}

function parseView(raw: string | null | undefined, fallback: PoliciesAllowedView): PoliciesAllowedView {
  if (isPoliciesAllowedView(raw)) return raw;
  return fallback;
}

function prettyWindow(minutes: number | null) {
  if (minutes === null) return "Sem cancelamento";
  if (minutes === 0) return "Até à hora";
  if (minutes % 1440 === 0) return `${minutes / 1440} dia(s)`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

function windowPresetFromValue(value: number | null): WindowPreset {
  if (value === null) return "none";
  if (value === 0) return "0";
  if (value === 60) return "60";
  if (value === 180) return "180";
  if (value === 720) return "720";
  if (value === 1440) return "1440";
  if (value === 2880) return "2880";
  if (value === 10080) return "10080";
  return "custom";
}

function resolveWindowFromDraft(preset: WindowPreset, customValue: string) {
  if (preset === "none") return null;
  if (preset === "custom") {
    const parsed = Number(customValue);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.round(parsed));
  }
  return Math.max(0, Math.round(Number(preset)));
}

function createInitialDraft(): PolicyDraft {
  return {
    name: "",
    policyType: "CUSTOM",
    allowCancellation: true,
    cancellationWindowPreset: "1440",
    cancellationWindowCustom: "",
    allowReschedule: true,
    rescheduleWindowPreset: "1440",
    rescheduleWindowCustom: "",
  };
}

function createInitialStorePolicyDraft(): StorePolicyDraft {
  return {
    returnPolicyMode: "WINDOW_DAYS",
    returnWindowDays: "14",
  };
}

function buildStoreReturnPolicyPreview(draft: StorePolicyDraft) {
  if (draft.returnPolicyMode === "NO_RETURNS") {
    return "Sem devolucoes. Em caso de defeito, contactar o suporte.";
  }
  const parsedDays = Number(draft.returnWindowDays);
  const days = Number.isFinite(parsedDays) ? Math.min(730, Math.max(0, Math.round(parsedDays))) : 14;
  return (
    days === 0
      ? "Devolucoes permitidas no proprio dia da compra, para produtos sem sinais de uso."
      : `Devolucoes permitidas durante ${days} dia(s) apos a compra, para produtos sem sinais de uso.`
  );
}

export default function PoliciesToolClient({ orgId, initialView }: PoliciesToolClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams?.get("view") ?? null, initialView);
  const orgApiBase = `/api/org/${orgId}`;

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value.trim() === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const nextHref = buildOrgHref(orgId, "/policies", params);
      router.replace(nextHref, { scroll: false });
    },
    [orgId, router, searchParams],
  );

  const { data: policiesData, error: policiesError, mutate: mutatePolicies, isLoading: policiesLoading } =
    useSWR<PoliciesResponse>(`${orgApiBase}/policies`, apiFetcher, swrOptions);
  const {
    data: storePolicyData,
    error: storePolicyError,
    mutate: mutateStorePolicy,
    isLoading: storePolicyLoading,
  } = useSWR<StorePolicyResponse>(`${orgApiBase}/policies/store`, apiFetcher, swrOptions);

  const policies = policiesData?.items ?? [];
  const [createDraft, setCreateDraft] = useState<PolicyDraft>(createInitialDraft);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<PolicyDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [storePolicyDraft, setStorePolicyDraft] = useState<StorePolicyDraft>(createInitialStorePolicyDraft);
  const [storePolicyLoaded, setStorePolicyLoaded] = useState(false);
  const [storePolicySaving, setStorePolicySaving] = useState(false);
  const [storePolicyErrorMessage, setStorePolicyErrorMessage] = useState<string | null>(null);
  const [storePolicySuccessMessage, setStorePolicySuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!storePolicyData?.policy || storePolicyLoaded) return;
    setStorePolicyDraft({
      returnPolicyMode: storePolicyData.policy.returnPolicyMode ?? "WINDOW_DAYS",
      returnWindowDays:
        storePolicyData.policy.returnPolicyMode === "NO_RETURNS"
          ? ""
          : String(storePolicyData.policy.returnWindowDays ?? 14),
    });
    setStorePolicyLoaded(true);
  }, [storePolicyData, storePolicyLoaded]);

  useEffect(() => {
    setStorePolicyLoaded(false);
    setStorePolicyDraft(createInitialStorePolicyDraft());
    setStorePolicyErrorMessage(null);
    setStorePolicySuccessMessage(null);
  }, [orgId]);

  const defaultModeratePolicy = useMemo(
    () => policies.find((policy) => policy.policyType === "MODERATE") ?? policies[0] ?? null,
    [policies],
  );
  const customPoliciesCount = useMemo(
    () => policies.filter((policy) => policy.policyType === "CUSTOM").length,
    [policies],
  );
  const strictestWindowMinutes = useMemo(() => {
    const windows = policies
      .filter((policy) => policy.allowCancellation && policy.cancellationWindowMinutes !== null)
      .map((policy) => policy.cancellationWindowMinutes as number);
    if (windows.length === 0) return null;
    return Math.min(...windows);
  }, [policies]);

  const applyBookingPreset = useCallback((preset: "FLEXIBLE" | "MODERATE" | "RIGID") => {
    if (preset === "FLEXIBLE") {
      setCreateDraft((prev) => ({
        ...prev,
        policyType: "CUSTOM",
        name: "Política flexível personalizada",
        allowCancellation: true,
        cancellationWindowPreset: "2880",
        cancellationWindowCustom: "",
        allowReschedule: true,
        rescheduleWindowPreset: "2880",
        rescheduleWindowCustom: "",
      }));
      return;
    }
    if (preset === "MODERATE") {
      setCreateDraft((prev) => ({
        ...prev,
        policyType: "CUSTOM",
        name: "Política moderada personalizada",
        allowCancellation: true,
        cancellationWindowPreset: "1440",
        cancellationWindowCustom: "",
        allowReschedule: true,
        rescheduleWindowPreset: "1440",
        rescheduleWindowCustom: "",
      }));
      return;
    }
    setCreateDraft((prev) => ({
      ...prev,
      policyType: "CUSTOM",
      name: "Política rígida personalizada",
      allowCancellation: true,
      cancellationWindowPreset: "180",
      cancellationWindowCustom: "",
      allowReschedule: false,
      rescheduleWindowPreset: "none",
      rescheduleWindowCustom: "",
    }));
  }, []);

  const createPolicy = useCallback(async () => {
    if (createSaving) return;
    if (!createDraft.name.trim()) {
      setCreateError("O nome da política é obrigatório.");
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const payload = {
        name: createDraft.name.trim(),
        policyType: createDraft.policyType,
        allowCancellation: createDraft.allowCancellation,
        cancellationWindowMinutes: createDraft.allowCancellation
          ? resolveWindowFromDraft(createDraft.cancellationWindowPreset, createDraft.cancellationWindowCustom)
          : null,
        cancellationPenaltyBps: 0,
        allowReschedule: createDraft.allowReschedule,
        rescheduleWindowMinutes: createDraft.allowReschedule
          ? resolveWindowFromDraft(createDraft.rescheduleWindowPreset, createDraft.rescheduleWindowCustom)
          : null,
      };
      const response = await fetch(`${orgApiBase}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error((json && (json.error || json.message)) || "Erro ao criar política.");
      }
      setCreateDraft(createInitialDraft());
      await mutatePolicies();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Erro ao criar política.");
    } finally {
      setCreateSaving(false);
    }
  }, [createDraft, createSaving, mutatePolicies, orgApiBase]);

  const startEdit = useCallback((policy: PolicyItem) => {
    setEditingPolicyId(policy.id);
    setEditError(null);
    setEditDraft({
      name: policy.name,
      policyType: policy.policyType,
      allowCancellation: policy.allowCancellation,
      cancellationWindowPreset: windowPresetFromValue(policy.cancellationWindowMinutes),
      cancellationWindowCustom:
        windowPresetFromValue(policy.cancellationWindowMinutes) === "custom"
          ? String(policy.cancellationWindowMinutes ?? "")
          : "",
      allowReschedule: policy.allowReschedule,
      rescheduleWindowPreset: windowPresetFromValue(policy.rescheduleWindowMinutes),
      rescheduleWindowCustom:
        windowPresetFromValue(policy.rescheduleWindowMinutes) === "custom"
          ? String(policy.rescheduleWindowMinutes ?? "")
          : "",
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingPolicyId || !editDraft || editSaving) return;
    if (!editDraft.name.trim()) {
      setEditError("O nome da política é obrigatório.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = {
        name: editDraft.name.trim(),
        policyType: editDraft.policyType,
        allowCancellation: editDraft.allowCancellation,
        cancellationWindowMinutes: editDraft.allowCancellation
          ? resolveWindowFromDraft(editDraft.cancellationWindowPreset, editDraft.cancellationWindowCustom)
          : null,
        cancellationPenaltyBps: 0,
        allowReschedule: editDraft.allowReschedule,
        rescheduleWindowMinutes: editDraft.allowReschedule
          ? resolveWindowFromDraft(editDraft.rescheduleWindowPreset, editDraft.rescheduleWindowCustom)
          : null,
      };
      const response = await fetch(`${orgApiBase}/policies/${editingPolicyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error((json && (json.error || json.message)) || "Erro ao guardar alterações.");
      }
      setEditingPolicyId(null);
      setEditDraft(null);
      await mutatePolicies();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Erro ao guardar alterações.");
    } finally {
      setEditSaving(false);
    }
  }, [editDraft, editSaving, editingPolicyId, mutatePolicies, orgApiBase]);

  const deletePolicy = useCallback(
    async (policy: PolicyItem) => {
      if (policy.policyType !== "CUSTOM") return;
      const confirmed = window.confirm(`Remover a política "${policy.name}"?`);
      if (!confirmed) return;
      try {
        const response = await fetch(`${orgApiBase}/policies/${policy.id}`, { method: "DELETE" });
        const json = await response.json().catch(() => null);
        if (!response.ok || json?.ok === false) {
          throw new Error((json && (json.error || json.message)) || "Erro ao remover política.");
        }
        await mutatePolicies();
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : "Erro ao remover política.");
      }
    },
    [mutatePolicies, orgApiBase],
  );

  const saveStorePolicy = useCallback(async () => {
    if (storePolicySaving) return;
    setStorePolicySaving(true);
    setStorePolicyErrorMessage(null);
    setStorePolicySuccessMessage(null);

    const parsedWindowDays = Number(storePolicyDraft.returnWindowDays);
    const returnWindowDays =
      storePolicyDraft.returnPolicyMode === "NO_RETURNS"
        ? null
        : Number.isFinite(parsedWindowDays)
          ? Math.min(730, Math.max(0, Math.round(parsedWindowDays)))
          : 14;

    try {
      const response = await fetch(`${orgApiBase}/policies/store`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnPolicyMode: storePolicyDraft.returnPolicyMode,
          returnWindowDays,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error((json && (json.error || json.message)) || "Erro ao guardar política da loja.");
      }
      setStorePolicySuccessMessage("Política da loja guardada.");
      setStorePolicyLoaded(false);
      await mutateStorePolicy();
    } catch (error) {
      setStorePolicyErrorMessage(error instanceof Error ? error.message : "Erro ao guardar política da loja.");
    } finally {
      setStorePolicySaving(false);
    }
  }, [mutateStorePolicy, orgApiBase, storePolicyDraft, storePolicySaving]);

  const headerByView: Record<PoliciesAllowedView, string> = {
    overview: "Políticas da organização",
    booking: "Políticas de reservas",
    terms: "Termos canónicos",
    store: "Políticas da loja",
    guardrails: "Guardrails e limites",
  };

  const hasPoliciesData = policies.length > 0;
  const canonicalLegalUrl = storePolicyData?.policy.legalUrl ?? "/username/legal";

  return (
    <section className="space-y-5 text-white sm:space-y-6">
      <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(20,20,20,0.92))] px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{headerByView[view]}</h1>
            <p className="text-sm text-white/70">
              Ferramenta para personalizar politicas e regras com guardrails e templates fechados.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-300/45 bg-cyan-300/12 px-3 py-2 text-xs text-cyan-100">
            Domínio: <span className="font-semibold">Políticas personalizáveis</span>
          </div>
        </div>
      </div>

      {(policiesError || storePolicyError) && (
        <div className="rounded-xl border border-rose-300/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
          {(policiesError instanceof Error ? policiesError.message : null) ??
            (storePolicyError instanceof Error ? storePolicyError.message : "Erro ao carregar dados.")}
        </div>
      )}

      {view === "overview" && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Políticas ativas" value={String(policies.length)} />
            <MetricCard label="Políticas custom" value={String(customPoliciesCount)} />
            <MetricCard
              label="Janela mais restritiva"
              value={strictestWindowMinutes === null ? "Sem limite" : prettyWindow(strictestWindowMinutes)}
            />
            <MetricCard label="Penalizacao cancelamento" value="0%" />
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Default operacional" subtitle="Referência atual para novas configurações">
              {defaultModeratePolicy ? (
                <div className="rounded-xl border border-white/12 bg-white/5 p-3 text-sm text-white/85">
                  <p className="font-semibold text-white">{defaultModeratePolicy.name}</p>
                  <p className="mt-1 text-white/70">
                    {defaultModeratePolicy.policyType} · Cancelamento:{" "}
                    {defaultModeratePolicy.allowCancellation
                      ? prettyWindow(defaultModeratePolicy.cancellationWindowMinutes)
                      : "Desativado"}
                  </p>
                  <p className="text-white/70">
                    Penalizacao: 0% · Reagendamento:{" "}
                    {defaultModeratePolicy.allowReschedule
                      ? prettyWindow(defaultModeratePolicy.rescheduleWindowMinutes)
                      : "Desativado"}
                  </p>
                </div>
              ) : (
                <EmptyState label="Ainda não existem políticas carregadas." />
              )}
            </Panel>
            <Panel title="Termos públicos" subtitle="Template legal fechado em URL canónica">
              <div className="space-y-2 rounded-xl border border-white/12 bg-white/5 p-3 text-sm text-white/80">
                <p>
                  URL pública:{" "}
                  <span className="font-semibold text-white">{canonicalLegalUrl}</span>
                </p>
                <p>
                  Conteúdo legal é gerado por template ORYA (termos, privacidade, reservas e loja) sem campos de texto
                  livre editáveis.
                </p>
              </div>
            </Panel>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={CTA_NEUTRAL} onClick={() => updateQuery({ view: "booking" })}>
              Gerir políticas de reservas
            </button>
            <button type="button" className={CTA_NEUTRAL} onClick={() => updateQuery({ view: "terms" })}>
              Ver termos canónicos
            </button>
            <button type="button" className={CTA_NEUTRAL} onClick={() => updateQuery({ view: "store" })}>
              Configurar política da loja
            </button>
            <button type="button" className={CTA_NEUTRAL} onClick={() => updateQuery({ view: "guardrails" })}>
              Ver guardrails
            </button>
          </div>
        </div>
      )}

      {view === "booking" && (
        <div className="space-y-3">
          <Panel title="Criar política personalizada" subtitle="Combina dropdowns e campos livres com defaults">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome da política">
                <input
                  className={INPUT}
                  value={createDraft.name}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex.: Política torneio premium"
                />
              </Field>
              <Field label="Tipo base">
                <select
                  className={INPUT}
                  value={createDraft.policyType}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, policyType: event.target.value as OrganizationPolicyType }))
                  }
                >
                  <option value="CUSTOM">CUSTOM</option>
                  <option value="FLEXIBLE">FLEXIBLE</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="RIGID">RIGID</option>
                </select>
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={CTA_NEUTRAL} onClick={() => applyBookingPreset("FLEXIBLE")}>
                Aplicar preset flexível
              </button>
              <button type="button" className={CTA_NEUTRAL} onClick={() => applyBookingPreset("MODERATE")}>
                Aplicar preset moderado
              </button>
              <button type="button" className={CTA_NEUTRAL} onClick={() => applyBookingPreset("RIGID")}>
                Aplicar preset rígido
              </button>
            </div>

            <PolicyControls draft={createDraft} onChange={setCreateDraft} />

            {createError ? (
              <div className="rounded-xl border border-rose-300/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
                {createError}
              </div>
            ) : null}

            <div className="mt-3">
              <button type="button" className={CTA_PRIMARY} onClick={() => void createPolicy()} disabled={createSaving}>
                {createSaving ? "A criar..." : "Criar política"}
              </button>
            </div>
          </Panel>

          <Panel title="Políticas existentes" subtitle="Editar, ajustar ou remover (apenas CUSTOM)">
            {policiesLoading && !hasPoliciesData ? (
              <EmptyState label="A carregar políticas..." />
            ) : policies.length === 0 ? (
              <EmptyState label="Sem políticas para mostrar." />
            ) : (
              <div className="space-y-2">
                {policies.map((policy) => (
                  <div key={policy.id} className="rounded-xl border border-white/12 bg-white/5 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{policy.name}</p>
                        <p className="text-[12px] text-white/70">
                          {policy.policyType} · Cancelamento {policy.allowCancellation ? "ativo" : "desativado"} ·
                          Penalizacao 0%
                        </p>
                        <p className="text-[12px] text-white/60">
                          Janela cancelamento: {prettyWindow(policy.cancellationWindowMinutes)} · Janela reagendamento:{" "}
                          {policy.allowReschedule ? prettyWindow(policy.rescheduleWindowMinutes) : "desativado"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={CTA_NEUTRAL} onClick={() => startEdit(policy)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={cn(CTA_NEUTRAL, policy.policyType !== "CUSTOM" && "cursor-not-allowed opacity-45")}
                          onClick={() => void deletePolicy(policy)}
                          disabled={policy.policyType !== "CUSTOM"}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {view === "terms" && (
        <Panel
          title="Termos e políticas legais"
          subtitle="Conteúdo 100% canónico gerado por templates ORYA"
        >
          <div className="space-y-3 text-sm text-white/80">
            <div className="rounded-xl border border-white/12 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Página legal canónica</p>
              <p className="mt-1 font-semibold text-white">{canonicalLegalUrl}</p>
              <p className="mt-1 text-white/70">
                A página inclui secções fixas de termos, privacidade, reservas e loja com links internos para checkout
                e superfícies públicas.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
              Texto livre está bloqueado nesta ferramenta. Alterações legais são derivadas apenas de campos estruturados.
            </div>
          </div>
        </Panel>
      )}

      {view === "store" && (
        <Panel
          title="Política de checkout da loja"
          subtitle="Template único para devoluções, privacidade e termos com guardrails operacionais"
        >
          {storePolicyLoading && !storePolicyData ? (
            <EmptyState label="A carregar política da loja..." />
          ) : (
            <div className="space-y-3">
              {!storePolicyData?.storeFeatureEnabled ? (
                <div className="rounded-xl border border-amber-300/45 bg-amber-500/12 px-3 py-2 text-sm text-amber-100">
                  O módulo de loja está desativado nesta instalação.
                </div>
              ) : null}

              {storePolicyData?.storeFeatureEnabled && !storePolicyData?.hasStore ? (
                <div className="rounded-xl border border-amber-300/45 bg-amber-500/12 px-3 py-2 text-sm text-amber-100">
                  A organização ainda não tem loja ativa. A política fica pronta aqui e passa a aplicar quando a loja
                  ficar disponível.
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Modo de devoluções">
                  <select
                    className={INPUT}
                    value={storePolicyDraft.returnPolicyMode}
                    onChange={(event) =>
                      setStorePolicyDraft((prev) => ({
                        ...prev,
                        returnPolicyMode: event.target.value as StorePolicyMode,
                      }))
                    }
                  >
                    <option value="WINDOW_DAYS">Com devoluções</option>
                    <option value="NO_RETURNS">Sem devoluções</option>
                  </select>
                </Field>
                <Field label="URL legal canónica">
                  <input
                    className={cn(INPUT, "opacity-80")}
                    value={storePolicyData?.policy.legalUrl ?? ""}
                    readOnly
                    placeholder="/{username}/legal"
                  />
                </Field>
              </div>

              {storePolicyDraft.returnPolicyMode === "WINDOW_DAYS" ? (
                <Field label="Janela de devolução (dias)">
                  <input
                    className={INPUT}
                    value={storePolicyDraft.returnWindowDays}
                    onChange={(event) =>
                      setStorePolicyDraft((prev) => ({
                        ...prev,
                        returnWindowDays: event.target.value.replace(/[^\d]/g, ""),
                      }))
                    }
                    inputMode="numeric"
                    placeholder="0 a 730"
                  />
                </Field>
              ) : null}

              <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/80">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Preview devoluções</p>
                <p className="mt-1">{buildStoreReturnPolicyPreview(storePolicyDraft)}</p>
              </div>

              <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/80">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Privacidade (template ORYA)</p>
                <p className="mt-1">{storePolicyData?.policy.privacyPolicy ?? "A carregar..."}</p>
              </div>

              {(storePolicyData?.policy.supportEmail || storePolicyData?.policy.supportPhone) ? (
                <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/80">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Suporte atual</p>
                  <p className="mt-1">
                    {storePolicyData?.policy.supportEmail ?? ""}
                    {storePolicyData?.policy.supportEmail && storePolicyData?.policy.supportPhone ? " · " : ""}
                    {storePolicyData?.policy.supportPhone ?? ""}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
                Contactos de suporte (email/telefone) são geridos em
                {" "}
                <a className="underline" href={buildOrgHref(orgId, "/settings")}>
                  Definições
                </a>
                {" "}
                e reutilizados automaticamente no checkout.
              </div>

              {storePolicyErrorMessage ? (
                <div className="rounded-xl border border-rose-300/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
                  {storePolicyErrorMessage}
                </div>
              ) : null}
              {storePolicySuccessMessage ? (
                <div className="rounded-xl border border-emerald-300/45 bg-emerald-500/12 px-3 py-2 text-sm text-emerald-100">
                  {storePolicySuccessMessage}
                </div>
              ) : null}

              <div>
                <button
                  type="button"
                  className={CTA_PRIMARY}
                  onClick={() => void saveStorePolicy()}
                  disabled={
                    storePolicySaving ||
                    !storePolicyData?.storeFeatureEnabled
                  }
                >
                  {storePolicySaving ? "A guardar..." : "Guardar política da loja"}
                </button>
              </div>
            </div>
          )}
        </Panel>
      )}

      {view === "guardrails" && (
        <Panel title="Guardrails operacionais" subtitle="Limites de segurança para personalização">
          <ul className="space-y-2 text-sm text-white/80">
            <li className={GUARDRAIL_ITEM}>
              Políticas predefinidas (`FLEXIBLE`, `MODERATE`, `RIGID`) podem ser editadas, mas só políticas `CUSTOM`
              podem ser removidas.
            </li>
            <li className={GUARDRAIL_ITEM}>
              Penalizacao de cancelamento e fixa em `0%` nesta versao.
            </li>
            <li className={GUARDRAIL_ITEM}>
              Janelas são sempre validadas em minutos e normalizadas para inteiro não negativo.
            </li>
            <li className={GUARDRAIL_ITEM}>
              Textos legais publicos sao gerados por template fechado e URL interna '/username/legal'.
            </li>
            <li className={GUARDRAIL_ITEM}>
              No-show fee esta fora de customizacao nesta versao (lockado em 0 na politica publica).
            </li>
            <li className={GUARDRAIL_ITEM}>
              Política da loja usa template fechado: devoluções `sem devoluções` ou `0..730 dias`, com clamp automático.
            </li>
            <li className={GUARDRAIL_ITEM}>
              Email/telefone de suporte da loja vivem em `Definições` e não podem ser editados dentro da ferramenta Loja.
            </li>
          </ul>
        </Panel>
      )}

      {editingPolicyId && editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/14 bg-[#0b1014] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">Editar política</h3>
              <button
                type="button"
                className={CTA_NEUTRAL}
                onClick={() => {
                  setEditingPolicyId(null);
                  setEditDraft(null);
                  setEditError(null);
                }}
              >
                Fechar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome da política">
                <input
                  className={INPUT}
                  value={editDraft.name}
                  onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                />
              </Field>
              <Field label="Tipo base">
                <select
                  className={INPUT}
                  value={editDraft.policyType}
                  onChange={(event) =>
                    setEditDraft((prev) => (prev ? { ...prev, policyType: event.target.value as OrganizationPolicyType } : prev))
                  }
                >
                  <option value="CUSTOM">CUSTOM</option>
                  <option value="FLEXIBLE">FLEXIBLE</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="RIGID">RIGID</option>
                </select>
              </Field>
            </div>

            <PolicyControls
              draft={editDraft}
              onChange={(next) =>
                setEditDraft((prev) => {
                  if (!prev) return prev;
                  return typeof next === "function" ? next(prev) : next;
                })
              }
            />

            {editError ? (
              <div className="mt-3 rounded-xl border border-rose-300/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
                {editError}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={CTA_PRIMARY} onClick={() => void saveEdit()} disabled={editSaving}>
                {editSaving ? "A guardar..." : "Guardar alterações"}
              </button>
              <button
                type="button"
                className={CTA_NEUTRAL}
                onClick={() => {
                  setEditingPolicyId(null);
                  setEditDraft(null);
                  setEditError(null);
                }}
                disabled={editSaving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PolicyControls({
  draft,
  onChange,
}: {
  draft: PolicyDraft;
  onChange: (next: PolicyDraft | ((prev: PolicyDraft) => PolicyDraft)) => void;
}) {
  const assign = useCallback(
    (updater: (prev: PolicyDraft) => PolicyDraft) => {
      onChange((prev) => updater(prev));
    },
    [onChange],
  );

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={TOGGLE_LABEL}>
          <span>Permitir cancelamento</span>
          <input
            type="checkbox"
            checked={draft.allowCancellation}
            onChange={(event) => assign((prev) => ({ ...prev, allowCancellation: event.target.checked }))}
          />
        </label>
        <label className={TOGGLE_LABEL}>
          <span>Permitir reagendamento</span>
          <input
            type="checkbox"
            checked={draft.allowReschedule}
            onChange={(event) => assign((prev) => ({ ...prev, allowReschedule: event.target.checked }))}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Janela de cancelamento">
          <select
            className={INPUT}
            value={draft.cancellationWindowPreset}
            onChange={(event) =>
              assign((prev) => ({ ...prev, cancellationWindowPreset: event.target.value as WindowPreset }))
            }
            disabled={!draft.allowCancellation}
          >
            <option value="none">Sem cancelamento</option>
            <option value="0">Até à hora</option>
            <option value="60">1h</option>
            <option value="180">3h</option>
            <option value="720">12h</option>
            <option value="1440">24h</option>
            <option value="2880">48h</option>
            <option value="10080">7 dias</option>
            <option value="custom">Personalizado</option>
          </select>
          {draft.cancellationWindowPreset === "custom" ? (
            <input
              className={cn(INPUT, "mt-2")}
              value={draft.cancellationWindowCustom}
              onChange={(event) =>
                assign((prev) => ({ ...prev, cancellationWindowCustom: event.target.value.replace(/[^\d]/g, "") }))
              }
              placeholder="Minutos"
              disabled={!draft.allowCancellation}
            />
          ) : null}
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Janela de reagendamento">
          <select
            className={INPUT}
            value={draft.rescheduleWindowPreset}
            onChange={(event) =>
              assign((prev) => ({ ...prev, rescheduleWindowPreset: event.target.value as WindowPreset }))
            }
            disabled={!draft.allowReschedule}
          >
            <option value="none">Sem reagendamento</option>
            <option value="0">Até à hora</option>
            <option value="60">1h</option>
            <option value="180">3h</option>
            <option value="720">12h</option>
            <option value="1440">24h</option>
            <option value="2880">48h</option>
            <option value="10080">7 dias</option>
            <option value="custom">Personalizado</option>
          </select>
          {draft.rescheduleWindowPreset === "custom" ? (
            <input
              className={cn(INPUT, "mt-2")}
              value={draft.rescheduleWindowCustom}
              onChange={(event) =>
                assign((prev) => ({ ...prev, rescheduleWindowCustom: event.target.value.replace(/[^\d]/g, "") }))
              }
              placeholder="Minutos"
              disabled={!draft.allowReschedule}
            />
          ) : null}
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">{label}</span>
      {children}
    </label>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 shadow-[0_16px_46px_rgba(0,0,0,0.28)]">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-white/60">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/14 bg-gradient-to-br from-white/12 via-[#0b1124]/72 to-[#050810]/95 p-3 shadow-[0_20px_62px_rgba(0,0,0,0.5)]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-1 text-[24px] font-bold leading-tight text-white">{value}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 text-sm text-white/75">
      <p className="font-semibold text-white/90">Sem dados disponíveis</p>
      <p className="mt-1">{label}</p>
    </div>
  );
}

const INPUT =
  "h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80";
const CTA_PRIMARY =
  "inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/55 bg-[#22D3EE]/18 px-5 py-2 text-sm font-semibold text-white transition hover:border-[#22D3EE]/75 hover:bg-[#22D3EE]/24";
const CTA_NEUTRAL =
  "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] text-white transition hover:border-[#22D3EE]/45 hover:bg-[#22D3EE]/12";
const TOGGLE_LABEL =
  "flex items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/85";
const GUARDRAIL_ITEM = "rounded-xl border border-white/12 bg-white/5 px-3 py-2";
