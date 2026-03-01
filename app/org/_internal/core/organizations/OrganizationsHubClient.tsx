"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { CTA_PRIMARY } from "@/app/org/_internal/core/dashboardUi";
import { cn } from "@/lib/utils";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import { resolveGroupDisplayName } from "@/lib/orgHub/groupDisplayName";
import OrgHubTopNav from "@/app/org/_internal/core/organizations/OrgHubTopNav";

const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ORG_SWITCH_TIMEOUT_MS = 8_000;

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

const ROLE_META: Record<string, string> = {
  OWNER: "Owner",
  CO_OWNER: "Co-owner",
  ADMIN: "Admin",
  STAFF: "Staff",
};

const STATUS_META: Record<string, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  PENDING: "Pendente",
};

function getRoleMeta(rawRole: string) {
  const normalized = rawRole.toUpperCase();
  return ROLE_META[normalized] ?? normalized;
}

function getStatusMeta(rawStatus: string | null) {
  const normalized = (rawStatus ?? "").toUpperCase();
  const mapped = STATUS_META[normalized];
  if (mapped) return mapped;
  return normalized || "Sem estado";
}

function getOrganizationDisplayName(item: OrgItem) {
  return item.organization.publicName || item.organization.businessName || "Clube";
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
    const pending = groupBuckets.reduce((sum, bucket) => sum + bucket.pendingJoinCount + bucket.pendingExitCount, 0);
    const actionable = groupBuckets.reduce((sum, bucket) => sum + bucket.actionableCount, 0);

    return {
      organizations: sortedOrgs.length,
      groups: groupBuckets.length,
      pending,
      actionable,
    };
  }, [sortedOrgs.length, groupBuckets]);

  const handleSwitch = async (organizationId: number) => {
    if (loadingSwitch) return;
    setLoadingSwitch(true);
    setActionMessage(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ORG_SWITCH_TIMEOUT_MS);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org-hub/organizations/switch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setActionMessage(json?.error || "Não foi possível mudar de clube.");
        return;
      }

      setCurrentActive(organizationId);
      setOrgs((prev) =>
        prev.map((item) =>
          item.organizationId === organizationId ? { ...item, lastUsedAt: new Date().toISOString() } : item,
        ),
      );

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
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setActionMessage("A troca de clube expirou. Tenta novamente.");
        return;
      }
      console.error("[org hub] switch error", err);
      setActionMessage("Erro inesperado ao mudar de clube.");
    } finally {
      window.clearTimeout(timeoutId);
      setLoadingSwitch(false);
    }
  };

  const renderOrgCard = (item: OrgItem) => {
    const isActive = currentActive === item.organizationId;
    const roleLabel = getRoleMeta(item.role);
    const statusLabel = getStatusMeta(item.organization.status);
    const typeLine = item.organization.entityType || "Tipo não definido";
    const handle = item.organization.username ? `@${item.organization.username}` : "Sem username";

    return (
      <article
        key={item.organizationId}
        className={cn(
          "flex min-h-[198px] flex-col justify-between rounded-3xl border p-5 shadow-[0_16px_52px_rgba(0,0,0,0.42)] transition",
          isActive
            ? "border-[#22D3EE]/55 bg-[linear-gradient(160deg,rgba(23,52,88,0.45),rgba(8,16,34,0.65))]"
            : "border-white/14 bg-[linear-gradient(160deg,rgba(12,20,36,0.52),rgba(7,11,21,0.45))] hover:border-white/22 hover:bg-white/[0.09]",
        )}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                src={item.organization.brandingAvatarUrl ?? null}
                name={getOrganizationDisplayName(item)}
                className="h-11 w-11 border border-white/20"
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
              <span className="rounded-full border border-[#22D3EE]/65 bg-[#22D3EE]/16 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#CCFCFF]">
                Ativa
              </span>
            )}
          </div>

          <p className="text-[12px] text-white/66">{`Estado: ${statusLabel} · Papel: ${roleLabel}`}</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-white/60">{isActive ? "Clube ativo" : "Pronto para entrar"}</p>
          <button
            type="button"
            onClick={() => {
              if (isActive) {
                router.push(buildOrgHref(item.organizationId, "/overview"));
                return;
              }
              void handleSwitch(item.organizationId);
            }}
            disabled={loadingSwitch}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-60"
          >
            Entrar
          </button>
        </div>
      </article>
    );
  };

  const emptyState = sortedOrgs.length === 0;

  return (
    <div
      aria-busy={loadingSwitch}
      className={cn("mx-auto w-full max-w-[1240px] px-4 py-10 text-white sm:px-6 md:py-12 lg:px-8")}
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-6">
          <OrgHubTopNav />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[30px] font-semibold leading-tight">Clubes</h1>
              <p className="mt-1 text-sm text-white/75">
                Entra rapidamente no clube certo e começa a operação diária.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(buildOrgHubHref("/groups"))}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
            >
              Ver grupos
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Clubes</p>
              <p className="mt-1 text-xl font-semibold">{summary.organizations}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Grupos</p>
              <p className="mt-1 text-xl font-semibold">{summary.groups}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Operações pendentes</p>
              <p className="mt-1 text-xl font-semibold">{summary.pending}</p>
            </div>
            <div className="rounded-2xl border border-[#22D3EE]/32 bg-[#22D3EE]/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#B5F9FF]">Ações tuas</p>
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
              const pendingOperations = group.pendingJoinCount + group.pendingExitCount;
              const groupLabel = resolveGroupDisplayName(group.name, group.id);

              return (
                <article
                  key={`group-${group.id}`}
                  className="rounded-3xl border border-white/15 bg-[linear-gradient(145deg,rgba(12,21,38,0.74),rgba(6,11,24,0.84))] p-4 shadow-[0_18px_66px_rgba(0,0,0,0.47)] sm:p-5"
                >
                  <div className="mb-4 space-y-1">
                    <h2 className="text-xl font-semibold text-white">{groupLabel}</h2>
                    <p className="text-[11px] text-white/55">ID #{group.id}</p>
                    <p className="text-[12px] text-white/70">
                      {group.organizationCount} clube(s)
                      {pendingOperations > 0
                        ? ` · ${pendingOperations} operação(ões) pendente(s)`
                        : " · sem operações pendentes"}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{group.organizations.map(renderOrgCard)}</div>
                </article>
              );
            })}

            <button
              type="button"
              onClick={() => router.push(buildOrgHubHref("/create"))}
              className="flex min-h-[190px] w-full flex-col justify-between rounded-3xl border border-dashed border-white/24 bg-white/6 p-5 text-left shadow-[0_16px_50px_rgba(0,0,0,0.35)] transition hover:-translate-y-[2px] hover:border-[#22D3EE]/45 hover:bg-white/10"
            >
              <div className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl font-bold">
                  +
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Novo clube</h3>
                  <p className="text-sm text-white/68">Cria um novo clube e entra diretamente no dashboard.</p>
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
              <h2 className="text-2xl font-semibold">Ainda não tens nenhum clube</h2>
              <p className="text-sm text-white/70">Cria o teu primeiro clube para começar.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(buildOrgHubHref("/create"))}
              className={`${CTA_PRIMARY} px-5 py-2 text-sm`}
            >
              Criar primeiro clube
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
