"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useUser } from "@/app/hooks/useUser";
import Link from "next/link";
import { NotificationBell } from "./notifications/NotificationBell";
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [hydratedPathname, setHydratedPathname] = useState<string | null>(null);
  const [lastOrganizerUsername, setLastOrganizerUsername] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const pathname = hydratedPathname ?? "";
  const shouldHide = rawPathname?.startsWith("/organizador");

  const Logo = () => {
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

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("orya_last_organizer_username");
      if (stored) setLastOrganizerUsername(stored);
    } catch {
      // ignore storage issues
    }
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        } ${shouldHide ? "hidden" : ""}`}
      >
        <div className="relative flex w-full items-center gap-4 rounded-b-[28px] border-b border-white/10 bg-[linear-gradient(120deg,rgba(8,10,20,0.38),rgba(8,10,20,0.52))] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-[18px] transition-all duration-300 md:px-6 md:py-5 lg:px-8">
          {/* Logo + link explorar */}
          <div className="flex flex-1 items-center gap-3">
            <Logo />

            <nav className="hidden items-center gap-3 text-xs text-zinc-300 md:flex">
              <button
                type="button"
                onClick={() => router.push("/explorar")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  pathname?.startsWith("/explorar")
                    ? "bg-[linear-gradient(120deg,rgba(255,0,200,0.22),rgba(107,255,255,0.18))] text-white border border-white/30 shadow-[0_0_18px_rgba(107,255,255,0.35)]"
                    : "text-white/85 hover:text-white bg-white/5 border border-white/16 hover:border-white/26"
                }`}
              >
                Explorar
              </button>
              <button
                type="button"
                onClick={() => router.push("/organizador")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  pathname?.startsWith("/organizador")
                    ? "bg-[linear-gradient(120deg,rgba(107,255,255,0.18),rgba(22,70,245,0.22))] text-white border border-white/28 shadow-[0_0_18px_rgba(22,70,245,0.28)]"
                    : "text-white/85 hover:text-white bg-white/5 border border-white/16 hover:border-white/26"
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
              className="group relative flex w-full max-w-xl items-center gap-3 rounded-full border border-white/16 bg-[linear-gradient(120deg,rgba(255,0,200,0.1),rgba(107,255,255,0.1)),rgba(5,6,12,0.82)] px-4 py-2 text-left text-[13px] text-white hover:border-white/35 hover:shadow-[0_0_35px_rgba(107,255,255,0.28)] transition shadow-[0_26px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
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
            {/* Acesso rápido a Organizar no mobile */}
            <button
              type="button"
              onClick={() => router.push("/organizador")}
              className="inline-flex md:hidden items-center rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 hover:border-white/28 hover:bg-white/16 transition"
            >
              Organizar
            </button>
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
                <NotificationBell />
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-2.5 py-1 text-[11px] text-white/90 hover:border-white/28 hover:bg-white/12 shadow-[0_0_22px_rgba(255,0,200,0.22)] transition"
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  aria-label="Abrir menu de conta"
                >
                  <div className="relative h-9 w-9">
                    <div className="absolute inset-[-3px] rounded-full bg-[conic-gradient(from_180deg,#ff00c8_0deg,#ff5afc_120deg,#6b7bff_240deg,#ff00c8_360deg)] opacity-85 blur-[8px]" />
                    <div className="relative h-full w-full overflow-hidden rounded-full border border-white/20 bg-gradient-to-br from-[#0b0f1b] via-[#0f1222] to-[#0a0d18] text-[11px] font-bold text-white shadow-[0_0_22px_rgba(255,0,200,0.32)]">
                      <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
                      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF00C8]/35 via-[#6BFFFF]/22 to-transparent animate-[spin_16s_linear_infinite]" />
                      <span className="relative z-10 flex h-full w-full items-center justify-center bg-gradient-to-r from-[#FF9CF2] to-[#6BFFFF] bg-clip-text text-transparent">
                        {userInitial}
                      </span>
                    </div>
                  </div>
                  <span className="hidden max-w-[120px] truncate text-[11px] sm:inline">
                    {userLabel || "Conta ORYA"}
                  </span>
                </button>

                {isProfileMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-3 w-60 origin-top-right rounded-2xl border border-white/16 bg-[linear-gradient(135deg,rgba(3,4,10,0.97),rgba(8,10,18,0.98))] p-2 text-[11px] text-white/90 shadow-[0_28px_80px_rgba(0,0,0,0.88)] backdrop-blur-3xl"
                    role="menu"
                    aria-label="Menu de conta ORYA"
                  >
                    <Link
                      href="/me"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8"
                    >
                      <span className="font-semibold text-white">Minha conta</span>
                    </Link>
                    <Link
                      href="/me/carteira"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8"
                    >
                      <span>Carteira</span>
                    </Link>
                    <Link
                      href="/me/compras"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8"
                    >
                      <span>Compras</span>
                    </Link>
                    <Link
                      href="/me/settings"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8"
                    >
                      <span>Definições</span>
                    </Link>
                    {lastOrganizerUsername && (
                      <Link
                        href={`/o/${lastOrganizerUsername}`}
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8"
                      >
                        <span>Ver página pública</span>
                      </Link>
                    )}
                    {pathname?.startsWith("/organizador") && (
                      <Link
                        href="/me"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8"
                      >
                        <span>Voltar a utilizador</span>
                      </Link>
                    )}
                    {/* Dashboard de organizador removido do dropdown: já está acessível na nav */}
                    <div className="my-1 h-px w-full bg-white/10" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-left font-semibold text-red-100 hover:bg-white/15"
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
              className="fixed inset-0 z-40 bg-[radial-gradient(circle_at_10%_20%,rgba(255,0,200,0.07),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(107,255,255,0.08),transparent_30%),rgba(3,5,12,0.82)] backdrop-blur-[18px]"
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
              className="rounded-3xl border border-white/14 bg-[radial-gradient(circle_at_12%_0%,rgba(255,0,200,0.1),transparent_38%),radial-gradient(circle_at_88%_0%,rgba(107,255,255,0.12),transparent_34%),linear-gradient(120deg,rgba(6,10,22,0.94),rgba(8,10,20,0.9),rgba(6,9,16,0.94))] p-4 shadow-[0_32px_90px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
              aria-label="Pesquisa de eventos ORYA"
            >
              <form
                onSubmit={handleSubmitSearch}
                className="flex items-center gap-3 rounded-2xl border border-white/16 bg-[linear-gradient(120deg,rgba(255,0,200,0.08),rgba(107,255,255,0.08)),rgba(255,255,255,0.03)] px-4 py-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-[12px] text-white/80">
                  ⌕
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="O que queres fazer hoje?"
                  className="flex-1 bg-transparent text-base text-white placeholder:text-white/65 focus:outline-none"
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
                <div className="md:col-span-3 rounded-2xl border border-white/12 bg-[linear-gradient(140deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between text-[11px] text-white/75">
                    <span>Resultados</span>
                    {isSuggestLoading && <span className="animate-pulse text-white/65">a carregar…</span>}
                  </div>
                  <div className="mt-2 space-y-2">
                  {suggestions.length === 0 && !isSuggestLoading && (
                    <p className="text-[11px] text-white/70">
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
                        className="w-full rounded-xl border border-white/12 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(8,10,22,0.7))] p-2.5 text-left hover:border-white/20 hover:bg-white/8 transition flex gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
                      >
                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]">
                          {item.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.coverImageUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55">
                              ORYA
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-white line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-white/80 line-clamp-1">
                            {item.locationName || item.locationCity || "Local a anunciar"}
                          </p>
                          <p className="text-[10px] text-white/75">
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
                        <span className="self-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/85">
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
    </>
  );
}
