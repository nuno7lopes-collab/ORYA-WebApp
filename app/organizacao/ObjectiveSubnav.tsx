"use client";

import Link from "next/link";
import useSWR from "swr";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CORE_ORGANIZATION_MODULES,
  OPERATION_MODULES,
  parseOrganizationModules,
  resolvePrimaryModule,
} from "@/lib/organizationCategories";
import {
  getObjectiveSections,
  type ObjectiveNavContext,
  type ObjectiveTab,
} from "./objectiveNav";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const OBJECTIVE_LABELS: Record<ObjectiveTab, string> = {
  create: "Criar",
  manage: "Gerir",
  promote: "Promover",
  analyze: "Analisar",
  profile: "Perfil",
};

type ObjectiveSubnavProps = {
  objective: ObjectiveTab;
  activeId?: string;
  focusSectionId?: string;
  primaryModule?: string | null;
  modules?: string[] | null;
  mode?: "dashboard" | "page";
  variant?: "full" | "tabs" | "topbar";
  hideWhenSingle?: boolean;
  className?: string;
};

export default function ObjectiveSubnav({
  objective,
  activeId,
  focusSectionId,
  primaryModule,
  modules,
  mode,
  variant = "full",
  hideWhenSingle = true,
  className,
}: ObjectiveSubnavProps) {
  const { data } = useSWR(primaryModule || modules ? null : "/api/organizacao/me", fetcher);
  const organization = data?.organization ?? null;
  const pathname = usePathname();
  const inscricoesBasePath = (() => {
    if (!pathname?.startsWith("/organizacao/inscricoes/")) return null;
    const match = pathname.match(/^\/organizacao\/inscricoes\/(\d+)/);
    return match ? `/organizacao/inscricoes/${match[1]}` : null;
  })();
  const moduleBasePath =
    pathname?.startsWith("/organizacao/eventos")
      ? "/organizacao/eventos"
      : pathname?.startsWith("/organizacao/torneios")
        ? "/organizacao/torneios"
        : null;
  const operationOverride =
    pathname?.startsWith("/organizacao/reservas")
      ? "RESERVAS"
      : pathname?.startsWith("/organizacao/eventos")
        ? "EVENTOS"
        : pathname?.startsWith("/organizacao/torneios") ||
            pathname?.startsWith("/organizacao/padel") ||
            pathname?.startsWith("/organizacao/tournaments")
          ? "TORNEIOS"
          : null;

  const rawModules = Array.isArray(modules)
    ? modules
    : Array.isArray(organization?.modules)
      ? organization.modules
      : [];
  const normalizedModules = parseOrganizationModules(rawModules) ?? [];
  const resolvedPrimary = resolvePrimaryModule(
    primaryModule ?? organization?.primaryModule ?? null,
    normalizedModules,
  );
  const activeModules = (() => {
    const base = new Set<string>([
      ...normalizedModules,
      ...CORE_ORGANIZATION_MODULES,
      ...OPERATION_MODULES,
      resolvedPrimary,
    ]);
    return Array.from(base);
  })();
  const context: ObjectiveNavContext = {
    primaryModule: resolvedPrimary,
    modules: activeModules,
    username: organization?.username ?? null,
  };

  const sections = getObjectiveSections(objective, context, {
    mode,
    basePath: moduleBasePath,
    focusSectionId,
    inscricoesBasePath,
    operationOverride,
  });
  const active =
    activeId &&
    sections.some((section) =>
      section.id === activeId || section.items?.some((item) => item.id === activeId),
    )
      ? activeId
      : "overview";

  if (hideWhenSingle && sections.length <= 1) return null;

  const isTopbar = variant === "topbar";
  const tabsWrapperClass = cn(
    "inline-flex items-center",
    isTopbar
      ? "flex-nowrap gap-1 rounded-full border border-white/12 bg-white/5 px-1 py-1 text-[12px] shadow-[0_10px_32px_rgba(0,0,0,0.35)] overflow-visible w-fit max-w-full"
      : "flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.4)]",
  );
  const tabBaseClass = isTopbar
    ? "rounded-full px-3 py-1.5 text-[12px] font-semibold transition whitespace-nowrap"
    : "rounded-xl px-3 py-2 font-semibold transition";
  const tabActiveClass = isTopbar
    ? "bg-white/15 text-white shadow-[0_10px_28px_rgba(107,255,255,0.25)]"
    : "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]";
  const tabInactiveClass = isTopbar ? "text-white/70 hover:bg-white/10" : "text-white/80 hover:bg-white/10";
  const disableScrollToTop = isTopbar || mode === "dashboard";

  const tabs = (
    <div className={tabsWrapperClass}>
      {sections.map((section) => {
        const isGrouped = Array.isArray(section.items) && section.items.length > 0;
        const isActive =
          section.id === active ||
          section.items?.some((item) => item.id === active);
        const tabClasses = cn(
          tabBaseClass,
          isActive ? tabActiveClass : tabInactiveClass,
          isGrouped && "flex items-center gap-1",
          section.disabled && "cursor-not-allowed opacity-60",
        );

        if (section.disabled) {
          return (
            <span key={section.id} className={tabClasses}>
              <span>{section.label}</span>
              {section.badge && (
                <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70">
                  {section.badge}
                </span>
              )}
            </span>
          );
        }

        if (isGrouped) {
          return (
            <div key={section.id} className="relative group">
              <Link
                href={section.href}
                className={tabClasses}
                aria-current={isActive ? "page" : undefined}
                scroll={disableScrollToTop ? false : undefined}
              >
                <span>{section.label}</span>
                {section.badge && (
                  <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70">
                    {section.badge}
                  </span>
                )}
                <span className="text-white/50">▾</span>
              </Link>
              <div className="pointer-events-none absolute left-0 top-full z-40 mt-2 min-w-[200px] rounded-2xl border border-white/12 bg-[#060b15]/95 p-2 text-[12px] text-white/85 opacity-0 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl transition group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="grid gap-1">
                  {section.items?.map((item) => {
                    const itemActive = item.id === active;
                    if (item.disabled) {
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl px-3 py-2 text-white/55"
                        >
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/60">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3 py-2 transition",
                          itemActive ? "bg-white/15 text-white" : "hover:bg-white/10 text-white/80",
                        )}
                        scroll={disableScrollToTop ? false : undefined}
                      >
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        return (
          <Link
            key={section.id}
            href={section.href}
            className={tabClasses}
            aria-current={isActive ? "page" : undefined}
            scroll={disableScrollToTop ? false : undefined}
          >
            <span>{section.label}</span>
            {section.badge && (
              <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70">
                {section.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );

  if (variant === "tabs" || variant === "topbar") {
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
