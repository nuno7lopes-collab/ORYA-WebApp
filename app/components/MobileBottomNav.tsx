"use client";

import { useRouter } from "next/navigation";

type MobileBottomNavProps = {
  pathname: string;
  isSearchOpen: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
};

export default function MobileBottomNav({
  pathname,
  isSearchOpen,
  onOpenSearch,
  onCloseSearch,
}: MobileBottomNavProps) {
  const router = useRouter();

  const go = (path: string) => {
    onCloseSearch();
    router.push(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 bg-[#050915]/90 px-4 py-3 text-[11px] text-white backdrop-blur md:hidden">
      <button
        type="button"
        className={`flex flex-col items-center gap-1 ${
          pathname === "/" ? "text-white" : "text-white/70"
        }`}
        onClick={() => go("/")}
      >
        <span>🏠</span>
        <span>Home</span>
      </button>

      <button
        type="button"
        className={`flex flex-col items-center gap-1 ${
          pathname.startsWith("/explorar") ? "text-white" : "text-white/70"
        }`}
        onClick={() => go("/explorar")}
      >
        <span>🧭</span>
        <span>Explorar</span>
      </button>

      <button
        type="button"
        className={`flex flex-col items-center gap-1 ${
          isSearchOpen ? "text-white" : "text-white/70"
        }`}
        onClick={isSearchOpen ? onCloseSearch : onOpenSearch}
      >
        <span>⌕</span>
        <span>Pesquisar</span>
      </button>

      <button
        type="button"
        className={`flex flex-col items-center gap-1 ${
          pathname.startsWith("/me") ? "text-white" : "text-white/70"
        }`}
        onClick={() => go("/me")}
      >
        <span>👤</span>
        <span>Conta</span>
      </button>
    </nav>
  );
}
