"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

type MobileBottomNavProps = {
  pathname: string;
  isSearchOpen: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
};

type Item = {
  label: string;
  icon: string;
  path: string;
  active: (path: string) => boolean;
};

export default function MobileBottomNav({
  pathname,
  isSearchOpen,
  onOpenSearch,
  onCloseSearch,
}: MobileBottomNavProps) {
  const router = useRouter();
  const homeActive = pathname === "/" || pathname === "";
  const derivedTab = (() => {
    if (isSearchOpen) return "search";
    if (pathname.startsWith("/explorar")) return "explorar";
    if (pathname.startsWith("/buscar")) return "search";
    if (pathname.startsWith("/me/carteira")) return "tickets";
    if (pathname.startsWith("/me")) return "profile";
    return "home";
  })();

  const itemExplorar: Item = useMemo(
    () => ({
      label: "Explorar",
      icon: "🧭",
      path: "/explorar",
      active: (p) => p.startsWith("/explorar"),
    }),
    [],
  );

  const itemProcurar: Item = useMemo(
    () => ({
      label: "Procurar",
      icon: "🔍",
      path: "/buscar",
      active: (_p) => isSearchOpen,
    }),
    [isSearchOpen],
  );

  const itemBilhetes: Item = useMemo(
    () => ({
      label: "Bilhetes",
      icon: "🎫",
      path: "/me/carteira",
      active: (p) => p.startsWith("/me/carteira"),
    }),
    [],
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
    onCloseSearch();
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
              <NavItem item={itemExplorar} isActive={derivedTab === "explorar"} onClick={go} />
              <NavItem
                item={itemProcurar}
                isActive={derivedTab === "search"}
                onClick={() => onOpenSearch()}
              />
              <div />
              <NavItem item={itemBilhetes} isActive={derivedTab === "tickets"} onClick={go} />
              <NavItem item={itemPerfil} isActive={derivedTab === "profile"} onClick={go} />
            </div>

            {/* Botão central ORYA */}
            <div className="absolute left-1/2 top-[12px] -translate-x-1/2">
              <button
                type="button"
                onClick={() => go({ label: "Início", icon: "", path: "/", active: (p) => p === "/" })}
                className="relative flex h-11 w-11 items-center justify-center rounded-full outline-none transition transform hover:scale-[1.05] active:scale-95"
                aria-label="Início ORYA"
              >
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#5bf5ff]/32 via-[#8f66ff]/32 to-[#ff3cd6]/32 blur-lg" />
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#5bf5ff] via-[#8f66ff] to-[#ff3cd6] opacity-95 shadow-[0_0_38px_rgba(107,255,255,0.6)]" />
                <span className="absolute inset-[5px] rounded-full bg-[#050915] shadow-inner shadow-black/75" />
                <span className="absolute inset-[2px] rounded-full bg-gradient-to-r from-[#5bf5ff]/35 via-[#8f66ff]/35 to-[#ff3cd6]/35 animate-pulse opacity-55" />
                {derivedTab === "home" && <span className="absolute inset-0 rounded-full border border-white/30" />}
              </button>
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
      <span className="text-[18px] leading-none">{item.icon}</span>
      <span className="leading-none truncate">{item.label}</span>
    </button>
  );
}
