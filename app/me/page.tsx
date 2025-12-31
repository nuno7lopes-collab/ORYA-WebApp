"use client";

import { useEffect, useMemo, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import { useUser } from "@/app/hooks/useUser";
import { useWallet } from "@/app/components/wallet/useWallet";
import { WalletCard } from "@/app/components/wallet/WalletCard";
import useSWR from "swr";

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatAgendaDate(value?: string | null) {
  if (!value) return "Data a anunciar";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data a anunciar";
  return parsed.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
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
  const { startIso, endIso } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 30);
    end.setHours(23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, []);

  const agendaUrl = user ? `/api/me/agenda?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}` : null;
  const { data: agendaData } = useSWR<{ ok: boolean; items?: Array<{ id: string; type: string; title: string; startAt: string; label?: string | null; ctaHref?: string | null }> }>(
    agendaUrl,
    fetcher,
  );
  const { data: orgsData } = useSWR<{ ok: boolean; items?: Array<{ organizerId: number; role: string; organizer: { publicName: string | null; businessName: string | null; username: string | null; organizationCategory: string | null } }> }>(
    user ? "/api/organizador/organizations" : null,
    fetcher,
  );

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

  const now = new Date();
  const agendaItems = agendaData?.items ?? [];
  const upcomingEvents = agendaItems.filter((item) => item.type === "EVENTO").slice(0, 3);
  const upcomingBookings = agendaItems.filter((item) => item.type === "RESERVA").slice(0, 3);
  const padelItems = agendaItems
    .filter((item) => item.type === "JOGO" || item.type === "INSCRICAO")
    .slice(0, 3);
  const organizations = orgsData?.items ?? [];

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

  let content: ReactElement = (
    <div className="orya-page-width flex flex-col gap-6 px-4 py-8">
      <ProfileHeader
        name={displayName}
        username={profile?.username || user?.email || "user"}
        avatarUrl={profile?.avatarUrl}
        avatarUpdatedAt={profile?.updatedAt ?? null}
        city={profile?.city}
        visibility={profile?.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE"}
        followers={null}
        following={null}
        isVerified={profile?.isVerified ?? false}
        isOwner
      />

      {/* STATUS */}
      <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
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
            <p className="text-[12px] text-purple-50/80">Total pago.</p>
          </div>
        </div>
      </section>

      {/* CARTEIRA */}
      <section className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-2xl p-5 space-y-4 shadow-[0_26px_78px_rgba(5,6,16,0.62)] min-h-[320px] relative overflow-hidden">
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
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:border-white/45 hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur"
          >
            Ver carteira
            <span className="text-[12px]">↗</span>
          </Link>
        </div>

        {ticketsLoading && (
          <div className="space-y-2">
            <div className="h-24 rounded-xl orya-skeleton-surface border border-white/15 animate-pulse" />
            <div className="h-24 rounded-xl orya-skeleton-surface border border-white/15 animate-pulse" />
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
          <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-2xl p-10 text-center flex flex-col items-center gap-5 shadow-[0_32px_90px_rgba(5,6,16,0.82)] relative overflow-hidden">
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
                className="inline-flex mt-2 px-4 py-2.5 rounded-full border border-white/30 bg-white/10 text-xs font-semibold text-white hover:border-white/45 hover:bg-white/20 shadow-[0_0_16px_rgba(255,255,255,0.1)]"
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

      {/* PROXIMOS */}
      <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">Proximos</h2>
            <p className="text-[11px] text-white/68">Tudo o que vem ai nas proximas semanas.</p>
          </div>
          <Link
            href="/me"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:border-white/45 hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur"
          >
            Ver agenda
            <span className="text-[12px]">↗</span>
          </Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Eventos</p>
            <div className="mt-3 space-y-2">
              {upcomingEvents.length === 0 && <p className="text-[12px] text-white/60">Sem eventos marcados.</p>}
              {upcomingEvents.map((item) => (
                <Link
                  key={item.id}
                  href={item.ctaHref ?? "/me/compras"}
                  className="block rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-[12px] text-white/60">
                    {formatAgendaDate(item.startAt)} · {item.label ?? "Evento"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Reservas</p>
            <div className="mt-3 space-y-2">
              {upcomingBookings.length === 0 && <p className="text-[12px] text-white/60">Sem reservas marcadas.</p>}
              {upcomingBookings.map((item) => (
                <Link
                  key={item.id}
                  href={item.ctaHref ?? "/me/reservas"}
                  className="block rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-[12px] text-white/60">
                    {formatAgendaDate(item.startAt)} · {item.label ?? "Reserva"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Padel</p>
            <div className="mt-3 space-y-2">
              {padelItems.length === 0 && <p className="text-[12px] text-white/60">Sem jogos pendentes.</p>}
              {padelItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.ctaHref ?? "/padel/duplas"}
                  className="block rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-[12px] text-white/60">
                    {formatAgendaDate(item.startAt)} · {item.label ?? "Padel"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RESERVAS */}
      <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">Reservas</h2>
            <p className="text-[11px] text-white/68">
              Consulta horários marcados e gere cancelamentos.
            </p>
          </div>
          <Link
            href="/me/reservas"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:border-white/45 hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur"
          >
            Ver reservas
            <span className="text-[12px]">↗</span>
          </Link>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/70">
          Todas as reservas confirmadas ou pendentes aparecem na tua área pessoal.
        </div>
      </section>

      {/* ORGANIZACOES */}
      <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">As minhas organizacoes</h2>
            <p className="text-[11px] text-white/68">Entra rapido no modo organizador.</p>
          </div>
          <Link
            href="/organizador"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:border-white/45 hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur"
          >
            Ver painel
            <span className="text-[12px]">↗</span>
          </Link>
        </div>

        {organizations.length === 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/70">
            Ainda nao tens organizacoes associadas.
          </div>
        )}

        {organizations.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {organizations.map((org) => {
              const name =
                org.organizer.publicName ||
                org.organizer.businessName ||
                org.organizer.username ||
                "Organizacao";
              return (
                <Link
                  key={org.organizerId}
                  href={`/organizador?tab=overview&org=${org.organizerId}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/25 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-white">{name}</p>
                  <p className="text-[12px] text-white/60">
                    {org.organizer.username ? `@${org.organizer.username}` : ""}
                  </p>
                  <p className="text-[11px] text-white/50">Role: {org.role}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

  if (redirectingToProfile) {
    content = (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-4 text-sm text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          A redirecionar para @{profile?.username}…
        </div>
      </div>
    );
  } else if (needsUsername) {
    content = (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl space-y-3 text-center">
          <h1 className="text-xl font-semibold">Escolhe o teu username</h1>
          <p className="text-sm text-white/70">
            Define um @username para poderes ter o teu perfil público. Depois disso, /me passa a
            apontar para o teu perfil.
          </p>
          <div className="flex justify-center">
            <Link
              href="/onboarding/perfil"
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:border-white/45 hover:bg-white/20"
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
        <div className="max-w-lg w-full rounded-3xl border border-white/15 bg-white/5 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Entra para veres a tua conta</h1>
          <p className="text-sm text-white/70">
            Autentica-te para veres a tua carteira, histórico e bilhetes. O QR e ações só aparecem depois de iniciares sessão.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/login?redirectTo=/me"
              className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:shadow-[0_22px_55px_rgba(255,255,255,0.25)]"
            >
              Entrar
            </Link>
            <Link
              href="/login?mode=signup&redirectTo=/me"
              className="px-4 py-2.5 rounded-xl border border-white/30 bg-white/10 text-sm font-semibold text-white hover:border-white/45 hover:bg-white/20"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      {content}
    </main>
  );
}
