"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type TabKey =
  | "overview"
  | "events"
  | "sales"
  | "finance"
  | "marketing"
  | "padel"
  | "staff"
  | "settings";

type Tab = { id: TabKey; label: string };

const TABS: Tab[] = [
  { id: "overview", label: "Resumo" },
  { id: "events", label: "Eventos" },
  { id: "marketing", label: "Marketing" },
  { id: "staff", label: "Equipa" },
  { id: "finance", label: "Finanças" },
  { id: "padel", label: "Padel" },
  { id: "settings", label: "Definições" },
];

function tabHref(id: TabKey) {
  return `/organizador?tab=${id}`;
}

export function DashboardTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const activeTab = TABS.some((t) => t.id === tabParam) ? (tabParam as TabKey) : "overview";

  const handleClick = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams ?? undefined);
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-sm text-white/80 shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
      {TABS.map((tab) => {
        const active = activeTab === tab.id || (!tabParam && tab.id === "overview");
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleClick(tab.id)}
            className={`rounded-xl px-3.5 py-2 transition ${
              active
                ? "bg-white/15 text-white shadow-[0_0_18px_rgba(107,255,255,0.25)] border border-white/20"
                : "border border-transparent hover:border-white/15 hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
