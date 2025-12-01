// app/me/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import { useUser } from "@/app/hooks/useUser";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";


type UserTicket = {
  id: string;
  qrToken: string;
  eventId: number;
  eventSlug: string;
  eventTitle: string;
  eventStartDate: string;
  eventLocationName: string | null;
  eventCoverImageUrl: string | null;
  ticketName: string;
  quantity: number;
  pricePaid: number; // em cêntimos
  currency: string;
  createdAt: string; // data de compra
};

type TicketsApiResponse =
  | {
      tickets: UserTicket[];
    }
  | {
      error: string;
    };


function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function MePage() {
  const { user, profile, isLoading: meLoading, error: meError } = useUser();

  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>([]);

  const isAdmin = Array.isArray(profile?.roles) && profile.roles.includes("admin");

  useEffect(() => {
    const fetchTickets = async () => {
      setTicketsLoading(true);
      setTicketsError(null);

      try {
        const res = await fetch("/api/me/tickets", {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401) {
            setTicketsError(
              "Precisas de iniciar sessão para ver os teus bilhetes.",
            );
            setTickets([]);
            return;
          }

          const text = await res.text();
          console.error("Erro /api/me/tickets:", text);
          setTicketsError("Erro ao carregar os teus bilhetes.");
          return;
        }

        const data: TicketsApiResponse = await res.json();

        if ("error" in data) {
          setTicketsError("Erro ao carregar os teus bilhetes.");
          return;
        }

        setTickets(data.tickets ?? []);
      } catch (err) {
        console.error("Erro inesperado em /api/me/tickets:", err);
        setTicketsError("Erro inesperado ao carregar os teus bilhetes.");
      } finally {
        setTicketsLoading(false);
      }
    };

    fetchTickets();
  }, []);

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
    const d = parseDate(t.eventStartDate);
    return d !== null && d.getTime() >= now.getTime();
  });

  const pastTickets = tickets.filter((t) => {
    const d = parseDate(t.eventStartDate);
    return d !== null && d.getTime() < now.getTime();
  });

  const totalEvents = tickets.length;
  const totalUpcoming = upcomingTickets.length;
  const totalPast = pastTickets.length;

  const totalSpentCents = tickets.reduce(
    (sum, t) => sum + (t.pricePaid || 0),
    0,
  );
  const totalSpentEuros = (totalSpentCents / 100).toFixed(2);

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
  const hasActivity = !ticketsLoading && tickets.length > 0;

  // Bilhetes mais recentes para preview no perfil (3–4)
  const sortedTickets = [...tickets].sort((a, b) => {
    const da = parseDate(a.eventStartDate) ?? parseDate(a.createdAt);
    const db = parseDate(b.eventStartDate) ?? parseDate(b.createdAt);

    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;

    return db.getTime() - da.getTime();
  });

  const recentTickets = sortedTickets.slice(0, 3);

  // New: ProfileHeader props
  const profileHeaderProps = {
    user,
    profile,
    displayName,
    displayInitial,
    meLoading,
    meError,
    levelLabel,
    levelDescription,
    isOwner: true,
    name: profile?.fullName ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    createdAt: profile?.id ? undefined : undefined,
  };

  return (
    <main className="orya-body-bg text-white" aria-labelledby="me-page-title">
      <h1 id="me-page-title" className="sr-only">
        A minha conta
      </h1>
      <section className="max-w-5xl mx-auto px-5 py-8 md:py-10 space-y-6">
        <div className="min-h-[180px]">
          {meLoading ? (
            <div className="space-y-3 h-full">
              <div className="h-20 rounded-3xl border border-white/10 bg-white/5 animate-pulse blur-[0.2px]" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded-2xl border border-white/8 bg-white/5 animate-pulse blur-[0.3px]"
                  />
                ))}
              </div>
            </div>
          ) : (
            <ProfileHeader {...profileHeaderProps} />
          )}
        </div>

        {/* STATS COMPACTO */}
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0f172a]/70 via-[#020617]/60 to-black/70 backdrop-blur-2xl p-6 shadow-[0_24px_70px_rgba(0,0,0,0.85)] min-h-[240px]">
          <div className="grid grid-cols-1 gap-3 text-[11px] md:grid-cols-4 md:gap-4">
            <div className="rounded-2xl border border-white/18 bg-white/[0.02] px-4 py-3 min-h-[96px]">
              <p className="text-white/55">Eventos com bilhete</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {totalEvents}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">
                Toda a tua timeline ORYA.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 min-h-[96px]">
              <p className="text-emerald-100/80">Próximos eventos</p>
              <p className="mt-1 text-lg font-semibold text-emerald-100">
                {totalUpcoming}
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-100/80">
                O que ainda vem aí.
              </p>
            </div>
            <div className="rounded-2xl border border-white/18 bg-white/[0.02] px-4 py-3 min-h-[96px]">
              <p className="text-white/55">Eventos já vividos</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {totalPast}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">
                Memórias que já fazem parte da tua história.
              </p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-3 min-h-[96px]">
              <p className="text-fuchsia-100/85">Total investido</p>
              <p className="mt-1 text-lg font-semibold text-fuchsia-100">
                {totalSpentEuros} €
              </p>
              <p className="mt-0.5 text-[10px] text-fuchsia-100/80">
                Em ser a pessoa que não fica em casa.
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/65 min-h-[32px]">{levelDescription}</p>
        </div>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)] gap-6">
          {/* RESUMO PERFIL */}
          <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-slate-950/85 to-slate-950 backdrop-blur-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white/90">
              Detalhes da conta
            </h2>

            <div className="space-y-2 text-[11px] text-white/75 min-h-[120px]">
              {!profile?.username && (
                <div className="mt-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                  Ainda não escolheste um @username. Define um para ativares o teu perfil público.
                </div>
              )}

              {isAdmin && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Área de staff</span>
                  <Link
                    href="/staff/eventos"
                    className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 transition-colors"
                  >
                    Entrar como staff
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Nome</span>
                <span className="font-medium text-white/85">
                  {profile?.fullName ?? "Ainda não definido"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Cidade</span>
                <span className="font-medium text-white/85">
                  {profile?.city ?? "Sem cidade definida"}
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-white/55">
              Em breve vais poder escolher interesses, tipos de eventos
              favoritos e muito mais, para que a ORYA se adapte cada vez mais a
              ti.
            </p>
          </section>

          {/* BILHETES */}
          <section className="rounded-2xl border border-[#6BFFFF]/30 bg-gradient-to-br from-[#020617f2] via-slate-950 to-slate-950 backdrop-blur-xl p-5 space-y-4 shadow-[0_16px_40px_rgba(15,23,42,0.7)] min-h-[320px]">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-white/95">
                  Os meus bilhetes
                </h2>
                <p className="text-[11px] text-white/65">
                  Tudo o que já reservaste na ORYA. Próximos eventos à frente,
                  memórias logo atrás.
                </p>
              </div>
              <Link
                href="/me/tickets"
                className="inline-flex items-center gap-1 rounded-full bg-white text-black text-[11px] font-semibold px-3.5 py-1.5 shadow-[0_0_18px_rgba(255,255,255,0.3)] hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Ver todos os bilhetes
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
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2.5 text-[11px] text-red-50">
                {ticketsError}
              </div>
            )}

            {!ticketsLoading && !ticketsError && tickets.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a]/70 via-[#020617]/60 to-black/70 backdrop-blur-2xl p-8 text-center flex flex-col items-center gap-4 shadow-[0_28px_80px_rgba(15,23,42,0.95)]">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] flex items-center justify-center shadow-[0_0_35px_rgba(107,255,255,0.5)] text-black text-3xl font-bold">
                  🎟️
                </div>
                <h3 className="text-lg font-semibold text-white/95">Ainda não tens bilhetes ORYA</h3>
                <p className="text-[12px] text-white/70 max-w-sm">
                  A tua jornada na ORYA começa aqui. Explora eventos, música, festas e experiências novas — e guarda os teus bilhetes com estilo.
                </p>
                <Link
                  href="/explorar"
                  className="inline-flex mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black shadow-[0_0_28px_rgba(107,255,255,0.5)] hover:scale-[1.05] active:scale-95 transition-transform"
                >
                  Explorar eventos
                </Link>
              </div>
            )}

            {!ticketsLoading && !ticketsError && tickets.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] text-white/60">
                  Últimos bilhetes comprados. Em breve vais conseguir ver aqui a tua timeline completa de eventos.
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5">
                  {recentTickets.map((t) => {
                    const eventDate = parseDate(t.eventStartDate) ?? parseDate(t.createdAt);
                    const dateLabel = eventDate
                      ? eventDate.toLocaleString("pt-PT", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Data a anunciar";

                    const quantityLabel = t.quantity > 1 ? `${t.quantity} bilhetes` : "1 bilhete";
                    const totalEuros = (t.pricePaid / 100).toFixed(2);

                    return (
                      <article
                        key={t.id}
                        className="group flex min-w-[260px] max-w-[280px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] backdrop-blur-xl shadow-[0_16px_45px_rgba(0,0,0,0.85)]"
                      >
                        <div className="relative h-32 w-full overflow-hidden">
                          {t.eventCoverImageUrl ? (
                            <Image
                              src={optimizeImageUrl(t.eventCoverImageUrl, 600, 70)}
                              alt={t.eventTitle}
                              fill
                              sizes="(max-width: 640px) 90vw, 320px"
                              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              placeholder="blur"
                              blurDataURL={defaultBlurDataURL}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-semibold text-black/80">
                              Bilhete ORYA
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                          <div className="absolute inset-x-3 bottom-2 space-y-0.5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/65">
                              Bilhete ORYA
                            </p>
                            <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                              {t.eventTitle}
                            </h3>
                            <p className="text-[11px] text-white/80">
                              {dateLabel}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-[11px]">
                          <div className="space-y-0.5">
                            <p className="text-white/65">{quantityLabel}</p>
                            <p className="text-white font-medium">{totalEuros} €</p>
                            <span className="inline-flex mt-0.5 items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/75">
                              {t.ticketName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Image
                              src={`/api/qr/${t.qrToken}`}
                              alt="QR Code do bilhete ORYA"
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded-lg bg-black/20 p-1 object-cover"
                              sizes="48px"
                              placeholder="blur"
                              blurDataURL={defaultBlurDataURL}
                            />

                            <div>
                              <p className="text-white">{t.eventTitle}</p>
                              <p className="text-xs text-white/60">Wave {t.ticketName}</p>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
