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
};

export default function MobileTopBar({
  logoHref = "/descobrir",
  notificationsHref = "/social?tab=notifications",
  showSearch = true,
  showNotifications = true,
}: MobileTopBarProps) {
  const { isLoggedIn } = useUser();
  const { data } = useSWR(
    isLoggedIn ? "/api/notifications?status=unread&limit=1" : null,
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
        <div className="flex items-center justify-between">
          <Link href={logoHref} className="flex items-center gap-2" aria-label="Ir para Início">
            <Image
              src="/brand/orya-logo-flat.png"
              alt="ORYA"
              width={74}
              height={41}
              priority
              className="h-6 w-auto object-contain drop-shadow-[0_0_10px_rgba(107,255,255,0.2)]"
            />
            <span className="text-[12px] font-semibold tracking-[0.32em] text-white/85">ORYA</span>
          </Link>
          <div className="flex items-center gap-2">
            {showSearch && (
              <button
                type="button"
                onClick={handleOpenSearch}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/85 hover:bg-white/15 transition"
                aria-label="Procurar"
              >
                <SearchIcon className="h-4 w-4" />
              </button>
            )}
            {showNotifications && (
              <Link
                href={notificationsHref}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20 transition"
                aria-label="Alertas"
              >
                <BellIcon className="h-4 w-4 text-amber-100" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ff5bd6] shadow-[0_0_10px_rgba(255,91,214,0.7)]" />
                )}
              </Link>
            )}
          </div>
        </div>
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
