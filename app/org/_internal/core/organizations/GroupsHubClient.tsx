"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildOrgHubHref } from "@/lib/organizationIdUtils";
import type { OrgHubGroupPayload } from "@/lib/orgHub/listGroupsForUser";
import { resolveGroupDisplayName } from "@/lib/orgHub/groupDisplayName";
import { cn } from "@/lib/utils";
import OrgHubTopNav from "@/app/org/_internal/core/organizations/OrgHubTopNav";

type Props = {
  initialGroups: OrgHubGroupPayload[];
};

type ViewFilter = "all" | "owned" | "actionable";

const FILTER_OPTIONS: Array<{ id: ViewFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "owned", label: "Geridos por mim" },
  { id: "actionable", label: "Com ação" },
];

export default function GroupsHubClient({ initialGroups }: Props) {
  const router = useRouter();
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");

  const visibleGroups = useMemo(() => {
    if (viewFilter === "owned") {
      return initialGroups.filter((group) => group.viewerIsGroupOwner);
    }
    if (viewFilter === "actionable") {
      return initialGroups.filter(
        (group) => group.actionableRequestCount > 0 || group.pendingTransfers.some((transfer) => transfer.isActionable),
      );
    }
    return initialGroups;
  }, [initialGroups, viewFilter]);

  const summary = useMemo(() => {
    const groups = initialGroups.length;
    const ownedGroups = initialGroups.filter((group) => group.viewerIsGroupOwner).length;
    const openRequests = initialGroups.reduce((sum, group) => sum + group.openRequests.length, 0);
    const actionable = initialGroups.reduce(
      (sum, group) => sum + group.actionableRequestCount + group.pendingTransfers.filter((item) => item.isActionable).length,
      0,
    );

    return {
      groups,
      ownedGroups,
      openRequests,
      actionable,
    };
  }, [initialGroups]);

  if (initialGroups.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 py-12 text-white sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <OrgHubTopNav />
          <h1 className="mt-4 text-2xl font-semibold">Grupos</h1>
          <p className="mt-2 text-sm text-white/70">
            Ainda não tens grupos ativos para gerir. Cria ou entra numa organização para começar.
          </p>
          <button
            type="button"
            onClick={() => router.push(buildOrgHubHref("/organizations"))}
            className="mt-4 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
          >
            Ir para organizações
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-10 text-white sm:px-6 md:py-12 lg:px-8">
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-6">
          <OrgHubTopNav />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-semibold leading-tight">Grupos</h1>
              <p className="mt-1 text-sm text-white/75">Diretório de grupos com acesso rápido ao dashboard e à governança.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(buildOrgHubHref("/organizations"))}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
            >
              Ver organizações
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Grupos</p>
              <p className="mt-1 text-xl font-semibold">{summary.groups}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Geridos por mim</p>
              <p className="mt-1 text-xl font-semibold">{summary.ownedGroups}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Pedidos abertos</p>
              <p className="mt-1 text-xl font-semibold">{summary.openRequests}</p>
            </div>
            <div className="rounded-2xl border border-[#22D3EE]/32 bg-[#22D3EE]/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#B5F9FF]">Ações pendentes</p>
              <p className="mt-1 text-xl font-semibold text-[#DEFDFF]">{summary.actionable}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => {
              const active = viewFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setViewFilter(option.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55",
                    active
                      ? "border-[#22D3EE]/50 bg-[#22D3EE]/15 text-[#D8FDFF]"
                      : "border-white/20 bg-white/8 text-white/70 hover:bg-white/12",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        {visibleGroups.length === 0 && (
          <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 text-sm text-white/75 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <p>Não existem grupos para este filtro.</p>
            <button
              type="button"
              onClick={() => setViewFilter("all")}
              className="mt-4 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
            >
              Ver todos
            </button>
          </section>
        )}

        {visibleGroups.length > 0 && (
          <section className="grid gap-4 lg:grid-cols-2">
            {visibleGroups.map((group) => {
              const groupLabel = resolveGroupDisplayName(group.groupName, group.groupId);
              const organizationsPreview = group.organizations.slice(0, 4);
              const pendingOperations = group.openRequests.length + group.pendingTransfers.length;

              return (
                <article
                  key={`group-${group.groupId}`}
                  className="rounded-3xl border border-white/14 bg-[linear-gradient(145deg,rgba(12,21,38,0.74),rgba(6,11,24,0.84))] p-5 shadow-[0_18px_66px_rgba(0,0,0,0.47)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold text-white">{groupLabel}</h2>
                      <p className="text-[12px] text-white/70">
                        {group.organizationCount} organização(ões) · {pendingOperations} operação(ões) pendente(s)
                      </p>
                      <p className="text-[12px] text-white/58">
                        {group.viewerIsGroupOwner ? "Papel: owner do grupo" : "Papel: governança"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/6 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Organizações visíveis</p>
                    <p className="mt-2 text-sm text-white/75">
                      {organizationsPreview.length === 0
                        ? "Sem organizações visíveis."
                        : organizationsPreview.map((organization) => organization.name).join(", ")}
                      {group.organizations.length > organizationsPreview.length
                        ? ` +${group.organizations.length - organizationsPreview.length}`
                        : ""}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={buildOrgHubHref(`/groups/${group.groupId}`)}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={buildOrgHubHref(`/groups/${group.groupId}/governance`)}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
                    >
                      Governança
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
