"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ORG_HUB_NAV_ITEMS, resolveOrgHubNavKey } from "@/app/org/_internal/core/organizations/orgHubNav";

export default function OrgHubTopNav() {
  const pathname = usePathname() || "";
  const activeKey = resolveOrgHubNavKey(pathname);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label="Navegação do hub de organizações"
        className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/16 bg-black/28 p-1"
      >
        {ORG_HUB_NAV_ITEMS.map((item) => {
          const active = item.key === activeKey;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55",
                active
                  ? "border border-[#22D3EE]/50 bg-[#22D3EE]/15 text-[#D8FDFF]"
                  : "border border-transparent text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white",
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/me"
        className="rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/14 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
      >
        Sair do modo organização
      </Link>
    </div>
  );
}
