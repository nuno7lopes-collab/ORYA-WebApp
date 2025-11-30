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

  const itemsLeft: Item[] = useMemo(
    () => [
      { label: "Início", icon: "🏠", path: "/", active: (p) => p === "/" },
      { label: "Explorar", icon: "🧭", path: "/explorar", active: (p) => p.startsWith("/explorar") },
    ],
    [],
  );

  const itemsRight: Item[] = useMemo(
    () => [
      { label: "Bilhetes", icon: "🎫", path: "/me/tickets", active: (p) => p.startsWith("/me/tickets") },
      { label: "Perfil", icon: "👤", path: "/me", active: (p) => p.startsWith("/me") },
    ],
    [],
  );

  const go = (item: Item) => {
    onCloseSearch();
    router.push(item.path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-white/10 bg-[#050915]/92 text-white shadow-[0_-12px_36px_rgba(0,0,0,0.55)] backdrop-blur md:hidden"
      style={{
        paddingBottom: "calc(10px + env(safe-area-inset-bottom, 14px))",
        paddingTop: "12px",
      }}
    >
      <div className="relative mx-auto flex max-w-md items-end justify-between px-3">
        {/* Grupo esquerdo */}
        <div className="flex flex-1 items-center justify-start gap-2">
          {itemsLeft.map((item) => {
            const active = item.active(pathname);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => go(item)}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-2.5 py-1.5 transition ${
                  active
                    ? "bg-gradient-to-r from-[#5bf5ff]/15 via-[#8f66ff]/15 to-[#ff3cd6]/20 text-white shadow-[0_0_10px_rgba(107,255,255,0.28)]"
                    : "text-white/75 hover:bg-white/5"
                }`}
              >
                <span className="text-[17px] leading-none">{item.icon}</span>
                <span className="text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Botão central com anel ORYA */}
            <div className="absolute left-1/2 top-[-24px] -translate-x-1/2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="relative flex h-14 w-14 items-center justify-center rounded-full outline-none"
                aria-label="Início ORYA"
              >
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#5bf5ff]/25 via-[#8f66ff]/25 to-[#ff3cd6]/25 blur-sm" />
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#5bf5ff] via-[#8f66ff] to-[#ff3cd6] opacity-90 shadow-[0_0_26px_rgba(107,255,255,0.42)]" />
                <span className="absolute inset-[5px] rounded-full bg-[#050915]" />
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#5bf5ff]/35 via-[#8f66ff]/35 to-[#ff3cd6]/35 animate-pulse opacity-60" />
              </button>
            </div>

            {/* Grupo direito */}
            <div className="flex flex-1 items-center justify-end gap-2">
              {itemsRight.map((item) => {
            const active = item.active(pathname);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => go(item)}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-2.5 py-1.5 transition ${
                  active
                    ? "bg-gradient-to-r from-[#5bf5ff]/15 via-[#8f66ff]/15 to-[#ff3cd6]/20 text-white shadow-[0_0_10px_rgba(107,255,255,0.28)]"
                    : "text-white/75 hover:bg-white/5"
                }`}
              >
                <span className="text-[17px] leading-none">{item.icon}</span>
                <span className="text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
