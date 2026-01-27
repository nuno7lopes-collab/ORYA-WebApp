"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";
import { adminLoadOpsSummary, adminReplayOutboxEvents } from "./actions";

type OrganizationStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | string;

type AdminOrganizationOwner = {
  id: string;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type AdminOrganizationItem = {
  id: number | string;
  publicName: string;
  status: OrganizationStatus;
  createdAt: string;
  orgType?: string | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: string | null;
  owner?: AdminOrganizationOwner | null;
  eventsCount?: number | null;
  totalTickets?: number | null;
  totalRevenueCents?: number | null;
};

type AdminOrganizationsListResponse =
  | {
      ok: true;
      organizations: AdminOrganizationItem[];
    }
  | {
      ok: false;
      error?: string;
      reason?: string;
    };

type EventLogItem = {
  id: string;
  type: string;
  actorId: string | null;
  orgId: number;
  sourceEventId: string | null;
  status: string;
  createdAt: string;
};

type EventLogResponse =
  | { ok: true; items: EventLogItem[] }
  | { ok: false; error?: string };

type OpsSummaryResponse =
  | {
      ok: true;
      slo: {
        ts: string;
        outbox: {
          pendingCountCapped: number;
          capLimit: number;
          oldestPendingCreatedAt: string | null;
          oldestPendingAgeSec: number | null;
          nextAttemptAtSoonest: string | null;
          backoffLagSec: number | null;
          deadLetteredLast24h: number;
        };
        eventLog: { last1hCount: number };
      };
    }
  | { ok: false; error?: string };

type RollupStatusResponse =
  | { ok: true; latestBucketDate: string | null }
  | { ok: false; error?: string };

type PaymentsRefreshResponse =
  | {
      ok: true;
      status: string;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      requirements_due: string[];
      accountId: string | null;
      requestId?: string | null;
    }
  | { ok: false; error?: string; requestId?: string | null; retryAfterSec?: number };

type LastAction = {
  action: string;
  status: "OK" | "ERROR" | "NOOP";
  code?: string | null;
  requestId?: string | null;
  at: string;
  details?: string | null;
};

const STATUS_LABEL: Record<OrganizationStatus, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
};

const FILTERS: { id: "ALL" | OrganizationStatus; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "PENDING", label: "Pendentes" },
  { id: "ACTIVE", label: "Ativos" },
  { id: "SUSPENDED", label: "Suspensos" },
];

const ERROR_COPY: Record<string, { title: string; message: string }> = {
  LEGAL_DOCS_REQUIRED: {
    title: "Documentos legais em falta",
    message: "Esta ação exige documentos legais aceites pela organização.",
  },
  KILL_SWITCH_ACTIVE: {
    title: "Kill switch ativo",
    message: "A organização está em modo restrito. Desativa o kill switch para continuar.",
  },
  STEP_UP_REQUIRED: {
    title: "Confirmação extra necessária",
    message: "Esta ação requer autenticação adicional antes de continuar.",
  },
  THROTTLED: {
    title: "Ação limitada",
    message: "Esta ação foi executada recentemente. Aguarda alguns minutos e tenta novamente.",
  },
  LIMIT_EXCEEDED: {
    title: "Limite excedido",
    message: "Reduz o número de itens por pedido e tenta novamente.",
  },
  OPS_FORBIDDEN: {
    title: "Ops restrito",
    message: "Este endpoint exige permissões de operações (ops) ou secret header.",
  },
  ALREADY_FRESH: {
    title: "Rollup já recente",
    message: "Os rollups já estão atualizados para hoje.",
  },
  UNAUTHENTICATED: {
    title: "Sessão em falta",
    message: "Inicia sessão novamente para continuar.",
  },
  FORBIDDEN: {
    title: "Acesso restrito",
    message: "Não tens permissões para executar esta ação.",
  },
  ORGANIZATION_NOT_FOUND: {
    title: "Organização não encontrada",
    message: "A organização já não existe ou foi removida.",
  },
  NOT_DEAD_LETTERED: {
    title: "Evento ainda não está em DLQ",
    message: "O replay só é possível para eventos dead-lettered.",
  },
  ALREADY_PUBLISHED: {
    title: "Evento já publicado",
    message: "Este evento já foi processado e não pode ser rearmado.",
  },
  INVALID_ORGANIZATION_ID: {
    title: "ID inválido",
    message: "Confirma o ID da organização e tenta novamente.",
  },
  INTERNAL_ERROR: {
    title: "Erro interno",
    message: "Ocorreu um erro inesperado. Tenta novamente em instantes.",
  },
};

function formatStatusLabel(status: OrganizationStatus) {
  return STATUS_LABEL[status] ?? status;
}

function statusBadgeClasses(status: OrganizationStatus) {
  switch (status) {
    case "PENDING":
      return "border-amber-400/60 bg-amber-500/10 text-amber-100";
    case "ACTIVE":
      return "border-emerald-400/60 bg-emerald-500/10 text-emerald-100";
    case "SUSPENDED":
      return "border-red-400/60 bg-red-500/10 text-red-100";
    default:
      return "border-white/20 bg-white/5 text-white/80";
  }
}

function paymentsModeLabel(orgType?: string | null) {
  return orgType === "PLATFORM" ? "Pagamentos ORYA" : "Pagamentos Connect";
}

function paymentsBadgeClasses(orgType?: string | null) {
  return orgType === "PLATFORM"
    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
    : "border-sky-400/60 bg-sky-500/10 text-sky-100";
}

function emailBadgeClasses(isVerified: boolean) {
  return isVerified
    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
    : "border-amber-400/60 bg-amber-500/10 text-amber-100";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDateShort(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatMoneyCents(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  const euros = value / 100;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(euros);
}

function formatOwner(owner?: AdminOrganizationOwner | null) {
  if (!owner) return "Utilizador ORYA";
  if (owner.username) return `@${owner.username}`;
  if (owner.fullName) return owner.fullName;
  if (owner.email) return owner.email;
  return "Utilizador ORYA";
}

function getPaymentsStatus(org: AdminOrganizationItem) {
  if (org.orgType === "PLATFORM") return "PLATFORM";
  if (!org.stripeAccountId) return "NOT_CONNECTED";
  if (org.stripeChargesEnabled && org.stripePayoutsEnabled) return "CONNECTED";
  return "INCOMPLETE";
}

function makeRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}`;
}

function describePaymentsStatus(status: string) {
  switch (status) {
    case "PLATFORM":
      return "ORYA (plataforma)";
    case "CONNECTED":
      return "Stripe ativo";
    case "INCOMPLETE":
      return "Atenção necessária";
    case "NOT_CONNECTED":
      return "Sem ligação Stripe";
    default:
      return status;
  }
}

function logAdminError(context: string, code?: string | null) {
  console.error(`[admin/organizacoes] ${context}`, code ?? "UNKNOWN");
}

function getErrorCopy(code?: string | null) {
  if (!code) return ERROR_COPY.INTERNAL_ERROR;
  return ERROR_COPY[code] ?? {
    title: "Erro inesperado",
    message: "Ocorreu um erro ao executar esta ação.",
  };
}

function InlineAlert({
  tone = "danger",
  title,
  message,
  code,
  requestId,
}: {
  tone?: "danger" | "warning" | "info";
  title: string;
  message: string;
  code?: string | null;
  requestId?: string | null;
}) {
  const classes =
    tone === "warning"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-50"
      : tone === "info"
        ? "border-sky-400/40 bg-sky-500/10 text-sky-50"
        : "border-red-500/40 bg-red-500/10 text-red-50";

  return (
    <div className={`rounded-xl border px-3 py-2 text-[11px] ${classes}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-white/70">{message}</p>
      {code && <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/50">{code}</p>}
      {requestId && (
        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/40">
          req {requestId}
        </p>
      )}
    </div>
  );
}

export default function AdminOrganizacoesPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessIssue, setAccessIssue] = useState<"UNAUTH" | "FORBIDDEN" | null>(null);
  const [organizations, setOrganizations] = useState<AdminOrganizationItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | OrganizationStatus>("ALL");
  const [selectedOrgId, setSelectedOrgId] = useState<number | string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | string | null>(null);
  const [updatingEmailId, setUpdatingEmailId] = useState<number | string | null>(null);
  const [refreshingPayments, setRefreshingPayments] = useState(false);
  const [actionError, setActionError] = useState<
    { scope: string; code?: string | null; requestId?: string | null } | null
  >(null);
  const [eventLog, setEventLog] = useState<{
    loading: boolean;
    error?: string | null;
    items: EventLogItem[];
  }>({ loading: false, error: null, items: [] });
  const [opsSummary, setOpsSummary] = useState<{
    loading: boolean;
    error?: string | null;
    data: OpsSummaryResponse["slo"] | null;
  }>({ loading: false, error: null, data: null });
  const [rollup, setRollup] = useState<{
    loading: boolean;
    error?: string | null;
    latestBucketDate: string | null;
  }>({ loading: false, error: null, latestBucketDate: null });
  const [rollupRunning, setRollupRunning] = useState(false);
  const [replayId, setReplayId] = useState("");
  const [replaying, setReplaying] = useState(false);
  const [paymentsDetails, setPaymentsDetails] = useState<
    Record<string, { status: string; requirements: string[]; accountId: string | null }>
  >({});
  const [lastActionByOrg, setLastActionByOrg] = useState<Record<string, LastAction>>({});

  const pendingOrganizations = useMemo(
    () => organizations.filter((o) => o.status === "PENDING"),
    [organizations],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOrganizations() {
      try {
        setLoading(true);
        setErrorMsg(null);
        setAccessIssue(null);

        const res = await fetch("/api/admin/organizacoes/list", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (res.status === 401) {
          if (!cancelled) setAccessIssue("UNAUTH");
          return;
        }

        if (res.status === 403) {
          if (!cancelled) setAccessIssue("FORBIDDEN");
          return;
        }

        const json = (await res.json().catch(() => null)) as AdminOrganizationsListResponse | null;
        if (!res.ok || !json || !("ok" in json) || !json.ok) {
          const code = json && "ok" in json ? json.error || json.reason : null;
          logAdminError("load-organizations", code);
          if (!cancelled) {
            const copy = getErrorCopy(code ?? "INTERNAL_ERROR");
            setErrorMsg(copy.message);
          }
          return;
        }

        if (!cancelled) {
          setOrganizations(Array.isArray(json.organizations) ? json.organizations : []);
        }
      } catch (err) {
        logAdminError("load-organizations", "INTERNAL_ERROR");
        if (!cancelled) {
          setErrorMsg("Ocorreu um erro inesperado. Tenta novamente dentro de instantes.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrganizations();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (organizations.length === 0) {
      setSelectedOrgId(null);
      return;
    }
    if (selectedOrgId && organizations.some((org) => String(org.id) === String(selectedOrgId))) {
      return;
    }
    setSelectedOrgId(organizations[0].id);
  }, [organizations, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId) return;
    void loadEventLog(selectedOrgId);
    void loadRollupStatus(selectedOrgId);
  }, [selectedOrgId]);

  useEffect(() => {
    void loadOpsSummary();
  }, []);

  const filteredOrganizations = useMemo(() => {
    if (filter === "ALL") return organizations;
    return organizations.filter((o) => o.status === filter);
  }, [organizations, filter]);

  const stats = useMemo(() => {
    const total = organizations.length;
    const pending = organizations.filter((o) => o.status === "PENDING").length;
    const active = organizations.filter((o) => o.status === "ACTIVE").length;
    const suspended = organizations.filter((o) => o.status === "SUSPENDED").length;
    return { total, pending, active, suspended };
  }, [organizations]);

  const selectedOrganization = useMemo(
    () => organizations.find((org) => String(org.id) === String(selectedOrgId)) ?? null,
    [organizations, selectedOrgId],
  );
  const lastAction = useMemo(
    () =>
      selectedOrganization ? lastActionByOrg[String(selectedOrganization.id)] ?? null : null,
    [lastActionByOrg, selectedOrganization],
  );

  function recordLastAction(
    orgId: number | string,
    action: string,
    status: "OK" | "ERROR" | "NOOP",
    options?: { code?: string | null; requestId?: string | null; details?: string | null },
  ) {
    setLastActionByOrg((prev) => ({
      ...prev,
      [String(orgId)]: {
        action,
        status,
        code: options?.code ?? null,
        requestId: options?.requestId ?? null,
        details: options?.details ?? null,
        at: new Date().toISOString(),
      },
    }));
  }

  async function loadEventLog(orgId: number | string) {
    setEventLog((prev) => ({ ...prev, loading: true, error: null }));
    const params = new URLSearchParams({ orgId: String(orgId), limit: "12" });
    const res = await fetch(`/api/admin/organizacoes/event-log?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as EventLogResponse | null;
    if (!res.ok || !json || !json.ok) {
      const code = json && "ok" in json ? json.error : null;
      logAdminError("load-event-log", code);
      setEventLog({ loading: false, error: code ?? "INTERNAL_ERROR", items: [] });
      return;
    }
    setEventLog({ loading: false, error: null, items: json.items ?? [] });
  }

  async function loadOpsSummary() {
    setOpsSummary((prev) => ({ ...prev, loading: true, error: null }));
    const json = (await adminLoadOpsSummary().catch(() => null)) as OpsSummaryResponse | null;
    if (!json || !json.ok) {
      const code = json && "ok" in json ? json.error : null;
      logAdminError("load-ops-summary", code);
      setOpsSummary({ loading: false, error: code ?? "INTERNAL_ERROR", data: null });
      return;
    }
    setOpsSummary({ loading: false, error: null, data: json.slo });
  }

  async function loadRollupStatus(orgId: number | string) {
    setRollup((prev) => ({ ...prev, loading: true, error: null }));
    const params = new URLSearchParams({ orgId: String(orgId) });
    const res = await fetch(`/api/admin/ops/analytics-rollups?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as RollupStatusResponse | null;
    if (!res.ok || !json || !json.ok) {
      const code = json && "ok" in json ? json.error : null;
      logAdminError("load-rollup-status", code);
      setRollup({ loading: false, error: code ?? "INTERNAL_ERROR", latestBucketDate: null });
      return;
    }
    setRollup({ loading: false, error: null, latestBucketDate: json.latestBucketDate ?? null });
  }

  async function updateStatus(organizationId: number | string, newStatus: OrganizationStatus) {
    const org = organizations.find((item) => String(item.id) === String(organizationId));
    const isSuspending = newStatus === "SUSPENDED";
    const isReactivating = newStatus === "ACTIVE" && org?.status === "SUSPENDED";
    if (isSuspending || isReactivating) {
      const label = isSuspending ? "suspender" : "reativar";
      const confirmed = window.confirm(`Confirmas ${label} esta organização?`);
      if (!confirmed) return;
    }

    try {
      setUpdatingId(organizationId);
      setActionError(null);
      const requestId = makeRequestId();
      const res = await fetch("/api/admin/organizacoes/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
        body: JSON.stringify({ organizationId, newStatus }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; requestId?: string | null; organization?: { changed?: boolean } }
        | null;
      if (!res.ok || !data?.ok) {
        const code = data?.error ?? "INTERNAL_ERROR";
        logAdminError("update-status", code);
        const resolvedRequestId = data?.requestId ?? requestId;
        setActionError({ scope: "status", code, requestId: resolvedRequestId });
        recordLastAction(organizationId, "Atualizar estado", "ERROR", {
          code,
          requestId: resolvedRequestId,
        });
        return;
      }
      const resolvedRequestId = data?.requestId ?? requestId;
      setOrganizations((prev) =>
        prev.map((orgItem) =>
          String(orgItem.id) === String(organizationId)
            ? { ...orgItem, status: newStatus }
            : orgItem,
        ),
      );
      recordLastAction(
        organizationId,
        "Atualizar estado",
        data?.organization?.changed === false ? "NOOP" : "OK",
        { requestId: resolvedRequestId },
      );
    } catch (err) {
      logAdminError("update-status", "INTERNAL_ERROR");
      setActionError({ scope: "status", code: "INTERNAL_ERROR" });
      recordLastAction(organizationId, "Atualizar estado", "ERROR", {
        code: "INTERNAL_ERROR",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function verifyPlatformEmail(organizationId: number | string) {
    const confirmed = window.confirm(
      "Confirmas marcar esta organização como plataforma e validar o email oficial para oryapt@gmail.com?",
    );
    if (!confirmed) return;

    try {
      setUpdatingEmailId(organizationId);
      setActionError(null);
      const requestId = makeRequestId();
      const res = await fetch("/api/admin/organizacoes/verify-platform-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            requestId?: string | null;
            organization?: AdminOrganizationItem;
          }
        | null;
      if (!res.ok || !data?.ok) {
        const code = data?.error ?? "INTERNAL_ERROR";
        logAdminError("verify-platform-email", code);
        const resolvedRequestId = data?.requestId ?? requestId;
        setActionError({ scope: "payments", code, requestId: resolvedRequestId });
        recordLastAction(organizationId, "Marcar como plataforma", "ERROR", {
          code,
          requestId: resolvedRequestId,
        });
        return;
      }

      const resolvedRequestId = data?.requestId ?? requestId;
      setOrganizations((prev) =>
        prev.map((org) =>
          String(org.id) === String(organizationId)
            ? {
                ...org,
                orgType: data.organization?.orgType ?? "PLATFORM",
                officialEmail: data.organization?.officialEmail ?? "oryapt@gmail.com",
                officialEmailVerifiedAt:
                  data.organization?.officialEmailVerifiedAt ?? new Date().toISOString(),
              }
            : org,
        ),
      );
      recordLastAction(organizationId, "Marcar como plataforma", "OK", {
        requestId: resolvedRequestId,
      });
    } catch (err) {
      logAdminError("verify-platform-email", "INTERNAL_ERROR");
      setActionError({ scope: "payments", code: "INTERNAL_ERROR" });
      recordLastAction(organizationId, "Marcar como plataforma", "ERROR", {
        code: "INTERNAL_ERROR",
      });
    } finally {
      setUpdatingEmailId(null);
    }
  }

  async function refreshPaymentsStatus(organizationId: number | string) {
    try {
      setRefreshingPayments(true);
      setActionError(null);
      const requestId = makeRequestId();
      const res = await fetch("/api/admin/organizacoes/refresh-payments-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await res.json().catch(() => null)) as PaymentsRefreshResponse | null;
      if (!res.ok || !data?.ok) {
        const code = data?.error ?? "INTERNAL_ERROR";
        logAdminError("refresh-payments-status", code);
        const resolvedRequestId = data?.requestId ?? requestId;
        setActionError({ scope: "payments", code, requestId: resolvedRequestId });
        recordLastAction(organizationId, "Atualizar status pagamentos", "ERROR", {
          code,
          requestId: resolvedRequestId,
          details: data?.retryAfterSec ? `retryAfter ${data.retryAfterSec}s` : null,
        });
        return;
      }
      const resolvedRequestId = data?.requestId ?? requestId;
      setPaymentsDetails((prev) => ({
        ...prev,
        [String(organizationId)]: {
          status: data.status,
          requirements: data.requirements_due ?? [],
          accountId: data.accountId ?? null,
        },
      }));
      setOrganizations((prev) =>
        prev.map((org) =>
          String(org.id) === String(organizationId)
            ? {
                ...org,
                stripeChargesEnabled: data.charges_enabled,
                stripePayoutsEnabled: data.payouts_enabled,
                stripeAccountId: data.accountId ?? org.stripeAccountId,
              }
            : org,
        ),
      );
      recordLastAction(organizationId, "Atualizar status pagamentos", "OK", {
        requestId: resolvedRequestId,
      });
    } catch (err) {
      logAdminError("refresh-payments-status", "INTERNAL_ERROR");
      setActionError({ scope: "payments", code: "INTERNAL_ERROR" });
      recordLastAction(organizationId, "Atualizar status pagamentos", "ERROR", {
        code: "INTERNAL_ERROR",
      });
    } finally {
      setRefreshingPayments(false);
    }
  }

  async function replayOutboxEvent() {
    if (!replayId.trim()) {
      setActionError({ scope: "ops", code: "INVALID_PAYLOAD" });
      return;
    }
    try {
      setReplaying(true);
      setActionError(null);
      const requestId = makeRequestId();
      const eventIds = replayId
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      const data = (await adminReplayOutboxEvents({ eventIds, requestId }).catch(() => null)) as
        | { ok?: boolean; error?: string; requestId?: string | null }
        | null;
      if (!data?.ok) {
        const code = data?.error ?? "INTERNAL_ERROR";
        logAdminError("outbox-replay", code);
        const resolvedRequestId = data?.requestId ?? requestId;
        setActionError({ scope: "ops", code, requestId: resolvedRequestId });
        if (selectedOrganization) {
          recordLastAction(selectedOrganization.id, "Rearmar DLQ", "ERROR", {
            code,
            requestId: resolvedRequestId,
          });
        }
        return;
      }
      const resolvedRequestId = data?.requestId ?? requestId;
      setReplayId("");
      void loadOpsSummary();
      if (selectedOrganization) {
        recordLastAction(selectedOrganization.id, "Rearmar DLQ", "OK", {
          requestId: resolvedRequestId,
        });
      }
    } catch (err) {
      logAdminError("outbox-replay", "INTERNAL_ERROR");
      setActionError({ scope: "ops", code: "INTERNAL_ERROR" });
      if (selectedOrganization) {
        recordLastAction(selectedOrganization.id, "Rearmar DLQ", "ERROR", {
          code: "INTERNAL_ERROR",
        });
      }
    } finally {
      setReplaying(false);
    }
  }

  async function triggerRollup(organizationId: number | string) {
    try {
      setRollupRunning(true);
      setActionError(null);
      const requestId = makeRequestId();
      const res = await fetch("/api/admin/ops/analytics-rollups", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
        body: JSON.stringify({ organizationId: Number(organizationId) }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; status?: string; requestId?: string | null }
        | null;
      if (!res.ok || !data?.ok) {
        const code = data?.error ?? "INTERNAL_ERROR";
        logAdminError("rollup-trigger", code);
        const resolvedRequestId = data?.requestId ?? requestId;
        setActionError({ scope: "ops", code, requestId: resolvedRequestId });
        recordLastAction(organizationId, "Trigger rollups", "ERROR", {
          code,
          requestId: resolvedRequestId,
        });
        return;
      }
      const resolvedRequestId = data?.requestId ?? requestId;
      if (data?.status === "ALREADY_FRESH") {
        recordLastAction(organizationId, "Trigger rollups", "NOOP", {
          code: "ALREADY_FRESH",
          requestId: resolvedRequestId,
        });
      } else {
        recordLastAction(organizationId, "Trigger rollups", "OK", {
          requestId: resolvedRequestId,
        });
      }
      if (selectedOrgId) {
        void loadRollupStatus(selectedOrgId);
      }
    } catch (err) {
      logAdminError("rollup-trigger", "INTERNAL_ERROR");
      setActionError({ scope: "ops", code: "INTERNAL_ERROR" });
      recordLastAction(organizationId, "Trigger rollups", "ERROR", {
        code: "INTERNAL_ERROR",
      });
    } finally {
      setRollupRunning(false);
    }
  }

  const hasOrganizations = filteredOrganizations.length > 0;

  return (
    <AdminLayout
      title="Org Control Center"
      subtitle="Consola operacional para gestão de organizações"
    >
      <section className="space-y-6">
        <AdminPageHeader
          title="Org Control Center"
          subtitle="Estado, pagamentos, compliance, operações e auditoria por organização."
          eyebrow="Admin • Organizações"
          actions={
            pendingOrganizations.length > 0 ? (
              <span className="admin-chip">{pendingOrganizations.length} pendente(s)</span>
            ) : null
          }
        />

        <div className="grid grid-cols-2 gap-2 text-[11px] sm:flex sm:flex-row">
          <div className="admin-card-soft px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Total</p>
            <p className="text-sm font-semibold">{stats.total}</p>
          </div>
          <div className="admin-card-soft px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-100/80">
              Pendentes
            </p>
            <p className="text-sm font-semibold text-amber-100">{stats.pending}</p>
          </div>
          <div className="admin-card-soft px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/80">
              Ativos
            </p>
            <p className="text-sm font-semibold text-emerald-100">{stats.active}</p>
          </div>
          <div className="admin-card-soft px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-rose-100/80">
              Suspensos
            </p>
            <p className="text-sm font-semibold text-rose-100">{stats.suspended}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-white/60 uppercase tracking-[0.18em]">Filtrar por estado</span>
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={
                  "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] transition-colors " +
                  (isActive
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-white/20 bg-white/5 text-white/60 hover:bg-white/10")
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {accessIssue === "UNAUTH" && (
          <InlineAlert
            tone="warning"
            title="Sessão em falta"
            message="Para aceder ao painel de admin, tens de iniciar sessão com a tua conta de administrador."
          />
        )}

        {accessIssue === "FORBIDDEN" && (
          <InlineAlert
            title="Acesso restrito"
            message="Esta área é exclusiva para contas com permissões de admin. Se achas que isto é um erro, fala com o responsável pela plataforma."
          />
        )}

        {errorMsg && !accessIssue && (
          <InlineAlert title="Não foi possível carregar" message={errorMsg} />
        )}

        {loading && !accessIssue && !errorMsg && (
          <div className="mt-6 space-y-3" aria-hidden="true">
            <div className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
            <div className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
            <div className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
          </div>
        )}

        {!loading && !accessIssue && !errorMsg && !hasOrganizations && (
          <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-black/60 px-6 py-8 text-center space-y-3">
            <p className="text-base font-medium text-white/90">
              Ainda não há organizações registadas
            </p>
            <p className="text-[13px] text-white/65 max-w-md mx-auto">
              Assim que um utilizador fizer pedido para se tornar organização,
              vais conseguir aprovar ou recusar essa conta a partir daqui.
            </p>
          </div>
        )}

        {!loading && !accessIssue && !errorMsg && hasOrganizations && (
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px),minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="admin-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                    Organizações
                  </p>
                  <span className="text-[11px] text-white/50">
                    {filteredOrganizations.length} itens
                  </span>
                </div>
                <div className="space-y-2">
                  {filteredOrganizations.map((org) => {
                    const isSelected = String(org.id) === String(selectedOrgId);
                    return (
                      <button
                        key={String(org.id)}
                        type="button"
                        onClick={() => setSelectedOrgId(org.id)}
                        className={
                          "w-full rounded-xl border px-3 py-2 text-left text-[11px] transition " +
                          (isSelected
                            ? "border-white/30 bg-white/10 text-white"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
                        }
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white/90">
                            {org.publicName}
                          </span>
                          <span
                            className={
                              "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium " +
                              statusBadgeClasses(org.status)
                            }
                          >
                            {formatStatusLabel(org.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-white/50">
                          Dono: <span className="text-white/70">{formatOwner(org.owner)}</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedOrganization ? (
              <div className="space-y-4">
                <div className="admin-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                        Organização selecionada
                      </p>
                      <h2 className="text-xl font-semibold text-white/95">
                        {selectedOrganization.publicName}
                      </h2>
                      <p className="text-[11px] text-white/55">
                        Criada em {formatDate(selectedOrganization.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-[2px] font-medium " +
                          statusBadgeClasses(selectedOrganization.status)
                        }
                      >
                        {formatStatusLabel(selectedOrganization.status)}
                      </span>
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-[2px] font-medium " +
                          paymentsBadgeClasses(selectedOrganization.orgType ?? null)
                        }
                      >
                        {paymentsModeLabel(selectedOrganization.orgType ?? null)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-white/60">
                    <span>ID #{selectedOrganization.id}</span>
                    <span>Dono: {formatOwner(selectedOrganization.owner)}</span>
                    <span>Eventos: {selectedOrganization.eventsCount ?? "—"}</span>
                    <span>Bilhetes: {selectedOrganization.totalTickets ?? "—"}</span>
                    <span>Volume: {formatMoneyCents(selectedOrganization.totalRevenueCents)}</span>
                  </div>
                </div>

                <div className="admin-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                      Última ação
                    </p>
                    {lastAction && (
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium " +
                          (lastAction.status === "OK"
                            ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                            : lastAction.status === "NOOP"
                              ? "border-sky-400/60 bg-sky-500/10 text-sky-100"
                              : "border-rose-400/60 bg-rose-500/10 text-rose-100")
                        }
                      >
                        {lastAction.status}
                      </span>
                    )}
                  </div>
                  {lastAction ? (
                    <div className="space-y-1 text-[11px] text-white/60">
                      <p className="text-white/80">{lastAction.action}</p>
                      <p>Hora: {formatDate(lastAction.at)}</p>
                      {lastAction.code && <p>Código: {lastAction.code}</p>}
                      {lastAction.requestId && <p>Request: {lastAction.requestId}</p>}
                      {lastAction.details && <p>Info: {lastAction.details}</p>}
                    </div>
                  ) : (
                    <p className="text-[11px] text-white/50">
                      Sem ações recentes para esta organização.
                    </p>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="admin-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                        Estado da Organização
                      </p>
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium " +
                          statusBadgeClasses(selectedOrganization.status)
                        }
                      >
                        {formatStatusLabel(selectedOrganization.status)}
                      </span>
                    </div>
                    <div className="space-y-2 text-[11px] text-white/60">
                      <div className="flex items-center justify-between">
                        <span>Kill switch (org)</span>
                        <span className="text-white/40">Disponível em breve</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Reason code</span>
                        <span className="text-white/40">—</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Expira em</span>
                        <span className="text-white/40">—</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {selectedOrganization.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            disabled={updatingId === selectedOrganization.id}
                            onClick={() => updateStatus(selectedOrganization.id, "ACTIVE")}
                            className="admin-button px-3 py-1.5 text-[11px] disabled:opacity-60"
                          >
                            {updatingId === selectedOrganization.id ? "A aprovar…" : "Aprovar"}
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === selectedOrganization.id}
                            onClick={() => updateStatus(selectedOrganization.id, "SUSPENDED")}
                            className="admin-button-secondary px-3 py-1.5 text-[11px] disabled:opacity-60"
                          >
                            {updatingId === selectedOrganization.id ? "A suspender…" : "Suspender"}
                          </button>
                        </>
                      )}
                      {selectedOrganization.status === "ACTIVE" && (
                        <button
                          type="button"
                          disabled={updatingId === selectedOrganization.id}
                          onClick={() => updateStatus(selectedOrganization.id, "SUSPENDED")}
                          className="admin-button-secondary px-3 py-1.5 text-[11px] disabled:opacity-60"
                        >
                          {updatingId === selectedOrganization.id ? "A suspender…" : "Suspender"}
                        </button>
                      )}
                      {selectedOrganization.status === "SUSPENDED" && (
                        <button
                          type="button"
                          disabled={updatingId === selectedOrganization.id}
                          onClick={() => updateStatus(selectedOrganization.id, "ACTIVE")}
                          className="px-3 py-1.5 rounded-full border border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/10 transition-colors disabled:opacity-60"
                        >
                          {updatingId === selectedOrganization.id ? "A reativar…" : "Reativar"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled
                        className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-white/40"
                      >
                        Kill switch (breve)
                      </button>
                    </div>
                    {actionError?.scope === "status" && (
                      <InlineAlert
                        {...getErrorCopy(actionError.code)}
                        code={actionError.code}
                        requestId={actionError.requestId}
                      />
                    )}
                  </div>

                  <div className="admin-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                        Payments / Payouts
                      </p>
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium " +
                          paymentsBadgeClasses(selectedOrganization.orgType ?? null)
                        }
                      >
                        {paymentsModeLabel(selectedOrganization.orgType ?? null)}
                      </span>
                    </div>
                    <div className="space-y-2 text-[11px] text-white/60">
                      <div className="flex items-center justify-between">
                        <span>Status Stripe</span>
                        <span className="text-white/80">
                          {describePaymentsStatus(
                            paymentsDetails[String(selectedOrganization.id)]?.status ??
                              getPaymentsStatus(selectedOrganization),
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Charges enabled</span>
                        <span className="text-white/80">
                          {selectedOrganization.stripeChargesEnabled ? "Sim" : "Não"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Payouts enabled</span>
                        <span className="text-white/80">
                          {selectedOrganization.stripePayoutsEnabled ? "Sim" : "Não"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Conta Stripe</span>
                        <span className="text-white/80">
                          {paymentsDetails[String(selectedOrganization.id)]?.accountId ||
                            selectedOrganization.stripeAccountId ||
                            "—"}
                        </span>
                      </div>
                      {paymentsDetails[String(selectedOrganization.id)]?.requirements?.length ? (
                        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100">
                          Requisitos pendentes:{" "}
                          {paymentsDetails[String(selectedOrganization.id)]?.requirements.join(", ")}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 text-[10px]">
                        <span
                          className={
                            "inline-flex items-center rounded-full border px-2 py-[2px] font-medium " +
                            emailBadgeClasses(
                              (selectedOrganization.officialEmail ?? "").toLowerCase() ===
                                "oryapt@gmail.com" && Boolean(selectedOrganization.officialEmailVerifiedAt),
                            )
                          }
                        >
                          Email plataforma{" "}
                          {(selectedOrganization.officialEmail ?? "").toLowerCase() === "oryapt@gmail.com" &&
                          selectedOrganization.officialEmailVerifiedAt
                            ? "confirmado"
                            : "pendente"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <button
                        type="button"
                        disabled={refreshingPayments}
                        onClick={() => refreshPaymentsStatus(selectedOrganization.id)}
                        className="admin-button px-3 py-1.5 text-[11px] disabled:opacity-60"
                      >
                        {refreshingPayments ? "A atualizar…" : "Atualizar status"}
                      </button>
                      <button
                        type="button"
                        disabled={updatingEmailId === selectedOrganization.id}
                        onClick={() => verifyPlatformEmail(selectedOrganization.id)}
                        className="admin-button-secondary px-3 py-1.5 text-[11px] disabled:opacity-60"
                      >
                        {updatingEmailId === selectedOrganization.id
                          ? "A confirmar…"
                          : "Marcar como plataforma"}
                      </button>
                      <button
                        type="button"
                        disabled
                        className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-white/40"
                      >
                        Bloquear payouts (breve)
                      </button>
                    </div>
                    {actionError?.scope === "payments" && (
                      <InlineAlert
                        {...getErrorCopy(actionError.code)}
                        code={actionError.code}
                        requestId={actionError.requestId}
                      />
                    )}
                  </div>

                  <div className="admin-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                        Compliance
                      </p>
                      <span className="text-[10px] text-white/40">Disponível em breve</span>
                    </div>
                    <div className="space-y-2 text-[11px] text-white/60">
                      <div className="flex items-center justify-between">
                        <span>Legal docs</span>
                        <span className="text-white/40">—</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>DSAR casos</span>
                        <span className="text-white/40">—</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-dashed border-white/15 bg-black/40 px-3 py-2 text-[11px] text-white/50">
                      Este bloco ficará ativo assim que os endpoints de compliance estiverem
                      disponíveis.
                    </div>
                  </div>

                  <div className="admin-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                      Operações
                    </p>
                    <button
                        type="button"
                        onClick={() => loadOpsSummary()}
                        className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/60 hover:bg-white/10"
                      >
                        Atualizar
                      </button>
                  </div>
                  <p className="text-[10px] text-white/40">
                    Ações de ops requerem role ops ou header secreto.
                  </p>
                    {opsSummary.loading ? (
                      <div className="space-y-2">
                        <div className="h-6 rounded-lg bg-white/5 animate-pulse" />
                        <div className="h-6 rounded-lg bg-white/5 animate-pulse" />
                      </div>
                    ) : opsSummary.data ? (
                      <div className="space-y-2 text-[11px] text-white/60">
                        <div className="flex items-center justify-between">
                          <span>Outbox pendente</span>
                          <span className="text-white/80">
                            {opsSummary.data.outbox.pendingCountCapped}/
                            {opsSummary.data.outbox.capLimit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>DLQ (24h)</span>
                          <span className="text-white/80">
                            {opsSummary.data.outbox.deadLetteredLast24h}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Oldest pending</span>
                          <span className="text-white/80">
                            {opsSummary.data.outbox.oldestPendingCreatedAt
                              ? formatDateShort(opsSummary.data.outbox.oldestPendingCreatedAt)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Next attempt</span>
                          <span className="text-white/80">
                            {opsSummary.data.outbox.nextAttemptAtSoonest
                              ? formatDateShort(opsSummary.data.outbox.nextAttemptAtSoonest)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-white/50">Sem dados de operações.</p>
                    )}

                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                        Replay DLQ
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={replayId}
                          onChange={(event) => setReplayId(event.target.value)}
                          placeholder="eventId(s) separados por vírgula"
                          className="flex-1 min-w-[180px] rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] text-white/80 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={replaying}
                          onClick={() => replayOutboxEvent()}
                          className="admin-button px-3 py-1.5 text-[11px] disabled:opacity-60"
                        >
                          {replaying ? "A rearmar…" : "Rearmar"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                        Rollups
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-white/60">
                        <span>Último bucket</span>
                        <span className="text-white/80">
                          {rollup.latestBucketDate ? formatDate(rollup.latestBucketDate) : "—"}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={rollupRunning}
                        onClick={() => triggerRollup(selectedOrganization.id)}
                        className="admin-button-secondary px-3 py-1.5 text-[11px] disabled:opacity-60"
                      >
                        {rollupRunning ? "A gerar rollups…" : "Trigger rollup"}
                      </button>
                    </div>

                    {actionError?.scope === "ops" && (
                      <InlineAlert
                        {...getErrorCopy(actionError.code)}
                        code={actionError.code}
                        requestId={actionError.requestId}
                      />
                    )}
                  </div>
                </div>

                <div className="admin-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                      Auditoria (EventLog)
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        selectedOrganization ? loadEventLog(selectedOrganization.id) : null
                      }
                      className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/60 hover:bg-white/10"
                    >
                      Atualizar
                    </button>
                  </div>
                  {eventLog.loading ? (
                    <div className="space-y-2">
                      <div className="h-6 rounded-lg bg-white/5 animate-pulse" />
                      <div className="h-6 rounded-lg bg-white/5 animate-pulse" />
                      <div className="h-6 rounded-lg bg-white/5 animate-pulse" />
                    </div>
                  ) : eventLog.error ? (
                    <InlineAlert
                      title="Erro ao carregar EventLog"
                      message={getErrorCopy(eventLog.error).message}
                      code={eventLog.error}
                    />
                  ) : eventLog.items.length === 0 ? (
                    <p className="text-[11px] text-white/50">Sem eventos recentes.</p>
                  ) : (
                    <div className="space-y-2 text-[11px]">
                      {eventLog.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-white/90">{item.type}</span>
                            <span className="text-[10px] text-white/50">
                              {formatDateShort(item.createdAt)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/50">
                            <span>actor: {item.actorId ?? "—"}</span>
                            <span>org: {item.orgId}</span>
                            <span>source: {item.sourceEventId ?? "—"}</span>
                            <span>status: {item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="admin-card p-4 text-[11px] text-white/60">
                Seleciona uma organização para abrir o control center.
              </div>
            )}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
