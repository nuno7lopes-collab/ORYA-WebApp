"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

type OverviewResponse = {
  ok: boolean;
  totalTickets: number;
  totalRevenueCents: number;
  eventsWithSalesCount: number;
  activeEventsCount: number;
};

type EventItem = {
  id: number;
  slug: string;
  title: string;
  startsAt: string;
  locationName: string | null;
  locationCity: string | null;
  status: string;
  isFree: boolean;
  ticketsSold?: number;
  revenueCents?: number;
};

type EventsResponse = { ok: boolean; items: EventItem[] };

export default function OrganizadorPage() {
  const { user, profile, isLoading: userLoading, mutate: mutateUser } = useUser();
  const { openModal } = useAuthModal();
  const [ctaError, setCtaError] = useState<string | null>(null);
  const emailVerified = Boolean(user?.emailConfirmedAt);

  const { data: organizerData, isLoading: organizerLoading, mutate: mutateOrganizer } = useSWR(
    user ? "/api/organizador/me" : null,
    (url: string) => fetch(url).then((res) => res.json())
  );

  const organizer = organizerData?.organizer ?? null;
  const loading = userLoading || organizerLoading;

  const { data: overview } = useSWR<OverviewResponse>(
    organizer?.status === "ACTIVE" ? "/api/organizador/estatisticas/overview?range=30d" : null,
    (url: string) => fetch(url).then((res) => res.json()),
    { revalidateOnFocus: false }
  );

  const { data: events } = useSWR<EventsResponse>(
    organizer?.status === "ACTIVE" ? "/api/organizador/events/list" : null,
    (url: string) => fetch(url).then((res) => res.json()),
    { revalidateOnFocus: false }
  );

  async function handleBecomeOrganizer() {
    if (!emailVerified) {
      setCtaError("Confirma o teu e-mail antes de pedires acesso a organizador.");
      return;
    }
    try {
      const res = await fetch("/api/organizador/become", {
        method: "POST",
      });

      if (!res.ok) {
        console.error("Erro ao tornar organizador");
        return;
      }

      await mutateOrganizer();
      await mutateUser();
      setCtaError(null);
    } catch (err) {
      console.error("Erro inesperado ao tornar organizador", err);
    }
  }

  const statsCards = useMemo(() => {
    const revenueEuros = (overview?.totalRevenueCents ?? 0) / 100;
    return [
      {
        label: "Bilhetes 30d",
        value: overview ? overview.totalTickets : "—",
        hint: "Bilhetes vendidos nos últimos 30 dias",
      },
      {
        label: "Receita 30d",
        value: overview ? `${revenueEuros.toFixed(2)} €` : "—",
        hint: "Valor bruto em cêntimos convertidos",
      },
      {
        label: "Eventos com vendas",
        value: overview ? overview.eventsWithSalesCount : "—",
        hint: "Eventos com pelo menos 1 venda",
      },
      {
        label: "Eventos publicados",
        value: overview ? overview.activeEventsCount : "—",
        hint: "Eventos PUBLISHED ligados a ti",
      },
    ];
  }, [overview]);

  const statusText = (() => {
    if (loading) {
      return "A carregar o estado da tua conta de organizador...";
    }
    if (!user) {
      return "Entra ou cria conta para começares a vender bilhetes com a ORYA.";
    }
    if (!organizer) {
      return "Ainda não és organizador ORYA. Envia a candidatura para começares.";
    }
    if (organizer.status === "PENDING") {
      return "A tua candidatura está a ser revista pela equipa ORYA.";
    }
    if (organizer.status !== "ACTIVE") {
      return "A tua conta de organizador não está ativa. Contacta suporte.";
    }
    return "Dashboard do organizador — acompanha eventos, vendas e equipa num só sítio.";
  })();

  const quickLinks = [
    { label: "Criar evento", href: "/organizador/eventos/novo", accent: "from-[#FF00C8] to-[#6BFFFF]" },
    { label: "Eventos", href: "/organizador/eventos", accent: "from-[#6BFFFF] to-[#1646F5]" },
    { label: "Estatísticas", href: "/organizador/estatisticas", accent: "from-[#A855F7] to-[#6366F1]" },
    { label: "Pagamentos / Stripe", href: "/organizador/pagamentos", accent: "from-[#10B981] to-[#34D399]" },
    { label: "Staff", href: "/organizador/staff", accent: "from-[#F59E0B] to-[#F97316]" },
  ];

  if (!user) {
    return (
      <main className="orya-body-bg min-h-screen text-white">
        <section className="mx-auto max-w-4xl px-4 py-10 space-y-4">
          <h1 className="text-2xl font-semibold">Área de organizador</h1>
          <p>Entra ou cria conta para enviares a tua candidatura.</p>
          <button
            type="button"
            onClick={() => openModal({ mode: "login", redirectTo: "/organizador" })}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-lg"
          >
            Entrar / Criar conta
          </button>
        </section>
      </main>
    );
  }

  if (!organizer) {
    return (
      <main className="orya-body-bg min-h-screen text-white">
        <section className="mx-auto max-w-4xl px-4 py-10 space-y-4">
          <h1 className="text-2xl font-semibold">Candidatura a organizador</h1>
          <p className="text-sm text-white/70">
            Queres vender bilhetes na ORYA? Envia a tua candidatura e a equipa vai rever.
          </p>
          {!emailVerified && (
            <p className="text-sm text-amber-200">
              Confirma o teu e-mail antes de pedires acesso a organizador.
            </p>
          )}
          {ctaError && <p className="text-sm text-red-200">{ctaError}</p>}
          <button
            type="button"
            onClick={handleBecomeOrganizer}
            disabled={!emailVerified}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-lg disabled:opacity-60"
          >
            Enviar candidatura
          </button>
        </section>
      </main>
    );
  }

  if (organizer.status === "PENDING") {
    return (
      <main className="orya-body-bg min-h-screen text-white">
        <section className="mx-auto max-w-4xl px-4 py-10 space-y-4">
          <h1 className="text-2xl font-semibold">Candidatura enviada</h1>
          <p className="text-sm text-white/70">
            A tua candidatura a organizador está a ser revista pela equipa ORYA. Vamos avisar assim que for aprovada.
          </p>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/organizador/become", { method: "DELETE" });
              window.location.reload();
            }}
            className="px-4 py-2 rounded-full border border-white/15 text-white/80 hover:bg-white/10 transition"
          >
            Cancelar candidatura
          </button>
        </section>
      </main>
    );
  }

  if (organizer.status !== "ACTIVE") {
    return (
      <main className="orya-body-bg min-h-screen text-white">
        <section className="mx-auto max-w-4xl px-4 py-10 space-y-4">
          <h1 className="text-2xl font-semibold">Conta de organizador inativa</h1>
          <p className="text-sm text-white/70">
            O estado atual é {organizer.status}. Contacta a equipa ORYA para desbloquear.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="orya-body-bg min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-12 md:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
              Dashboard · Organizador
            </p>
            <h1 className="text-3xl font-bold leading-tight">
              Olá {profile?.fullName ?? profile?.username ?? "organizador"} — aqui tens tudo o que precisas
            </h1>
            <p className="text-sm text-white/70">{statusText}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/organizador/eventos/novo"
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-lg"
            >
              Criar novo evento
            </Link>
            <Link
              href="/me/tickets"
              className="px-4 py-2 rounded-full border border-white/15 text-white/80 hover:bg-white/10 transition"
            >
              Ver como participante
            </Link>
          </div>
        </div>

        {/* Painel principal */}
        <div className="mt-6 grid gap-4 md:grid-cols-[1.6fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 md:p-5 space-y-4 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Vendas rápidas (30d)</h2>
              <Link href="/organizador/estatisticas" className="text-[11px] text-[#6BFFFF] hover:underline">
                Ver estatísticas →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
              {statsCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-black/40 p-3"
                >
                  <p className="text-white/50">{card.label}</p>
                  <p className="text-xl font-semibold text-white mt-1">{card.value}</p>
                  <p className="text-[10px] text-white/45">{card.hint}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/75">
              Liga a tua conta Stripe para receberes payouts automáticos e evitares bloqueios de venda.
              <div className="mt-2 flex gap-2">
                <Link
                  href="/organizador/pagamentos"
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] px-3 py-1.5 text-[11px] font-semibold text-black shadow"
                >
                  Ligar Stripe
                </Link>
                <Link
                  href="/organizador/pagamentos"
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/10"
                >
                  Ver pagamentos
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 md:p-5 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Ações rápidas</h2>
              <span className="text-[11px] text-white/60">Gestão completa</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-2xl border border-white/12 bg-gradient-to-r ${link.accent} px-3 py-2 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:scale-[1.01] transition`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/70">
              Garante que a tua equipa tem acesso: adiciona staff, define escopos e evita filas à porta.
            </div>
          </div>
        </div>

        {/* Listagem de eventos */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-5 shadow-[0_18px_60px_rgba(0,0,0,0.65)] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Eventos</h3>
              <p className="text-[11px] text-white/60">Próximos e passados ligados à tua conta de organizador.</p>
            </div>
            <Link
              href="/organizador/eventos/novo"
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 text-[11px] font-semibold text-black shadow"
            >
              Novo evento
            </Link>
          </div>
          <div className="space-y-2">
            {!events?.items && (
              <div className="grid gap-2 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
                ))}
              </div>
            )}
            {events?.items?.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-[12px] text-white/70">
                Ainda não tens eventos. Cria o primeiro e começa a vender.
              </div>
            )}
            {events?.items && events.items.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {events.items.slice(0, 6).map((ev) => {
                  const date = ev.startsAt ? new Date(ev.startsAt) : null;
                  const ticketsSold = ev.ticketsSold ?? 0;
                  const revenue = ((ev.revenueCents ?? 0) / 100).toFixed(2);
                  const dateLabel = date
                    ? date.toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Data a confirmar";
                  return (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-white/12 bg-white/5 p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <p className="text-sm font-semibold text-white line-clamp-2">{ev.title}</p>
                          <p className="text-[11px] text-white/60">{dateLabel}</p>
                          <p className="text-[11px] text-white/60">
                            {ev.locationName || ev.locationCity || "Local a anunciar"}
                          </p>
                          <p className="text-[11px] text-white/60">
                            {ticketsSold} bilhetes · {revenue} €
                          </p>
                        </div>
                        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/80">
                          {ev.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <Link
                          href={`/organizador/eventos/${ev.id}/edit`}
                          className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                        >
                          Editar
                        </Link>
                        <Link
                          href={`/eventos/${ev.slug}`}
                          className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                        >
                          Página pública
                        </Link>
                        <Link
                          href={`/organizador/estatisticas?eventId=${ev.id}`}
                          className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                        >
                          Estatísticas
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
