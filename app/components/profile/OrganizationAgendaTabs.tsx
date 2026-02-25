"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AgendaItem = {
  id: number;
  slug: string;
  title: string;
  timeLabel: string;
  locationLabel: string;
  isPast: boolean;
  isGratis: boolean;
  templateType?: string | null;
  coverUrl?: string | null;
};

type AgendaGroup = {
  key: string;
  label: string;
  items: AgendaItem[];
};

type FlatAgendaItem = AgendaItem & {
  groupKey: string;
  groupLabel: string;
};

type AgendaTabKey = "upcoming" | "past";

type OrganizationAgendaTabsProps = {
  upcomingGroups: AgendaGroup[];
  pastGroups: AgendaGroup[];
  spotlightEventId?: number | null;
  initialVisibleUpcoming?: number;
  initialVisiblePast?: number;
  pageSize?: number;
};

const TAB_LABELS: Record<AgendaTabKey, string> = {
  upcoming: "Próximos",
  past: "Histórico",
};

export default function OrganizationAgendaTabs({
  upcomingGroups,
  pastGroups,
  spotlightEventId = null,
  initialVisibleUpcoming = 5,
  initialVisiblePast = 4,
  pageSize = 5,
}: OrganizationAgendaTabsProps) {
  const flattenGroups = (groups: AgendaGroup[]) =>
    groups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        groupKey: group.key,
        groupLabel: group.label,
      })),
    );

  const toVisibleGroups = (items: FlatAgendaItem[]) => {
    const orderedGroups: AgendaGroup[] = [];
    const groupMap = new Map<string, AgendaGroup>();

    for (const item of items) {
      const group = groupMap.get(item.groupKey);
      const nextItem: AgendaItem = {
        id: item.id,
        slug: item.slug,
        title: item.title,
        timeLabel: item.timeLabel,
        locationLabel: item.locationLabel,
        isPast: item.isPast,
        isGratis: item.isGratis,
        templateType: item.templateType ?? null,
        coverUrl: item.coverUrl ?? null,
      };
      if (group) {
        group.items.push(nextItem);
        continue;
      }
      const nextGroup: AgendaGroup = {
        key: item.groupKey,
        label: item.groupLabel,
        items: [nextItem],
      };
      orderedGroups.push(nextGroup);
      groupMap.set(item.groupKey, nextGroup);
    }
    return orderedGroups;
  };

  const upcomingFlat = useMemo(() => {
    const flattened = flattenGroups(upcomingGroups);
    return spotlightEventId ? flattened.filter((item) => item.id !== spotlightEventId) : flattened;
  }, [upcomingGroups, spotlightEventId]);
  const pastFlat = useMemo(() => {
    const flattened = flattenGroups(pastGroups);
    return spotlightEventId ? flattened.filter((item) => item.id !== spotlightEventId) : flattened;
  }, [pastGroups, spotlightEventId]);

  const initialByTab = useMemo(
    () => ({
      upcoming: Math.max(1, initialVisibleUpcoming),
      past: Math.max(1, initialVisiblePast),
    }),
    [initialVisibleUpcoming, initialVisiblePast],
  );

  const defaultTab: AgendaTabKey = upcomingFlat.length > 0 ? "upcoming" : "past";
  const [tab, setTab] = useState<AgendaTabKey>(defaultTab);
  const [visibleByTab, setVisibleByTab] = useState<Record<AgendaTabKey, number>>({
    upcoming: Math.min(upcomingFlat.length, initialByTab.upcoming),
    past: Math.min(pastFlat.length, initialByTab.past),
  });

  const activeGroups = useMemo(() => {
    const activeFlat = tab === "past" ? pastFlat : upcomingFlat;
    const activeLimit = Math.min(visibleByTab[tab] ?? initialByTab[tab], activeFlat.length);
    return toVisibleGroups(activeFlat.slice(0, activeLimit));
  }, [tab, upcomingFlat, pastFlat, visibleByTab, initialByTab]);

  const activeItems = tab === "past" ? pastFlat : upcomingFlat;
  const visibleCount = Math.min(visibleByTab[tab] ?? initialByTab[tab], activeItems.length);
  const remainingCount = Math.max(0, activeItems.length - visibleCount);

  const emptyLabel =
    tab === "past"
      ? "Sem eventos publicados no histórico."
      : "Sem próximos eventos além do destaque.";

  const tabs: Array<{ key: AgendaTabKey; count: number }> = [
    { key: "upcoming", count: upcomingFlat.length },
    { key: "past", count: pastFlat.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tabItem) => {
            const isActive = tabItem.key === tab;
            return (
              <button
                key={tabItem.key}
                type="button"
                onClick={() => setTab(tabItem.key)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  isActive
                    ? "border-white/35 bg-white/20 text-white shadow-[0_8px_20px_rgba(255,255,255,0.14)]"
                    : "border-white/15 bg-black/20 text-white/70 hover:border-white/30 hover:text-white"
                }`}
              >
                {TAB_LABELS[tabItem.key]} <span className="text-[10px] opacity-70">{tabItem.count}</span>
              </button>
            );
          })}
        </div>
        <span className="text-[11px] text-white/60">
          {tab === "upcoming"
            ? `${upcomingFlat.length} próximo${upcomingFlat.length === 1 ? "" : "s"}`
            : `${pastFlat.length} no histórico`}
        </span>
      </div>

      {activeGroups.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/70">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {activeGroups.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{group.label}</p>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const href = item.isPast ? `/eventos/${item.slug}` : `/eventos/${item.slug}?checkout=1#bilhetes`;
                  const isPadel = item.templateType === "PADEL";
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      className="group flex items-center gap-3 rounded-2xl border border-white/12 bg-black/20 p-2.5 transition hover:border-white/30 hover:bg-white/10"
                    >
                      <div className="relative h-[72px] w-[108px] shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[radial-gradient(circle_at_30%_20%,rgba(120,240,255,0.35),transparent_52%),radial-gradient(circle_at_80%_80%,rgba(234,88,255,0.3),transparent_56%),#0b1020]">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-[1.03]"
                          style={item.coverUrl ? { backgroundImage: `url(${item.coverUrl})` } : undefined}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">{item.timeLabel}</p>
                        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                        <p className="truncate text-[12px] text-white/60">{item.locationLabel}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${
                          item.isPast
                            ? "border-white/15 bg-white/8 text-white/70"
                            : "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                        }`}
                      >
                        {item.isPast
                          ? "Ver resumo"
                          : isPadel
                            ? "Inscrever agora"
                            : item.isGratis
                              ? "Garantir lugar"
                              : "Comprar bilhete"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeItems.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-2">
          {visibleCount > initialByTab[tab] ? (
            <button
              type="button"
              onClick={() =>
                setVisibleByTab((prev) => ({
                  ...prev,
                  [tab]: Math.min(activeItems.length, initialByTab[tab]),
                }))
              }
              className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] text-white/75 transition hover:border-white/35 hover:text-white"
            >
              Mostrar menos
            </button>
          ) : null}
          {remainingCount > 0 ? (
            <button
              type="button"
              onClick={() =>
                setVisibleByTab((prev) => ({
                  ...prev,
                  [tab]: Math.min(activeItems.length, (prev[tab] ?? initialByTab[tab]) + Math.max(1, pageSize)),
                }))
              }
              className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-[11px] text-white/85 transition hover:border-white/35 hover:bg-white/14 hover:text-white"
            >
              Ver mais {Math.min(remainingCount, Math.max(1, pageSize))}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
