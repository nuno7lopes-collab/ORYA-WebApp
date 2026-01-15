

"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

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

const STATUS_LABEL: Record<OrganizationStatus, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
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

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatMoneyCents(value?: number | null) {
  if (!value || Number.isNaN(value)) return "0,00 €";
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

const FILTERS: { id: "ALL" | OrganizationStatus; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "PENDING", label: "Pendentes" },
  { id: "ACTIVE", label: "Ativos" },
  { id: "SUSPENDED", label: "Suspensos" },
];

export default function AdminOrganizacoesPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessIssue, setAccessIssue] = useState<"UNAUTH" | "FORBIDDEN" | null>(
    null,
  );
  const [organizations, setOrganizations] = useState<AdminOrganizationItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | OrganizationStatus>("ALL");
  const [updatingId, setUpdatingId] = useState<number | string | null>(null);
  const [updatingPaymentsId, setUpdatingPaymentsId] = useState<number | string | null>(null);
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
          headers: {
            "Content-Type": "application/json",
          },
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

        if (!res.ok) {
          const text = await res.text();
          console.error("[admin/organizacoes] Erro ao carregar:", text);
          if (!cancelled) {
            setErrorMsg(
              "Não foi possível carregar a lista de organizações. Tenta novamente em alguns segundos.",
            );
          }
          return;
        }

        const json = (await res.json().catch(() => null)) as
          | AdminOrganizationsListResponse
          | null;

        if (!json || !json.ok) {
          if (!cancelled) {
            setErrorMsg(
              json?.error ||
                json?.reason ||
                "Resposta inesperada ao carregar organizações.",
            );
          }
          return;
        }

        if (!cancelled) {
          setOrganizations(Array.isArray(json.organizations) ? json.organizations : []);
        }
      } catch (err) {
        console.error("[admin/organizacoes] Erro inesperado:", err);
        if (!cancelled) {
          setErrorMsg(
            "Ocorreu um erro inesperado. Tenta novamente dentro de instantes.",
          );
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

  async function updateStatus(
    organizationId: number | string,
    newStatus: OrganizationStatus,
  ) {
    try {
      setUpdatingId(organizationId);

      const res = await fetch("/api/admin/organizacoes/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId, newStatus }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        console.error("[admin/organizacoes] Erro ao atualizar estado:", data);
        alert("Não foi possível atualizar o estado deste organização.");
        return;
      }

      setOrganizations((prev) =>
        prev.map((org) =>
          String(org.id) === String(organizationId)
            ? { ...org, status: newStatus }
            : org,
        ),
      );
    } catch (err) {
      console.error("[admin/organizacoes] Erro ao atualizar estado:", err);
      alert(
        "Ocorreu um erro inesperado ao atualizar o estado. Tenta novamente dentro de instantes.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function updatePaymentsMode(
    organizationId: number | string,
    mode: "PLATFORM" | "CONNECT",
  ) {
    if (
      mode === "PLATFORM" &&
      !window.confirm(
        "Confirmas associar esta organização à plataforma ORYA? Todos os payouts pendentes serão cancelados.",
      )
    ) {
      return;
    }

    try {
      setUpdatingPaymentsId(organizationId);
      const res = await fetch("/api/admin/organizacoes/update-payments-mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId, paymentsMode: mode }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        console.error("[admin/organizacoes] Erro ao atualizar pagamentos:", data);
        alert("Não foi possível atualizar o modo de pagamentos.");
        return;
      }

      setOrganizations((prev) =>
        prev.map((org) =>
          String(org.id) === String(organizationId)
            ? {
                ...org,
                orgType:
                  data.organization?.orgType ?? (mode === "PLATFORM" ? "PLATFORM" : "EXTERNAL"),
              }
            : org,
        ),
      );
    } catch (err) {
      console.error("[admin/organizacoes] Erro ao atualizar pagamentos:", err);
      alert("Ocorreu um erro inesperado ao atualizar o modo de pagamentos.");
    } finally {
      setUpdatingPaymentsId(null);
    }
  }

  const hasOrganizations = filteredOrganizations.length > 0;

  return (
    <AdminLayout title="Organizações" subtitle="Aprova e gere as contas de organização na ORYA.">
      <section className="space-y-6">
        <AdminPageHeader
          title="Organizações"
          subtitle="Vê quem está a organizar eventos na plataforma, aprova pedidos e suspende contas quando necessário."
          eyebrow="Admin • Organizações"
          actions={
            pendingOrganizations.length > 0 ? (
              <span className="admin-chip">
                {pendingOrganizations.length} pendente(s)
              </span>
            ) : null
          }
        />

        <div className="grid grid-cols-2 gap-2 text-[11px] sm:flex sm:flex-row">
          <div className="admin-card-soft px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Total</p>
            <p className="text-sm font-semibold">{stats.total}</p>
          </div>
          <div className="admin-card-soft px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-100/80">Pendentes</p>
            <p className="text-sm font-semibold text-amber-100">
              {stats.pending}
            </p>
          </div>
          <div className="admin-card-soft px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/80">Ativos</p>
            <p className="text-sm font-semibold text-emerald-100">
              {stats.active}
            </p>
          </div>
          <div className="admin-card-soft px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-rose-100/80">Suspensos</p>
            <p className="text-sm font-semibold text-rose-100">
              {stats.suspended}
            </p>
          </div>
        </div>

        {/* Filtros de estado */}
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

        {/* Estados globais: acesso / erros / loading */}
        {accessIssue === "UNAUTH" && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-50">
            <p className="font-medium">Sessão em falta</p>
            <p className="mt-1 text-amber-100/80">
              Para aceder ao painel de admin, tens de iniciar sessão com a tua
              conta de administrador.
            </p>
          </div>
        )}

        {accessIssue === "FORBIDDEN" && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[11px] text-red-50">
            <p className="font-medium">Acesso restrito</p>
            <p className="mt-1 text-red-100/80">
              Esta área é exclusiva para contas com permissões de admin. Se
              achas que isto é um erro, fala com o responsável pela plataforma.
            </p>
          </div>
        )}

        {errorMsg && !accessIssue && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[11px] text-red-50">
            <p className="font-medium">Não foi possível carregar</p>
            <p className="mt-1 text-red-100/80">{errorMsg}</p>
          </div>
        )}

        {/* Lista rápida de pendentes */}
        {!loading && !accessIssue && !errorMsg && pendingOrganizations.length > 0 && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-50">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-amber-50">Pedidos pendentes</p>
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-100">
                {pendingOrganizations.length} para rever
              </span>
            </div>
            <div className="space-y-2">
              {pendingOrganizations.map((org) => (
                <div
                  key={String(org.id)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/30 bg-black/40 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-white">{org.publicName}</span>
                    <span className="text-amber-100/80">
                      Dono: {formatOwner(org.owner)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={updatingId === org.id}
                      onClick={() => updateStatus(org.id, "ACTIVE")}
                      className="admin-button px-3 py-1 text-[11px] disabled:opacity-60"
                    >
                      {updatingId === org.id ? "A aprovar…" : "Aprovar"}
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === org.id}
                      onClick={() => updateStatus(org.id, "SUSPENDED")}
                      className="admin-button-secondary px-3 py-1 text-[11px] disabled:opacity-60"
                    >
                      {updatingId === org.id ? "A atualizar…" : "Reprovar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
              Ainda não há organizações registados
            </p>
            <p className="text-[13px] text-white/65 max-w-md mx-auto">
              Assim que um utilizador fizer pedido para se tornar organização,
              vais conseguir aprovar ou recusar essa conta a partir daqui.
            </p>
          </div>
        )}

        {!loading && !accessIssue && !errorMsg && hasOrganizations && (
          <div className="mt-4 space-y-3">
            {filteredOrganizations.map((org) => {
              const isPending = org.status === "PENDING";
              const isActive = org.status === "ACTIVE";
              const isSuspended = org.status === "SUSPENDED";
              const isPlatformPayments = org.orgType === "PLATFORM";

              return (
                <div
                  key={String(org.id)}
                  className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2">
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
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium " +
                          paymentsBadgeClasses(org.orgType ?? null)
                        }
                      >
                        {paymentsModeLabel(org.orgType ?? null)}
                      </span>
                    </div>

                    <p className="text-white/65">
                      Dono: <span className="font-medium">{formatOwner(org.owner)}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-white/55">
                      <span>Criado em {formatDate(org.createdAt)}</span>
                      {typeof org.eventsCount === "number" && (
                        <span>{org.eventsCount} evento(s)</span>
                      )}
                      {typeof org.totalTickets === "number" && (
                        <span>{org.totalTickets} bilhete(s) vendidos</span>
                      )}
                      {typeof org.totalRevenueCents === "number" && (
                        <span>
                          Volume: {formatMoneyCents(org.totalRevenueCents)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                    <button
                      type="button"
                      disabled={updatingPaymentsId === org.id}
                      onClick={() =>
                        updatePaymentsMode(org.id, isPlatformPayments ? "CONNECT" : "PLATFORM")
                      }
                      className="admin-button-secondary px-3 py-1.5 text-[11px] disabled:opacity-60"
                    >
                      {updatingPaymentsId === org.id
                        ? "A atualizar…"
                        : isPlatformPayments
                          ? "Voltar a Connect"
                          : "Receber na ORYA"}
                    </button>
                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={updatingId === org.id}
                          onClick={() => updateStatus(org.id, "ACTIVE")}
                          className="admin-button px-3 py-1.5 text-[11px] active:scale-95 disabled:opacity-60"
                        >
                          {updatingId === org.id ? "A aprovar…" : "Aprovar"}
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === org.id}
                          onClick={() => updateStatus(org.id, "SUSPENDED")}
                          className="admin-button-secondary px-3 py-1.5 text-[11px] disabled:opacity-60"
                        >
                          {updatingId === org.id ? "A atualizar…" : "Rejeitar"}
                        </button>
                      </>
                    )}

                    {isActive && (
                      <button
                        type="button"
                        disabled={updatingId === org.id}
                        onClick={() => updateStatus(org.id, "SUSPENDED")}
                        className="admin-button-secondary px-3 py-1.5 text-[11px] disabled:opacity-60"
                      >
                        {updatingId === org.id ? "A suspender…" : "Suspender"}
                      </button>
                    )}

                    {isSuspended && (
                      <button
                        type="button"
                        disabled={updatingId === org.id}
                        onClick={() => updateStatus(org.id, "ACTIVE")}
                        className="px-3 py-1.5 rounded-full border border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/10 transition-colors disabled:opacity-60"
                      >
                        {updatingId === org.id ? "A reativar…" : "Reativar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
