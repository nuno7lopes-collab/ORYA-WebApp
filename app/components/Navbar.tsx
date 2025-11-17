"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type UserProfile = Record<string, unknown>;

type MeResponse =
  | {
      success: true;
      user: { id: string; email?: string | null };
      profile: UserProfile;
    }
  | { success: false; error: string };

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [isVisible, setIsVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const lastScrollYRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const fetchMe = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!isMounted) return;

        if (res.status === 401) {
          setMe({ success: false, error: "Not authenticated" });
          return;
        }

        const data = (await res.json()) as MeResponse;
        setMe(data);
      } catch (err) {
        console.error("[Navbar] Erro a carregar /api/me", err);
        if (isMounted) {
          setMe({ success: false, error: "Erro ao carregar perfil" });
        }
      }
    };

    fetchMe();

    return () => {
      isMounted = false;
    };
  }, []);

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
        if (currentY > prevY + 8) {
          setIsVisible(false);
        } else if (currentY < prevY - 8) {
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
      setIsLoggingOut(true);
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (baseUrl && typeof window !== "undefined") {
        const redirect = `${window.location.origin}/`;
        const url = `${baseUrl}/auth/v1/logout?redirect_to=${encodeURIComponent(
          redirect,
        )}`;
        window.location.href = url;
        return;
      }

      // fallback: vai para /login se não houver env
      router.push("/login");
    } catch (err) {
      console.error("[Navbar] Erro ao terminar sessão", err);
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isAuthenticated = me?.success === true && !!me.user;
  const userEmail = isAuthenticated ? me.user.email ?? "" : "";
  const userInitial =
    userEmail?.trim().charAt(0).toUpperCase() || "O";

  const inAuthPage =
    pathname === "/login" || pathname === "/registar" || pathname === "/auth/callback";

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-250 ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div
          className={`flex w-full items-center gap-4 px-4 py-3 md:px-6 lg:px-8 ${
            isAtTop && !isSearchOpen
              ? "border-b border-white/5 bg-black/20 backdrop-blur-xl"
              : "border-b border-white/10 bg-black/40 backdrop-blur-2xl shadow-[0_16px_45px_rgba(15,23,42,0.9)]"
          }`}
        >
          {/* Logo + link explorar */}
          <div className="flex flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-black tracking-[0.2em] shadow-lg shadow-[#ff00c833]">
                OY
              </div>
              <span className="hidden text-sm font-semibold uppercase tracking-[0.22em] text-zinc-100 sm:inline">
                ORYA
              </span>
            </button>

            <nav className="hidden items-center gap-3 text-xs text-zinc-300 md:flex">
              <button
                type="button"
                onClick={() => router.push("/explorar")}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  pathname?.startsWith("/explorar")
                    ? "bg-white/10 text-white"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                Explorar eventos
              </button>
            </nav>
          </div>

          {/* Barra de pesquisa central */}
          <div className="flex flex-[1.2] justify-center">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="group flex w-full max-w-md items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-left text-xs text-white/70 hover:border-white/40 hover:bg-white/10 transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/30 text-[10px] text-white/70">
                ⌕
              </span>
              <span className="flex-1 truncate">
                Procura eventos, festas, concertos…
              </span>
              <span className="hidden rounded-full border border-white/20 px-2 py-0.5 text-[9px] text-white/50 md:inline">
                /explorar
              </span>
            </button>
          </div>

          {/* Lado direito: instalar app + auth/profile */}
          <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => {
                const target = document.getElementById("instalar-app");
                if (target) {
                  target.scrollIntoView({ behavior: "smooth", block: "start" });
                } else {
                  router.push("/#instalar-app");
                }
              }}
              className="hidden items-center gap-1 rounded-full border border-[#6BFFFF]/40 bg-[#020617]/80 px-3 py-1.5 text-[11px] font-medium text-[#D6FEFF] shadow-[0_0_20px_rgba(107,255,255,0.35)] hover:bg-[#020617] md:inline-flex"
            >
              <span className="text-[12px]">⬇</span>
              <span>Instalar app</span>
            </button>

            {!isAuthenticated || inAuthPage ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/login${
                      pathname && pathname !== "/"
                        ? `?redirect=${encodeURIComponent(pathname)}`
                        : ""
                    }`,
                  )
                }
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3.5 py-1.5 text-[11px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.65)] hover:brightness-110"
              >
                Entrar / Registar
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setIsProfileMenuOpen((open) => !open)
                  }
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-white/85 hover:bg-white/15"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-bold text-black shadow-[0_0_18px_rgba(107,255,255,0.7)]">
                    {userInitial}
                  </div>
                  <span className="hidden max-w-[120px] truncate text-[11px] sm:inline">
                    {userEmail || "Conta ORYA"}
                  </span>
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-white/14 bg-black/80 p-2 text-[11px] text-white/80 shadow-[0_18px_45px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
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
                        router.push("/me/bilhetes");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/8"
                    >
                      <span>Os meus bilhetes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        router.push("/organizador/candidatura");
                      }}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/8"
                    >
                      <span>Tornar-me organizador</span>
                      <span className="text-[10px] text-[#FFCC66]">
                        Em breve
                      </span>
                    </button>
                    <div className="my-1 h-px bg-white/10" />
                    <button
                      type="button"
                      disabled={isLoggingOut}
                      onClick={handleLogout}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                    >
                      <span>Terminar sessão</span>
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
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-2xl">
          <div className="mx-auto mt-20 max-w-2xl px-4">
            <div className="rounded-3xl border border-white/18 bg-[#020617]/90 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.95)]">
              <form
                onSubmit={handleSubmitSearch}
                className="flex items-center gap-3 rounded-2xl border border-white/20 bg-black/60 px-4 py-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-[12px] text-white/80">
                  ⌕
                </span>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="O que queres fazer hoje?"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/45 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[11px] text-white/60 hover:text-white"
                >
                  Fechar
                </button>
              </form>

              <div className="mt-4 text-[11px] text-white/60">
                <p className="mb-2 text-white/75">Sugestões populares</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickSearch("festas universitárias")}
                    className="rounded-full bg-white/8 px-3 py-1 hover:bg-white/12"
                  >
                    Festas universitárias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSearch("jogos de padel")}
                    className="rounded-full bg-white/8 px-3 py-1 hover:bg-white/12"
                  >
                    Jogos de padel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSearch("concertos hoje")}
                    className="rounded-full bg-white/8 px-3 py-1 hover:bg-white/12"
                  >
                    Concertos hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSearch("afterwork porto")}
                    className="rounded-full bg-white/8 px-3 py-1 hover:bg-white/12"
                  >
                    Afterwork no Porto
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}