"use client";

import { useMemo, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";

type MobileBottomNavProps = {
  pathname: string;
  socialBadgeCount?: number;
};

type IconProps = SVGProps<SVGSVGElement>;
type IconComponent = ComponentType<IconProps>;

const RESERVED_ROOT_ROUTES = new Set([
  "admin",
  "api",
  "auth",
  "atividade",
  "agora",
  "descobrir",
  "em-breve",
  "eventos",
  "explorar",
  "inscricoes",
  "live",
  "login",
  "mapa",
  "me",
  "onboarding",
  "organizacao",
  "organização",
  "perfil",
  "procurar",
  "padel",
  "rede",
  "resale",
  "reset-password",
  "servicos",
  "signup",
  "social",
  "staff",
]);

const normalizePathname = (value: string) => {
  if (!value) return "/";
  const path = value.split("?")[0]?.split("#")[0] ?? "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
};

const isRootProfileHandle = (path: string) => {
  if (!path || path === "/") return false;
  const segment = path.startsWith("/") ? path.slice(1) : path;
  if (!segment || segment.includes("/")) return false;
  return !RESERVED_ROOT_ROUTES.has(segment);
};

const isProfilePath = (path: string) => path.startsWith("/me") || isRootProfileHandle(path);

type Item = {
  label: string;
  icon: IconComponent;
  path: string;
  active: (path: string) => boolean;
  badge?: number;
};

export default function MobileBottomNav({ pathname, socialBadgeCount }: MobileBottomNavProps) {
  const router = useRouter();
  const currentPathname = normalizePathname(pathname);

  const itemDescobrir: Item = useMemo(
    () => ({
      label: "Descobrir",
      icon: IconCompass,
      path: "/explorar",
      active: (p) => p.startsWith("/explorar") || p.startsWith("/procurar"),
    }),
    [],
  );

  const itemInicio: Item = useMemo(
    () => ({
      label: "Início",
      icon: IconHome,
      path: "/descobrir",
      active: (p) => p === "/descobrir" || p === "/",
    }),
    [],
  );

  const itemRede: Item = useMemo(
    () => ({
      label: "Rede",
      icon: IconUsers,
      path: "/rede",
      active: (p) => p.startsWith("/rede"),
      badge: typeof socialBadgeCount === "number" && socialBadgeCount > 0 ? socialBadgeCount : undefined,
    }),
    [socialBadgeCount],
  );

  const itemAgora: Item = useMemo(
    () => ({
      label: "Agora",
      icon: IconClock,
      path: "/agora",
      active: (p) => p.startsWith("/agora"),
    }),
    [],
  );

  const itemPerfil: Item = useMemo(
    () => ({
      label: "Perfil",
      icon: IconUser,
      path: "/perfil",
      active: (p) => p.startsWith("/perfil") || isProfilePath(p),
    }),
    [],
  );

  const go = (item: Item) => {
    router.push(item.path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[70] text-white md:hidden overflow-hidden border-t border-white/10"
      style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom, 10px))" }}
      aria-label="Navegação principal móvel"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(8,10,20,0.45),rgba(8,10,20,0.68))] backdrop-blur-[26px] shadow-[0_-14px_34px_rgba(0,0,0,0.6)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_45%,rgba(0,0,0,0.48)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />
      <div className="relative mx-auto max-w-3xl px-3">
        <div className="grid h-[56px] grid-cols-5 items-center text-center gap-1">
          <NavItem item={itemInicio} isActive={itemInicio.active(currentPathname)} onClick={go} />
          <NavItem item={itemDescobrir} isActive={itemDescobrir.active(currentPathname)} onClick={go} />
          <NavItem item={itemAgora} isActive={itemAgora.active(currentPathname)} onClick={go} />
          <NavItem item={itemRede} isActive={itemRede.active(currentPathname)} onClick={go} />
          <NavItem item={itemPerfil} isActive={itemPerfil.active(currentPathname)} onClick={go} />
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
  const badgeValue = typeof item.badge === "number" ? item.badge : 0;
  const showBadge = badgeValue > 0;
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={`group relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition duration-200 ${
        isActive ? "text-white" : "text-white/60"
      }`}
    >
      <span
        className={`absolute inset-0 rounded-lg transition duration-200 ${
          isActive
            ? "bg-white/8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
            : "bg-transparent"
        }`}
      />
      <span className="relative flex h-7 w-7 items-center justify-center rounded-xl">
        <Icon
          className={`h-4 w-4 transition duration-200 ${
            isActive
              ? "text-white drop-shadow-[0_0_12px_rgba(107,255,255,0.55)]"
              : "text-white/65 group-hover:text-white/85"
          }`}
          aria-hidden="true"
        />
        {showBadge && (
          <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-[#ff5a7a] px-1 text-[9px] font-semibold text-white shadow-[0_0_10px_rgba(255,90,122,0.65)]">
            {badgeValue > 9 ? "9+" : badgeValue}
          </span>
        )}
      </span>
      <span
        className={`relative leading-none transition duration-200 ${
          isActive ? "text-white/95" : "text-white/60 group-hover:text-white/85"
        }`}
      >
        {item.label}
      </span>
      {isActive && (
        <span className="absolute bottom-0 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#5bf5ff] via-[#8f66ff] to-[#ff3cd6] shadow-[0_0_10px_rgba(107,255,255,0.55)]" />
      )}
    </button>
  );
}

function IconCompass(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 14l4-4" />
      <path d="M9 9l6 2-2 6-6-2 2-6Z" />
    </svg>
  );
}

function IconHome(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function IconUsers(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="10" r="2.5" />
      <path d="M3 19c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" />
    </svg>
  );
}

function IconClock(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.5 2" />
    </svg>
  );
}

function IconUser(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20c1.7-3.6 4.7-5.4 8-5.4s6.3 1.8 8 5.4" />
    </svg>
  );
}
