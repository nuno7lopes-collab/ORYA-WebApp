"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { CTA_PRIMARY } from "@/app/org/_internal/core/dashboardUi";
import { cn } from "@/lib/utils";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import OrgHubTopNav from "@/app/org/_internal/core/organizations/OrgHubTopNav";

const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type OrgItem = {
  organizationId: number;
  groupId: number;
  role: string;
  lastUsedAt: string | null;
  organization: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    entityType: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
  };
  group?: {
    id: number;
    name: string | null;
    ownerUserId: string | null;
    viewerIsGroupOwner: boolean;
    organizationCount: number;
    pendingJoinCount: number;
    pendingExitCount: number;
    actionableCount: number;
  };
};

type GroupBucket = {
  id: number;
  name: string | null;
  ownerUserId: string | null;
  viewerIsGroupOwner: boolean;
  organizationCount: number;
  pendingJoinCount: number;
  pendingExitCount: number;
  actionableCount: number;
  organizations: OrgItem[];
};

type Props = {
  initialOrgs: OrgItem[];
  activeId: number | null;
};

const ROLE_META: Record<string, { label: string; badge: string }> = {
  OWNER: {
    label: "Owner",
    badge: "border-cyan-300/60 bg-cyan-300/15 text-cyan-50",
  },
  CO_OWNER: {
    label: "Co-owner",
    badge: "border-sky-300/60 bg-sky-300/15 text-sky-50",
  },
  ADMIN: {
    label: "Admin",
    badge: "border-indigo-300/60 bg-indigo-300/15 text-indigo-50",
  },
  STAFF: {
    label: "Staff",
    badge: "border-violet-300/55 bg-violet-300/15 text-violet-50",
  },
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  ACTIVE: {
    label: "Ativa",
    badge: "border-emerald-400/50 bg-emerald-400/16 text-emerald-50",
  },
  SUSPENDED: {
    label: "Suspensa",
    badge: "border-red-400/55 bg-red-400/16 text-red-50",
  },
  PENDING: {
    label: "Pendente",
    badge: "border-amber-400/55 bg-amber-400/16 text-amber-50",
  },
};

function getRoleMeta(rawRole: string) {
  const normalized = rawRole.toUpperCase();
  return ROLE_META[normalized] ?? {
    label: normalized,
    badge: "border-white/22 bg-white/10 text-white/75",
  };
}

function getStatusMeta(rawStatus: string | null) {
  const normalized = (rawStatus ?? "").toUpperCase();
  return STATUS_META[normalized] ?? {
    label: normalized || "Sem estado",
    badge: "border-white/22 bg-white/10 text-white/75",
  };
}

function getOrganizationDisplayName(item: OrgItem) {
  return item.organization.publicName || item.organization.businessName || "Organização";
}

export default function OrganizationsHubClient({ initialOrgs, activeId }: Props) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgItem[]>(initialOrgs);
  const [currentActive, setCurrentActive] = useState<number | null>(activeId);
  const [loadingSwitch, setLoadingSwitch] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const sortedOrgs = useMemo(() => {
    return [...orgs].sort((a, b) => {
      const aIsActive = a.organizationId === currentActive ? 1 : 0;
      const bIsActive = b.organizationId === currentActive ? 1 : 0;
      if (aIsActive !== bIsActive) return bIsActive - aIsActive;
      return getOrganizationDisplayName(a).localeCompare(getOrganizationDisplayName(b), "pt");
    });
  }, [orgs, currentActive]);

  const groupBuckets = useMemo<GroupBucket[]>(() => {
    const grouped = new Map<number, GroupBucket>();

    for (const item of sortedOrgs) {
      const groupId = item.group?.id ?? item.groupId;
      const current = grouped.get(groupId);
      if (current) {
        current.organizations.push(item);
        continue;
      }

      grouped.set(groupId, {
        id: groupId,
        name: item.group?.name ?? null,
        ownerUserId: item.group?.ownerUserId ?? null,
        viewerIsGroupOwner: Boolean(item.group?.viewerIsGroupOwner),
        organizationCount: item.group?.organizationCount ?? 1,
        pendingJoinCount: item.group?.pendingJoinCount ?? 0,
        pendingExitCount: item.group?.pendingExitCount ?? 0,
        actionableCount: item.group?.actionableCount ?? 0,
        organizations: [item],
      });
    }

    return Array.from(grouped.values())
      .map((bucket) => ({
        ...bucket,
        organizations: [...bucket.organizations].sort((a, b) =>
          getOrganizationDisplayName(a).localeCompare(getOrganizationDisplayName(b), "pt"),
        ),
      }))
      .sort((a, b) => {
        const aHasActive = a.organizations.some((item) => item.organizationId === currentActive) ? 1 : 0;
        const bHasActive = b.organizations.some((item) => item.organizationId === currentActive) ? 1 : 0;
        if (aHasActive !== bHasActive) return bHasActive - aHasActive;
        return a.id - b.id;
      });
  }, [sortedOrgs, currentActive]);

  const summary = useMemo(() => {
    const pendingJoin = groupBuckets.reduce((sum, bucket) => sum + bucket.pendingJoinCount, 0);
    const pendingExit = groupBuckets.reduce((sum, bucket) => sum + bucket.pendingExitCount, 0);
    const actionable = groupBuckets.reduce((sum, bucket) => sum + bucket.actionableCount, 0);

    return {
      organizations: sortedOrgs.length,
      groups: groupBuckets.length,
      pendingJoin,
      pendingExit,
      actionable,
    };
  }, [sortedOrgs.length, groupBuckets]);

  const preferredGroupHref = useMemo(() => {
    if (groupBuckets.length !== 1) return null;
    return buildOrgHubHref(`/groups/${groupBuckets[0].id}`);
  }, [groupBuckets]);

  const handleSwitch = async (organizationId: number, redirectToDashboard = false) => {
    if (loadingSwitch) return;
    setLoadingSwitch(true);
    setActionMessage(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org-hub/organizations/switch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setActionMessage(json?.error || "Não foi possível mudar de organização.");
        return;
      }

      setCurrentActive(organizationId);
      setOrgs((prev) =>
        prev.map((item) =>
          item.organizationId === organizationId ? { ...item, lastUsedAt: new Date().toISOString() } : item,
        ),
      );

      if (redirectToDashboard) {
        const targetHref = buildOrgHref(organizationId, "/overview");
        try {
          const secureSuffix = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `orya_organization=${organizationId}; path=/; Max-Age=${ORG_COOKIE_MAX_AGE}; SameSite=Lax${secureSuffix}`;
        } catch (err) {
          console.warn("[org switch] não foi possível escrever cookie no browser", err);
        }
        router.replace(targetHref);
        setTimeout(() => {
          const expectedPrefix = `/org/${organizationId}/`;
          if (window?.location?.pathname?.startsWith(expectedPrefix) === false) {
            window.location.href = targetHref;
          }
        }, 50);
      } else {
        setActionMessage("Organização ativa atualizada.");
      }
    } catch (err) {
      console.error("[org hub] switch error", err);
      setActionMessage("Erro inesperado ao mudar de organização.");
    } finally {
      setLoadingSwitch(false);
    }
  };

  const renderOrgCard = (item: OrgItem) => {
    const isActive = currentActive === item.organizationId;
    const roleMeta = getRoleMeta(item.role);
    const statusMeta = getStatusMeta(item.organization.status);
    const typeLine = item.organization.entityType || "Tipo não definido";
    const handle = item.organization.username ? `@${item.organization.username}` : "Sem username";
    const groupLabel = item.group?.name ?? `Grupo #${item.groupId}`;
    const groupHref = buildOrgHubHref(`/groups/${item.groupId}`);

    const handleCardClick = () => {
      if (isActive) {
        router.push(buildOrgHref(item.organizationId, "/overview"));
        return;
      }
      void handleSwitch(item.organizationId, true);
    };

    return (
      <article
        key={item.organizationId}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleCardClick();
          }
        }}
        className={`group flex min-h-[214px] cursor-pointer flex-col justify-between rounded-3xl border p-5 shadow-[0_16px_52px_rgba(0,0,0,0.42)] transition hover:-translate-y-[2px] hover:border-[#6BFFFF]/45 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/65 ${
          isActive
            ? "border-[#6BFFFF]/60 bg-[linear-gradient(160deg,rgba(23,52,88,0.45),rgba(8,16,34,0.65))]"
            : "border-white/14 bg-[linear-gradient(160deg,rgba(12,20,36,0.52),rgba(7,11,21,0.45))]"
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                src={item.organization.brandingAvatarUrl ?? null}
                name={getOrganizationDisplayName(item)}
                className="h-12 w-12 border border-white/20"
                textClassName="text-sm font-semibold uppercase tracking-[0.16em] text-white/85"
                fallbackText="OR"
              />
              <div>
                <h3 className="text-lg font-semibold text-white">{getOrganizationDisplayName(item)}</h3>
                <p className="text-[12px] text-white/68">
                  {handle} · {typeLine}
                </p>
              </div>
            </div>
            {isActive && (
              <span className="rounded-full border border-[#6BFFFF]/65 bg-[#6BFFFF]/16 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#CCFCFF]">
                Ativa
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
            <span className={`rounded-full border px-2.5 py-1 ${statusMeta.badge}`}>{statusMeta.label}</span>
            <span className={`rounded-full border px-2.5 py-1 ${roleMeta.badge}`}>{roleMeta.label}</span>
            <span className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-white/78">
              Org #{item.organizationId}
            </span>
            <span className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-white/70">
              {groupLabel}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-white/60">{isActive ? "Organização ativa" : "Selecionar para entrar"}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCardClick();
              }}
              disabled={loadingSwitch}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55 disabled:opacity-60"
            >
              {isActive ? "Entrar" : "Ativar e entrar"}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                router.push(groupHref);
              }}
              className="rounded-full border border-white/20 bg-white/8 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55"
            >
              Abrir grupo
            </button>
          </div>
        </div>
      </article>
    );
  };

  const emptyState = sortedOrgs.length === 0;

  return (
    <div
      aria-busy={loadingSwitch}
      className={cn("mx-auto w-full max-w-6xl px-4 py-10 text-white md:px-6 md:py-12 lg:px-8")}
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-6">
          <OrgHubTopNav groupDashboardHref={preferredGroupHref} />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/75">Organizações</p>
              <h1 className="text-[30px] font-semibold leading-tight">As tuas organizações</h1>
              <p className="mt-1 text-sm text-white/75">
                Estruturadas por grupo-mãe para gerir subsidiárias, entradas, saídas e crescimento sem fricção.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(buildOrgHubHref("/groups"))}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55"
            >
              Gestão de grupos
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Orgs</p>
              <p className="mt-1 text-xl font-semibold">{summary.organizations}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Grupos</p>
              <p className="mt-1 text-xl font-semibold">{summary.groups}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Join pendente</p>
              <p className="mt-1 text-xl font-semibold">{summary.pendingJoin}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Exit pendente</p>
              <p className="mt-1 text-xl font-semibold">{summary.pendingExit}</p>
            </div>
            <div className="rounded-2xl border border-[#6BFFFF]/32 bg-[#6BFFFF]/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#B5F9FF]">Ação tua</p>
              <p className="mt-1 text-xl font-semibold text-[#DEFDFF]">{summary.actionable}</p>
            </div>
          </div>
        </section>

        {actionMessage && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-emerald-300/45 bg-emerald-400/15 px-4 py-2 text-sm text-emerald-50"
          >
            {actionMessage}
          </div>
        )}

        {!emptyState && (
          <section className="space-y-4">
            {groupBuckets.map((group) => {
              const openRequests = group.pendingJoinCount + group.pendingExitCount;
              const createInGroupHref = `${buildOrgHubHref("/create")}?groupMode=EXISTING_GROUP&groupId=${group.id}`;
              const groupLabel = group.name ?? `Grupo #${group.id}`;
              const groupDashboardHref = buildOrgHubHref(`/groups/${group.id}`);

              return (
                <article
                  key={`group-${group.id}`}
                  className="rounded-3xl border border-white/15 bg-[linear-gradient(145deg,rgba(12,21,38,0.74),rgba(6,11,24,0.84))] p-4 shadow-[0_18px_66px_rgba(0,0,0,0.47)] sm:p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/58">Grupo mãe</p>
                      <h2 className="text-xl font-semibold text-white">{groupLabel}</h2>
                      <p className="text-[11px] text-white/55">ID #{group.id}</p>
                      <p className="text-[12px] text-white/70">
                        {group.organizationCount} subsidiária{group.organizationCount === 1 ? "" : "s"}
                        {openRequests > 0 ? ` · ${openRequests} operação(ões) pendente(s)` : " · Sem operações pendentes"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em]">
                      {group.viewerIsGroupOwner ? (
                        <span className="rounded-full border border-[#6BFFFF]/55 bg-[#6BFFFF]/14 px-2.5 py-1 text-[#CCFCFF]">
                          Gestão tua
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-white/70">
                          Gestão externa
                        </span>
                      )}
                      {group.actionableCount > 0 && (
                        <span className="rounded-full border border-amber-300/55 bg-amber-300/14 px-2.5 py-1 text-amber-100">
                          {group.actionableCount} requer ação
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => router.push(createInGroupHref)}
                        disabled={!group.viewerIsGroupOwner}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Nova org neste grupo
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(groupDashboardHref)}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55"
                      >
                        Dashboard do grupo
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(buildOrgHubHref("/groups"))}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55"
                      >
	                        Governança
	                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{group.organizations.map(renderOrgCard)}</div>
                </article>
              );
            })}

            <button
              type="button"
              onClick={() => router.push(buildOrgHubHref("/create"))}
              className="flex min-h-[190px] w-full flex-col justify-between rounded-3xl border border-dashed border-white/24 bg-white/6 p-5 text-left shadow-[0_16px_50px_rgba(0,0,0,0.35)] transition hover:-translate-y-[2px] hover:border-[#6BFFFF]/45 hover:bg-white/10"
            >
              <div className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl font-bold">
                  +
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Nova organização</h3>
                  <p className="text-sm text-white/68">
                    Cria em novo grupo (default) ou adiciona a um grupo que já geres.
                  </p>
                </div>
              </div>
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#BFFBFF]">
                Iniciar onboarding
              </span>
            </button>
          </section>
        )}

        {emptyState && (
          <section className="space-y-4 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Ainda não tens nenhuma organização</h2>
              <p className="text-sm text-white/70">
                Cria a primeira organização para começar a gerir equipa, grupos e operações.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                <li>Cria o teu clube, marca ou espaço.</li>
                <li>Define se queres um novo grupo ou anexar a um grupo existente.</li>
                <li>Ativa módulos e entra no dashboard.</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => router.push(buildOrgHubHref("/create"))}
              className={`${CTA_PRIMARY} px-5 py-2 text-sm`}
            >
              Criar primeira organização
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
