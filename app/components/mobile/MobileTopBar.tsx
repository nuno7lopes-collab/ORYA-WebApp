"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import type { SVGProps } from "react";
import { useUser } from "@/app/hooks/useUser";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type MobileTopBarProps = {
  logoHref?: string;
  notificationsHref?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
  variant?: "default" | "search-only";
  searchPlaceholder?: string;
};

export default function MobileTopBar({
  logoHref = "/",
  notificationsHref = "/social?tab=notifications",
  showSearch = true,
  showNotifications = true,
  variant = "default",
  searchPlaceholder = "Pesquisar",
}: MobileTopBarProps) {
  const { isLoggedIn } = useUser();
  const { data } = useSWR(
    isLoggedIn ? "/api/me/notifications/feed?limit=1" : null,
    fetcher,
  );
  const unreadCount = data?.unreadCount ?? 0;
  const handleOpenSearch = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("orya:open-search"));
  };

  return (
    <div className="sticky top-0 z-40 md:hidden">
      <div className="orya-mobile-topbar px-4 pt-4 pb-3">
        {variant === "search-only" ? (
          <button
            type="button"
            onClick={handleOpenSearch}
            className="group flex h-12 w-full items-center gap-3 rounded-full border border-white/22 bg-[#2a2a2a] px-4 text-left text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-white/32 hover:bg-[#303030]"
            aria-label="Pesquisar"
          >
            <SearchIcon className="h-5 w-5 shrink-0 text-white/55" />
            <span className="flex-1 truncate text-[17px] font-medium text-white/62">{searchPlaceholder}</span>
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <Link href={logoHref} className="flex items-center gap-2" aria-label="Ir para Início">
              <Image
                src="/brand/logo_icon.png"
                alt="ORYA"
                width={28}
                height={28}
                priority
                className="h-7 w-7 object-contain"
              />
              <span className="text-[12px] font-semibold tracking-[0.28em] text-white/85">ORYA</span>
            </Link>
            <div className="flex items-center gap-2">
              {showSearch && (
                <button
                  type="button"
                  onClick={handleOpenSearch}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 hover:border-white/30 hover:bg-white/10 transition"
                  aria-label="Procurar"
                >
                  <SearchIcon className="h-4 w-4" />
                </button>
              )}
              {showNotifications && (
                <Link
                  href={notificationsHref}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10 transition"
                  aria-label="Alertas"
                >
                  <BellIcon className="h-4 w-4 text-white/70" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                  )}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function BellIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillOpacity="0.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6.8 9.5a5.2 5.2 0 0 1 10.4 0v3.7c0 .8.3 1.6.8 2.2l.7.9H5.3l.7-.9c.5-.6.8-1.4.8-2.2V9.5Z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

function SearchIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}
