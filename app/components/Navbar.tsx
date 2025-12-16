"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useUser } from "@/app/hooks/useUser";
import Link from "next/link";
import MobileBottomNav from "./MobileBottomNav";
import { NotificationBell } from "./notifications/NotificationBell";
import { featureFlags } from "@/lib/flags";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { OryaPortal } from "./OryaPortal";

type Suggestion = {
  id: number;
  type: "EVENT" | "EXPERIENCE";
  slug: string;
  title: string;
  startsAt: string | null;
  locationName: string | null;
  locationCity: string | null;
  coverImageUrl: string | null;
};

export function Navbar() {
  const router = useRouter();
  const rawPathname = usePathname();

  const { openModal: openAuthModal, isOpen: isAuthOpen } = useAuthModal();
  const { user, profile, roles, isLoading } = useUser();

  const [isVisible, setIsVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [hydratedPathname, setHydratedPathname] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const pathname = hydratedPathname ?? "";
  const useNewNavbar = featureFlags.NEW_NAVBAR();
  const shouldHide = rawPathname?.startsWith("/organizador");

  const LogoNew = () => {
    const [logoState, setLogoState] = useState<"idle" | "hover" | "press">("idle");
    return (
      <button
        type="button"
        onClick={() => router.push("/")}
        onMouseEnter={() => setLogoState("hover")}
        onMouseLeave={() => setLogoState("idle")}
        onMouseDown={() => setLogoState("press")}
        onMouseUp={() => setLogoState("hover")}
        className="flex items-center gap-2"
        aria-label="Voltar à homepage ORYA"
      >
        <OryaPortal size={44} state={logoState} variant="full" />
        <span className="hidden text-sm font-semibold tracking-wide text-white sm:inline">ORYA</span>
      </button>
    );
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    // Garantir pathname estável só depois de montar para evitar mismatch
    if (typeof window !== "undefined") {
      setHydratedPathname(rawPathname ?? window.location.pathname);
    }
  }, [rawPathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (shouldHide) {
      document.body.dataset.navHidden = "true";
    } else {
      delete document.body.dataset.navHidden;
    }
  }, [shouldHide]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const currentY = window.scrollY || 0;
      const atTop = currentY < 10;
      setIsAtTop(atTop);

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

  const inAuthPage =
    pathname === "/login" || pathname === "/signup" || pathname === "/auth/callback";

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearchOpen(false);
    router.push(`/explorar?query=${encodeURIComponent(query)}`);
  };

  const handleQuickSearch = (value: string) => {
    setIsSearchOpen(false);
    router.push(`/explorar?query=${encodeURIComponent(value)}`);
  };

  const handleLogout = async () => {
    try {
      await supabaseBrowser.auth.signOut();
    } catch (err) {
      console.warn("[navbar] signOut falhou", err);
    } finally {
      setIsProfileMenuOpen(false);
      router.push("/");
      router.refresh();
    }
  };

  const buildSlug = (item: Pick<Suggestion, "type" | "slug">) =>
    item.type === "EXPERIENCE" ? `/experiencias/${item.slug}` : `/eventos/${item.slug}`;

  // Sugestões ao digitar (tipo DICE)
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      const q = searchQuery.trim();
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        setIsSuggestLoading(true);
        const res = await fetch(`/api/explorar/list?q=${encodeURIComponent(q)}&limit=6`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("erro sugestões");
        const data = await res.json();
        if (!active) return;
        const items = Array.isArray(data?.items)
          ? (data.items as Array<{
              id: number;
              type: "EVENT" | "EXPERIENCE";
              slug: string;
              title: string;
              startsAt?: string | null;
              location?: { name?: string | null; city?: string | null };
              coverImageUrl?: string | null;
            }>)
          : [];
        setSuggestions(
          items.map((it) => ({
            id: it.id,
            type: it.type,
            slug: it.slug,
            title: it.title,
            startsAt: it.startsAt ?? null,
            locationName: it.location?.name ?? null,
            locationCity: it.location?.city ?? null,
            coverImageUrl: it.coverImageUrl ?? null,
          })),
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (active) setSuggestions([]);
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

  const isAuthenticated = !!user;
  const isOrganizer = roles?.includes("organizer");
  const userLabel =
    profile?.username ||
    profile?.fullName ||
    (typeof user?.email === "string" ? user.email : "");
  const userInitial =
    (userLabel || "O").trim().charAt(0).toUpperCase() || "O";

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        } ${shouldHide ? "hidden" : ""}`}
      >
        <div
          className={`flex w-full items-center gap-4 px-4 md:px-6 lg:px-8 transition-all duration-300 ${
            isAtTop && !isSearchOpen
              ? "py-4 md:py-5 border-b border-white/5 bg-[#050915]/60 backdrop-blur-xl"
              : "py-3.5 md:py-4 border-b border-white/10 bg-[#060a16]/85 backdrop-blur-2xl shadow-[0_14px_50px_rgba(0,0,0,0.65)]"
          }`}
        >
          {/* Logo + link explorar */}
          <div className="flex flex-1 items-center gap-3">
            {useNewNavbar ? (
              <LogoNew />
            ) : (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex items-center gap-2"
              >
                <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224] text-xs font-black tracking-[0.2em] shadow-[0_0_18px_rgba(107,255,255,0.25)]">
                  <span className="absolute inset-0 rounded-2xl border border-white/10" />
                  <span className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#FF00C8]/35 via-[#6BFFFF]/20 to-transparent animate-[spin_9s_linear_infinite]" />
                  <span className="relative z-10 bg-gradient-to-r from-[#FF9CF2] to-[#6BFFFF] bg-clip-text text-transparent">
                    OY
                  </span>
                </div>
                <span className="hidden text-sm font-semibold uppercase tracking-[0.22em] text-zinc-100 sm:inline">
                  ORYA
                </span>
              </button>
            )}

            <nav className="hidden items-center gap-3 text-xs text-zinc-300 md:flex">
              <button
                type="button"
                onClick={() => router.push("/explorar")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  pathname?.startsWith("/explorar")
                    ? "bg-white/12 text-white border border-white/25 shadow-[0_0_18px_rgba(255,255,255,0.18)]"
                    : "text-zinc-200 hover:bg-white/5 hover:text-white border border-white/10"
                }`}
              >
                Explorar
              </button>
              <button
                type="button"
                onClick={() => router.push("/organizador")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  pathname?.startsWith("/organizador")
                    ? "bg-white/12 text-white border border-white/25 shadow-[0_0_18px_rgba(107,255,255,0.25)]"
                    : "text-zinc-200 hover:bg-white/5 hover:text-white border border-white/10"
                }`}
              >
                Organizar
              </button>
            </nav>
          </div>

          {/* Barra de pesquisa central */}
          <div className="hidden md:flex flex-[1.2] justify-center">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="group flex w-full max-w-xl items-center gap-3 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-left text-[13px] text-white/75 hover:border-white/40 hover:bg-white/10 transition-colors shadow-[0_16px_36px_rgba(0,0,0,0.45)]"
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

          {/* Lado direito: auth/profile */}
          <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60 animate-pulse">
                <div className="h-7 w-7 rounded-full bg-white/20" />
                <div className="h-3 w-20 rounded-full bg-white/15" />
              </div>
            ) : !isAuthenticated || inAuthPage ? (
              <button
                type="button"
                onClick={() => {
                  const redirect = pathname && pathname !== "/" ? pathname : "/";
                  openAuthModal({ mode: "login", redirectTo: redirect });
                }}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3.5 py-1.5 text-[11px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.65)] hover:brightness-110"
              >
                Entrar / Registar
              </button>
            ) : (
              <div className="relative flex items-center gap-2" ref={profileMenuRef}>
                {useNewNavbar && <NotificationBell />}
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-white/85 hover:bg-white/15"
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            aria-label="Abrir menu de conta"
          >
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224] text-[11px] font-bold text-white shadow-[0_0_22px_rgba(107,255,255,0.55)]">
                    <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
                    <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF00C8]/35 via-[#6BFFFF]/25 to-transparent animate-[spin_14s_linear_infinite]" />
                    <span className="relative z-10 flex h-full w-full items-center justify-center bg-gradient-to-r from-[#FF9CF2] to-[#6BFFFF] bg-clip-text text-transparent">
                      {userInitial}
                    </span>
                  </div>
                  <span className="hidden max-w-[120px] truncate text-[11px] sm:inline">
                    {userLabel || "Conta ORYA"}
                  </span>
                </button>

                {isProfileMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-2xl border border-white/14 bg-black/85 p-2 text-[11px] text-white/80 shadow-[0_22px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
                    role="menu"
                    aria-label="Menu de conta ORYA"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        router.push("/me");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/8"
                    >
                      <span>A minha conta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        router.push("/me/tickets");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/8"
                    >
                      <span>Os meus bilhetes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        router.push("/me/compras");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/8"
                    >
                      <span>Minhas compras</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        router.push("/me/settings");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/8"
                    >
                      <span>Definições</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        router.push("/me/experiencias");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/8"
                    >
                      <span>Minhas experiências</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        router.push("/organizador");
                      }}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/8"
                    >
                      <span>{isOrganizer ? "Dashboard de organizador" : "Tornar-me organizador"}</span>
                      {!isOrganizer && (
                        <span className="text-[10px] text-[#FFCC66]">
                          Em breve
                        </span>
                      )}
                    </button>
                    <div className="my-1 h-px w-full bg-white/10" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-left text-red-100 hover:bg-white/15"
                    >
                      Terminar sessão
                    </button>
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
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-2xl"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSearchOpen(false);
            }
          }}
        >
          <div className="mx-auto mt-20 max-w-3xl px-4">
            <div
              className="rounded-3xl border border-white/18 bg-[#050915]/90 p-4 shadow-[0_32px_90px_rgba(0,0,0,0.9)]"
              aria-label="Pesquisa de eventos ORYA"
            >
              <form
                onSubmit={handleSubmitSearch}
                className="flex items-center gap-3 rounded-2xl border border-white/20 bg-black/60 px-4 py-2.5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-[12px] text-white/80">
                  ⌕
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="O que queres fazer hoje?"
                  className="flex-1 bg-transparent text-base text-white placeholder:text-white/45 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[11px] text-white/60 hover:text-white"
                >
                  Fechar
                </button>
              </form>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="md:col-span-3 rounded-2xl border border-white/8 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <span>Resultados</span>
                    {isSuggestLoading && <span className="animate-pulse text-white/50">a carregar…</span>}
                  </div>
                  <div className="mt-2 space-y-2">
                  {suggestions.length === 0 && !isSuggestLoading && (
                    <p className="text-[11px] text-white/55">
                      Começa a escrever para ver eventos, locais e cidades.
                    </p>
                  )}
                  {suggestions.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                          router.push(buildSlug(item));
                        }}
                        className="w-full rounded-xl border border-white/8 bg-black/50 p-2.5 text-left hover:border-white/20 hover:bg-white/5 transition flex gap-3"
                      >
                        <div className="h-14 w-14 overflow-hidden rounded-lg bg-gradient-to-br from-[#111827]/70 to-[#0f172a]/60">
                          {item.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.coverImageUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-white line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-white/65 line-clamp-1">
                            {item.locationName || item.locationCity || "Local a anunciar"}
                          </p>
                          <p className="text-[10px] text-white/55">
                            {item.startsAt
                              ? new Date(item.startsAt).toLocaleString("pt-PT", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Data a anunciar"}
                          </p>
                        </div>
                        <span className="self-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                          {item.type === "EXPERIENCE" ? "Experiência" : "Evento"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {hasMounted && (
        <MobileBottomNav
          pathname={pathname || ""}
          isSearchOpen={isSearchOpen}
          onOpenSearch={() => setIsSearchOpen(true)}
          onCloseSearch={() => setIsSearchOpen(false)}
        />
      )}
    </>
  );
}
