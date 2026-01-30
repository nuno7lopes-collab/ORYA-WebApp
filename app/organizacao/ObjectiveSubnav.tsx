"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { parseOrganizationId } from "@/lib/organizationIdUtils";
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
  promote: "Promoções",
  analyze: "Analisar",
  profile: "Perfil",
};

type ObjectiveSubnavProps = {
  objective: ObjectiveTab;
  activeId?: string;
  focusSectionId?: string;
  primaryModule?: string | null;
  modules?: string[] | null;
  organizationId?: number | null;
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
  organizationId: organizationIdProp = null,
  mode,
  variant = "full",
  hideWhenSingle = true,
  className,
}: ObjectiveSubnavProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ left: number; top: number } | null>(null);
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
    hasDragged: false,
  });
  const searchParams = useSearchParams();
  const organizationIdParam = parseOrganizationId(searchParams?.get("organizationId"));
  const organizationId = organizationIdProp ?? organizationIdParam ?? null;
  const orgMeUrl = organizationId ? `/api/organizacao/me?organizationId=${organizationId}` : null;
  const { data } = useSWR(primaryModule || modules ? null : orgMeUrl, fetcher);
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
  const shouldHideNav = hideWhenSingle && sections.length <= 1;

  const isTopbar = variant === "topbar";
  const tabsWrapperClass = cn(
    "inline-flex items-center",
    isTopbar
      ? "flex-nowrap gap-1 rounded-full border border-white/12 bg-white/5 px-1 py-1 text-[12px] shadow-[0_10px_32px_rgba(0,0,0,0.35)] overflow-visible w-fit max-w-full"
      : "flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.4)]",
  );
  const tabBaseClass = isTopbar
    ? "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition whitespace-nowrap"
    : "inline-flex items-center gap-2 rounded-xl px-3 py-2 font-semibold transition";
  const tabActiveClass = isTopbar
    ? "bg-white/15 text-white shadow-[0_10px_28px_rgba(107,255,255,0.25)]"
    : "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]";
  const tabInactiveClass = isTopbar ? "text-white/70 hover:bg-white/10" : "text-white/80 hover:bg-white/10";
  const disableScrollToTop = isTopbar || mode === "dashboard";

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpenDropdownId(null);
    }, 140);
  };

  const openDropdown = (id: string, target: HTMLElement) => {
    if (!isTopbar) return;
    clearCloseTimeout();
    anchorRef.current = target;
    setOpenDropdownId(id);
    setAnchorRect(target.getBoundingClientRect());
  };

  useEffect(() => {
    if (!isTopbar || !openDropdownId) return undefined;
    const updateRect = () => {
      if (anchorRef.current) {
        setAnchorRect(anchorRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    const scroller = scrollRef.current;
    scroller?.addEventListener("scroll", updateRect, { passive: true });
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, { passive: true });
    return () => {
      scroller?.removeEventListener("scroll", updateRect);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [isTopbar, openDropdownId]);

  useLayoutEffect(() => {
    if (!isTopbar || !openDropdownId || !anchorRect) {
      setDropdownStyle(null);
      return;
    }
    const dropdownWidth = dropdownRef.current?.offsetWidth ?? 220;
    const viewportWidth = window.innerWidth || 0;
    const left = Math.min(
      Math.max(anchorRect.left, 12),
      Math.max(12, viewportWidth - dropdownWidth - 12),
    );
    setDropdownStyle({ left, top: anchorRect.bottom + 8 });
  }, [anchorRect, isTopbar, openDropdownId]);

  if (shouldHideNav) return null;

  const tabs = (
    <div className={tabsWrapperClass}>
      {sections.map((section) => {
        const isGrouped = Array.isArray(section.items) && section.items.length > 1;
        const isActive =
          section.id === active ||
          section.items?.some((item) => item.id === active);
        const tabClasses = cn(
          tabBaseClass,
          isActive ? tabActiveClass : tabInactiveClass,
          isGrouped && "gap-1",
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
          if (isTopbar) {
            return (
              <div key={section.id} className="relative">
                <Link
                  href={section.href}
                  className={tabClasses}
                  aria-current={isActive ? "page" : undefined}
                  scroll={disableScrollToTop ? false : undefined}
                  onMouseEnter={(event) => openDropdown(section.id, event.currentTarget)}
                  onFocus={(event) => openDropdown(section.id, event.currentTarget)}
                  onMouseLeave={scheduleClose}
                  onBlur={scheduleClose}
                >
                  <span>{section.label}</span>
                  {section.badge && (
                    <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70">
                      {section.badge}
                    </span>
                  )}
                  <span className="text-[10px] leading-none text-white/45" aria-hidden="true">
                    ▾
                  </span>
                </Link>
              </div>
            );
          }
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
                <span className="text-[10px] leading-none text-white/45" aria-hidden="true">
                  ▾
                </span>
              </Link>
              <div className="pointer-events-none absolute left-0 top-full z-40 min-w-[200px] rounded-2xl orya-menu-surface p-2 text-[12px] text-white/85 opacity-0 backdrop-blur-2xl transition before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 before:content-[''] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                <div className="orya-menu-list">
                  {section.items?.map((item) => {
                    const itemActive = item.id === active;
                    if (item.disabled) {
                      return (
                        <div
                          key={item.id}
                          className="orya-menu-item pointer-events-none text-white/55"
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
                          "orya-menu-item text-[12px]",
                          itemActive ? "bg-[var(--orya-menu-hover)] text-white" : "text-white/80",
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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button")) return;
    const container = scrollRef.current;
    if (!container) return;
    dragState.current.isDragging = true;
    dragState.current.startX = event.clientX;
    dragState.current.scrollLeft = container.scrollLeft;
    dragState.current.hasDragged = false;
    container.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container || !dragState.current.isDragging) return;
    const delta = event.clientX - dragState.current.startX;
    if (Math.abs(delta) > 4) {
      dragState.current.hasDragged = true;
    }
    container.scrollLeft = dragState.current.scrollLeft - delta;
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.isDragging) return;
    dragState.current.isDragging = false;
    try {
      scrollRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (dragState.current.hasDragged) {
      window.setTimeout(() => {
        dragState.current.hasDragged = false;
      }, 0);
    }
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragState.current.hasDragged) return;
    event.preventDefault();
    event.stopPropagation();
    dragState.current.hasDragged = false;
  };

  const openSection = isTopbar ? sections.find((section) => section.id === openDropdownId) ?? null : null;

  if (variant === "topbar") {
    return (
      <div className={className}>
        <div
          ref={scrollRef}
          className="orya-scrollbar-hide flex max-w-full select-none overflow-x-auto overflow-y-visible touch-pan-x cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerLeave={stopDrag}
          onPointerCancel={stopDrag}
          onClickCapture={handleClickCapture}
        >
          {tabs}
        </div>
        {openSection?.items?.length && anchorRect ? (
          <div
            className="fixed z-[var(--z-popover)]"
            style={{
              left: dropdownStyle?.left ?? anchorRect.left,
              top: dropdownStyle?.top ?? anchorRect.bottom + 8,
            }}
            onMouseEnter={clearCloseTimeout}
            onMouseLeave={scheduleClose}
            onFocus={clearCloseTimeout}
            onBlur={scheduleClose}
          >
            <div
              ref={dropdownRef}
              className="min-w-[200px] rounded-2xl orya-menu-surface p-2 text-[12px] text-white/85 backdrop-blur-2xl animate-popover"
            >
              <div className="orya-menu-list">
                {openSection.items.map((item) => {
                  const itemActive = item.id === active;
                  if (item.disabled) {
                      return (
                        <div
                          key={item.id}
                          className="orya-menu-item pointer-events-none text-white/55"
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
                          "orya-menu-item text-[12px]",
                          itemActive ? "bg-[var(--orya-menu-hover)] text-white" : "text-white/80",
                        )}
                        scroll={disableScrollToTop ? false : undefined}
                        onClick={() => setOpenDropdownId(null)}
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
        ) : null}
      </div>
    );
  }

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
