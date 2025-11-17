// app/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { mapEventToCardDTO, type EventCardDTO } from "@/lib/events";

function formatDateRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dayOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
  };

  const dateStr = start.toLocaleDateString("pt-PT", dayOpts);
  const endDateStr = end.toLocaleDateString("pt-PT", dayOpts);

  const startTime = start.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime = end.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) {
    return `${dateStr} · ${startTime} – ${endTime}`;
  }

  // multi-dia
  return `${dateStr} ${startTime} · ${endDateStr} ${endTime}`;
}

function formatPrice(event: EventCardDTO) {
  if (event.isFree) return "Entrada gratuita";
  if (event.priceFrom == null) return "Preço a anunciar";
  return `Desde ${event.priceFrom}€`;
}

export default async function HomePage() {
  const eventsRaw = await prisma.event.findMany({
    orderBy: { startDate: "asc" },
    include: {
      tickets: {
        orderBy: { sortOrder: "asc" },
      },
    },
    take: 18,
  });

  const events: EventCardDTO[] = eventsRaw.map(mapEventToCardDTO);

  const spotlight = events[0] ?? null;
  const hotNow = events.slice(0, 3); // máx. 3 em alta

  const totalEvents = events.length;
  const paidEvents = events.filter((e) => !e.isFree).length;
  const freeEvents = events.filter((e) => e.isFree).length;

  return (
    <main className="min-h-screen text-white">
      {/* HERO */}
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-10 pt-10 md:flex-row md:px-6 md:pb-16 md:pt-16 lg:px-8">
        {/* TEXTO ESQUERDA */}
        <div className="flex-1 space-y-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-400">
            APP · EVENTOS · VIDA SOCIAL EM PORTUGAL
          </p>

          <h1 className="text-[2.25rem] font-extrabold leading-tight md:text-[2.9rem] md:leading-[1.03]">
            O{" "}
            <span className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
              centro da tua vida social
            </span>{" "}
            — num mapa com{" "}
            <span className="text-zinc-100">eventos, bilhetes e amigos reais.</span>
          </h1>

          <p className="max-w-xl text-sm text-zinc-200 md:text-[15px]">
            A ORYA junta descoberta de eventos, compra de bilhetes e check-in
            digital numa só app. Sem links perdidos, grupos caóticos ou &quot;logo
            se vê&quot;. Abres o mapa e vês, em segundos, o que está a acontecer à
            tua volta.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="#instalar-app"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(15,23,42,0.95)] shadow-[#6bffff80] transition-transform hover:translate-y-[1px] hover:brightness-110"
            >
              Instalar a app ORYA
              <span className="text-[15px]">⚡</span>
            </Link>

            <Link
              href="/explorar"
              className="inline-flex items-center justify-center rounded-full border border-zinc-600/70 bg-black/40 px-5 py-2 text-xs font-medium text-zinc-100 hover:border-zinc-300 hover:bg-black/70"
            >
              Ver eventos no mapa
            </Link>
          </div>

          {/* CTA futuro app stores */}
          <p className="mt-4 text-[11px] text-zinc-400">
            A ORYA vai viver na App Store e Google Play. Até lá, podes &quot;instalar&quot; a
            versão web no teu telemóvel e começar já a usar a app para os teus
            primeiros eventos.
          </p>

          {/* MINI STATS */}
          <div className="mt-4 grid grid-cols-1 gap-3 text-[11px] text-zinc-300 sm:grid-cols-3">
            <div className="rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-br from-[#FF8AD906] via-[#9BE7FF0D] to-[#020617f2] px-3.5 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.7)] backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">
                Eventos ativos
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-50">
                {totalEvents.toString().padStart(2, "0")}
              </p>
              <p className="mt-1 text-[11px] text-zinc-200">
                Base de eventos pronta para escalar com mapa e social.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-br from-[#FF8AD906] via-[#9BE7FF0D] to-[#020617f2] px-3.5 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.7)] backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">
                Pagos
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-50">
                {paidEvents.toString().padStart(2, "0")}
              </p>
              <p className="mt-1 text-[11px] text-zinc-200">
                Waves, stock, Stripe e (no futuro) MB Way, Apple Pay, etc.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-br from-[#FF8AD906] via-[#9BE7FF0D] to-[#020617f2] px-3.5 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.7)] backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">
                Gratuitos
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-50">
                {freeEvents.toString().padStart(2, "0")}
              </p>
              <p className="mt-1 text-[11px] text-zinc-200">
                Perfeito para jantares, desporto e planos espontâneos.
              </p>
            </div>
          </div>
        </div>

        {/* CARD SPOTLIGHT – mock de ecrã da app */}
        <div className="flex-1">
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#FF00C8]/45 via-[#6BFFFF]/25 to-[#1646F5]/45 opacity-90 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-[#FF8AD906] via-[#9BE7FF12] to-[#020617f2] backdrop-blur-2xl shadow-[0_26px_80px_rgba(15,23,42,0.9)]">
              <div className="flex items-center justify-between border-b border-white/14 px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-100">
                    Em alta agora
                  </p>
                  <p className="text-[11px] text-zinc-200">
                    Destaque automático a partir da tua base de dados.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[11px] font-medium text-emerald-100">
                  Beta ORYA
                </span>
              </div>

              {spotlight ? (
                <>
                  <div className="relative h-44 w-full overflow-hidden">
                    {spotlight.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={spotlight.coverImageUrl}
                        alt={spotlight.title}
                        className="h-full w-full object-cover opacity-85"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent" />

                    <div className="absolute left-4 right-4 top-3 flex items-center justify-between gap-3 text-[10px] text-zinc-100">
                      <span className="rounded-full bg-black/60 px-2 py-1">
                        {spotlight.venue.name}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {spotlight.stats.goingCount} pessoas confirmadas
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-zinc-50">
                          {spotlight.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-200">
                          {formatDateRange(
                            spotlight.startDate,
                            spotlight.endDate
                          )}
                        </p>
                      </div>
                      <p className="rounded-full bg-black/75 px-3 py-1 text-[11px] font-medium text-zinc-50">
                        {formatPrice(spotlight)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 px-4 pb-4 pt-3">
                    <p className="line-clamp-2 text-xs text-zinc-100">
                      {spotlight.shortDescription}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-300">
                      <span>
                        {spotlight.stats.goingCount} vão ·{" "}
                        {spotlight.stats.interestedCount} interessados
                      </span>
                      <span className="hidden rounded-full border border-zinc-500/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-200 sm:inline-block">
                        Evento ORYA
                      </span>
                    </div>

                    <Link
                      href={`/eventos/${spotlight.slug}`}
                      className="mt-1 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-[#6bffff80] hover:brightness-110"
                    >
                      Abrir página do evento
                    </Link>
                  </div>
                </>
              ) : (
                <div className="px-4 py-6 text-sm text-zinc-200">
                  Ainda não tens eventos criados.
                  <br />
                  <Link
                    href="/eventos/novo"
                    className="mt-2 inline-flex text-[13px] font-medium text-[#6BFFFF] underline underline-offset-4"
                  >
                    Cria o teu primeiro evento →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* EM ALTA PERTO DE TI – máx 3 eventos */}
      {hotNow.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12 md:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold md:text-base">
                Em alta perto de ti
              </h2>
              <p className="text-[11px] text-zinc-300">
                Uma amostra real de eventos já criados na ORYA.
              </p>
            </div>
            <Link
              href="/explorar"
              className="text-[11px] text-zinc-300 underline underline-offset-4 hover:text-white"
            >
              Ver todos os eventos
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {hotNow.map((event) => {
              const dateLabel = formatDateRange(
                event.startDate,
                event.endDate
              );
              const priceLabel = formatPrice(event);

              return (
                <Link
                  key={event.id}
                  href={`/eventos/${event.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/18 bg-gradient-to-br from-[#FF8AD906] via-[#9BE7FF12] to-[#020617f2] backdrop-blur-xl shadow-[0_22px_80px_rgba(15,23,42,0.9)] transition-transform hover:-translate-y-1 hover:border-[#FF00C8]/80"
                >
                  <div className="relative h-32 w-full overflow-hidden">
                    {event.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.coverImageUrl}
                        alt={event.title}
                        className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity duration-300 group-hover:opacity-95"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent" />

                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-200">
                          {event.venue.name}
                        </p>
                        <p className="text-[11px] text-zinc-200">
                          {dateLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-black/75 px-2 py-1 text-[10px] font-medium text-zinc-50">
                        {priceLabel}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 p-4">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-50">
                      {event.title}
                    </h3>
                    <p className="line-clamp-2 text-xs text-zinc-200">
                      {event.shortDescription}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* COMO FUNCIONA – 3 passos */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.85)] backdrop-blur-xl md:p-8">
          <h2 className="text-base font-semibold md:text-lg">Como funciona</h2>
          <p className="mt-1 text-xs text-zinc-300 md:text-sm">
            Em três passos estás a usar a ORYA para a tua vida social.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF00C8] to-[#6BFFFF] text-xs font-bold text-black shadow-lg shadow-[#ff00c866]">
                1
              </div>
              <h3 className="text-sm font-semibold">
                Descobre o que há à tua volta
              </h3>
              <p className="text-xs text-zinc-300">
                Abres o mapa, vês eventos, jantares, sunsets, desporto e tudo o
                que está a mexer na tua cidade.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6BFFFF] to-[#1646F5] text-xs font-bold text-black shadow-lg shadow-[#6bffff66]">
                2
              </div>
              <h3 className="text-sm font-semibold">Junta-te em segundos</h3>
              <p className="text-xs text-zinc-300">
                Escolhes a wave, compras o bilhete ou marcas presença. Tudo
                fica registado na tua conta.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF00C8] to-[#1646F5] text-xs font-bold text-black shadow-lg shadow-[#ff00c866]">
                3
              </div>
              <h3 className="text-sm font-semibold">
                Vives, guardas e repetes
              </h3>
              <p className="text-xs text-zinc-300">
                Fazes check-in, vês quem mais vai, guardas memórias e usas a
                ORYA como centro da tua vida social.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* FOOTER LANDING */}
      <footer className="border-t border-white/10 bg-black/35">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 text-xs text-zinc-300 md:flex-row md:items-start md:justify-between md:px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-extrabold tracking-[0.16em]">
              OR
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-50">ORYA</p>
              <p className="mt-1 max-w-xs text-[11px] text-zinc-400">
                O amigo virtual que te lembra que a vida acontece fora do ecrã —
                e te mostra onde é que as melhores cenas estão a acontecer.
              </p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Sobre a ORYA
              </p>
              <ul className="space-y-1">
                <li>
                  <Link href="#sobre">Visão</Link>
                </li>
                <li>
                  <Link href="#instalar-app">Instalar a app</Link>
                </li>
                <li>
                  <Link href="#parceiros">Parceiros</Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Suporte
              </p>
              <ul className="space-y-1">
                <li>
                  <Link href="#faq">Perguntas frequentes</Link>
                </li>
                <li>
                  <Link href="#contacto">Contacto</Link>
                </li>
                <li>
                  <Link href="#termos">Termos &amp; condições</Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Comunidade
              </p>
              <ul className="space-y-1">
                <li>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://tiktok.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    TikTok
                  </a>
                </li>
                <li>
                  <Link href="#newsletter">Newsletter</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}