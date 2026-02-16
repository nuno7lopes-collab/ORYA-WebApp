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
type PenaltyPreset = "0" | "1000" | "2500" | "5000" | "10000" | "custom";

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

type MeResponse = {
  organization?: {
    infoPolicies?: string | null;
    infoRules?: string | null;
    infoRequirements?: string | null;
    infoLocationNotes?: string | null;
  } | null;
};

type PolicyDraft = {
  name: string;
  policyType: OrganizationPolicyType;
  allowCancellation: boolean;
  cancellationWindowPreset: WindowPreset;
  cancellationWindowCustom: string;
  cancellationPenaltyPreset: PenaltyPreset;
  cancellationPenaltyCustom: string;
  allowReschedule: boolean;
  rescheduleWindowPreset: WindowPreset;
  rescheduleWindowCustom: string;
};

type TermsDraft = {
  infoPolicies: string;
  infoRules: string;
  infoRequirements: string;
  infoLocationNotes: string;
};

const swrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 2,
} as const;

const REFUND_TEXT_TEMPLATES: Record<"FLEXIVEL" | "MODERADA" | "RIGIDA", string> = {
  FLEXIVEL:
    "Reembolso total permitido até 48 horas antes do início. Após esse prazo, aplica-se retenção mínima para custos operacionais.",
  MODERADA:
    "Reembolso total permitido até 24 horas antes. Cancelamentos tardios podem gerar retenção parcial de acordo com a penalização definida.",
  RIGIDA:
    "Sem reembolso após confirmação, exceto obrigação legal. Ajustes extraordinários dependem de validação operacional.",
};

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

function toPenaltyPctLabel(bps: number | null | undefined) {
  return `${(((bps ?? 0) / 100) as number).toFixed(2)}%`;
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

function penaltyPresetFromValue(value: number): PenaltyPreset {
  if (value === 0) return "0";
  if (value === 1000) return "1000";
  if (value === 2500) return "2500";
  if (value === 5000) return "5000";
  if (value === 10000) return "10000";
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

function resolvePenaltyFromDraft(preset: PenaltyPreset, customValue: string) {
  if (preset === "custom") {
    const parsed = Number(customValue);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(10000, Math.round(parsed)));
  }
  return Math.max(0, Math.min(10000, Math.round(Number(preset))));
}

function createInitialDraft(): PolicyDraft {
  return {
    name: "",
    policyType: "CUSTOM",
    allowCancellation: true,
    cancellationWindowPreset: "1440",
    cancellationWindowCustom: "",
    cancellationPenaltyPreset: "0",
    cancellationPenaltyCustom: "",
    allowReschedule: true,
    rescheduleWindowPreset: "1440",
    rescheduleWindowCustom: "",
  };
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
  const { data: meData, error: meError, mutate: mutateMe, isLoading: meLoading } =
    useSWR<MeResponse>(`${orgApiBase}/me`, apiFetcher, swrOptions);

  const policies = policiesData?.items ?? [];
  const [createDraft, setCreateDraft] = useState<PolicyDraft>(createInitialDraft);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<PolicyDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [termsDraft, setTermsDraft] = useState<TermsDraft>({
    infoPolicies: "",
    infoRules: "",
    infoRequirements: "",
    infoLocationNotes: "",
  });
  const [termsLoaded, setTermsLoaded] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsSuccess, setTermsSuccess] = useState<string | null>(null);
  const [refundTemplate, setRefundTemplate] = useState<"CUSTOM" | "FLEXIVEL" | "MODERADA" | "RIGIDA">("CUSTOM");

  useEffect(() => {
    if (!meData?.organization || termsLoaded) return;
    setTermsDraft({
      infoPolicies: meData.organization.infoPolicies ?? "",
      infoRules: meData.organization.infoRules ?? "",
      infoRequirements: meData.organization.infoRequirements ?? "",
      infoLocationNotes: meData.organization.infoLocationNotes ?? "",
    });
    setTermsLoaded(true);
  }, [meData?.organization, termsLoaded]);

  const defaultModeratePolicy = useMemo(
    () => policies.find((policy) => policy.policyType === "MODERATE") ?? policies[0] ?? null,
    [policies],
  );
  const customPoliciesCount = useMemo(
    () => policies.filter((policy) => policy.policyType === "CUSTOM").length,
    [policies],
  );
  const averagePenaltyBps = useMemo(() => {
    if (!policies.length) return 0;
    const total = policies.reduce((sum, policy) => sum + (policy.cancellationPenaltyBps ?? 0), 0);
    return Math.round(total / policies.length);
  }, [policies]);
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
        cancellationPenaltyPreset: "0",
        cancellationPenaltyCustom: "",
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
        cancellationPenaltyPreset: "2500",
        cancellationPenaltyCustom: "",
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
      cancellationPenaltyPreset: "10000",
      cancellationPenaltyCustom: "",
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
        cancellationPenaltyBps: resolvePenaltyFromDraft(
          createDraft.cancellationPenaltyPreset,
          createDraft.cancellationPenaltyCustom,
        ),
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
      cancellationPenaltyPreset: penaltyPresetFromValue(policy.cancellationPenaltyBps ?? 0),
      cancellationPenaltyCustom:
        penaltyPresetFromValue(policy.cancellationPenaltyBps ?? 0) === "custom"
          ? String(policy.cancellationPenaltyBps ?? 0)
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
        cancellationPenaltyBps: resolvePenaltyFromDraft(
          editDraft.cancellationPenaltyPreset,
          editDraft.cancellationPenaltyCustom,
        ),
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

  const saveTerms = useCallback(async () => {
    if (termsSaving) return;
    setTermsSaving(true);
    setTermsError(null);
    setTermsSuccess(null);
    try {
      const response = await fetch(`${orgApiBase}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          infoPolicies: termsDraft.infoPolicies,
          infoRules: termsDraft.infoRules,
          infoRequirements: termsDraft.infoRequirements,
          infoLocationNotes: termsDraft.infoLocationNotes,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error((json && (json.error || json.message)) || "Erro ao guardar termos.");
      }
      setTermsSuccess("Textos guardados com sucesso.");
      await mutateMe();
    } catch (error) {
      setTermsError(error instanceof Error ? error.message : "Erro ao guardar termos.");
    } finally {
      setTermsSaving(false);
    }
  }, [mutateMe, orgApiBase, termsDraft, termsSaving]);

  const applyRefundTemplate = useCallback((value: "CUSTOM" | "FLEXIVEL" | "MODERADA" | "RIGIDA") => {
    setRefundTemplate(value);
    if (value === "CUSTOM") return;
    setTermsDraft((prev) => ({ ...prev, infoPolicies: REFUND_TEXT_TEMPLATES[value] }));
  }, []);

  const headerByView: Record<PoliciesAllowedView, string> = {
    overview: "Políticas da organização",
    booking: "Políticas de reservas",
    terms: "Termos e textos legais",
    guardrails: "Guardrails e limites",
  };

  const hasPoliciesData = policies.length > 0;

  return (
    <section className="space-y-5 text-white sm:space-y-6">
      <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(20,20,20,0.92))] px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{headerByView[view]}</h1>
            <p className="text-sm text-white/70">
              Ferramenta para personalizar políticas, termos e regras com defaults, dropdowns e texto livre.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-300/45 bg-cyan-300/12 px-3 py-2 text-xs text-cyan-100">
            Domínio: <span className="font-semibold">Políticas personalizáveis</span>
          </div>
        </div>
      </div>

      {(policiesError || meError) && (
        <div className="rounded-xl border border-rose-300/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
          {(policiesError instanceof Error ? policiesError.message : null) ??
            (meError instanceof Error ? meError.message : "Erro ao carregar dados.")}
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
            <MetricCard label="Penalização média" value={toPenaltyPctLabel(averagePenaltyBps)} />
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
                    Penalização: {toPenaltyPctLabel(defaultModeratePolicy.cancellationPenaltyBps)} · Reagendamento:{" "}
                    {defaultModeratePolicy.allowReschedule
                      ? prettyWindow(defaultModeratePolicy.rescheduleWindowMinutes)
                      : "Desativado"}
                  </p>
                </div>
              ) : (
                <EmptyState label="Ainda não existem políticas carregadas." />
              )}
            </Panel>
            <Panel title="Termos públicos" subtitle="Resumo dos textos configurados">
              <div className="space-y-2 text-sm">
                <PreviewRow label="Políticas e termos" value={termsDraft.infoPolicies} />
                <PreviewRow label="Regras operacionais" value={termsDraft.infoRules} />
                <PreviewRow label="Requisitos" value={termsDraft.infoRequirements} />
                <PreviewRow label="Notas adicionais" value={termsDraft.infoLocationNotes} />
              </div>
            </Panel>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={CTA_NEUTRAL} onClick={() => updateQuery({ view: "booking" })}>
              Gerir políticas de reservas
            </button>
            <button type="button" className={CTA_NEUTRAL} onClick={() => updateQuery({ view: "terms" })}>
              Editar termos e textos
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
                          Penalização {toPenaltyPctLabel(policy.cancellationPenaltyBps)}
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
        <Panel title="Termos e textos" subtitle="Edita políticas textuais e aplica templates de reembolso">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Template de reembolso">
              <select
                className={INPUT}
                value={refundTemplate}
                onChange={(event) => applyRefundTemplate(event.target.value as "CUSTOM" | "FLEXIVEL" | "MODERADA" | "RIGIDA")}
              >
                <option value="CUSTOM">Personalizado</option>
                <option value="FLEXIVEL">Flexível</option>
                <option value="MODERADA">Moderada</option>
                <option value="RIGIDA">Rígida</option>
              </select>
            </Field>
            <div className="rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
              O template pré-preenche o texto e podes sempre editar manualmente antes de guardar.
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            <Field label="Políticas e termos gerais">
              <textarea
                className={TEXTAREA}
                value={termsDraft.infoPolicies}
                onChange={(event) => setTermsDraft((prev) => ({ ...prev, infoPolicies: event.target.value }))}
                placeholder="Descreve termos, condições e política de reembolso."
              />
            </Field>
            <Field label="Regras operacionais">
              <textarea
                className={TEXTAREA}
                value={termsDraft.infoRules}
                onChange={(event) => setTermsDraft((prev) => ({ ...prev, infoRules: event.target.value }))}
                placeholder="Define regras de cancelamento, reagendamento e no-show."
              />
            </Field>
            <Field label="Requisitos e elegibilidade">
              <textarea
                className={TEXTAREA}
                value={termsDraft.infoRequirements}
                onChange={(event) => setTermsDraft((prev) => ({ ...prev, infoRequirements: event.target.value }))}
                placeholder="Define requisitos para participação/compra."
              />
            </Field>
            <Field label="Notas adicionais">
              <textarea
                className={TEXTAREA}
                value={termsDraft.infoLocationNotes}
                onChange={(event) => setTermsDraft((prev) => ({ ...prev, infoLocationNotes: event.target.value }))}
                placeholder="Notas extras para contexto operacional/legal."
              />
            </Field>
          </div>

          {termsError ? (
            <div className="mt-3 rounded-xl border border-rose-300/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
              {termsError}
            </div>
          ) : null}
          {termsSuccess ? (
            <div className="mt-3 rounded-xl border border-emerald-300/45 bg-emerald-500/12 px-3 py-2 text-sm text-emerald-100">
              {termsSuccess}
            </div>
          ) : null}

          <div className="mt-3">
            <button type="button" className={CTA_PRIMARY} onClick={() => void saveTerms()} disabled={termsSaving || meLoading}>
              {termsSaving ? "A guardar..." : "Guardar textos"}
            </button>
          </div>
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
              Penalização de cancelamento é validada entre `0` e `10000` bps (`0%` a `100%`).
            </li>
            <li className={GUARDRAIL_ITEM}>
              Janelas são sempre validadas em minutos e normalizadas para inteiro não negativo.
            </li>
            <li className={GUARDRAIL_ITEM}>
              Alterações de texto legal são guardadas com defaults editáveis, sem quebrar o contrato público.
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

        <Field label="Penalização cancelamento">
          <select
            className={INPUT}
            value={draft.cancellationPenaltyPreset}
            onChange={(event) =>
              assign((prev) => ({ ...prev, cancellationPenaltyPreset: event.target.value as PenaltyPreset }))
            }
          >
            <option value="0">0% (0 bps)</option>
            <option value="1000">10% (1000 bps)</option>
            <option value="2500">25% (2500 bps)</option>
            <option value="5000">50% (5000 bps)</option>
            <option value="10000">100% (10000 bps)</option>
            <option value="custom">Personalizado</option>
          </select>
          {draft.cancellationPenaltyPreset === "custom" ? (
            <input
              className={cn(INPUT, "mt-2")}
              value={draft.cancellationPenaltyCustom}
              onChange={(event) =>
                assign((prev) => ({ ...prev, cancellationPenaltyCustom: event.target.value.replace(/[^\d]/g, "") }))
              }
              placeholder="bps (0-10000)"
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

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/15 px-2 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">{label}</p>
      <p className="mt-1 text-[12px] text-white/80">{value.trim() || "Sem conteúdo definido."}</p>
    </div>
  );
}

const INPUT =
  "h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80";
const TEXTAREA =
  "min-h-[120px] rounded-xl border border-white/20 bg-[#141414] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/80";
const CTA_PRIMARY =
  "inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/55 bg-[#22D3EE]/18 px-5 py-2 text-sm font-semibold text-white transition hover:border-[#22D3EE]/75 hover:bg-[#22D3EE]/24";
const CTA_NEUTRAL =
  "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] text-white transition hover:border-[#22D3EE]/45 hover:bg-[#22D3EE]/12";
const TOGGLE_LABEL =
  "flex items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/85";
const GUARDRAIL_ITEM = "rounded-xl border border-white/12 bg-white/5 px-3 py-2";
