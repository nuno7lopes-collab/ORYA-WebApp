// app/me/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SupabaseUser = {
  id: string;
  email?: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  city: string | null;
  avatar_url: string | null;
  phoneNumber?: string | null;
  phoneConfirmed?: boolean | null;
  role?: "user" | "organizer" | null;
};

type MeApiResponse =
  | {
      success: true;
      user: SupabaseUser;
      profile: Profile | null;
    }
  | {
      success: false;
      error: string;
    };

type UserTicket = {
  id: string;
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
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>([]);

  useEffect(() => {
    const fetchMe = async () => {
      setMeLoading(true);
      setMeError(null);

      try {
        const res = await fetch("/api/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401) {
            setMeError("Precisas de iniciar sessão para ver a tua conta.");
            setUser(null);
            setProfile(null);
            return;
          }

          const text = await res.text();
          console.error("Erro /api/me:", text);
          setMeError("Erro ao carregar os teus dados. Tenta novamente.");
          return;
        }

        const data: MeApiResponse = await res.json();

        if (!("success" in data) || !data.success) {
          setMeError("Erro ao carregar os teus dados. Tenta novamente.");
          return;
        }

        setUser(data.user);
        setProfile(data.profile ?? null);
      } catch (err) {
        console.error("Erro inesperado em /api/me:", err);
        setMeError("Erro inesperado ao carregar os teus dados.");
      } finally {
        setMeLoading(false);
      }
    };

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

    fetchMe();
    fetchTickets();
  }, []);

  const displayName =
    profile?.full_name ||
    profile?.username ||
    user?.email?.split("@")[0] ||
    "Utilizador ORYA";

  const displayInitial =
    (profile?.full_name || profile?.username || user?.email || "O")
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

  return (
    <main className="orya-body-bg text-white" aria-labelledby="me-page-title">
      <h1 id="me-page-title" className="sr-only">A minha conta</h1>
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                A minha conta
              </p>
              <p className="text-sm text-white/85">
                Onde vês a tua história ORYA a ganhar forma.
              </p>
            </div>
          </div>

          <Link
            href="/explorar"
            className="text-[11px] text-white/70 hover:text-white/90 underline-offset-4 hover:underline"
          >
            Voltar a explorar
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 py-8 md:py-10 space-y-6">
        {/* HERO PERFIL */}
        <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-[#0f172a] via-[#020617] to-black backdrop-blur-2xl p-6 md:p-7 flex flex-col gap-6 shadow-[0_28px_80px_rgba(15,23,42,0.95)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] flex items-center justify-center text-xl font-semibold shadow-[0_0_40px_rgba(107,255,255,0.7)] overflow-hidden">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{displayInitial}</span>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold tracking-tight md:text-base">
                    {displayName}
                  </p>
                  {profile?.role === "organizer" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-100 shadow-[0_0_16px_rgba(245,158,11,0.55)]">
                      <span className="text-[11px]">⭐</span>
                      Organizador ORYA
                    </span>
                  )}
                </div>
                {user?.email && (
                  <p className="text-[11px] text-white/65">{user.email}</p>
                )}
                {profile?.city && (
                  <p className="mt-0.5 text-[11px] text-white/55">
                    📍 {profile.city}
                  </p>
                )}
                {profile?.phoneNumber && (
                  <p className="mt-0.5 text-[11px] text-white/55">
                    📱 {profile.phoneNumber}
                    <span
                      className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${
                        profile.phoneConfirmed
                          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                          : "border-amber-400/60 bg-amber-500/15 text-amber-50"
                      }`}
                    >
                      {profile.phoneConfirmed ? "Confirmado" : "Por confirmar"}
                    </span>
                  </p>
                )}
                <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/20 px-3 py-1 text-[10px] text-white/80">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#FF00C8] to-[#6BFFFF] text-[9px]">
                    ⚡
                  </span>
                  <span className="font-medium">{levelLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 text-[11px]">
              {meLoading && (
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/70">
                  A carregar os teus dados…
                </span>
              )}
              {!meLoading && meError && (
                <>
                  <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-400/40 text-red-200">
                    {meError}
                  </span>
                  {meError.includes("iniciar sessão") && (
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-black text-[11px] font-semibold hover:bg-white/90 transition"
                    >
                      Iniciar sessão
                      <span className="text-[12px]">↗</span>
                    </Link>
                  )}
                </>
              )}
              {!meLoading && !meError && (
                <>
                  <span className="px-3 py-1 rounded-full bg-[#6BFFFF]/10 border border-[#6BFFFF]/40 text-[#6BFFFF]">
                    Sessão ativa ORYA
                  </span>
                  <Link
                    href="/me/edit"
                    className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/18 text-[11px] text-white/80 hover:bg-white/10 transition"
                  >
                    Editar perfil
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-1 gap-3 text-[11px] md:grid-cols-4 md:gap-4 mt-1">
            <div className="rounded-2xl border border-white/18 bg-white/[0.02] px-4 py-3">
              <p className="text-white/55">Eventos com bilhete</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {totalEvents}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">
                Toda a tua timeline ORYA.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3">
              <p className="text-emerald-100/80">Próximos eventos</p>
              <p className="mt-1 text-lg font-semibold text-emerald-100">
                {totalUpcoming}
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-100/80">
                O que ainda vem aí.
              </p>
            </div>
            <div className="rounded-2xl border border-white/18 bg-white/[0.02] px-4 py-3">
              <p className="text-white/55">Eventos já vividos</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {totalPast}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">
                Memórias que já fazem parte da tua história.
              </p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-3">
              <p className="text-fuchsia-100/85">Total investido</p>
              <p className="mt-1 text-lg font-semibold text-fuchsia-100">
                {totalSpentEuros} €
              </p>
              <p className="mt-0.5 text-[10px] text-fuchsia-100/80">
                Em ser a pessoa que não fica em casa.
              </p>
            </div>
          </div>

          <p className="mt-1 text-[11px] text-white/60 max-w-xl">
            {levelDescription}
          </p>
        </div>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)] gap-6">
          {/* RESUMO PERFIL */}
          <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-slate-950/85 to-slate-950 backdrop-blur-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white/90">
              Detalhes da conta
            </h2>

            <div className="space-y-2 text-[11px] text-white/75">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Username</span>
                <span className="font-medium text-white/85">
                  {profile?.username ?? "Ainda não definido"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Nome</span>
                <span className="font-medium text-white/85">
                  {profile?.full_name ?? "Ainda não definido"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Cidade</span>
                <span className="font-medium text-white/85">
                  {profile?.city ?? "Sem cidade definida"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Telemóvel</span>
                <span className="font-medium text-white/85">
                  {profile?.phoneNumber ?? "Sem telemóvel definido"}
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
          <section className="rounded-2xl border border-[#6BFFFF]/30 bg-gradient-to-br from-[#020617f2] via-slate-950 to-slate-950 backdrop-blur-xl p-5 space-y-4 shadow-[0_16px_40px_rgba(15,23,42,0.7)]">
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
                href="/me/bilhetes"
                className="inline-flex items-center gap-1 rounded-full bg-white text-black text-[11px] font-semibold px-3.5 py-1.5 shadow-[0_0_18px_rgba(255,255,255,0.3)] hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Ver todos os bilhetes
                <span className="text-[12px]">↗</span>
              </Link>
            </div>

            {ticketsLoading && (
              <div className="space-y-2">
                <div className="h-20 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
                <div className="h-20 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
              </div>
            )}

            {!ticketsLoading && ticketsError && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2.5 text-[11px] text-red-50">
                {ticketsError}
              </div>
            )}

            {!ticketsLoading && !ticketsError && !hasTickets && (
              <div className="rounded-xl border border-white/12 bg-black/50 px-4 py-4 text-[11px] text-white/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium text-white/85">
                    Ainda não tens bilhetes ORYA
                  </p>
                  <p className="mt-1 text-white/60">
                    Assim que comprares um bilhete com login feito, ele vai
                    aparecer aqui automaticamente.
                  </p>
                </div>
                <Link
                  href="/explorar"
                  className="inline-flex px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_25px_rgba(107,255,255,0.5)]"
                >
                  Explorar eventos
                </Link>
              </div>
            )}

            {!ticketsLoading && !ticketsError && hasTickets && (
              <div className="space-y-3">
                {recentTickets.map((t) => {
                  const eventDate = parseDate(t.eventStartDate);
                  const purchaseDate = parseDate(t.createdAt);

                  const isPast =
                    eventDate !== null &&
                    eventDate.getTime() < now.getTime();

                  const statusLabel = isPast ? "Evento terminado" : "A caminho";
                  const statusClasses = isPast
                    ? "bg-white/8 border-white/25 text-white/75"
                    : "bg-emerald-500/12 border-emerald-400/50 text-emerald-100";

                  const eventDateFormatted = eventDate
                    ? eventDate.toLocaleString("pt-PT", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Data do evento a anunciar";

                  const purchaseDateFormatted = purchaseDate
                    ? purchaseDate.toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })
                    : "Data não disponível";

                  const totalEuros = (t.pricePaid / 100).toFixed(2);

                  return (
                    <article
                      key={t.id}
                      className="rounded-xl border border-white/14 bg-gradient-to-br from-white/4 via-black/70 to-black/90 px-4 py-3.5 flex flex-col gap-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative h-20 w-14 rounded-lg border border-white/15 overflow-hidden bg-white/5 flex-shrink-0">
                          {t.eventCoverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={t.eventCoverImageUrl}
                              alt={t.eventTitle}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] flex items-center justify-center text-[10px] font-semibold text-black/90">
                              ORYA
                            </div>
                          )}
                        </div>

                        <div className="flex-1 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white/95">
                              {t.eventTitle}
                            </p>
                            <p className="mt-0.5 text-[11px] text-white/60">
                              {eventDateFormatted}
                              {t.eventLocationName
                                ? ` • ${t.eventLocationName}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`px-2 py-1 rounded-full border text-[10px] ${statusClasses}`}
                            >
                              {statusLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/6 border border-white/20 text-[9px] text-white/80">
                              Bilhete ORYA
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-white/80">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/55">Tipo:</span>
                          <span className="font-medium">{t.ticketName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/55">Quantidade:</span>
                          <span className="font-medium">{t.quantity}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/55">Total:</span>
                          <span className="font-semibold">
                            {totalEuros} €
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[10px] text-white/55">
                        <div>
                          <p>
                            Compra efetuada em {purchaseDateFormatted} • ID:{" "}
                            <span className="font-mono text-[10px] text-white/70">
                              {t.id.slice(0, 10)}…
                            </span>
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <Link
                              href={`/eventos/${t.eventSlug}`}
                              className="text-[10px] text-[#6BFFFF] hover:text-[#6BFFFF] underline underline-offset-4"
                            >
                              Ver evento
                            </Link>
                            <Link
                              href={`/bilhete/${t.id}`}
                              className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/5 px-3 py-1 text-[10px] text-white/80 hover:bg-white/10 hover:text-white transition"
                            >
                              Abrir bilhete
                              <span className="text-[11px]">↗</span>
                            </Link>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/22 bg-black/50 px-3 py-1.5">
                          <span className="text-sm">🎟️</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-white/85">
                              Bilhete digital
                            </span>
                            <span className="text-[9px] text-white/60">
                              Consulta todos os detalhes do teu bilhete na opção{" "}
                              <span className="font-medium">Abrir bilhete</span>.
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ATIVIDADE RECENTE */}
        <section className="rounded-2xl border border-white/12 bg-gradient-to-r from-[#020617] via-slate-950 to-black backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-white/95">
                Atividade recente
              </h2>
              <p className="text-[11px] text-white/65">
                Uma visão rápida do que tens feito na ORYA nos últimos tempos.
              </p>
            </div>
          </div>

          {ticketsLoading && (
            <div className="space-y-2">
              <div className="h-14 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
              <div className="h-14 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
            </div>
          )}

          {!ticketsLoading && !hasActivity && (
            <div className="rounded-xl border border-dashed border-white/20 bg-black/50 px-4 py-4 text-[11px] text-white/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-medium text-white/85">
                  Ainda não temos atividade para mostrar
                </p>
                <p className="mt-1 text-white/60">
                  Assim que começares a comprar bilhetes, vais ver aqui um
                  resumo das tuas últimas aventuras.
                </p>
              </div>
              <Link
                href="/explorar"
                className="inline-flex px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_25px_rgba(107,255,255,0.5)]"
              >
                Começar a explorar
              </Link>
            </div>
          )}

          {!ticketsLoading && hasActivity && (
            <div className="space-y-2">
              {recentTickets.map((t) => {
                const eventDate = parseDate(t.eventStartDate);
                const purchaseDate = parseDate(t.createdAt);

                const isPast =
                  eventDate !== null && eventDate.getTime() < now.getTime();

                const eventDateFormatted = eventDate
                  ? eventDate.toLocaleString("pt-PT", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : null;

                const purchaseDateFormatted = purchaseDate
                  ? purchaseDate.toLocaleDateString("pt-PT", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })
                  : null;

                const prefix = isPast ? "Foste a" : "Vais a";

                return (
                  <div
                    key={`activity-${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/[0.03] px-3.5 py-2.5 text-[11px] text-white/80"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] flex items-center justify-center text-[13px]">
                        🎟️
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="truncate">
                          <span className="text-white/60">{prefix} </span>
                          <span className="font-medium text-white/90">
                            {t.eventTitle}
                          </span>
                        </p>
                        <p className="text-[10px] text-white/55">
                          {eventDateFormatted && (
                            <span>
                              Evento: {eventDateFormatted}
                              {t.eventLocationName
                                ? ` • ${t.eventLocationName}`
                                : ""}
                            </span>
                          )}
                          {!eventDateFormatted && purchaseDateFormatted && (
                            <span>Compra em {purchaseDateFormatted}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/bilhete/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] text-white/80 hover:bg-white/10 hover:text-white transition"
                      >
                        Ver bilhete
                        <span className="text-[11px]">↗</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}