"use client";

import { useEffect, useMemo, useState } from "react";
import OrgHubTopNav from "@/app/org/_internal/core/organizations/OrgHubTopNav";
import { buildOrgHubHref } from "@/lib/organizationIdUtils";
import { cn } from "@/lib/utils";

type OrganizationSummary = {
  id: number;
  name: string;
  username: string | null;
  status: string | null;
};

type ProfessionalSummary = {
  id: number;
  name: string;
  roleTitle: string | null;
  organizationId: number;
  isActive: boolean;
};

type ResourceSummary = {
  id: number;
  label: string;
  capacity: number;
  organizationId: number;
  isActive: boolean;
};

type AgendaItem = {
  organizationId: number;
  organizationName: string;
  title: string;
  startsAt: string | Date;
  endsAt: string | Date;
  status: string;
  kind: "EVENT" | "TOURNAMENT" | "RESERVATION";
};

type Props = {
  group: { id: number; name: string | null; ownerUserId: string };
  organizations: OrganizationSummary[];
  metrics: {
    organizations: number;
    professionals: number;
    resources: number;
    upcomingAgenda: number;
  };
  professionals: ProfessionalSummary[];
  resources: ResourceSummary[];
};

type TabKey = "overview" | "agenda" | "professionals" | "resources";

const TAB_OPTIONS: Array<{ id: TabKey; label: string }> = [
  { id: "overview", label: "Visão geral" },
  { id: "agenda", label: "Agenda" },
  { id: "professionals", label: "Profissionais" },
  { id: "resources", label: "Recursos" },
];

const STATUS_META: Record<string, string> = {
  ACTIVE: "border-emerald-300/45 bg-emerald-300/14 text-emerald-100",
  SUSPENDED: "border-red-300/45 bg-red-300/14 text-red-100",
};

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function formatTimeRange(start: string | Date, end: string | Date) {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "-";
  return `${startDate.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} · ${endDate.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function GroupDashboardClient({ group, organizations, metrics, professionals, resources }: Props) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [orgSelection, setOrgSelection] = useState<number[]>([]);
  const [typeSelection, setTypeSelection] = useState<string[]>(["RESERVATION", "EVENT", "TOURNAMENT"]);
  const [fromDate, setFromDate] = useState(() => new Date());
  const [toDate, setToDate] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const groupDisplayName = group.name?.trim() ? group.name.trim() : `Grupo #${group.id}`;
  const groupDashboardHref = buildOrgHubHref(`/groups/${group.id}`);

  useEffect(() => {
    if (tab !== "agenda") return;
    const controller = new AbortController();
    const loadAgenda = async () => {
      setAgendaLoading(true);
      setAgendaError(null);
      try {
        const orgIds = orgSelection.length ? orgSelection : organizations.map((org) => org.id);
        const params = new URLSearchParams({
          from: new Date(`${toDateInputValue(fromDate)}T00:00:00`).toISOString(),
          to: new Date(`${toDateInputValue(toDate)}T23:59:59`).toISOString(),
          orgIds: orgIds.join(","),
          types: typeSelection.join(","),
        });
        const res = await fetch(`/api/org-hub/groups/${group.id}/dashboard/agenda?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || json?.message || "Não foi possível carregar a agenda.");
        }
        setAgendaItems(Array.isArray(json?.items) ? json.items : []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setAgendaError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setAgendaLoading(false);
      }
    };
    void loadAgenda();
    return () => controller.abort();
  }, [tab, orgSelection, typeSelection, fromDate, toDate, organizations, group.id]);

  const groupedAgenda = useMemo(() => {
    if (!agendaItems.length) return [] as Array<{ dateLabel: string; items: AgendaItem[] }>;
    const grouped: Array<{ dateLabel: string; items: AgendaItem[] }> = [];
    let currentDate = "";
    let currentBucket: AgendaItem[] = [];
    for (const item of agendaItems) {
      const dateLabel = formatDate(item.startsAt);
      if (dateLabel !== currentDate) {
        if (currentBucket.length) {
          grouped.push({ dateLabel: currentDate, items: currentBucket });
        }
        currentDate = dateLabel;
        currentBucket = [];
      }
      currentBucket.push(item);
    }
    if (currentBucket.length) {
      grouped.push({ dateLabel: currentDate, items: currentBucket });
    }
    return grouped;
  }, [agendaItems]);

  const groupedProfessionals = useMemo(() => {
    const map = new Map<number, ProfessionalSummary[]>();
    professionals.forEach((pro) => {
      const list = map.get(pro.organizationId) ?? [];
      list.push(pro);
      map.set(pro.organizationId, list);
    });
    return map;
  }, [professionals]);

  const groupedResources = useMemo(() => {
    const map = new Map<number, ResourceSummary[]>();
    resources.forEach((resource) => {
      const list = map.get(resource.organizationId) ?? [];
      list.push(resource);
      map.set(resource.organizationId, list);
    });
    return map;
  }, [resources]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-white md:px-6 md:py-12 lg:px-8">
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-6">
          <OrgHubTopNav groupDashboardHref={groupDashboardHref} />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/75">Dashboard do grupo</p>
              <h1 className="text-[30px] font-semibold leading-tight">{groupDisplayName}</h1>
              <p className="mt-1 text-sm text-white/75">
                Visão agregada com agenda, profissionais e recursos das organizações do grupo.
              </p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-white/70">
              ID #{group.id}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Organizações</p>
              <p className="mt-1 text-xl font-semibold">{metrics.organizations}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Profissionais</p>
              <p className="mt-1 text-xl font-semibold">{metrics.professionals}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Recursos</p>
              <p className="mt-1 text-xl font-semibold">{metrics.resources}</p>
            </div>
            <div className="rounded-2xl border border-[#6BFFFF]/32 bg-[#6BFFFF]/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#B5F9FF]">Agenda 7 dias</p>
              <p className="mt-1 text-xl font-semibold text-[#DEFDFF]">{metrics.upcomingAgenda}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {TAB_OPTIONS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55",
                    active
                      ? "border-[#6BFFFF]/50 bg-[#6BFFFF]/15 text-[#D8FDFF]"
                      : "border-white/20 bg-white/8 text-white/70 hover:bg-white/12",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        {tab === "overview" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/12 bg-[linear-gradient(160deg,rgba(12,20,36,0.6),rgba(7,11,22,0.7))] p-5">
              <h2 className="text-lg font-semibold">Organizações</h2>
              <p className="mt-1 text-sm text-white/70">
                Estado geral das subsidiárias ativas do grupo.
              </p>
              <div className="mt-4 space-y-2">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{org.name}</p>
                      <p className="text-[12px] text-white/60">{org.username ? `@${org.username}` : "Sem username"}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                        STATUS_META[(org.status ?? "").toUpperCase()] ?? "border-white/20 bg-white/8 text-white/70",
                      )}
                    >
                      {org.status ?? "Sem estado"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/12 bg-[linear-gradient(160deg,rgba(12,20,36,0.6),rgba(7,11,22,0.7))] p-5">
              <h2 className="text-lg font-semibold">Distribuição rápida</h2>
              <p className="mt-1 text-sm text-white/70">Visão rápida de equipas e recursos por organização.</p>
              <div className="mt-4 space-y-2">
                {organizations.map((org) => {
                  const proCount = groupedProfessionals.get(org.id)?.length ?? 0;
                  const resCount = groupedResources.get(org.id)?.length ?? 0;
                  return (
                    <div
                      key={`summary-${org.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{org.name}</p>
                        <p className="text-[12px] text-white/60">Profissionais e recursos ativos</p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
                        <span className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-white/75">
                          Profissionais {proCount}
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-white/75">
                          Recursos {resCount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {tab === "agenda" && (
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/12 bg-[linear-gradient(160deg,rgba(12,20,36,0.6),rgba(7,11,22,0.7))] p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/70">
                  <span>De</span>
                  <input
                    type="date"
                    value={toDateInputValue(fromDate)}
                    onChange={(event) => setFromDate(new Date(`${event.target.value}T00:00:00`))}
                    className="rounded-xl border border-white/20 bg-black/30 px-2.5 py-1.5 text-[12px] text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/70">
                  <span>Até</span>
                  <input
                    type="date"
                    value={toDateInputValue(toDate)}
                    onChange={(event) => setToDate(new Date(`${event.target.value}T23:59:59`))}
                    className="rounded-xl border border-white/20 bg-black/30 px-2.5 py-1.5 text-[12px] text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {organizations.map((org) => {
                  const active = orgSelection.length === 0 || orgSelection.includes(org.id);
                  return (
                    <button
                      key={`org-filter-${org.id}`}
                      type="button"
                      onClick={() =>
                        setOrgSelection((prev) =>
                          prev.length === 0
                            ? [org.id]
                            : prev.includes(org.id)
                              ? prev.filter((id) => id !== org.id)
                              : [...prev, org.id],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                        active
                          ? "border-[#6BFFFF]/50 bg-[#6BFFFF]/15 text-[#D8FDFF]"
                          : "border-white/20 bg-white/8 text-white/70 hover:bg-white/12",
                      )}
                    >
                      {org.name}
                    </button>
                  );
                })}
                {orgSelection.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOrgSelection([])}
                    className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 hover:bg-white/12"
                  >
                    Ver todas
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(["RESERVATION", "EVENT", "TOURNAMENT"] as const).map((type) => {
                  const active = typeSelection.includes(type);
                  return (
                    <button
                      key={`type-${type}`}
                      type="button"
                      onClick={() =>
                        setTypeSelection((prev) =>
                          prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                        active
                          ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-100"
                          : "border-white/20 bg-white/8 text-white/70 hover:bg-white/12",
                      )}
                    >
                      {type === "RESERVATION" ? "Reservas" : type === "EVENT" ? "Eventos" : "Torneios"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/12 bg-[linear-gradient(160deg,rgba(12,20,36,0.6),rgba(7,11,22,0.7))] p-5">
              {agendaLoading && <p className="text-sm text-white/70">A carregar agenda...</p>}
              {agendaError && <p className="text-sm text-red-200">{agendaError}</p>}
              {!agendaLoading && !agendaError && agendaItems.length === 0 && (
                <p className="text-sm text-white/70">Sem items para o intervalo escolhido.</p>
              )}
              {!agendaLoading && !agendaError && agendaItems.length > 0 && (
                <div className="space-y-4">
                  {groupedAgenda.map((bucket) => (
                    <div key={bucket.dateLabel}>
                      <p className="text-[12px] uppercase tracking-[0.22em] text-white/60">{bucket.dateLabel}</p>
                      <div className="mt-2 space-y-2">
                        {bucket.items.map((item, index) => (
                          <div
                            key={`${item.organizationId}-${item.startsAt}-${index}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">{item.title}</p>
                              <p className="text-[12px] text-white/60">{item.organizationName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[12px] text-white/80">{formatTimeRange(item.startsAt, item.endsAt)}</p>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                                {item.kind === "RESERVATION" ? "Reserva" : item.kind === "EVENT" ? "Evento" : "Torneio"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "professionals" && (
          <section className="rounded-3xl border border-white/12 bg-[linear-gradient(160deg,rgba(12,20,36,0.6),rgba(7,11,22,0.7))] p-5">
            <h2 className="text-lg font-semibold">Profissionais</h2>
            <p className="mt-1 text-sm text-white/70">Lista agregada por organização.</p>
            <div className="mt-4 space-y-3">
              {organizations.map((org) => {
                const list = groupedProfessionals.get(org.id) ?? [];
                return (
                  <div key={`pro-${org.id}`} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{org.name}</p>
                      <span className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70">
                        {list.length} profissionais
                      </span>
                    </div>
                    {list.length === 0 ? (
                      <p className="mt-2 text-sm text-white/60">Sem profissionais registados.</p>
                    ) : (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {list.map((pro) => (
                          <div key={pro.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <p className="text-sm text-white">{pro.name}</p>
                            <p className="text-[12px] text-white/60">{pro.roleTitle || "Sem função"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "resources" && (
          <section className="rounded-3xl border border-white/12 bg-[linear-gradient(160deg,rgba(12,20,36,0.6),rgba(7,11,22,0.7))] p-5">
            <h2 className="text-lg font-semibold">Recursos</h2>
            <p className="mt-1 text-sm text-white/70">Campos, salas e recursos com capacidade.</p>
            <div className="mt-4 space-y-3">
              {organizations.map((org) => {
                const list = groupedResources.get(org.id) ?? [];
                return (
                  <div key={`res-${org.id}`} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{org.name}</p>
                      <span className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70">
                        {list.length} recursos
                      </span>
                    </div>
                    {list.length === 0 ? (
                      <p className="mt-2 text-sm text-white/60">Sem recursos registados.</p>
                    ) : (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {list.map((resource) => (
                          <div key={resource.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <p className="text-sm text-white">{resource.label}</p>
                            <p className="text-[12px] text-white/60">Capacidade {resource.capacity}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
