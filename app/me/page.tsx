"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import { useUser } from "@/app/hooks/useUser";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";
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
  const {
    items: tickets,
    loading: ticketsLoading,
    error: ticketsError,
    authRequired,
    refetch: refetchWallet,
  } = useWallet();

  const isAdmin = Array.isArray(profile?.roles) && profile.roles.includes("admin");

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

  if (!user && !meLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex items-center justify-center px-4">
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
      </main>
    );
  }

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

  const hasTickets = !ticketsLoading && tickets.length > 0;
  const hasActivity = hasTickets;

  // Bilhetes mais recentes para preview no perfil (3–4)
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
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
        />

        {/* STATUS */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0f172a] via-slate-950 to-slate-950 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                Eventos com bilhete
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">{totalEvents}</p>
              <p className="text-[12px] text-white/60">Timeline ORYA.</p>
            </div>

            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-50/80">
                Próximos
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-50">{totalUpcoming}</p>
              <p className="text-[12px] text-emerald-50/80">O que vem aí.</p>
            </div>

            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-50/80">
                Passados
              </p>
              <p className="mt-1 text-2xl font-semibold text-cyan-50">{totalPast}</p>
              <p className="text-[12px] text-cyan-50/80">Memórias.</p>
            </div>

            <div className="rounded-xl border border-purple-400/25 bg-purple-500/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-purple-50/80">
                Total investido
              </p>
              <p className="mt-1 text-2xl font-semibold text-purple-50">{totalSpentEuros} €</p>
              <p className="text-[12px] text-purple-50/80">Bruto - taxas.</p>
            </div>
          </div>
        </section>

        {/* BILHETES */}
        <section className="rounded-2xl border border-[#6BFFFF]/30 bg-gradient-to-br from-[#020617f2] via-slate-950 to-slate-950 backdrop-blur-xl p-5 space-y-4 shadow-[0_16px_40px_rgba(15,23,42,0.7)] min-h-[320px]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-white/95">Os meus bilhetes</h2>
              <p className="text-[11px] text-white/65">
                Entitlements ativos primeiro; memórias logo atrás. Carteira ligada à nova API.
              </p>
            </div>
            <Link
              href="/me/carteira"
              className="inline-flex items-center gap-1 rounded-full bg-white text-black text-[11px] font-semibold px-3.5 py-1.5 shadow-[0_0_18px_rgba(255,255,255,0.3)] hover:scale-[1.02] active:scale-95 transition-transform"
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
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a]/70 via-[#020617]/60 to-black/70 backdrop-blur-2xl p-8 text-center flex flex-col items-center gap-4 shadow-[0_28px_80px_rgba(15,23,42,0.95)]">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] flex items-center justify-center shadow-[0_0_35px_rgba(107,255,255,0.5)] text-black text-3xl font-bold">
                🎟️
              </div>
              <h3 className="text-lg font-semibold text-white/95">Ainda não tens bilhetes ORYA</h3>
              <p className="text-[12px] text-white/70 max-w-sm">
                Compra o teu primeiro bilhete e ele aparece aqui com QR pronto a usar.
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                <Link
                  href="/explorar"
                  className="inline-flex mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black shadow-[0_0_28px_rgba(107,255,255,0.5)] hover:scale-[1.05] active:scale-95 transition-transform"
                >
                  Explorar eventos
                </Link>
                <Link
                  href="/me/carteira"
                  className="inline-flex mt-2 px-4 py-2.5 rounded-xl border border-white/30 text-xs font-semibold text-white hover:bg-white/10"
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
      </section>
    </main>
  );
}
