"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { normalizeOrganizationPathname } from "@/app/org/_internal/core/topbarRouteUtils";

export type ToolSubnavItem = {
  id: string;
  label: string;
  href: string;
  hidden?: boolean;
  isActive?: (ctx: {
    pathname: string | null;
    normalizedPathname: string | null;
    searchParams: URLSearchParams;
  }) => boolean;
};

type ToolSubnavShellProps = {
  items: ToolSubnavItem[];
  className?: string;
};

function matchHref(href: string, normalizedPathname: string | null, searchParams: URLSearchParams) {
  return getSubnavHrefMatchScore(href, normalizedPathname, searchParams) >= 0;
}

export function getSubnavHrefMatchScore(
  href: string,
  normalizedPathname: string | null,
  searchParams: URLSearchParams,
) {
  if (!normalizedPathname) return -1;
  const parsed = new URL(href, "https://orya.local");
  const exactPath = normalizedPathname === parsed.pathname;
  const nestedPath = normalizedPathname.startsWith(`${parsed.pathname}/`);
  if (!exactPath && !nestedPath) return -1;
  for (const [key, value] of parsed.searchParams.entries()) {
    if (searchParams.get(key) !== value) return -1;
  }
  return (exactPath ? 1000 : 500) + parsed.pathname.length * 10 + parsed.searchParams.size;
}

export function resolveSubnavActiveIndex(input: {
  items: ToolSubnavItem[];
  pathname: string | null;
  normalizedPathname: string | null;
  searchParams: URLSearchParams;
}) {
  const { items, pathname, normalizedPathname, searchParams } = input;
  const visibleItems = items.filter((item) => !item.hidden);
  const scoredItems = visibleItems.map((item, index) => {
    const hrefScore = getSubnavHrefMatchScore(item.href, normalizedPathname, searchParams);
    const customActive = item.isActive
      ? item.isActive({ pathname, normalizedPathname, searchParams })
      : matchHref(item.href, normalizedPathname, searchParams);
    return { index, customActive, hrefScore };
  });
  const activeCandidates = scoredItems.filter((entry) => entry.customActive);
  if (activeCandidates.length === 0) {
    return { activeIndex: -1, visibleItems };
  }
  const activeIndex = activeCandidates.reduce((best, current) => {
    if (current.hrefScore > best.hrefScore) return current;
    if (current.hrefScore === best.hrefScore && current.index > best.index) return current;
    return best;
  }).index;
  return { activeIndex, visibleItems };
}

export default function ToolSubnavShell({ items, className }: ToolSubnavShellProps) {
  const pathname = usePathname();
  const normalizedPathname = normalizeOrganizationPathname(pathname);
  const searchParams = useSearchParams();
  const stableSearchParams = new URLSearchParams(searchParams?.toString() ?? "");
  const { visibleItems, activeIndex } = resolveSubnavActiveIndex({
    items,
    pathname,
    normalizedPathname,
    searchParams: stableSearchParams,
  });

  return (
    <div
      className={cn(
        "relative w-full max-w-full rounded-full border border-white/24 bg-white/[0.04] px-1 py-1 text-[12px]",
        className,
      )}
    >
      <div className="orya-scrollbar-hide flex max-w-full items-center gap-1 overflow-x-auto overflow-y-visible touch-pan-x">
        {visibleItems.map((item, index) => {
            const active = index === activeIndex;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition",
                  active
                    ? "border border-[#22D3EE]/55 bg-[#22D3EE]/16 text-white"
                    : "text-white/86 hover:bg-white/[0.08] hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
      </div>
    </div>
  );
}
