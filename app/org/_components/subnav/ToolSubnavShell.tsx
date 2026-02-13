"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { normalizeOrganizationPathname } from "@/app/organizacao/topbarRouteUtils";

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
  if (!normalizedPathname) return false;
  const parsed = new URL(href, "https://orya.local");
  const samePath =
    normalizedPathname === parsed.pathname ||
    normalizedPathname.startsWith(`${parsed.pathname}/`);
  if (!samePath) return false;
  for (const [key, value] of parsed.searchParams.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

export default function ToolSubnavShell({ items, className }: ToolSubnavShellProps) {
  const pathname = usePathname();
  const normalizedPathname = normalizeOrganizationPathname(pathname);
  const searchParams = useSearchParams();
  const stableSearchParams = new URLSearchParams(searchParams?.toString() ?? "");

  return (
    <div
      className={cn(
        "relative w-full max-w-full rounded-full border border-white/12 bg-white/5 px-1 py-1 text-[12px] shadow-[0_10px_32px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <div className="orya-scrollbar-hide flex max-w-full items-center gap-1 overflow-x-auto overflow-y-visible touch-pan-x">
        {items
          .filter((item) => !item.hidden)
          .map((item) => {
            const active = item.isActive
              ? item.isActive({ pathname, normalizedPathname, searchParams: stableSearchParams })
              : matchHref(item.href, normalizedPathname, stableSearchParams);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition",
                  active
                    ? "bg-white/15 text-white shadow-[0_10px_28px_rgba(107,255,255,0.25)]"
                    : "text-white/70 hover:bg-white/10",
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
