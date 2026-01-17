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
  isFree: boolean;
  templateType?: string | null;
};

type AgendaGroup = {
  key: string;
  label: string;
  items: AgendaItem[];
};

type AgendaTabKey = "upcoming" | "past" | "all";

type OrganizationAgendaTabsProps = {
  upcomingGroups: AgendaGroup[];
  pastGroups: AgendaGroup[];
  allGroups: AgendaGroup[];
  upcomingCount: number;
  pastCount: number;
  totalCount: number;
  prelude?: React.ReactNode;
  title?: string;
  anchorId?: string;
  layout?: "stack" | "grid";
};

const TAB_LABELS: Record<AgendaTabKey, string> = {
  upcoming: "Próximos",
  past: "Passados",
  all: "Todos",
};

export default function OrganizationAgendaTabs({
  upcomingGroups,
  pastGroups,
  allGroups,
  upcomingCount,
  pastCount,
  totalCount,
  prelude,
  title,
  anchorId,
  layout = "stack",
}: OrganizationAgendaTabsProps) {
  const defaultTab: AgendaTabKey =
    upcomingCount > 0 ? "upcoming" : pastCount > 0 ? "past" : "all";
  const [tab, setTab] = useState<AgendaTabKey>(defaultTab);

  const activeGroups = useMemo(() => {
    if (tab === "past") return pastGroups;
    if (tab === "all") return allGroups;
    return upcomingGroups;
  }, [tab, upcomingGroups, pastGroups, allGroups]);

  const emptyLabel =
    tab === "past"
      ? "Sem eventos passados publicados."
      : tab === "all"
        ? "Sem eventos para mostrar."
        : upcomingCount > 0
          ? "Sem mais eventos além do destaque."
          : "Agenda em preparação. Os próximos eventos aparecem aqui.";

  const tabs: Array<{ key: AgendaTabKey; count: number }> = [
    { key: "upcoming", count: upcomingCount },
    { key: "past", count: pastCount },
    { key: "all", count: totalCount },
  ];

  const header = (
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
                  ? "border-white/40 bg-white/20 text-white"
                  : "border-white/15 bg-white/5 text-white/65 hover:border-white/30 hover:text-white"
              }`}
            >
              {TAB_LABELS[tabItem.key]}{" "}
              <span className="text-[10px] opacity-70">{tabItem.count}</span>
            </button>
          );
        })}
      </div>
      <span className="text-[11px] text-white/60">{totalCount} no total</span>
    </div>
  );

  const body = (
    <div className="space-y-4">
      {prelude}

      {activeGroups.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/70">
          {emptyLabel}
        </div>
      ) : (
        activeGroups.map((group) => (
          <div key={group.key} className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
              {group.label}
            </p>
            <div className="space-y-2">
              {group.items.map((item) => {
                const href = item.isPast
                  ? `/eventos/${item.slug}`
                  : `/eventos/${item.slug}?checkout=1#bilhetes`;
                const isPadel = item.templateType === "PADEL";
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/10"
                  >
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">
                        {item.timeLabel}
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {item.locationLabel}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        item.isPast
                          ? "border-white/15 bg-white/5 text-white/60"
                          : "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                      }`}
                    >
                      {item.isPast
                        ? "Ver resumo"
                        : isPadel
                          ? "Inscrever agora"
                          : item.isFree
                            ? "Garantir lugar"
                            : "Comprar bilhete"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (layout === "grid") {
    return (
      <>
        <div
          id={anchorId}
          className={`space-y-3 md:col-span-2 md:row-start-1 ${anchorId ? "scroll-mt-24" : ""}`}
        >
          {title && <h2 className="text-xl font-semibold text-white">{title}</h2>}
          {header}
        </div>
        <div className="md:col-span-2 md:row-start-2">{body}</div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <div id={anchorId} className={anchorId ? "scroll-mt-24" : ""}>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
      )}
      {header}
      {body}
    </div>
  );
}
