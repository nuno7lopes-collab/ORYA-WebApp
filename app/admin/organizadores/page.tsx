

"use client";

import { useEffect, useMemo, useState } from "react";

type OrganizerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | string;

type AdminOrganizerOwner = {
  id: string;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type AdminOrganizerItem = {
  id: number | string;
  displayName: string;
  status: OrganizerStatus;
  createdAt: string;
  owner?: AdminOrganizerOwner | null;
  eventsCount?: number | null;
  totalTickets?: number | null;
  totalRevenueCents?: number | null;
};

type AdminOrganizersListResponse =
  | {
      ok: true;
      organizers: AdminOrganizerItem[];
    }
  | {
      ok: false;
      error?: string;
      reason?: string;
    };

const STATUS_LABEL: Record<OrganizerStatus, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
};

function formatStatusLabel(status: OrganizerStatus) {
  return STATUS_LABEL[status] ?? status;
}

function statusBadgeClasses(status: OrganizerStatus) {
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

function formatOwner(owner?: AdminOrganizerOwner | null) {
  if (!owner) return "Utilizador ORYA";
  if (owner.username) return `@${owner.username}`;
  if (owner.fullName) return owner.fullName;
  if (owner.email) return owner.email;
  return "Utilizador ORYA";
}

const FILTERS: { id: "ALL" | OrganizerStatus; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "PENDING", label: "Pendentes" },
  { id: "ACTIVE", label: "Ativos" },
  { id: "SUSPENDED", label: "Suspensos" },
];

export default function AdminOrganizadoresPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessIssue, setAccessIssue] = useState<"UNAUTH" | "FORBIDDEN" | null>(
    null,
  );
  const [organizers, setOrganizers] = useState<AdminOrganizerItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | OrganizerStatus>("ALL");
  const [updatingId, setUpdatingId] = useState<number | string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOrganizers() {
      try {
        setLoading(true);
        setErrorMsg(null);
        setAccessIssue(null);

        const res = await fetch("/api/admin/organizadores/list", {
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
          console.error("[admin/organizadores] Erro ao carregar:", text);
          if (!cancelled) {
            setErrorMsg(
              "Não foi possível carregar a lista de organizadores. Tenta novamente em alguns segundos.",
            );
          }
          return;
        }

        const json = (await res.json().catch(() => null)) as
          | AdminOrganizersListResponse
          | null;

        if (!json || !json.ok) {
          if (!cancelled) {
            setErrorMsg(
              json?.error ||
                json?.reason ||
                "Resposta inesperada ao carregar organizadores.",
            );
          }
          return;
        }

        if (!cancelled) {
          setOrganizers(Array.isArray(json.organizers) ? json.organizers : []);
        }
      } catch (err) {
        console.error("[admin/organizadores] Erro inesperado:", err);
        if (!cancelled) {
          setErrorMsg(
            "Ocorreu um erro inesperado. Tenta novamente dentro de instantes.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrganizers();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOrganizers = useMemo(() => {
    if (filter === "ALL") return organizers;
    return organizers.filter((o) => o.status === filter);
  }, [organizers, filter]);

  const stats = useMemo(() => {
    const total = organizers.length;
    const pending = organizers.filter((o) => o.status === "PENDING").length;
    const active = organizers.filter((o) => o.status === "ACTIVE").length;
    const suspended = organizers.filter((o) => o.status === "SUSPENDED").length;

    return { total, pending, active, suspended };
  }, [organizers]);

  async function updateStatus(
    organizerId: number | string,
    newStatus: OrganizerStatus,
  ) {
    try {
      setUpdatingId(organizerId);

      const res = await fetch("/api/admin/organizadores/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizerId, status: newStatus }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        console.error("[admin/organizadores] Erro ao atualizar estado:", data);
        alert("Não foi possível atualizar o estado deste organizador.");
        return;
      }

      setOrganizers((prev) =>
        prev.map((org) =>
          String(org.id) === String(organizerId)
            ? { ...org, status: newStatus }
            : org,
        ),
      );
    } catch (err) {
      console.error("[admin/organizadores] Erro ao atualizar estado:", err);
      alert(
        "Ocorreu um erro inesperado ao atualizar o estado. Tenta novamente dentro de instantes.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const hasOrganizers = filteredOrganizers.length > 0;

  return (
    <main className="orya-body-bg min-h-screen w-full text-white pb-16">
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-extrabold tracking-[0.16em]">
              AD
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                Admin · Organizadores
              </p>
              <p className="text-sm text-white/85">
                Aprova e gere as contas de organizador na ORYA.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-5 pt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Organizadores
            </h1>
            <p className="mt-1 text-sm text-white/70 max-w-xl">
              Vê quem está a organizar eventos na plataforma, aprova novos
              pedidos e suspende contas quando necessário.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 text-[11px]">
            <div className="rounded-xl border border-white/15 bg-black/60 px-3 py-2">
              <p className="text-[10px] text-white/55">Total</p>
              <p className="text-sm font-semibold">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2">
              <p className="text-[10px] text-amber-100/80">Pendentes</p>
              <p className="text-sm font-semibold text-amber-100">
                {stats.pending}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2">
              <p className="text-[10px] text-emerald-100/80">Ativos</p>
              <p className="text-sm font-semibold text-emerald-100">
                {stats.active}
              </p>
            </div>
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2">
              <p className="text-[10px] text-red-100/80">Suspensos</p>
              <p className="text-sm font-semibold text-red-100">
                {stats.suspended}
              </p>
            </div>
          </div>
        </div>

        {/* Filtros de estado */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-white/60">Filtrar por estado:</span>
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={
                  "rounded-full border px-3 py-1 transition-colors " +
                  (isActive
                    ? "border-[#6BFFFF] bg-[#6BFFFF]/10 text-[#6BFFFF]"
                    : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10")
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

        {loading && !accessIssue && !errorMsg && (
          <div className="mt-6 space-y-3" aria-hidden="true">
            <div className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
            <div className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
            <div className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
          </div>
        )}

        {!loading && !accessIssue && !errorMsg && !hasOrganizers && (
          <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-black/60 px-6 py-8 text-center space-y-3">
            <p className="text-base font-medium text-white/90">
              Ainda não há organizadores registados
            </p>
            <p className="text-[13px] text-white/65 max-w-md mx-auto">
              Assim que um utilizador fizer pedido para se tornar organizador,
              vais conseguir aprovar ou recusar essa conta a partir daqui.
            </p>
          </div>
        )}

        {!loading && !accessIssue && !errorMsg && hasOrganizers && (
          <div className="mt-4 space-y-3">
            {filteredOrganizers.map((org) => {
              const isPending = org.status === "PENDING";
              const isActive = org.status === "ACTIVE";
              const isSuspended = org.status === "SUSPENDED";

              return (
                <div
                  key={String(org.id)}
                  className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white/90">
                        {org.displayName}
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
                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={updatingId === org.id}
                          onClick={() => updateStatus(org.id, "ACTIVE")}
                          className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.7)] hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100"
                        >
                          {updatingId === org.id ? "A aprovar…" : "Aprovar"}
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === org.id}
                          onClick={() => updateStatus(org.id, "SUSPENDED")}
                          className="px-3 py-1.5 rounded-full border border-white/25 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-60"
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
                        className="px-3 py-1.5 rounded-full border border-red-400/60 text-red-100 hover:bg-red-500/10 transition-colors disabled:opacity-60"
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
    </main>
  );
}