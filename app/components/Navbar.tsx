"use client";

import { useEffect, useLayoutEffect, useRef, useState, type SVGProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useUser } from "@/app/hooks/useUser";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { Avatar } from "@/components/ui/avatar";
import { getEventCoverUrl } from "@/lib/eventCover";
import MobileBottomNav from "./MobileBottomNav";
import useSWR from "swr";

type SearchEvent = {
  id: number;
  slug: string;
  title: string;
  startsAt: string | null;
  locationName: string | null;
  locationCity: string | null;
  coverImageUrl: string | null;
  priceFrom: number | null;
  isFree: boolean;
};

type SearchOrganization = {
  id: number;
  username: string | null;
  publicName: string | null;
  businessName: string | null;
  brandingAvatarUrl: string | null;
  city: string | null;
  isFollowing?: boolean;
};

type SearchUser = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isFollowing?: boolean;
  isRequested?: boolean;
};

type SearchTab = "all" | "events" | "organizations" | "users";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

const isRootProfileHandle = (path?: string | null) => {
  if (!path || path === "/") return false;
  const segment = path.startsWith("/") ? path.slice(1) : path;
  if (!segment || segment.includes("/")) return false;
  return !RESERVED_ROOT_ROUTES.has(segment);
};

export function Navbar() {
  const router = useRouter();
  const rawPathname = usePathname();
  if (rawPathname?.startsWith("/admin")) {
    return null;
  }

  const { openModal: openAuthModal, isOpen: isAuthOpen } = useAuthModal();
  const { user, profile, isLoading } = useUser();
  const isAuthenticated = !!user;
  const { data: notificationsData } = useSWR(
    isAuthenticated ? "/api/notifications?status=unread&limit=1" : null,
    fetcher,
  );
  const unreadCount = notificationsData?.unreadCount ?? 0;

  const [isVisible, setIsVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventResults, setEventResults] = useState<SearchEvent[]>([]);
  const [organizationResults, setOrganizationResults] = useState<SearchOrganization[]>([]);
  const [userResults, setUserResults] = useState<SearchUser[]>([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [activeSearchTab, setActiveSearchTab] = useState<SearchTab>("all");
  const [followPending, setFollowPending] = useState<Record<string, boolean>>({});
  const [hydratedPathname, setHydratedPathname] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const pathname = hydratedPathname ?? "";
  const shouldHide =
    rawPathname?.startsWith("/organizacao") || rawPathname?.startsWith("/landing");
  const isMobileHubRoute =
    rawPathname?.startsWith("/descobrir") ||
    rawPathname?.startsWith("/rede") ||
    rawPathname?.startsWith("/agora") ||
    rawPathname?.startsWith("/procurar") ||
    rawPathname?.startsWith("/explorar") ||
    rawPathname?.startsWith("/perfil") ||
    isRootProfileHandle(rawPathname);
  const Logo = () => (
    <button
      type="button"
      onClick={() => router.push("/descobrir")}
      className="group flex items-center gap-2 transition hover:opacity-90 sm:gap-3"
      aria-label="Voltar à homepage ORYA"
    >
      <Image
        src="/brand/orya-logo-112.png"
        alt="Logo ORYA"
        width={56}
        height={56}
        priority
        sizes="56px"
        className="h-14 w-14 shrink-0 rounded-full object-cover"
      />
      <span className="text-base font-semibold leading-none tracking-[0.18em] text-white sm:text-lg sm:tracking-[0.24em]">
        ORYA
      </span>
    </button>
  );

  useEffect(() => {
    // Garantir pathname estável só depois de montar para evitar mismatch
    if (typeof window !== "undefined") {
      setHydratedPathname(rawPathname ?? window.location.pathname);
    }
  }, [rawPathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOpenSearch = () => setIsSearchOpen(true);
    window.addEventListener("orya:open-search", handleOpenSearch);
    return () => window.removeEventListener("orya:open-search", handleOpenSearch);
  }, []);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    if (shouldHide) {
      document.body.dataset.navHidden = "true";
    } else {
      delete document.body.dataset.navHidden;
    }
  }, [shouldHide]);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    if (isMobileHubRoute) {
      document.body.dataset.mobileNavHidden = "true";
    } else {
      delete document.body.dataset.mobileNavHidden;
    }
  }, [isMobileHubRoute]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const currentY = window.scrollY || 0;
      const atTop = currentY < 12;
      setIsAtTop((prev) => (prev === atTop ? prev : atTop));

      const prevY = lastScrollYRef.current;

      if (atTop) {
        // No topo: navbar sempre visível
        setIsVisible(true);
      } else {
        // A descer esconde, a subir mostra
        if (currentY > prevY + 12) {
          setIsVisible(false);
        } else if (currentY < prevY - 12) {
          setIsVisible(true);
        }
      }

      lastScrollYRef.current = currentY;
    };

    // Inicializa logo o estado correto com a posição atual do scroll
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const originalOverflow = document.body.style.overflow;

    if (isSearchOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = originalOverflow;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      setActiveSearchTab("all");
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (searchPanelRef.current && target && !searchPanelRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleGlobalClick, true);
    return () => document.removeEventListener("mousedown", handleGlobalClick, true);
  }, [isSearchOpen]);

  const inAuthPage =
    pathname === "/login" || pathname === "/signup" || pathname === "/auth/callback";

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearchOpen(false);
    router.push(`/explorar?query=${encodeURIComponent(query)}`);
  };

  const handleLogout = async () => {
    try {
      await supabaseBrowser.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (err) {
      console.warn("[navbar] signOut falhou", err);
    } finally {
      setIsProfileMenuOpen(false);
      router.push("/");
      router.refresh();
    }
  };

  const buildEventHref = (slug: string) => `/eventos/${slug}`;
  const buildProfileHref = (username?: string | null) => (username ? `/${username}` : "/me");

  // Sugestões ao digitar (tipo DICE)
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      const q = searchQuery.trim();
      if (q.length < 1) {
        setEventResults([]);
        setOrganizationResults([]);
        setUserResults([]);
        setIsSuggestLoading(false);
        return;
      }
      try {
        setIsSuggestLoading(true);
        const query = encodeURIComponent(q);
        const [eventsData, usersData, organizationsData] = await Promise.all([
          fetch(`/api/explorar/list?q=${query}&limit=6`, {
            cache: "no-store",
            signal: controller.signal,
          })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null),
          fetch(`/api/users/search?q=${query}&limit=6`, {
            cache: "no-store",
            signal: controller.signal,
          })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null),
          fetch(`/api/organizations/search?q=${query}&limit=6`, {
            cache: "no-store",
            signal: controller.signal,
          })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null),
        ]);

        if (!active) return;

        const eventItems = Array.isArray(eventsData?.items)
          ? (eventsData.items as Array<{
              id: number;
              slug: string;
              title: string;
              startsAt?: string | null;
              location?: { name?: string | null; city?: string | null };
              coverImageUrl?: string | null;
              priceFrom?: number | null;
              isFree?: boolean;
            }>)
          : [];

        const userItems = Array.isArray(usersData?.results)
          ? (usersData.results as SearchUser[])
          : [];

        const organizationItems = Array.isArray(organizationsData?.results)
          ? (organizationsData.results as SearchOrganization[])
          : [];

        setEventResults(
          eventItems.map((it) => ({
            id: it.id,
            slug: it.slug,
            title: it.title,
            startsAt: it.startsAt ?? null,
            locationName: it.location?.name ?? null,
            locationCity: it.location?.city ?? null,
            coverImageUrl: it.coverImageUrl ?? null,
            priceFrom: typeof it.priceFrom === "number" ? it.priceFrom : null,
            isFree: Boolean(it.isFree),
          })),
        );
        setUserResults(userItems);
        setOrganizationResults(organizationItems);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (active) {
          setEventResults([]);
          setOrganizationResults([]);
          setUserResults([]);
        }
      } finally {
        if (active) setIsSuggestLoading(false);
      }
    }

    const handle = setTimeout(load, 220);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(handle);
    };
  }, [searchQuery]);

  // Forçar onboarding: se autenticado e perfil incompleto, abre modal e impede fechar
  useEffect(() => {
    if (user && profile && !profile.onboardingDone && !isAuthOpen && !inAuthPage) {
      openAuthModal({
        mode: "onboarding",
        redirectTo: pathname || "/",
      });
    }
  }, [user, profile, pathname, openAuthModal, isAuthOpen, inAuthPage]);

  const userLabel =
    profile?.username ||
    profile?.fullName ||
    (typeof user?.email === "string" ? user.email : "");

  const formatEventDate = (startsAt: string | null) =>
    startsAt
      ? new Date(startsAt).toLocaleString("pt-PT", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Data a anunciar";

  const hasResults =
    eventResults.length > 0 || organizationResults.length > 0 || userResults.length > 0;
  const normalizedQuery = searchQuery.trim();
  const hasActiveQuery = normalizedQuery.length >= 1;

  const setFollowPendingFlag = (key: string, value: boolean) => {
    setFollowPending((prev) => ({ ...prev, [key]: value }));
  };

  const updateUserFollowState = (targetId: string, nextFollowing: boolean, nextRequested: boolean) => {
    setUserResults((prev) =>
      prev.map((item) =>
        item.id === targetId ? { ...item, isFollowing: nextFollowing, isRequested: nextRequested } : item,
      ),
    );
  };

  const updateOrganizationFollowState = (targetId: number, next: boolean) => {
    setOrganizationResults((prev) =>
      prev.map((item) =>
        item.id === targetId ? { ...item, isFollowing: next } : item,
      ),
    );
  };

  const ensureAuthForFollow = () => {
    if (isAuthenticated) return true;
    const redirect = pathname && pathname !== "/" ? pathname : "/";
    openAuthModal({ mode: "login", redirectTo: redirect });
    return false;
  };

  const toggleUserFollow = async (targetId: string, status: "following" | "requested" | "none") => {
    if (!ensureAuthForFollow()) return;
    const key = `user_${targetId}`;
    setFollowPendingFlag(key, true);
    try {
      if (status === "following") {
        const res = await fetch("/api/social/unfollow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: targetId }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          updateUserFollowState(targetId, false, false);
        } else {
          updateUserFollowState(targetId, true, false);
        }
        return;
      }

      if (status === "requested") {
        const res = await fetch("/api/social/follow-requests/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: targetId }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          updateUserFollowState(targetId, false, false);
        } else {
          updateUserFollowState(targetId, false, true);
        }
        return;
      }

      const res = await fetch("/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        if (json.status === "REQUESTED") {
          updateUserFollowState(targetId, false, true);
        } else if (json.status === "FOLLOWING") {
          updateUserFollowState(targetId, true, false);
        }
      } else {
        updateUserFollowState(targetId, false, false);
      }
    } catch {
      updateUserFollowState(targetId, status === "following", status === "requested");
    } finally {
      setFollowPendingFlag(key, false);
    }
  };

  const toggleOrganizationFollow = async (targetId: number, next: boolean) => {
    if (!ensureAuthForFollow()) return;
    const key = `org_${targetId}`;
    setFollowPendingFlag(key, true);
    updateOrganizationFollowState(targetId, next);
    try {
      const res = await fetch(
        next ? "/api/social/follow-organization" : "/api/social/unfollow-organization",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: targetId }),
        },
      );
      if (!res.ok) {
        updateOrganizationFollowState(targetId, !next);
      }
    } catch {
      updateOrganizationFollowState(targetId, !next);
    } finally {
      setFollowPendingFlag(key, false);
    }
  };

  const goTo = (href: string) => {
    setIsSearchOpen(false);
    router.push(href);
  };

  const searchTabs: Array<{ key: SearchTab; label: string }> = [
    { key: "all", label: "Global" },
    { key: "events", label: "Eventos" },
    { key: "organizations", label: "Organizações" },
    { key: "users", label: "Utilizadores" },
  ];

  const navButtonBase =
    "inline-flex items-center justify-center rounded-full border text-[12px] font-semibold transition-colors h-10 px-4";

  const mainNavItems = [
    {
      label: "Início",
      href: "/descobrir",
      active: (path: string) => path === "/descobrir" || path === "/",
    },
    {
      label: "Descobrir",
      href: "/explorar",
      active: (path: string) =>
        path.startsWith("/explorar") || path.startsWith("/procurar"),
    },
  ];

  if (shouldHide) {
    return null;
  }

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        } ${shouldHide ? "hidden" : ""} ${isMobileHubRoute ? "hidden md:block" : ""}`}
      >
        <div
          className={`relative flex w-full items-center gap-4 rounded-b-[28px] border-b px-4 py-4 transition-all duration-300 md:px-6 md:py-5 lg:px-8 ${
            isAtTop
              ? "border-transparent bg-transparent shadow-none backdrop-blur-[6px]"
              : "border-white/10 bg-[linear-gradient(120deg,rgba(8,10,20,0.38),rgba(8,10,20,0.52))] shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-[18px]"
          }`}
        >
          {/* Logo + navegação principal */}
          <div className="flex flex-1 items-center gap-3">
            <Logo />

            <nav className="hidden items-center gap-3 text-xs text-zinc-300 md:flex">
              {mainNavItems.map((item) => {
                const isActive = item.active(pathname);
                const handleClick = () => {
                  router.push(item.href);
                };

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={handleClick}
                    className={`${navButtonBase} ${
                      isActive
                        ? "bg-[linear-gradient(120deg,rgba(255,0,200,0.22),rgba(107,255,255,0.18))] text-white border-white/30 shadow-[0_0_18px_rgba(107,255,255,0.35)]"
                        : "text-white/85 hover:text-white bg-white/5 border-white/16 hover:border-white/26"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Barra de pesquisa central */}
          <div className="hidden md:flex flex-[1.2] justify-center">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="group relative flex h-10 w-full max-w-xl items-center gap-3 rounded-full border border-white/16 bg-[linear-gradient(120deg,rgba(255,0,200,0.1),rgba(107,255,255,0.1)),rgba(5,6,12,0.82)] px-4 text-left text-[13px] text-white hover:border-white/35 hover:shadow-[0_0_35px_rgba(107,255,255,0.28)] transition shadow-[0_26px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/30 text-[10px] text-white/70">
                ⌕
              </span>
              <span className="flex-1 truncate text-[12px]">
                Procurar por evento, local ou cidade
              </span>
              <span className="hidden rounded-full border border-white/20 px-2.5 py-1 text-[10px] text-white/50 md:inline">
                Pesquisar
              </span>
            </button>
          </div>

          {/* Lado direito: notificações, auth/profile */}
          <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  const redirect = pathname && pathname !== "/" ? pathname : "/";
                  openAuthModal({ mode: "login", redirectTo: redirect });
                  return;
                }
                router.push("/organizacao");
              }}
              className={`${navButtonBase} hidden md:inline-flex border-white/18 bg-white/5 text-white/85 shadow-[0_0_18px_rgba(0,0,0,0.25)] hover:border-white/30 hover:bg-white/10`}
            >
              Organizar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  const redirect = pathname && pathname !== "/" ? pathname : "/";
                  openAuthModal({ mode: "login", redirectTo: redirect });
                  return;
                }
                router.push("/social?tab=notifications");
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20 transition"
              aria-label="Notificações"
            >
              <BellIcon className="h-4 w-4 text-amber-100" />
              {isAuthenticated && unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ff5bd6] shadow-[0_0_10px_rgba(255,91,214,0.7)]" />
              )}
            </button>
            {isLoading ? (
              <div className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-[11px] text-white/60 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-white/20" />
                <div className="h-3 w-20 rounded-full bg-white/15" />
              </div>
            ) : !isAuthenticated || inAuthPage ? (
              <button
                type="button"
                onClick={() => {
                  const redirect = pathname && pathname !== "/" ? pathname : "/";
                  openAuthModal({ mode: "login", redirectTo: redirect });
                }}
                className={`${CTA_PRIMARY} h-10 px-4 text-[12px]`}
              >
                Entrar / Registar
              </button>
            ) : (
              <div className="relative flex items-center gap-2" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((open) => !open)}
                  className="flex h-10 items-center gap-2 rounded-full border border-white/18 bg-white/8 px-3 text-[11px] text-white/90 hover:border-white/28 hover:bg-white/12 shadow-[0_0_22px_rgba(255,0,200,0.22)] transition"
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  aria-label="Abrir menu de conta"
                >
                  <div className="relative h-8 w-8">
                    <div className="absolute inset-[-3px] rounded-full bg-[conic-gradient(from_180deg,#ff00c8_0deg,#ff5afc_120deg,#6b7bff_240deg,#ff00c8_360deg)] opacity-85 blur-[8px]" />
                    <Avatar
                      src={profile?.avatarUrl ?? null}
                      version={profile?.updatedAt ?? null}
                      name={userLabel || "Conta ORYA"}
                      className="relative h-full w-full border border-white/20 shadow-[0_0_22px_rgba(255,0,200,0.32)]"
                      textClassName="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85"
                      fallbackText="OR"
                    />
                  </div>
                  <span className="hidden max-w-[120px] truncate text-[11px] sm:inline">
                    {userLabel || "Conta ORYA"}
                  </span>
                </button>

                {isProfileMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-3 w-60 origin-top-right rounded-2xl orya-menu-surface p-2 text-[11px] backdrop-blur-3xl"
                    role="menu"
                    aria-label="Menu de conta ORYA"
                  >
                    <div className="orya-menu-list">
                      <Link
                        href="/me"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="orya-menu-item font-semibold"
                      >
                        <span className="font-semibold">Perfil</span>
                      </Link>
                      <Link
                        href="/me/carteira"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="orya-menu-item"
                      >
                        <span>Carteira</span>
                      </Link>
                      <Link
                        href="/me/compras"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="orya-menu-item"
                      >
                        <span>Compras</span>
                      </Link>
                      <Link
                        href="/me/settings"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="orya-menu-item"
                      >
                        <span>Definições</span>
                      </Link>
                      {pathname?.startsWith("/organizacao") && (
                        <Link
                          href="/me"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="orya-menu-item"
                        >
                          <span>Voltar a utilizador</span>
                        </Link>
                      )}
                      {/* Dashboard de organização removido do dropdown: já está acessível na nav */}
                      <div className="my-1 orya-menu-divider" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="orya-menu-item font-semibold text-red-100 hover:bg-rose-500/10"
                      >
                        Terminar sessão
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Overlay de pesquisa estilo full-screen, com sugestões */}
      {isSearchOpen && (
        <div
          className={`fixed inset-0 z-40 ${
            isAtTop
              ? "bg-transparent backdrop-blur-[6px]"
              : "bg-white/5 backdrop-blur-[18px]"
          }`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSearchOpen(false);
            }
          }}
        >
          <div ref={searchPanelRef} className="mx-auto mt-24 md:mt-28 max-w-3xl px-4">
            <div
              className="rounded-3xl border border-white/18 bg-white/6 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
              aria-label="Pesquisa de eventos ORYA"
            >
              <form
                onSubmit={handleSubmitSearch}
                className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/8 px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-[12px] text-white/80">
                  ⌕
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="O que queres fazer hoje?"
                  className="flex-1 bg-transparent text-base text-white placeholder:text-white/65 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[11px] text-white/60 hover:text-white"
                >
                  Fechar
                </button>
              </form>

              <div className="mt-4">
                <div
                  className="flex flex-wrap items-center gap-2 rounded-full border border-white/12 bg-white/5 p-1 text-[11px] text-white/70"
                  role="tablist"
                  aria-label="Resultados da pesquisa"
                >
                  {searchTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveSearchTab(tab.key)}
                      role="tab"
                      aria-selected={activeSearchTab === tab.key}
                      className={`rounded-full px-3 py-1.5 font-semibold transition ${
                        activeSearchTab === tab.key
                          ? "bg-white/15 text-white shadow-[0_0_18px_rgba(255,255,255,0.15)]"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/16 bg-white/6 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between text-[11px] text-white/75">
                    <span>Resultados</span>
                    {isSuggestLoading && (
                      <span className="animate-pulse text-white/65">a carregar…</span>
                    )}
                  </div>

                  <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                    {!hasActiveQuery && (
                      <p className="text-[11px] text-white/70">
                        Começa a escrever para veres eventos, organizações e utilizadores.
                      </p>
                    )}

                    {hasActiveQuery && !isSuggestLoading && !hasResults && (
                      <p className="text-[11px] text-white/70">
                        Sem resultados para “{normalizedQuery}”.
                      </p>
                    )}

                    {hasActiveQuery && activeSearchTab === "all" && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between text-[11px] text-white/75">
                            <span>Eventos</span>
                            {eventResults.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveSearchTab("events")}
                                className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10"
                              >
                                Ver tudo
                              </button>
                            )}
                          </div>
                          <div className="mt-2 space-y-2">
                            {eventResults.slice(0, 3).map((item) => {
                              const coverSrc = getEventCoverUrl(item.coverImageUrl, {
                                seed: item.slug ?? item.id,
                                width: 200,
                                quality: 70,
                                format: "webp",
                              });
                              return (
                                <button
                                  key={`event-${item.id}`}
                                  type="button"
                                  onClick={() => goTo(buildEventHref(item.slug))}
                                  className="w-full rounded-xl border border-white/12 bg-white/5 p-2.5 text-left hover:border-white/20 hover:bg-white/8 transition flex gap-3"
                                >
                                  <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={coverSrc}
                                      alt={item.title}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold text-white line-clamp-1">
                                      {item.title}
                                    </p>
                                    <p className="text-[10px] text-white/80 line-clamp-1">
                                      {item.locationName || item.locationCity || "Local a anunciar"}
                                    </p>
                                    <p className="text-[10px] text-white/70">
                                      {formatEventDate(item.startsAt)}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 text-[10px] text-white/70">
                                    <span>
                                      {item.isFree
                                        ? "Grátis"
                                        : item.priceFrom !== null
                                          ? `Desde ${item.priceFrom.toFixed(2)} €`
                                          : "Preço a anunciar"}
                                    </span>
                                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/85">
                                      Ver
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                            {eventResults.length === 0 && (
                              <p className="text-[11px] text-white/60">Nenhum evento encontrado.</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between text-[11px] text-white/75">
                            <span>Organizações</span>
                            {organizationResults.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveSearchTab("organizations")}
                                className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10"
                              >
                                Ver tudo
                              </button>
                            )}
                          </div>
                          <div className="mt-2 space-y-2">
                            {organizationResults.slice(0, 3).map((item) => {
                              const isFollowing = Boolean(item.isFollowing);
                              const pending = followPending[`org_${item.id}`];
                              const displayName =
                                item.publicName?.trim() ||
                                item.businessName?.trim() ||
                                item.username ||
                                "Organização ORYA";
                              return (
                                <div
                                  key={`org-${item.id}`}
                                  className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 p-2.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => goTo(buildProfileHref(item.username))}
                                    className="flex flex-1 items-center gap-3 text-left"
                                  >
                                    <Avatar
                                      src={item.brandingAvatarUrl}
                                      name={displayName}
                                      className="h-12 w-12 border border-white/12"
                                      textClassName="text-[10px] font-semibold uppercase tracking-wide text-white/80"
                                      fallbackText="OR"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-[12px] font-semibold text-white line-clamp-1">
                                        {displayName}
                                      </p>
                                      <p className="text-[10px] text-white/70 line-clamp-1">
                                        {item.username ? `@${item.username}` : item.city || "Organização"}
                                      </p>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => toggleOrganizationFollow(item.id, !isFollowing)}
                                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                                      isFollowing
                                        ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                                        : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
                                    } ${pending ? "opacity-60" : ""}`}
                                  >
                                    {pending ? "…" : isFollowing ? "A seguir" : "Seguir"}
                                  </button>
                                </div>
                              );
                            })}
                            {organizationResults.length === 0 && (
                              <p className="text-[11px] text-white/60">Nenhum organização encontrado.</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between text-[11px] text-white/75">
                            <span>Utilizadores</span>
                            {userResults.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveSearchTab("users")}
                                className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10"
                              >
                                Ver tudo
                              </button>
                            )}
                          </div>
                          <div className="mt-2 space-y-2">
                            {userResults.slice(0, 3).map((item) => {
                              const isFollowing = Boolean(item.isFollowing);
                              const isRequested = Boolean(item.isRequested);
                              const followStatus: "following" | "requested" | "none" = isFollowing
                                ? "following"
                                : isRequested
                                  ? "requested"
                                  : "none";
                              const pending = followPending[`user_${item.id}`];
                              const displayName =
                                item.fullName?.trim() || item.username || "Utilizador ORYA";
                              return (
                                <div
                                  key={`user-${item.id}`}
                                  className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 p-2.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => goTo(buildProfileHref(item.username))}
                                    className="flex flex-1 items-center gap-3 text-left"
                                  >
                                    <Avatar
                                      src={item.avatarUrl}
                                      name={displayName}
                                      className="h-12 w-12 border border-white/12"
                                      textClassName="text-[10px] font-semibold uppercase tracking-wide text-white/80"
                                      fallbackText="OR"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-[12px] font-semibold text-white line-clamp-1">
                                        {displayName}
                                      </p>
                                      <p className="text-[10px] text-white/70 line-clamp-1">
                                        {item.username ? `@${item.username}` : "Utilizador"}
                                      </p>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => toggleUserFollow(item.id, followStatus)}
                                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                                      followStatus !== "none"
                                        ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                                        : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
                                    } ${pending ? "opacity-60" : ""}`}
                                  >
                                    {pending
                                      ? "…"
                                      : followStatus === "following"
                                        ? "A seguir"
                                        : followStatus === "requested"
                                          ? "Pedido enviado"
                                          : "Seguir"}
                                  </button>
                                </div>
                              );
                            })}
                            {userResults.length === 0 && (
                              <p className="text-[11px] text-white/60">Nenhum utilizador encontrado.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {hasActiveQuery && activeSearchTab === "events" && (
                      <div className="space-y-2">
                        {eventResults.map((item) => {
                          const coverSrc = getEventCoverUrl(item.coverImageUrl, {
                            seed: item.slug ?? item.id,
                            width: 200,
                            quality: 70,
                            format: "webp",
                          });
                          return (
                            <button
                              key={`event-tab-${item.id}`}
                              type="button"
                              onClick={() => goTo(buildEventHref(item.slug))}
                              className="w-full rounded-xl border border-white/12 bg-white/5 p-2.5 text-left hover:border-white/20 hover:bg-white/8 transition flex gap-3"
                            >
                              <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={coverSrc}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold text-white line-clamp-1">
                                  {item.title}
                                </p>
                                <p className="text-[10px] text-white/80 line-clamp-1">
                                  {item.locationName || item.locationCity || "Local a anunciar"}
                                </p>
                                <p className="text-[10px] text-white/70">
                                  {formatEventDate(item.startsAt)}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-[10px] text-white/70">
                                <span>
                                  {item.isFree
                                    ? "Grátis"
                                    : item.priceFrom !== null
                                      ? `Desde ${item.priceFrom.toFixed(2)} €`
                                      : "Preço a anunciar"}
                                </span>
                                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/85">
                                  Ver
                                </span>
                              </div>
                            </button>
                          );
                        })}
                        {eventResults.length === 0 && (
                          <p className="text-[11px] text-white/60">Nenhum evento encontrado.</p>
                        )}
                      </div>
                    )}

                    {hasActiveQuery && activeSearchTab === "organizations" && (
                      <div className="space-y-2">
                        {organizationResults.map((item) => {
                          const isFollowing = Boolean(item.isFollowing);
                          const pending = followPending[`org_${item.id}`];
                          const displayName =
                            item.publicName?.trim() ||
                            item.businessName?.trim() ||
                            item.username ||
                            "Organização ORYA";
                          return (
                            <div
                              key={`org-tab-${item.id}`}
                              className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 p-2.5"
                            >
                              <button
                                type="button"
                                onClick={() => goTo(buildProfileHref(item.username))}
                                className="flex flex-1 items-center gap-3 text-left"
                              >
                                <Avatar
                                  src={item.brandingAvatarUrl}
                                  name={displayName}
                                  className="h-12 w-12 border border-white/12"
                                  textClassName="text-[10px] font-semibold uppercase tracking-wide text-white/80"
                                  fallbackText="OR"
                                />
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-white line-clamp-1">
                                    {displayName}
                                  </p>
                                  <p className="text-[10px] text-white/70 line-clamp-1">
                                    {item.username ? `@${item.username}` : item.city || "Organização"}
                                  </p>
                                </div>
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => toggleOrganizationFollow(item.id, !isFollowing)}
                                className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                                  isFollowing
                                    ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                                    : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
                                } ${pending ? "opacity-60" : ""}`}
                              >
                                {pending ? "…" : isFollowing ? "A seguir" : "Seguir"}
                              </button>
                            </div>
                          );
                        })}
                        {organizationResults.length === 0 && (
                          <p className="text-[11px] text-white/60">Nenhum organização encontrado.</p>
                        )}
                      </div>
                    )}

                    {hasActiveQuery && activeSearchTab === "users" && (
                      <div className="space-y-2">
                        {userResults.map((item) => {
                          const isFollowing = Boolean(item.isFollowing);
                          const isRequested = Boolean(item.isRequested);
                          const followStatus: "following" | "requested" | "none" = isFollowing
                            ? "following"
                            : isRequested
                              ? "requested"
                              : "none";
                          const pending = followPending[`user_${item.id}`];
                          const displayName =
                            item.fullName?.trim() || item.username || "Utilizador ORYA";
                          return (
                            <div
                              key={`user-tab-${item.id}`}
                              className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 p-2.5"
                            >
                              <button
                                type="button"
                                onClick={() => goTo(buildProfileHref(item.username))}
                                className="flex flex-1 items-center gap-3 text-left"
                              >
                                <Avatar
                                  src={item.avatarUrl}
                                  name={displayName}
                                  className="h-12 w-12 border border-white/12"
                                  textClassName="text-[10px] font-semibold uppercase tracking-wide text-white/80"
                                  fallbackText="OR"
                                />
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-white line-clamp-1">
                                    {displayName}
                                  </p>
                                  <p className="text-[10px] text-white/70 line-clamp-1">
                                    {item.username ? `@${item.username}` : "Utilizador"}
                                  </p>
                                </div>
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => toggleUserFollow(item.id, followStatus)}
                                className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                                  followStatus !== "none"
                                    ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                                    : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
                                } ${pending ? "opacity-60" : ""}`}
                              >
                                {pending
                                  ? "…"
                                  : followStatus === "following"
                                    ? "A seguir"
                                    : followStatus === "requested"
                                      ? "Pedido enviado"
                                      : "Seguir"}
                              </button>
                            </div>
                          );
                        })}
                        {userResults.length === 0 && (
                          <p className="text-[11px] text-white/60">Nenhum utilizador encontrado.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {!shouldHide && <MobileBottomNav pathname={pathname} socialBadgeCount={unreadCount} />}
    </>
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
