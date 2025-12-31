"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

type MobileBottomNavProps = {
  pathname: string;
  socialBadgeCount?: number;
};

type Item = {
  label: string;
  icon: string;
  path: string;
  active: (path: string) => boolean;
  badge?: number;
};

export default function MobileBottomNav({
  pathname,
  socialBadgeCount,
}: MobileBottomNavProps) {
  const router = useRouter();
  const derivedTab = (() => {
    if (pathname.startsWith("/explorar")) return "explorar";
    if (pathname.startsWith("/social")) return "social";
    if (pathname.startsWith("/me")) return "profile";
    return "home";
  })();

  const itemHome: Item = useMemo(
    () => ({
      label: "Inicio",
      icon: "🏠",
      path: "/",
      active: (p) => p === "/",
    }),
    [],
  );

  const itemExplorar: Item = useMemo(
    () => ({
      label: "Explorar",
      icon: "🧭",
      path: "/explorar",
      active: (p) => p.startsWith("/explorar"),
    }),
    [],
  );

  const itemSocial: Item = useMemo(
    () => ({
      label: "Social",
      icon: "🤝",
      path: "/social",
      active: (p) => p.startsWith("/social"),
      badge: socialBadgeCount,
    }),
    [socialBadgeCount],
  );

  const itemPerfil: Item = useMemo(
    () => ({
      label: "Perfil",
      icon: "👤",
      path: "/me",
      active: (p) => p.startsWith("/me"),
    }),
    [],
  );

  const go = (item: Item) => {
    router.push(item.path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[70] text-white md:hidden"
      style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom, 10px))" }}
      aria-label="Navegação principal móvel"
    >
      <div className="mx-auto max-w-3xl px-3">
        <div className="relative h-[72px] flex justify-center">
          {/* Fundo glass + blur */}
          <div className="absolute inset-0 rounded-3xl border border-white/10 bg-black/32 backdrop-blur-[26px] shadow-[0_-24px_60px_rgba(0,0,0,0.72)]" />
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#0a1120]/85 via-[#0b0f1c]/85 to-[#0a1120]/85 opacity-95" />

          {/* Content */}
          <div className="relative z-10 h-full px-3 pb-2">
            <div className="grid h-full grid-cols-4 items-center text-center gap-1">
              <NavItem item={itemHome} isActive={derivedTab === "home"} onClick={go} />
              <NavItem item={itemExplorar} isActive={derivedTab === "explorar"} onClick={go} />
              <NavItem item={itemSocial} isActive={derivedTab === "social"} onClick={go} />
              <NavItem item={itemPerfil} isActive={derivedTab === "profile"} onClick={go} />
            </div>

          </div>
        </div>
      </div>
    </nav>
  );
}

type NavItemProps = {
  item: Item;
  isActive: boolean;
  onClick: (item: Item) => void;
};

function NavItem({ item, isActive, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition ${
        isActive
          ? "bg-gradient-to-r from-[#5bf5ff]/15 via-[#8f66ff]/15 to-[#ff3cd6]/20 text-white shadow-[0_0_14px_rgba(107,255,255,0.35)]"
          : "text-white/70 hover:bg-white/5"
      }`}
    >
      <span className="relative text-[18px] leading-none">
        {item.icon}
        {item.badge && item.badge > 0 && (
          <span className="absolute -right-2 -top-1 min-w-[14px] rounded-full bg-emerald-400 px-1 text-[9px] font-semibold text-black">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        )}
      </span>
      <span className="leading-none truncate">{item.label}</span>
    </button>
  );
}
