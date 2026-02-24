"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { isPoliciesAllowedView, type PoliciesAllowedView } from "@/lib/domainBoundaries";
import {
  BOOKING_POLICY_WINDOW_MINUTES_MAX,
  BOOKING_POLICY_WINDOW_MINUTES_MIN,
  validateBookingPolicyWindowMinutes,
} from "@/lib/policies/bookingPolicyGuardrails";
import { cn } from "@/lib/utils";

type PoliciesToolClientProps = {
  orgId: number;
  initialView: PoliciesAllowedView;
};

type OrganizationPolicyType = "FLEXIBLE" | "MODERATE" | "RIGID" | "CUSTOM";
type WindowPreset = "none" | "0" | "60" | "180" | "720" | "1440" | "2880" | "10080" | "custom";
type ConnectAccountStatus = "READY" | "INCOMPLETE" | "MISSING" | "NOT_REQUIRED";
type StorePolicyMode = "NO_RETURNS" | "WINDOW_DAYS";

type PolicyItem = {
  id: number;
  name: string;
  policyType: OrganizationPolicyType;
  allowCancellation: boolean;
  cancellationWindowMinutes: number | null;
  cancellationPenaltyBps: number;
  allowReschedule: boolean;
  rescheduleWindowMinutes: number | null;
  guestBookingAllowed?: boolean;
};

type FinancePolicySnapshot = {
  paymentsMode: "CONNECT" | "PLATFORM";
  paymentsAccount: {
    status: ConnectAccountStatus;
    ready: boolean;
    hasStripeAccount: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  };
  fees: {
    processingSource: "STRIPE_AUTOMATIC";
    processingPayer: "ORGANIZATION";
    feeMode: "ADDED" | "INCLUDED";
    platformFeeBps: number;
    platformFeeFixedCents: number;
    managePath: string;
  };
};

type PoliciesResponse = {
  items: PolicyItem[];
  organizationPolicy?: {
    orgRescheduleWindowMinutes?: number | null;
  };
  financePolicy?: FinancePolicySnapshot;
};

type PolicyDraft = {
  allowCancellation: boolean;
  cancellationWindowPreset: WindowPreset;
  cancellationWindowCustom: string;
  allowReschedule: boolean;
  rescheduleWindowPreset: WindowPreset;
  rescheduleWindowCustom: string;
  guestBookingAllowed: boolean;
};

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

type CrmPolicyConfig = {
  timezone: string;
  quietHoursStartMinute: number;
  quietHoursEndMinute: number;
  capPerDay: number;
  capPerWeek: number;
  capPerMonth: number;
  approvalEscalationHours: number;
  approvalExpireHours: number;
};

type CrmPolicyResponse = {
  config: CrmPolicyConfig;
};

type PadelPolicyResponse = {
  policy: {
    scope: "GLOBAL_FIXED";
    customizableByOrganization: boolean;
    splitDeadlineHours: number;
    splitWindowCloseHoursBeforeStart: number;
    pendingConfirmationWindowMin: number;
    pendingConfirmationWindowMax: number;
  };
  adoption: {
    totalTournaments: number;
    legacyOverrides: number;
  };
};

type DraftWindowValidation =
  | { ok: true; value: number | null }
  | { ok: false; message: string };

type PolicyDraftValidation = {
  ok: boolean;
  values: {
    cancellationWindowMinutes: number | null;
    rescheduleWindowMinutes: number | null;
  };
  errors: {
    cancellationWindowCustom: string | null;
    rescheduleWindowCustom: string | null;
  };
};

const swrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 2,
} as const;

const CRM_POLICY_FALLBACK: CrmPolicyConfig = {
  timezone: "Europe/Lisbon",
  quietHoursStartMinute: 20 * 60,
  quietHoursEndMinute: 10 * 60,
  capPerDay: 1,
  capPerWeek: 4,
  capPerMonth: 10,
  approvalEscalationHours: 24,
  approvalExpireHours: 48,
};

const PADEL_POLICY_FALLBACK = {
  scope: "GLOBAL_FIXED" as const,
  customizableByOrganization: false,
  splitDeadlineHours: 24,
  splitWindowCloseHoursBeforeStart: 24,
  pendingConfirmationWindowMin: 1,
  pendingConfirmationWindowMax: 240,
};

const PADEL_ADOPTION_FALLBACK = {
  totalTournaments: 0,
  legacyOverrides: 0,
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

function prettyWindow(minutes: number | null) {
  if (minutes === null) return "não permitido";
  if (minutes === 0) return "até à hora de início";
  if (minutes % 1440 === 0) return `${minutes / 1440} dia(s) antes`;
  if (minutes % 60 === 0) return `${minutes / 60} hora(s) antes`;
  return `${minutes} minutos antes`;
}

function minutesToClock(minutes: number) {
  const normalized = Math.min(1439, Math.max(0, Math.floor(minutes)));
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
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

function validateDraftWindow(params: {
  field: "cancellationWindowMinutes" | "rescheduleWindowMinutes";
  preset: WindowPreset;
  customValue: string;
}): DraftWindowValidation {
  const { field, preset, customValue } = params;
  if (preset === "none") return { ok: true, value: null };
  if (preset === "custom") {
    if (!customValue.trim()) {
      return {
        ok: false,
        message: `Indica um valor entre ${BOOKING_POLICY_WINDOW_MINUTES_MIN} e ${BOOKING_POLICY_WINDOW_MINUTES_MAX} minutos.`,
      };
    }
    const customValidation = validateBookingPolicyWindowMinutes({
      value: customValue,
      field,
      allowNull: false,
    });
    if (!customValidation.ok) {
      return { ok: false, message: customValidation.message };
    }
    return { ok: true, value: customValidation.value };
  }
  const presetValidation = validateBookingPolicyWindowMinutes({
    value: Number(preset),
    field,
    allowNull: false,
  });
  if (!presetValidation.ok) {
    return { ok: false, message: presetValidation.message };
  }
  return { ok: true, value: presetValidation.value };
}

function validatePolicyDraft(draft: PolicyDraft | null): PolicyDraftValidation | null {
  if (!draft) return null;
  const cancellationResult = draft.allowCancellation
    ? validateDraftWindow({
        field: "cancellationWindowMinutes",
        preset: draft.cancellationWindowPreset,
        customValue: draft.cancellationWindowCustom,
      })
    : ({ ok: true, value: null } as DraftWindowValidation);
  const rescheduleResult = draft.allowReschedule
    ? validateDraftWindow({
        field: "rescheduleWindowMinutes",
        preset: draft.rescheduleWindowPreset,
        customValue: draft.rescheduleWindowCustom,
      })
    : ({ ok: true, value: null } as DraftWindowValidation);

  return {
    ok: cancellationResult.ok && rescheduleResult.ok,
    values: {
      cancellationWindowMinutes: cancellationResult.ok ? cancellationResult.value : null,
      rescheduleWindowMinutes: rescheduleResult.ok ? rescheduleResult.value : null,
    },
    errors: {
      cancellationWindowCustom: cancellationResult.ok ? null : cancellationResult.message,
      rescheduleWindowCustom: rescheduleResult.ok ? null : rescheduleResult.message,
    },
  };
}

function formatFeeRateLabel(bps: number) {
  const normalized = Math.max(0, Math.round(Number(bps) || 0));
  if (normalized === 0) return "0%";
  if (normalized % 100 === 0) return `${normalized / 100}%`;
  return `${(normalized / 100).toFixed(2).replace(/\.00$/, "")}%`;
}

function createInitialStorePolicyDraft(): StorePolicyDraft {
  return {
    returnPolicyMode: "WINDOW_DAYS",
    returnWindowDays: "14",
  };
}

function buildStoreReturnPolicyPreview(draft: StorePolicyDraft) {
  if (draft.returnPolicyMode === "NO_RETURNS") {
    return "Não aceitas devoluções. Em caso de defeito, o cliente contacta o suporte.";
  }
  const parsedDays = Number(draft.returnWindowDays);
  const days = Number.isFinite(parsedDays) ? Math.min(730, Math.max(0, Math.round(parsedDays))) : 14;
  if (days === 0) {
    return "Aceitas devolução apenas no próprio dia da compra, sem sinais de uso.";
  }
  return `Aceitas devolução durante ${days} dia(s), sem sinais de uso.`;
}

function toPolicyDraft(policy: PolicyItem): PolicyDraft {
  const cancellationPreset = windowPresetFromValue(policy.cancellationWindowMinutes);
  const reschedulePreset = windowPresetFromValue(policy.rescheduleWindowMinutes);
  return {
    allowCancellation: policy.allowCancellation,
    cancellationWindowPreset: cancellationPreset,
    cancellationWindowCustom:
      cancellationPreset === "custom" ? String(policy.cancellationWindowMinutes ?? "") : "",
    allowReschedule: policy.allowReschedule,
    rescheduleWindowPreset: reschedulePreset,
    rescheduleWindowCustom:
      reschedulePreset === "custom" ? String(policy.rescheduleWindowMinutes ?? "") : "",
    guestBookingAllowed: Boolean(policy.guestBookingAllowed),
  };
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function PoliciesToolClient({ orgId, initialView }: PoliciesToolClientProps) {
  const searchParams = useSearchParams();
  const view = parseView(searchParams?.get("view") ?? null, initialView);
  const orgApiBase = `/api/org/${orgId}`;

  const shouldLoadCrmPolicy = view === "crm";
  const shouldLoadPadelPolicy = view === "padel";

  const { data: policiesData, error: policiesError, mutate: mutatePolicies } = useSWR<PoliciesResponse>(
    `${orgApiBase}/policies`,
    apiFetcher,
    swrOptions,
  );
  const { data: storePolicyData, error: storePolicyError, mutate: mutateStorePolicy } = useSWR<StorePolicyResponse>(
    `${orgApiBase}/policies/store`,
    apiFetcher,
    swrOptions,
  );
  const { data: crmPolicyData, error: crmPolicyError, isLoading: crmPolicyLoading } = useSWR<CrmPolicyResponse>(
    shouldLoadCrmPolicy ? `${orgApiBase}/crm/config` : null,
    apiFetcher,
    swrOptions,
  );
  const { data: padelPolicyData, error: padelPolicyError, isLoading: padelPolicyLoading } =
    useSWR<PadelPolicyResponse>(
      shouldLoadPadelPolicy ? `${orgApiBase}/policies/padel` : null,
      apiFetcher,
      swrOptions,
    );

  const policies = policiesData?.items ?? [];
  const financePolicy = policiesData?.financePolicy ?? null;
  const paymentsAccount = financePolicy?.paymentsAccount ?? null;
  const paymentsMode = financePolicy?.paymentsMode ?? "CONNECT";
  const paymentsManagePath = financePolicy?.fees.managePath ?? buildOrgHref(orgId, "/finance", { view: "payouts" });

  const bookingPolicy = useMemo(
    () => policies.find((policy) => policy.policyType === "MODERATE") ?? policies[0] ?? null,
    [policies],
  );

  const [loadedBookingPolicyId, setLoadedBookingPolicyId] = useState<number | null>(null);
  const [bookingDraft, setBookingDraft] = useState<PolicyDraft | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccessMessage, setBookingSuccessMessage] = useState<string | null>(null);

  const [storePolicyDraft, setStorePolicyDraft] = useState<StorePolicyDraft>(createInitialStorePolicyDraft);
  const [storePolicyLoaded, setStorePolicyLoaded] = useState(false);
  const [storePolicySaving, setStorePolicySaving] = useState(false);
  const [storePolicyErrorMessage, setStorePolicyErrorMessage] = useState<string | null>(null);
  const [storePolicySuccessMessage, setStorePolicySuccessMessage] = useState<string | null>(null);

  const bookingDraftValidation = useMemo(() => validatePolicyDraft(bookingDraft), [bookingDraft]);

  useEffect(() => {
    if (!bookingPolicy) return;
    if (loadedBookingPolicyId === bookingPolicy.id) return;
    setBookingDraft(toPolicyDraft(bookingPolicy));
    setLoadedBookingPolicyId(bookingPolicy.id);
    setBookingError(null);
    setBookingSuccessMessage(null);
  }, [bookingPolicy, loadedBookingPolicyId]);

  useEffect(() => {
    setLoadedBookingPolicyId(null);
    setBookingDraft(null);
    setBookingError(null);
    setBookingSuccessMessage(null);
    setStorePolicyLoaded(false);
    setStorePolicyDraft(createInitialStorePolicyDraft());
    setStorePolicyErrorMessage(null);
    setStorePolicySuccessMessage(null);
  }, [orgId]);

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

  const saveBookingPolicy = useCallback(async () => {
    if (!bookingPolicy || !bookingDraft || bookingSaving || !bookingDraftValidation) return;
    if (!bookingDraftValidation.ok) {
      setBookingError("Revê os guardrails dos valores personalizados antes de guardar.");
      setBookingSuccessMessage(null);
      return;
    }
    setBookingSaving(true);
    setBookingError(null);
    setBookingSuccessMessage(null);

    try {
      const payload = {
        allowCancellation: bookingDraft.allowCancellation,
        cancellationWindowMinutes: bookingDraft.allowCancellation
          ? bookingDraftValidation.values.cancellationWindowMinutes
          : null,
        allowReschedule: bookingDraft.allowReschedule,
        rescheduleWindowMinutes: bookingDraft.allowReschedule
          ? bookingDraftValidation.values.rescheduleWindowMinutes
          : null,
        guestBookingAllowed: bookingDraft.guestBookingAllowed,
        cancellationPenaltyBps: 0,
      };

      const response = await fetch(`${orgApiBase}/policies/${bookingPolicy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error((json && (json.error || json.message)) || "Não foi possível guardar a política.");
      }

      setLoadedBookingPolicyId(null);
      await mutatePolicies();
      setBookingSuccessMessage("Política de reservas atualizada.");
    } catch (error) {
      setBookingError(normalizeErrorMessage(error, "Não foi possível guardar a política."));
    } finally {
      setBookingSaving(false);
    }
  }, [bookingDraft, bookingDraftValidation, bookingPolicy, bookingSaving, mutatePolicies, orgApiBase]);

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
        throw new Error((json && (json.error || json.message)) || "Não foi possível guardar a política da loja.");
      }
      setStorePolicySuccessMessage("Política da loja atualizada.");
      setStorePolicyLoaded(false);
      await mutateStorePolicy();
    } catch (error) {
      setStorePolicyErrorMessage(normalizeErrorMessage(error, "Não foi possível guardar a política da loja."));
    } finally {
      setStorePolicySaving(false);
    }
  }, [mutateStorePolicy, orgApiBase, storePolicyDraft, storePolicySaving]);

  const crmPolicy = crmPolicyData?.config ?? CRM_POLICY_FALLBACK;
  const padelPolicy = padelPolicyData?.policy ?? PADEL_POLICY_FALLBACK;
  const padelAdoption = padelPolicyData?.adoption ?? PADEL_ADOPTION_FALLBACK;
  const canonicalLegalUrl = (storePolicyData?.policy.legalUrl ?? "").trim();

  const isPlatformPayments = paymentsMode === "PLATFORM" || paymentsAccount?.status === "NOT_REQUIRED";

  const paymentsStatusLabel = useMemo(() => {
    if (isPlatformPayments) return "Na plataforma";
    if (!paymentsAccount) return "Sem informação";
    if (paymentsAccount.status === "READY") return "Pronta";
    if (paymentsAccount.status === "INCOMPLETE") return "Em configuração";
    return "Por ligar";
  }, [isPlatformPayments, paymentsAccount]);

  const paymentsChecklist = useMemo(() => {
    if (isPlatformPayments) {
      return [
        {
          id: "platform-processing",
          label: "Pagamentos recebidos pela ORYA",
          done: true,
        },
        {
          id: "connect-not-required",
          label: "Não é necessário Stripe Connect",
          done: true,
        },
      ];
    }
    return [
      {
        id: "stripe-account",
        label: "Conta Stripe ligada",
        done: Boolean(paymentsAccount?.hasStripeAccount),
      },
      {
        id: "charges-enabled",
        label: "Pagamentos ativos",
        done: Boolean(paymentsAccount?.chargesEnabled),
      },
      {
        id: "payouts-enabled",
        label: "Transferências ativas",
        done: Boolean(paymentsAccount?.payoutsEnabled),
      },
    ];
  }, [isPlatformPayments, paymentsAccount]);

  const defaultViewError =
    (policiesError instanceof Error ? policiesError.message : null) ??
    (storePolicyError instanceof Error ? storePolicyError.message : null);
  const crmViewError = crmPolicyError instanceof Error ? crmPolicyError.message : null;
  const padelViewError = padelPolicyError instanceof Error ? padelPolicyError.message : null;
  const activeError =
    view === "crm" ? crmViewError ?? defaultViewError : view === "padel" ? padelViewError ?? defaultViewError : defaultViewError;

  return (
    <section className="space-y-4 text-white sm:space-y-5">
      <p className="text-sm text-white/80">Aqui encontras todas as regras da organização, num só lugar.</p>

      {activeError ? (
        <Notice tone="error">{activeError}</Notice>
      ) : null}

      {view === "overview" ? (
        <Panel title="Resumo">
          <div className="space-y-2">
            <InfoRow
              label="Reservas"
              value={
                bookingPolicy
                  ? `${bookingPolicy.allowCancellation ? "Com cancelamento" : "Sem cancelamento"} · ${prettyWindow(
                      bookingPolicy.cancellationWindowMinutes,
                    )}`
                  : "Sem política carregada"
              }
            />
            <InfoRow label="Financeiro" value={`${paymentsStatusLabel} · ${isPlatformPayments ? "Conta ORYA" : "Stripe Connect"}`} />
            <InfoRow label="CRM" value="Regra fixa da plataforma (20:00 às 10:00)" />
            <InfoRow label="Padel" value={`Split fixo em ${padelPolicy.splitDeadlineHours}h`} />
            <InfoRow
              label="Loja"
              value={
                storePolicyData?.policy.returnPolicyMode === "NO_RETURNS"
                  ? "Sem devoluções"
                  : `Devoluções: ${storePolicyData?.policy.returnWindowDays ?? 14} dia(s)`
              }
            />
            <InfoRow label="Página legal" value={canonicalLegalUrl || "Ainda sem link público"} />
          </div>
        </Panel>
      ) : null}

      {view === "booking" ? (
        <div className="space-y-3">
          <Panel
            title="Reservas"
            subtitle="Existe uma única regra padrão. Ao guardar, estás a atualizá-la."
          >
            {!bookingPolicy || !bookingDraft ? (
              <EmptyState label="A preparar regra padrão de reservas..." />
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/80">
                  <p>Esta regra é usada nas reservas e também na página legal pública.</p>
                </div>

                <PolicyControls
                  draft={bookingDraft}
                  validationErrors={{
                    cancellationWindowCustom: bookingDraftValidation?.errors.cancellationWindowCustom ?? null,
                    rescheduleWindowCustom: bookingDraftValidation?.errors.rescheduleWindowCustom ?? null,
                  }}
                  onChange={(next) => {
                    setBookingDraft((prev) => {
                      const base = prev ?? bookingDraft;
                      return typeof next === "function" ? next(base) : next;
                    });
                  }}
                />

                <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/80">
                  <p className="font-semibold text-white">Como fica para o cliente</p>
                  <p className="mt-1">
                    Cancelamento: {bookingDraft.allowCancellation
                      ? bookingDraftValidation?.errors.cancellationWindowCustom
                        ? "valor personalizado inválido"
                        : prettyWindow(bookingDraftValidation?.values.cancellationWindowMinutes ?? null)
                      : "não permitido"}
                  </p>
                  <p className="mt-1">
                    Reagendamento: {bookingDraft.allowReschedule
                      ? bookingDraftValidation?.errors.rescheduleWindowCustom
                        ? "valor personalizado inválido"
                        : prettyWindow(bookingDraftValidation?.values.rescheduleWindowMinutes ?? null)
                      : "não permitido"}
                  </p>
                  <p className="mt-1">
                    Reserva sem conta: {bookingDraft.guestBookingAllowed ? "permitida" : "não permitida"}
                  </p>
                </div>

                {bookingDraftValidation && !bookingDraftValidation.ok ? (
                  <Notice tone="warning">
                    Guardrails ativos: os prazos personalizados têm de ficar entre {BOOKING_POLICY_WINDOW_MINUTES_MIN} e{" "}
                    {BOOKING_POLICY_WINDOW_MINUTES_MAX} minutos.
                  </Notice>
                ) : null}
                {bookingError ? <Notice tone="error">{bookingError}</Notice> : null}
                {bookingSuccessMessage ? <Notice tone="success">{bookingSuccessMessage}</Notice> : null}

                <div>
                  <button
                    type="button"
                    className={CTA_PRIMARY}
                    onClick={() => void saveBookingPolicy()}
                    disabled={bookingSaving || Boolean(bookingDraftValidation && !bookingDraftValidation.ok)}
                  >
                    {bookingSaving ? "A guardar..." : "Guardar alterações"}
                  </button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {view === "finance" ? (
        <div className="space-y-3">
          <Panel title="Pagamentos">
            <div className="space-y-3 text-sm text-white/80">
              <InfoRow label="Estado atual" value={paymentsStatusLabel} />
              <InfoRow label="Modo" value={isPlatformPayments ? "Conta ORYA" : "Stripe Connect"} />

              <div className="space-y-2">
                {paymentsChecklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/12 bg-white/5 px-3 py-2">
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        item.done
                          ? "border-emerald-300/45 bg-emerald-500/12 text-emerald-100"
                          : "border-amber-300/45 bg-amber-500/12 text-amber-100",
                      )}
                    >
                      {item.done ? "OK" : "Pendente"}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <a className={CTA_PRIMARY} href={paymentsManagePath}>
                  Abrir financeiro
                </a>
              </div>
            </div>
          </Panel>

          <Panel title="Taxas automáticas">
            <div className="space-y-2 text-sm text-white/80">
              <InfoRow label="Taxa de processamento" value="Vem da Stripe e é aplicada automaticamente" />
              <InfoRow
                label="Quem paga a taxa de processamento"
                value="Organização"
              />
              <InfoRow
                label="Taxa da plataforma"
                value={`${formatFeeRateLabel(financePolicy?.fees.platformFeeBps ?? 0)} + ${financePolicy?.fees.platformFeeFixedCents ?? 0} cênt. por pagamento`}
              />
              <InfoRow
                label="Como entra no preço"
                value={(financePolicy?.fees.feeMode ?? "ADDED") === "INCLUDED" ? "Incluída no valor" : "Somada ao valor"}
              />
            </div>
          </Panel>
        </div>
      ) : null}

      {view === "crm" ? (
        <Panel title="CRM (só leitura)">
          {crmPolicyLoading && !crmPolicyData ? (
            <EmptyState label="A carregar política de CRM..." />
          ) : (
            <div className="space-y-2 text-sm text-white/80">
              <InfoRow
                label="Período sem mensagens"
                value={`${minutesToClock(crmPolicy.quietHoursStartMinute)} até ${minutesToClock(crmPolicy.quietHoursEndMinute)}`}
              />
              <InfoRow label="Limite por dia" value={`${crmPolicy.capPerDay} contacto(s)`} />
              <InfoRow label="Limite por semana" value={`${crmPolicy.capPerWeek} contacto(s)`} />
              <InfoRow label="Limite por mês" value={`${crmPolicy.capPerMonth} contacto(s)`} />
              <InfoRow label="Sobe para revisão ao fim de" value={`${crmPolicy.approvalEscalationHours}h`} />
              <InfoRow label="Aprovação válida por" value={`${crmPolicy.approvalExpireHours}h`} />
              <Notice tone="info">Estas regras são fixas da plataforma.</Notice>
            </div>
          )}
        </Panel>
      ) : null}

      {view === "padel" ? (
        <div className="space-y-3">
          <Panel title="Padel (regra fixa)">
            {padelPolicyLoading && !padelPolicyData ? (
              <EmptyState label="A carregar política de padel..." />
            ) : (
              <div className="space-y-2 text-sm text-white/80">
                <InfoRow label="Prazo mínimo para split" value={`${padelPolicy.splitDeadlineHours}h antes do início`} />
                <InfoRow
                  label="Fecho do split"
                  value={`${padelPolicy.splitWindowCloseHoursBeforeStart}h antes do início`}
                />
                <InfoRow
                  label="Confirmação pendente"
                  value={`${padelPolicy.pendingConfirmationWindowMin} a ${padelPolicy.pendingConfirmationWindowMax} minutos`}
                />
                <InfoRow label="Torneios na organização" value={String(padelAdoption.totalTournaments)} />
                <InfoRow label="Registos antigos fora da regra" value={String(padelAdoption.legacyOverrides)} />
                <Notice tone="info">É sempre igual para todos os torneios da organização.</Notice>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {view === "terms" ? (
        <Panel title="Legal">
          <div className="space-y-2 text-sm text-white/80">
            <InfoRow label="Link público" value={canonicalLegalUrl || "Ainda sem link público"} />
            <InfoRow label="Texto para clientes" value="Gerado automaticamente com base nas políticas" />
            <InfoRow
              label="Onde se altera"
              value="Nas próprias políticas (reservas, loja, etc.)"
            />
            {canonicalLegalUrl ? (
              <div>
                <a className={CTA_NEUTRAL} href={canonicalLegalUrl}>
                  Ver página legal
                </a>
              </div>
            ) : (
              <Notice tone="warning">O link público aparece quando a organização tiver username público ativo.</Notice>
            )}
          </div>
        </Panel>
      ) : null}

      {view === "store" ? (
        <Panel title="Loja" subtitle="Devoluções">
          <div className="space-y-3">
            {!storePolicyData?.storeFeatureEnabled ? (
              <Notice tone="warning">O módulo de loja está desativado nesta instalação.</Notice>
            ) : null}

            {storePolicyData?.storeFeatureEnabled && !storePolicyData?.hasStore ? (
              <Notice tone="warning">
                Ainda não tens loja ativa. Esta política fica guardada e entra em funcionamento quando a loja estiver ativa.
              </Notice>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Com devoluções?">
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
                  <option value="WINDOW_DAYS">Sim</option>
                  <option value="NO_RETURNS">Não</option>
                </select>
              </Field>

              <Field label="Link público legal">
                <input className={cn(INPUT, "opacity-80")} value={storePolicyData?.policy.legalUrl ?? ""} readOnly />
              </Field>
            </div>

            {storePolicyDraft.returnPolicyMode === "WINDOW_DAYS" ? (
              <Field label="Prazo de devolução (em dias)">
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
              <p className="font-semibold text-white">Texto que o cliente vê</p>
              <p className="mt-1">{buildStoreReturnPolicyPreview(storePolicyDraft)}</p>
            </div>

            <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/80">
              <p className="font-semibold text-white">Contacto de suporte para o cliente</p>
              <p className="mt-1">
                {storePolicyData?.policy.supportEmail ?? "Sem email"}
                {storePolicyData?.policy.supportEmail && storePolicyData?.policy.supportPhone ? " · " : ""}
                {storePolicyData?.policy.supportPhone ?? ""}
              </p>
            </div>

            <Notice tone="info">
              Email e telefone de suporte vêm de
              {" "}
              <a className="underline" href={buildOrgHref(orgId, "/settings")}>
                Definições
              </a>
              .
            </Notice>

            {storePolicyErrorMessage ? <Notice tone="error">{storePolicyErrorMessage}</Notice> : null}
            {storePolicySuccessMessage ? <Notice tone="success">{storePolicySuccessMessage}</Notice> : null}

            <div>
              <button
                type="button"
                className={CTA_PRIMARY}
                onClick={() => void saveStorePolicy()}
                disabled={storePolicySaving || !storePolicyData?.storeFeatureEnabled}
              >
                {storePolicySaving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </Panel>
      ) : null}

      {view === "guardrails" ? (
        <Panel title="Limites fixos">
          <ul className="space-y-2 text-sm text-white/80">
            <li className={GUARDRAIL_ITEM}>Existe uma única regra padrão de reservas e, ao guardar, estás a atualizá-la.</li>
            <li className={GUARDRAIL_ITEM}>Não existe multa extra em percentagem no cancelamento.</li>
            <li className={GUARDRAIL_ITEM}>No-show não cria cobrança extra: fica apenas como registo operacional/CRM.</li>
            <li className={GUARDRAIL_ITEM}>Taxas de pagamento vêm automaticamente da Stripe e da configuração da plataforma.</li>
            <li className={GUARDRAIL_ITEM}>A página legal pública usa as mesmas políticas, para evitar versões diferentes da verdade.</li>
            <li className={GUARDRAIL_ITEM}>No padel, o split é fixo para todos os torneios da organização.</li>
          </ul>
        </Panel>
      ) : null}
    </section>
  );
}

function PolicyControls({
  draft,
  validationErrors,
  onChange,
}: {
  draft: PolicyDraft;
  validationErrors: {
    cancellationWindowCustom: string | null;
    rescheduleWindowCustom: string | null;
  };
  onChange: (next: PolicyDraft | ((prev: PolicyDraft) => PolicyDraft)) => void;
}) {
  const assign = useCallback(
    (updater: (prev: PolicyDraft) => PolicyDraft) => {
      onChange((prev) => updater(prev));
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={TOGGLE_LABEL}>
          <span>Permitir cancelamentos</span>
          <input
            type="checkbox"
            checked={draft.allowCancellation}
            onChange={(event) => assign((prev) => ({ ...prev, allowCancellation: event.target.checked }))}
          />
        </label>
        <label className={TOGGLE_LABEL}>
          <span>Permitir reagendamentos</span>
          <input
            type="checkbox"
            checked={draft.allowReschedule}
            onChange={(event) => assign((prev) => ({ ...prev, allowReschedule: event.target.checked }))}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Prazo para cancelar">
          <select
            className={INPUT}
            value={draft.cancellationWindowPreset}
            onChange={(event) =>
              assign((prev) => ({ ...prev, cancellationWindowPreset: event.target.value as WindowPreset }))
            }
            disabled={!draft.allowCancellation}
          >
            <option value="none">Não permitir</option>
            <option value="0">Até à hora de início</option>
            <option value="60">1 hora antes</option>
            <option value="180">3 horas antes</option>
            <option value="720">12 horas antes</option>
            <option value="1440">24 horas antes</option>
            <option value="2880">48 horas antes</option>
            <option value="10080">7 dias antes</option>
            <option value="custom">Personalizado</option>
          </select>
          {draft.cancellationWindowPreset === "custom" ? (
            <>
              <input
                className={cn(INPUT, "mt-2")}
                value={draft.cancellationWindowCustom}
                onChange={(event) =>
                  assign((prev) => ({ ...prev, cancellationWindowCustom: event.target.value.replace(/[^\d]/g, "") }))
                }
                placeholder={`Minutos (${BOOKING_POLICY_WINDOW_MINUTES_MIN}-${BOOKING_POLICY_WINDOW_MINUTES_MAX})`}
                disabled={!draft.allowCancellation}
                inputMode="numeric"
                aria-invalid={Boolean(validationErrors.cancellationWindowCustom)}
              />
              <p
                className={cn(
                  "mt-1 text-xs",
                  validationErrors.cancellationWindowCustom ? "text-rose-200" : "text-white/60",
                )}
              >
                {validationErrors.cancellationWindowCustom ??
                  `Aceita apenas ${BOOKING_POLICY_WINDOW_MINUTES_MIN}-${BOOKING_POLICY_WINDOW_MINUTES_MAX} minutos.`}
              </p>
            </>
          ) : null}
        </Field>

        <Field label="Prazo para reagendar">
          <select
            className={INPUT}
            value={draft.rescheduleWindowPreset}
            onChange={(event) =>
              assign((prev) => ({ ...prev, rescheduleWindowPreset: event.target.value as WindowPreset }))
            }
            disabled={!draft.allowReschedule}
          >
            <option value="none">Não permitir</option>
            <option value="0">Até à hora de início</option>
            <option value="60">1 hora antes</option>
            <option value="180">3 horas antes</option>
            <option value="720">12 horas antes</option>
            <option value="1440">24 horas antes</option>
            <option value="2880">48 horas antes</option>
            <option value="10080">7 dias antes</option>
            <option value="custom">Personalizado</option>
          </select>
          {draft.rescheduleWindowPreset === "custom" ? (
            <>
              <input
                className={cn(INPUT, "mt-2")}
                value={draft.rescheduleWindowCustom}
                onChange={(event) =>
                  assign((prev) => ({ ...prev, rescheduleWindowCustom: event.target.value.replace(/[^\d]/g, "") }))
                }
                placeholder={`Minutos (${BOOKING_POLICY_WINDOW_MINUTES_MIN}-${BOOKING_POLICY_WINDOW_MINUTES_MAX})`}
                disabled={!draft.allowReschedule}
                inputMode="numeric"
                aria-invalid={Boolean(validationErrors.rescheduleWindowCustom)}
              />
              <p
                className={cn(
                  "mt-1 text-xs",
                  validationErrors.rescheduleWindowCustom ? "text-rose-200" : "text-white/60",
                )}
              >
                {validationErrors.rescheduleWindowCustom ??
                  `Aceita apenas ${BOOKING_POLICY_WINDOW_MINUTES_MIN}-${BOOKING_POLICY_WINDOW_MINUTES_MAX} minutos.`}
              </p>
            </>
          ) : null}
        </Field>
      </div>

      <label className={TOGGLE_LABEL}>
        <span>Permitir reservas sem conta</span>
        <input
          type="checkbox"
          checked={draft.guestBookingAllowed}
          onChange={(event) => assign((prev) => ({ ...prev, guestBookingAllowed: event.target.checked }))}
        />
      </label>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-white/65">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-white/70">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/75">
      {label}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2 text-sm">
      <span className="text-white/65">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "success" | "warning" | "info";
  children: React.ReactNode;
}) {
  const toneClasses =
    tone === "error"
      ? "border-rose-300/45 bg-rose-500/12 text-rose-100"
      : tone === "success"
        ? "border-emerald-300/45 bg-emerald-500/12 text-emerald-100"
        : tone === "warning"
          ? "border-amber-300/45 bg-amber-500/12 text-amber-100"
          : "border-cyan-300/35 bg-cyan-300/10 text-cyan-100";
  return <div className={cn("rounded-xl border px-3 py-2 text-sm", toneClasses)}>{children}</div>;
}

const INPUT =
  "h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80";
const CTA_PRIMARY =
  "inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/55 bg-[#22D3EE]/18 px-5 py-2 text-sm font-semibold text-white transition hover:border-[#22D3EE]/75 hover:bg-[#22D3EE]/24";
const CTA_NEUTRAL =
  "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] text-white transition hover:border-[#22D3EE]/45 hover:bg-[#22D3EE]/12";
const TOGGLE_LABEL =
  "flex items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/85";
const GUARDRAIL_ITEM = "border-b border-white/10 py-2";
