"use client";

import Link from "next/link";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  getObjectiveSections,
  normalizeOrgCategory,
  type ObjectiveNavContext,
  type ObjectiveTab,
} from "./objectiveNav";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const OBJECTIVE_LABELS: Record<ObjectiveTab, string> = {
  create: "Criar",
  manage: "Gerir",
  promote: "Promover",
  analyze: "Analisar",
};

type ObjectiveSubnavProps = {
  objective: ObjectiveTab;
  activeId?: string;
  category?: string | null;
  modules?: string[] | null;
  mode?: "dashboard" | "page";
  className?: string;
};

export default function ObjectiveSubnav({
  objective,
  activeId,
  category,
  modules,
  mode,
  className,
}: ObjectiveSubnavProps) {
  const { data } = useSWR(category || modules ? null : "/api/organizador/me", fetcher);
  const organizer = data?.organizer ?? null;

  const context: ObjectiveNavContext = {
    category: normalizeOrgCategory(category ?? organizer?.organizationCategory),
    modules: Array.isArray(modules) ? modules : Array.isArray(organizer?.modules) ? organizer.modules : [],
    username: organizer?.username ?? null,
  };

  const sections = getObjectiveSections(objective, context, { mode });
  const active =
    activeId && sections.some((section) => section.id === activeId)
      ? activeId
      : "overview";

  return (
    <div
      className={cn(
        "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050912]/95 p-4 shadow-[0_22px_80px_rgba(0,0,0,0.55)] backdrop-blur-3xl",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.26em] text-white/65">
          Objetivo · {OBJECTIVE_LABELS[objective]}
        </div>
        <div className="text-[11px] text-white/60">
          {sections.length} secções
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sections.map((section) => {
          const isActive = section.id === active;
          return (
            <Link
              key={section.id}
              href={section.href}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                isActive
                  ? "border-white/30 bg-white/15 text-white shadow-[0_12px_30px_rgba(107,255,255,0.35)]"
                  : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
