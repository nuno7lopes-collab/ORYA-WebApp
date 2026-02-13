"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
  CTA_PRIMARY,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const TRIGGER_OPTIONS = [
  "STORE_ORDER_PAID",
  "BOOKING_COMPLETED",
  "EVENT_CHECKIN",
  "PADEL_TOURNAMENT_ENTRY",
  "ORG_FOLLOWED",
] as const;

const CONDITION_FIELDS = [
  { value: "lastActivityAt", label: "Última atividade" },
  { value: "totalSpentCents", label: "Gasto total (cêntimos)" },
  { value: "marketingOptIn", label: "Marketing opt-in" },
  { value: "contactType", label: "Tipo de contacto" },
  { value: "tag", label: "Tag" },
] as const;

const CONDITION_OPS = [
  { value: "eq", label: "Igual" },
  { value: "gte", label: "Maior ou igual" },
  { value: "lte", label: "Menor ou igual" },
  { value: "in", label: "Inclui" },
  { value: "not_in", label: "Exclui" },
] as const;

const ACTION_CHANNELS = [
  { value: "IN_APP", label: "In-app" },
  { value: "EMAIL", label: "Email" },
] as const;

type JourneyListItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  publishedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stepsCount: number;
  enrollmentsCount: number;
};

type JourneyListResponse = {
  ok: boolean;
  items?: JourneyListItem[];
  error?: string;
  message?: string;
};

type JourneyDetailResponse = {
  ok: boolean;
  journey?: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    definition: Record<string, unknown> | null;
    steps: Array<{
      id: string;
      stepKey: string;
      position: number;
      stepType: "TRIGGER" | "CONDITION" | "DELAY" | "ACTION";
      config: Record<string, unknown> | null;
    }>;
  };
  error?: string;
  message?: string;
};

type JourneyConditionStep = {
  id: string;
  kind: "CONDITION";
  field: string;
  op: string;
  value: string;
  windowDays: string;
};

type JourneyDelayStep = {
  id: string;
  kind: "DELAY";
  minutes: string;
};

type JourneyActionStep = {
  id: string;
  kind: "ACTION";
  channel: "IN_APP" | "EMAIL";
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

type JourneyStepDraft = JourneyConditionStep | JourneyDelayStep | JourneyActionStep;

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

function createConditionStep(seed: number): JourneyConditionStep {
  return {
    id: `cond_${Date.now()}_${seed}`,
    kind: "CONDITION",
    field: "lastActivityAt",
    op: "gte",
    value: "30d",
    windowDays: "",
  };
}

function createDelayStep(seed: number): JourneyDelayStep {
  return {
    id: `delay_${Date.now()}_${seed}`,
    kind: "DELAY",
    minutes: "60",
  };
}

function createActionStep(seed: number): JourneyActionStep {
  return {
    id: `action_${Date.now()}_${seed}`,
    kind: "ACTION",
    channel: "IN_APP",
    title: "",
    body: "",
    ctaLabel: "",
    ctaUrl: "",
  };
}

function sanitizePositiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function normalizeTrigger(value: unknown): (typeof TRIGGER_OPTIONS)[number] {
  if (typeof value !== "string") return TRIGGER_OPTIONS[0];
  const match = TRIGGER_OPTIONS.find((item) => item === value.trim().toUpperCase());
  return match ?? TRIGGER_OPTIONS[0];
}

function stepBadge(kind: JourneyStepDraft["kind"]) {
  if (kind === "ACTION") return "Ação";
  if (kind === "DELAY") return "Delay";
  return "Condição";
}

function stepAccent(kind: JourneyStepDraft["kind"]) {
  if (kind === "ACTION") return "border-emerald-300/35 bg-emerald-500/10";
  if (kind === "DELAY") return "border-cyan-300/35 bg-cyan-500/10";
  return "border-amber-300/35 bg-amber-500/10";
}

export default function CrmJourneysPage() {
  const { data, isLoading, mutate } = useSWR<JourneyListResponse>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/journeys"),
    fetcher,
  );
  const journeys = data?.ok ? data.items ?? [] : [];

  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<(typeof TRIGGER_OPTIONS)[number]>(TRIGGER_OPTIONS[0]);
  const [steps, setSteps] = useState<JourneyStepDraft[]>([
    createConditionStep(1),
    createDelayStep(2),
    createActionStep(3),
  ]);

  const [loadingEditorId, setLoadingEditorId] = useState<string | null>(null);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [savingComposer, setSavingComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalDelayMinutes = useMemo(
    () =>
      steps.reduce((sum, step) => {
        if (step.kind !== "DELAY") return sum;
        return sum + sanitizePositiveInt(step.minutes, 0);
      }, 0),
    [steps],
  );
  const actionsCount = useMemo(() => steps.filter((step) => step.kind === "ACTION").length, [steps]);
  const conditionsCount = useMemo(() => steps.filter((step) => step.kind === "CONDITION").length, [steps]);

  const canSaveComposer = useMemo(() => {
    return name.trim().length >= 2 && actionsCount > 0 && !savingComposer;
  }, [actionsCount, name, savingComposer]);

  const resetComposer = () => {
    setEditingJourneyId(null);
    setName("");
    setDescription("");
    setTrigger(TRIGGER_OPTIONS[0]);
    setSteps([createConditionStep(1), createDelayStep(2), createActionStep(3)]);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((prev) => {
      const clone = [...prev];
      const current = clone[index];
      clone[index] = clone[target];
      clone[target] = current;
      return clone;
    });
  };

  const updateStep = (stepId: string, patch: Partial<JourneyStepDraft>) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        return { ...step, ...patch } as JourneyStepDraft;
      }),
    );
  };

  const removeStep = (stepId: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== stepId));
  };

  const addStep = (kind: JourneyStepDraft["kind"]) => {
    setSteps((prev) => {
      const seed = prev.length + 1;
      if (kind === "CONDITION") return [...prev, createConditionStep(seed)];
      if (kind === "DELAY") return [...prev, createDelayStep(seed)];
      return [...prev, createActionStep(seed)];
    });
  };

  const buildStepsPayload = () => {
    const payload: Array<{
      stepKey: string;
      position: number;
      stepType: "TRIGGER" | "CONDITION" | "DELAY" | "ACTION";
      config: Record<string, unknown>;
    }> = [
      {
        stepKey: "trigger",
        position: 0,
        stepType: "TRIGGER",
        config: { eventType: trigger },
      },
    ];

    steps.forEach((step, index) => {
      const position = index + 1;
      if (step.kind === "CONDITION") {
        payload.push({
          stepKey: `condition_${position}`,
          position,
          stepType: "CONDITION",
          config: {
            field: step.field,
            op: step.op,
            value: step.value.trim(),
            ...(step.windowDays.trim() ? { windowDays: sanitizePositiveInt(step.windowDays, 0) } : {}),
          },
        });
        return;
      }
      if (step.kind === "DELAY") {
        payload.push({
          stepKey: `delay_${position}`,
          position,
          stepType: "DELAY",
          config: {
            minutes: sanitizePositiveInt(step.minutes, 1),
          },
        });
        return;
      }
      payload.push({
        stepKey: `action_${position}`,
        position,
        stepType: "ACTION",
        config: {
          channel: step.channel,
          ...(step.title.trim() ? { title: step.title.trim() } : {}),
          ...(step.body.trim() ? { body: step.body.trim() } : {}),
          ...(step.ctaLabel.trim() ? { ctaLabel: step.ctaLabel.trim() } : {}),
          ...(step.ctaUrl.trim() ? { ctaUrl: step.ctaUrl.trim() } : {}),
          templateKey: "crm_journey_default",
        },
      });
    });

    return payload;
  };

  const buildDefinitionPayload = () => {
    return {
      version: 2,
      trigger: { eventType: trigger },
      summary: {
        actionsCount,
        conditionsCount,
        totalDelayMinutes,
      },
      graph: steps.map((step, index) => ({
        id: step.id,
        position: index,
        kind: step.kind,
      })),
    };
  };

  const parseJourneyToComposer = (journey: NonNullable<JourneyDetailResponse["journey"]>) => {
    const definitionTrigger =
      journey.definition &&
      typeof journey.definition === "object" &&
      journey.definition.trigger &&
      typeof journey.definition.trigger === "object" &&
      typeof (journey.definition.trigger as { eventType?: unknown }).eventType === "string"
        ? (journey.definition.trigger as { eventType: string }).eventType
        : null;

    const triggerStep = journey.steps.find((step) => step.stepType === "TRIGGER");
    const triggerFromStep =
      triggerStep?.config &&
      typeof triggerStep.config === "object" &&
      typeof triggerStep.config.eventType === "string"
        ? triggerStep.config.eventType
        : null;

    const nextTrigger = normalizeTrigger(definitionTrigger ?? triggerFromStep);

    const parsedSteps: JourneyStepDraft[] = [];
    journey.steps
      .filter((step) => step.stepType !== "TRIGGER")
      .sort((a, b) => a.position - b.position)
      .forEach((step, index) => {
        const config = step.config && typeof step.config === "object" ? step.config : {};
        if (step.stepType === "CONDITION") {
          parsedSteps.push({
            id: step.id || `cond_${index + 1}`,
            kind: "CONDITION",
            field: typeof config.field === "string" ? config.field : "lastActivityAt",
            op: typeof config.op === "string" ? config.op : "eq",
            value: typeof config.value === "string" ? config.value : "",
            windowDays:
              typeof config.windowDays === "number" && Number.isFinite(config.windowDays)
                ? String(config.windowDays)
                : "",
          });
          return;
        }
        if (step.stepType === "DELAY") {
          parsedSteps.push({
            id: step.id || `delay_${index + 1}`,
            kind: "DELAY",
            minutes:
              typeof config.minutes === "number" && Number.isFinite(config.minutes)
                ? String(Math.trunc(config.minutes))
                : "60",
          });
          return;
        }
        parsedSteps.push({
          id: step.id || `action_${index + 1}`,
          kind: "ACTION",
          channel: config.channel === "EMAIL" ? "EMAIL" : "IN_APP",
          title: typeof config.title === "string" ? config.title : "",
          body: typeof config.body === "string" ? config.body : "",
          ctaLabel: typeof config.ctaLabel === "string" ? config.ctaLabel : "",
          ctaUrl: typeof config.ctaUrl === "string" ? config.ctaUrl : "",
        });
      });

    setEditingJourneyId(journey.id);
    setName(journey.name);
    setDescription(journey.description ?? "");
    setTrigger(nextTrigger);
    setSteps(parsedSteps.length ? parsedSteps : [createActionStep(1)]);
  };

  const handleOpenEditor = async (journeyId: string) => {
    setLoadingEditorId(journeyId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/journeys/${journeyId}`));
      const json = (await res.json().catch(() => null)) as JourneyDetailResponse | null;
      if (!res.ok || !json?.ok || !json.journey) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao abrir journey");
      }
      parseJourneyToComposer(json.journey);
      setSuccess("Journey carregada no composer.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir journey");
    } finally {
      setLoadingEditorId(null);
    }
  };

  const handleSaveComposer = async () => {
    if (!canSaveComposer) return;
    setSavingComposer(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        definition: buildDefinitionPayload(),
        steps: buildStepsPayload(),
      };
      const isEditing = Boolean(editingJourneyId);
      const endpoint = isEditing
        ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/journeys/${editingJourneyId}`)
        : resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/journeys");
      const res = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao guardar journey");
      }

      if (!isEditing && json?.journey?.id) {
        setEditingJourneyId(String(json.journey.id));
      }

      await mutate();
      setSuccess(isEditing ? "Journey atualizada." : "Journey criada em rascunho.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar journey");
    } finally {
      setSavingComposer(false);
    }
  };

  const handleJourneyAction = async (journeyId: string, action: "publish" | "pause") => {
    setRowActionId(journeyId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/journeys/${journeyId}/${action}`), {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message ?? json?.error ?? "Falha na ação da journey");
      }
      await mutate();
      setSuccess(action === "publish" ? "Journey publicada." : "Journey pausada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar journey");
    } finally {
      setRowActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Journeys</h1>
        <p className={DASHBOARD_MUTED}>Composer visual com passos, condições, delays e ações multicanal.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-[12px] text-emerald-100">
          {success}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "space-y-4 p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">
            {editingJourneyId ? "Composer de Journey (edição)" : "Composer de Journey"}
          </h2>
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <span>{steps.length} passos</span>
            <span>•</span>
            <span>{actionsCount} ações</span>
            <span>•</span>
            <span>{totalDelayMinutes} min delay</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/70">
            Nome
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Reativação jogadores inativos"
            />
          </label>
          <label className="text-[12px] text-white/70">
            Trigger
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={trigger}
              onChange={(event) => setTrigger(normalizeTrigger(event.target.value))}
            >
              {TRIGGER_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-white/70 md:col-span-2">
            Descrição
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Objetivo e público da automação"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={CTA_NEUTRAL} onClick={() => addStep("CONDITION")}>
            + Condição
          </button>
          <button type="button" className={CTA_NEUTRAL} onClick={() => addStep("DELAY")}>
            + Delay
          </button>
          <button type="button" className={CTA_NEUTRAL} onClick={() => addStep("ACTION")}>
            + Ação
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <article
              key={step.id}
              className={cn("rounded-2xl border p-3", stepAccent(step.kind))}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-white/75">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 font-semibold">
                    Passo {index + 1}
                  </span>
                  <span>{stepBadge(step.kind)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={cn(CTA_NEUTRAL, "px-2 py-1")}
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={cn(CTA_NEUTRAL, "px-2 py-1")}
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={cn(CTA_NEUTRAL, "px-2 py-1")}
                    onClick={() => removeStep(step.id)}
                    disabled={steps.length <= 1}
                  >
                    Remover
                  </button>
                </div>
              </div>

              {step.kind === "CONDITION" ? (
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="text-[11px] text-white/75">
                    Campo
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.field}
                      onChange={(event) => updateStep(step.id, { field: event.target.value })}
                    >
                      {CONDITION_FIELDS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-white/75">
                    Operador
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.op}
                      onChange={(event) => updateStep(step.id, { op: event.target.value })}
                    >
                      {CONDITION_OPS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-white/75">
                    Valor
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.value}
                      onChange={(event) => updateStep(step.id, { value: event.target.value })}
                      placeholder="Ex.: 30d, VIP, 10000"
                    />
                  </label>
                  <label className="text-[11px] text-white/75">
                    Janela (dias)
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.windowDays}
                      onChange={(event) => updateStep(step.id, { windowDays: event.target.value })}
                      placeholder="Opcional"
                    />
                  </label>
                </div>
              ) : null}

              {step.kind === "DELAY" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-[11px] text-white/75">
                    Delay (minutos)
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.minutes}
                      onChange={(event) => updateStep(step.id, { minutes: event.target.value })}
                    />
                  </label>
                </div>
              ) : null}

              {step.kind === "ACTION" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-[11px] text-white/75">
                    Canal
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.channel}
                      onChange={(event) => updateStep(step.id, { channel: event.target.value as "IN_APP" | "EMAIL" })}
                    >
                      {ACTION_CHANNELS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-white/75">
                    Título
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.title}
                      onChange={(event) => updateStep(step.id, { title: event.target.value })}
                      placeholder="Mensagem principal"
                    />
                  </label>
                  <label className="text-[11px] text-white/75 md:col-span-2">
                    Mensagem
                    <textarea
                      className="mt-1 min-h-[84px] w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.body}
                      onChange={(event) => updateStep(step.id, { body: event.target.value })}
                      placeholder="Texto da comunicação"
                    />
                  </label>
                  <label className="text-[11px] text-white/75">
                    CTA label
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.ctaLabel}
                      onChange={(event) => updateStep(step.id, { ctaLabel: event.target.value })}
                      placeholder="Ex.: Ver oferta"
                    />
                  </label>
                  <label className="text-[11px] text-white/75">
                    CTA URL
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={step.ctaUrl}
                      onChange={(event) => updateStep(step.id, { ctaUrl: event.target.value })}
                      placeholder="https://..."
                    />
                  </label>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={CTA_PRIMARY}
            onClick={handleSaveComposer}
            disabled={!canSaveComposer}
          >
            {savingComposer ? "A guardar..." : editingJourneyId ? "Guardar alterações" : "Guardar rascunho"}
          </button>
          <button type="button" className={CTA_NEUTRAL} onClick={resetComposer}>
            Novo fluxo
          </button>
          {actionsCount === 0 ? <span className="text-[11px] text-rose-200">Adiciona pelo menos uma ação.</span> : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Journeys</h2>
          <span className="text-[11px] text-white/50">{journeys.length} journeys</span>
        </div>

        <div className="grid gap-3">
          {journeys.map((journey) => {
            const isPublished = journey.status === "PUBLISHED";
            return (
              <article key={journey.id} className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{journey.name}</p>
                    <p className="text-[12px] text-white/60">{journey.description || "Sem descrição"}</p>
                  </div>
                  <div className="text-right text-[11px] text-white/60">
                    <p>Status: {journey.status}</p>
                    <p>Atualizada: {formatDate(journey.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-[12px] text-white/70">
                  <span>Passos: {journey.stepsCount}</span>
                  <span>Inscrições: {journey.enrollmentsCount}</span>
                  <span>Publicada: {formatDate(journey.publishedAt)}</span>
                  <span>Pausada: {formatDate(journey.pausedAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={CTA_NEUTRAL}
                    onClick={() => handleOpenEditor(journey.id)}
                    disabled={loadingEditorId === journey.id}
                  >
                    {loadingEditorId === journey.id ? "A abrir..." : "Editar no composer"}
                  </button>
                  {!isPublished ? (
                    <button
                      type="button"
                      className={CTA_NEUTRAL}
                      onClick={() => handleJourneyAction(journey.id, "publish")}
                      disabled={rowActionId === journey.id}
                    >
                      {rowActionId === journey.id ? "A publicar..." : "Publicar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={CTA_NEUTRAL}
                      onClick={() => handleJourneyAction(journey.id, "pause")}
                      disabled={rowActionId === journey.id}
                    >
                      {rowActionId === journey.id ? "A pausar..." : "Pausar"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!isLoading && journeys.length === 0 ? (
            <div className={cn(DASHBOARD_CARD, "p-6 text-center text-[12px] text-white/60")}>Sem journeys criadas.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
