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
  variant?: "full" | "tabs";
  hideWhenSingle?: boolean;
  className?: string;
};

export default function ObjectiveSubnav({
  objective,
  activeId,
  category,
  modules,
  mode,
  variant = "full",
  hideWhenSingle = true,
  className,
}: ObjectiveSubnavProps) {
  const { data } = useSWR(category || modules ? null : "/api/organizacao/me", fetcher);
  const organization = data?.organization ?? null;

  const context: ObjectiveNavContext = {
    category: normalizeOrgCategory(category ?? organization?.organizationCategory),
    modules: Array.isArray(modules) ? modules : Array.isArray(organization?.modules) ? organization.modules : [],
    username: organization?.username ?? null,
  };

  const sections = getObjectiveSections(objective, context, { mode });
  const active =
    activeId && sections.some((section) => section.id === activeId)
      ? activeId
      : "overview";

  if (hideWhenSingle && sections.length <= 1) return null;

  const tabs = (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.4)]">
      {sections.map((section) => {
        const isActive = section.id === active;
        return (
          <Link
            key={section.id}
            href={section.href}
            className={cn(
              "rounded-xl px-3 py-2 font-semibold transition",
              isActive
                ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]"
                : "text-white/80 hover:bg-white/10",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {section.label}
          </Link>
        );
      })}
    </div>
  );

  if (variant === "tabs") {
    return <div className={className}>{tabs}</div>;
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 p-4 shadow-[0_26px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          Objetivo · {OBJECTIVE_LABELS[objective]}
        </div>
        <div className="text-[11px] text-white/60">{sections.length} secções</div>
      </div>
      <div className="mt-3">{tabs}</div>
    </div>
  );
}
