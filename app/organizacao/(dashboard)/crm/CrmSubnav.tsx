"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const CRM_NAV = [
  { id: "clientes", label: "Clientes", href: "/organizacao/crm/clientes" },
  { id: "segmentos", label: "Segmentos", href: "/organizacao/crm/segmentos" },
  { id: "campanhas", label: "Campanhas", href: "/organizacao/crm/campanhas", feature: "CRM_CAMPAIGNS" as const },
  { id: "journeys", label: "Journeys", href: "/organizacao/crm/journeys" },
  { id: "relatorios", label: "Relatórios", href: "/organizacao/crm/relatorios" },
  { id: "loyalty", label: "Pontos & recompensas", href: "/organizacao/crm/loyalty" },
];

type CrmSubnavProps = {
  variant?: "default" | "topbar";
  className?: string;
  campaignsEnabled?: boolean;
};

export default function CrmSubnav({ variant = "default", className, campaignsEnabled = false }: CrmSubnavProps) {
  const pathname = usePathname();
  const isTopbar = variant === "topbar";
  const navItems = CRM_NAV.filter((item) => {
    if (item.feature === "CRM_CAMPAIGNS") return campaignsEnabled;
    return true;
  });
  const wrapperClass = cn(
    isTopbar
      ? "relative w-full max-w-full rounded-full border border-white/12 bg-white/5 px-1 py-1 text-[12px] shadow-[0_10px_32px_rgba(0,0,0,0.35)] overflow-hidden"
      : "rounded-2xl border border-white/10 bg-white/5 px-2 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.35)]",
    className,
  );
  const listClass = cn("flex items-center", isTopbar ? "flex-nowrap gap-1" : "flex-wrap gap-2");
  const linkBase = isTopbar
    ? "inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold transition whitespace-nowrap"
    : "inline-flex items-center rounded-full px-4 py-2 text-[12px] font-semibold transition";
  const linkActive = isTopbar
    ? "bg-white/15 text-white shadow-[0_10px_28px_rgba(107,255,255,0.25)]"
    : "bg-gradient-to-r from-[#FF7AD1]/55 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_32px_rgba(107,255,255,0.35)]";
  const linkInactive = isTopbar
    ? "text-white/70 hover:bg-white/10"
    : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10";

  const content = (
    <div className={listClass}>
      {navItems.map((item) => {
        const isActive = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              linkBase,
              isActive ? linkActive : linkInactive,
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className={wrapperClass}>
      {isTopbar ? (
        <div className="orya-scrollbar-hide flex max-w-full overflow-x-auto overflow-y-visible touch-pan-x">
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}
