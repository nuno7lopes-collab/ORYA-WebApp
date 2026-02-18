"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildOrgHubHref } from "@/lib/organizationIdUtils";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: buildOrgHubHref("/organizations"),
    label: "Organizações",
    match: (pathname) => pathname.startsWith("/org-hub/organizations"),
  },
  {
    href: buildOrgHubHref("/groups"),
    label: "Grupos",
    match: (pathname) => pathname.startsWith("/org-hub/groups"),
  },
  {
    href: buildOrgHubHref("/create"),
    label: "Nova organização",
    match: (pathname) => pathname.startsWith("/org-hub/create"),
  },
];

export default function OrgHubTopNav() {
  const pathname = usePathname() || "";

  return (
    <nav
      aria-label="Navegação do hub de organizações"
      className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/16 bg-black/28 p-1"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/55",
              active
                ? "border border-[#6BFFFF]/50 bg-[#6BFFFF]/15 text-[#D8FDFF]"
                : "border border-transparent text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
