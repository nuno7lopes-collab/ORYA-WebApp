"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import { useUser } from "@/app/hooks/useUser";
import { useWallet } from "@/app/components/wallet/useWallet";
import { WalletCard } from "@/app/components/wallet/WalletCard";

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function MePage() {
  const { user, profile, isLoading: meLoading } = useUser();
  const router = useRouter();
  const {
    items: tickets,
    loading: ticketsLoading,
    error: ticketsError,
    authRequired,
    refetch: refetchWallet,
  } = useWallet();

  const isAdmin = Array.isArray(profile?.roles) && profile.roles.includes("admin");

  // Redireciona quando já tem username ou força login
  useEffect(() => {
    if (meLoading) return;
    if (!user) {
      router.replace("/login?redirectTo=/me");
      return;
    }
    if (profile?.username) {
      router.replace(`/${profile.username}`);
    }
  }, [meLoading, user, profile?.username, router]);

  // Refetch carteira ao voltar ao foco
  useEffect(() => {
    const onFocus = () => {
      if (user) refetchWallet();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, refetchWallet]);

  const displayName =
    profile?.fullName ||
    profile?.username ||
    user?.email?.split("@")[0] ||
    "Utilizador ORYA";

  const displayInitial =
    (profile?.fullName || profile?.username || user?.email || "O")
      .trim()
      .charAt(0)
      .toUpperCase() || "O";

  const now = new Date();

  const upcomingTickets = tickets.filter((t) => {
    const d = parseDate(t.snapshot.startAt);
    return d !== null && d.getTime() >= now.getTime();
  });

  const pastTickets = tickets.filter((t) => {
    const d = parseDate(t.snapshot.startAt);
    return d !== null && d.getTime() < now.getTime();
  });

  const totalEvents = tickets.length;
  const totalUpcoming = upcomingTickets.length;
  const totalPast = pastTickets.length;

  const totalSpentEuros = "—";

  let levelLabel = "Explorador ORYA";
  let levelDescription =
    "Começo perfeito. Em breve vais desbloquear novas badges com mais eventos.";

  if (totalEvents >= 10) {
    levelLabel = "Lenda dos eventos";
    levelDescription =
      "Já estás em modo ORYA total. Continuar assim e vamos ter de inventar um nível novo só para ti.";
  } else if (totalEvents >= 5) {
    levelLabel = "Insider da noite";
    levelDescription =
      "Já és cliente recorrente. Os melhores spots da tua cidade começam a ser a tua segunda casa.";
  } else if (totalEvents >= 1) {
    levelLabel = "Primeiros passos";
    levelDescription =
      "Já tens os teus primeiros bilhetes ORYA. Bora continuar a construir a tua timeline.";
  }

  const sortedTickets = useMemo(
    () =>
      [...tickets].sort((a, b) => {
        const d1 = parseDate(a.snapshot.startAt)?.getTime() ?? 0;
        const d2 = parseDate(b.snapshot.startAt)?.getTime() ?? 0;
        return d2 - d1;
      }),
    [tickets],
  );

  const recentTickets = sortedTickets.slice(0, 4);

  const redirectingToProfile = !meLoading && user && profile?.username;
  const needsUsername = !meLoading && user && !profile?.username;
  const isLoggedOut = !meLoading && !user;

  let content: JSX.Element = (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <ProfileHeader
        displayName={displayName}
        handle={profile?.username || user?.email || "user"}
        avatarUrl={profile?.avatarUrl}
        stats={{
          totalEvents,
          totalUpcoming,
          totalPast,
          totalSpentEuros,
        }}
        levelLabel={levelLabel}
        levelDescription={levelDescription}
        isLoading={meLoading}
        isAdmin={isAdmin}
        city={profile?.city}
        visibility={profile?.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC"}
        followers={null}
        following={null}
        isOwner
      />

      {/* STATUS */}
      <section className="rounded-3xl border border-white/12 bg-gradient-to-r from-white/6 via-[#0f1424]/35 to-white/6 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-3xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/14 bg-gradient-to-br from-white/10 via-[#0b1224]/75 to-[#0a0f1d] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.55)] transition-transform duration-150 hover:-translate-y-[3px] hover:shadow-[0_22px_50px_rgba(0,0,0,0.65)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 mix-blend-screen" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-white/5 blur-2xl" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">Eventos com bilhete</p>
            <p className="mt-1 text-3xl font-semibold text-white">{totalEvents}</p>
            <p className="text-[12px] text-white/60">Timeline ORYA.</p>
          </div>

          <div className="rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-500/16 via-emerald-500/9 to-[#0c1a14] p-4 shadow-[0_18px_40px_rgba(16,185,129,0.28)] transition-transform duration-150 hover:-translate-y-[3px] hover:shadow-[0_22px_50px_rgba(16,185,129,0.32)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-emerald-100/12 mix-blend-screen" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-emerald-100/10 blur-2xl" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-50/80">Próximos</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-50">{totalUpcoming}</p>
            <p className="text-[12px] text-emerald-50/80">O que vem aí.</p>
          </div>

          <div className="rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-500/16 via-cyan-500/9 to-[#08171c] p-4 shadow-[0_18px_40px_rgba(34,211,238,0.28)] transition-transform duration-150 hover:-translate-y-[3px] hover:shadow-[0_22px_50px_rgba(34,211,238,0.32)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-100/12 mix-blend-screen" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-cyan-100/10 blur-2xl" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-50/80">Passados</p>
            <p className="mt-1 text-3xl font-semibold text-cyan-50">{totalPast}</p>
            <p className="text-[12px] text-cyan-50/80">Memórias.</p>
          </div>

          <div className="rounded-2xl border border-purple-300/30 bg-gradient-to-br from-purple-500/16 via-purple-500/9 to-[#120d1f] p-4 shadow-[0_18px_40px_rgba(168,85,247,0.28)] transition-transform duration-150 hover:-translate-y-[3px] hover:shadow-[0_22px_50px_rgba(168,85,247,0.32)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-purple-100/12 mix-blend-screen" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-purple-100/10 blur-2xl" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-purple-50/80">Total investido</p>
            <p className="mt-1 text-3xl font-semibold text-purple-50">{totalSpentEuros} €</p>
            <p className="text-[12px] text-purple-50/80">Bruto - taxas.</p>
          </div>
        </div>
      </section>

      {/* CARTEIRA */}
      <section className="rounded-3xl border border-[#6BFFFF]/22 bg-gradient-to-br from-[#030816f2] via-[#050a18] to-[#05060f] backdrop-blur-2xl p-5 space-y-4 shadow-[0_26px_78px_rgba(5,6,16,0.62)] min-h-[320px] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.03),transparent_34%),radial-gradient(circle_at_50%_85%,rgba(255,255,255,0.03),transparent_40%)]" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">Carteira ORYA</h2>
            <p className="text-[11px] text-white/68">
              Entitlements ativos primeiro; memórias logo atrás. Tudo num só lugar, pronto a usar.
            </p>
          </div>
          <Link
            href="/me/carteira"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur"
          >
            Ver carteira
            <span className="text-[12px]">↗</span>
          </Link>
        </div>

        {ticketsLoading && (
          <div className="space-y-2">
            <div className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
            <div className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          </div>
        )}

        {!ticketsLoading && ticketsError && (
          <div className="rounded-3xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-[12px] text-red-50 flex flex-col gap-2">
            <div>{ticketsError}</div>
            <div className="flex gap-2 flex-wrap">
              {!authRequired && (
                <button
                  onClick={refetchWallet}
                  className="px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-semibold shadow"
                >
                  Tentar novamente
                </button>
              )}
              {authRequired ? (
                <Link
                  href="/login?redirectTo=/me"
                  className="px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-semibold shadow"
                >
                  Iniciar sessão
                </Link>
              ) : (
                <Link
                  href="/explorar"
                  className="px-3 py-1.5 rounded-lg border border-white/30 text-[11px] text-white hover:bg-white/10"
                >
                  Explorar eventos
                </Link>
              )}
            </div>
          </div>
        )}

        {!ticketsLoading && !ticketsError && tickets.length === 0 && (
          <div className="rounded-3xl border border-white/14 bg-white/4 backdrop-blur-2xl p-10 text-center flex flex-col items-center gap-5 shadow-[0_32px_90px_rgba(5,6,16,0.82)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.06),transparent_42%),radial-gradient(circle_at_82%_12%,rgba(255,255,255,0.05),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(255,255,255,0.05),transparent_45%)]" />
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-2xl bg-white/12 blur-2xl" />
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-white/10 via-white/6 to-white/10 border border-white/18 shadow-[0_0_32px_rgba(255,255,255,0.28)] flex items-center justify-center text-2xl text-white">
                🎟️
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white/95">Ainda não tens bilhetes ORYA</h3>
              <p className="text-[12px] text-white/70 max-w-sm">
                Compra o teu primeiro bilhete e ele aparece aqui com QR pronto a usar.
              </p>
            </div>
            <div className="relative flex gap-2 flex-wrap justify-center">
              <Link
                href="/explorar"
                className="inline-flex mt-2 px-4 py-2.5 rounded-full bg-white text-black text-xs font-semibold shadow-[0_10px_35px_rgba(255,255,255,0.2)] hover:scale-[1.03] active:scale-95 transition-transform"
              >
                Explorar eventos
              </Link>
              <Link
                href="/me/carteira"
                className="inline-flex mt-2 px-4 py-2.5 rounded-full border border-white/28 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 shadow-[0_0_16px_rgba(255,255,255,0.1)]"
              >
                Ver carteira
              </Link>
            </div>
          </div>
        )}

        {!ticketsLoading && !ticketsError && tickets.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] text-white/60">
              Últimos entitlements. Snapshot + status. QR só quando permitido.
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5">
              {recentTickets.map((t) => (
                <WalletCard key={t.entitlementId} item={t} compact />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );

  if (redirectingToProfile) {
    content = (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="rounded-3xl border border-white/12 bg-white/5 px-6 py-4 text-sm text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          A redirecionar para @{profile?.username}…
        </div>
      </div>
    );
  } else if (needsUsername) {
    content = (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl space-y-3 text-center">
          <h1 className="text-xl font-semibold">Escolhe o teu username</h1>
          <p className="text-sm text-white/70">
            Define um @username para poderes ter o teu perfil público. Depois disso, /me passa a
            apontar para o teu perfil.
          </p>
          <div className="flex justify-center">
            <Link
              href="/onboarding/perfil"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:border-white/30 hover:bg-white/15"
            >
              Definir username
            </Link>
          </div>
        </div>
      </div>
    );
  } else if (isLoggedOut) {
    content = (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/[0.02] p-8 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Entra para veres a tua conta</h1>
          <p className="text-sm text-white/70">
            Autentica-te para veres a tua carteira, histórico e bilhetes. O QR e ações só aparecem depois de iniciares sessão.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/login?redirectTo=/me"
              className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold shadow-[0_0_22px_rgba(255,255,255,0.4)]"
            >
              Entrar
            </Link>
            <Link
              href="/login?mode=signup&redirectTo=/me"
              className="px-4 py-2.5 rounded-xl border border-white/25 text-sm font-semibold text-white hover:bg-white/10"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_18%,rgba(255,0,200,0.06),transparent_38%),radial-gradient(circle_at_88%_12%,rgba(107,255,255,0.06),transparent_32%),radial-gradient(circle_at_42%_78%,rgba(22,70,245,0.06),transparent_38%),linear-gradient(135deg,#050611_0%,#040812_60%,#05060f_100%)] text-white">
      {content}
    </main>
  );
}
