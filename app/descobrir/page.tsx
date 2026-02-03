import Link from "next/link";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import DiscoverFilters from "@/app/descobrir/_components/DiscoverFilters";
import {
  buildTimingTag,
  formatEventDayLabel,
  formatLocationLabel,
  formatPriceLabel,
  getDiscoverData,
} from "@/app/descobrir/_lib/discoverData";
import { EventListCard, EventSquareCard } from "@/app/components/mobile/MobileCards.server";
import InvitePeopleCard from "@/app/components/mobile/InvitePeopleCard";
import { getEventCoverUrl } from "@/lib/eventCover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = {
  tab?: string;
  range?: string;
  lat?: string;
  lng?: string;
  priceMin?: string;
  priceMax?: string;
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

function toNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function DescobrirPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const tabParam: "eventos" | "torneios" | "reservas" =
    resolvedParams.tab === "torneios" || resolvedParams.tab === "reservas"
      ? resolvedParams.tab
      : "eventos";
  const rangeParam = resolvedParams.range === "today" || resolvedParams.range === "near" ? resolvedParams.range : "week";
  const priceMin = toNumber(resolvedParams.priceMin, 0);
  const priceMax = toNumber(resolvedParams.priceMax, 100);
  const lat = resolvedParams.lat ? Number(resolvedParams.lat) : undefined;
  const lng = resolvedParams.lng ? Number(resolvedParams.lng) : undefined;

  const { liveEvents, fallbackEvents, weekEvents } = await getDiscoverData({
    tab: tabParam,
    range: rangeParam,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    priceMin: priceMin > 0 ? priceMin : undefined,
    priceMax: priceMax < 100 ? priceMax : undefined,
  });

  const now = new Date();
  const nowEvents = liveEvents.length > 0 ? liveEvents : fallbackEvents;
  const hasLive = liveEvents.length > 0;
  const isReservations = tabParam === "reservas";
  const isTournaments = tabParam === "torneios";

  const heroTitle = isReservations
    ? "Reservas e serviços"
    : isTournaments
      ? "Torneios e jogos"
      : "Eventos e planos";
  const heroSubtitle = isReservations
    ? "Encontra reservas populares e novidades perto de ti."
    : isTournaments
      ? "Descobre torneios e jogos que estão a acontecer."
      : "Encontra o que acontece agora e planeia a tua semana.";

  const primaryTitle = isReservations
    ? "Mais populares"
    : isTournaments
      ? "Torneios a decorrer"
      : "A acontecer agora";
  const primarySubtitle = isReservations
    ? "Reservas com maior procura."
    : hasLive
      ? "A decorrer neste momento"
      : isTournaments
        ? "Torneios a seguir hoje"
        : "Eventos a seguir hoje";
  const secondaryTitle = isReservations ? "Novidades" : "Em alta esta semana";
  const secondarySubtitle = isReservations
    ? "Novas sugestões e recomendações."
    : isTournaments
      ? "Torneios nos 7 dias seguintes."
      : "Eventos nos 7 dias seguintes.";

  const primaryEvents = isReservations ? weekEvents.slice(0, 4) : nowEvents;
  const secondaryEvents = isReservations ? weekEvents.slice(4, 10) : weekEvents;
  const hasActiveFilters = rangeParam !== "week" || priceMin > 0 || priceMax < 100;
  const baseTabHref = tabParam === "eventos" ? "/descobrir" : `/descobrir?tab=${tabParam}`;
  const primaryEmptyMessage = isReservations
    ? "Sem reservas para mostrar por agora."
    : rangeParam === "near"
      ? "Sem eventos perto de ti neste momento."
      : rangeParam === "today"
        ? "Sem eventos a acontecer hoje."
        : "Sem eventos a acontecer por agora.";
  const secondaryEmptyMessage = isReservations
    ? "Sem novidades por agora."
    : rangeParam === "near"
      ? "Sem eventos próximos para esta semana."
      : "Sem eventos para esta semana.";

  return (
    <main className="min-h-screen text-white pb-24">
      <MobileTopBar />
      <section className="orya-page-width px-4 md:px-8 pt-10 pb-8 md:pt-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-8">
            <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              <div className="space-y-3">
          <p className="orya-mobile-kicker">Início</p>
                <h1 className="text-2xl font-semibold text-white md:text-3xl">{heroTitle}</h1>
                <p className="text-sm text-white/60">{heroSubtitle}</p>
              </div>
              <div className="mt-5">
                <DiscoverFilters
                  initialTab={tabParam}
                  initialRange={rangeParam}
                  initialPriceMin={priceMin}
                  initialPriceMax={priceMax}
                />
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-[16px] font-semibold text-white">{primaryTitle}</p>
                  <p className="text-[11px] text-white/60">{primarySubtitle}</p>
                </div>
              </div>

              {primaryEvents.length === 0 ? (
                <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                  <p>{primaryEmptyMessage}</p>
                  {hasActiveFilters && (
                    <Link
                      href={baseTabHref}
                      className="btn-orya mt-3 inline-flex text-[11px] font-semibold"
                    >
                      Limpar filtros
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
                  {primaryEvents.map((event, index) => {
                    const cover = getEventCoverUrl(event.coverImageUrl, {
                      seed: event.slug ?? event.id,
                      width: 720,
                      quality: 65,
                      format: "webp",
                      square: true,
                    });
                    const tag = buildTimingTag(event, now);
                    const hideOnMobile = index > 1;
                    return (
                      <EventSquareCard
                        key={event.id}
                        href={`/eventos/${event.slug}`}
                        imageUrl={cover}
                        title={event.title}
                        location={formatLocationLabel(event)}
                        tagLabel={isReservations ? undefined : tag.label}
                        tagTone={isReservations ? undefined : tag.tone}
                        meta={[{ label: formatPriceLabel(event) }]}
                        className={hideOnMobile ? "hidden sm:block" : undefined}
                        imagePriority={index < 2}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-[16px] font-semibold text-white">{secondaryTitle}</p>
                  <p className="text-[11px] text-white/60">{secondarySubtitle}</p>
                </div>
              </div>

              {secondaryEvents.length === 0 ? (
                <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                  <p>{secondaryEmptyMessage}</p>
                  {hasActiveFilters && (
                    <Link
                      href={baseTabHref}
                      className="btn-orya mt-3 inline-flex text-[11px] font-semibold"
                    >
                      Limpar filtros
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3">
                  {secondaryEvents.map((event) => {
                    const cover = getEventCoverUrl(event.coverImageUrl, {
                      seed: event.slug ?? event.id,
                      width: 520,
                      quality: 65,
                      format: "webp",
                      square: true,
                    });
                    return (
                      <EventListCard
                        key={event.id}
                        href={`/eventos/${event.slug}`}
                        imageUrl={cover}
                        title={event.title}
                        subtitle={formatLocationLabel(event)}
                        dateLabel={formatEventDayLabel(event)}
                        meta={[{ label: formatPriceLabel(event) }]}
                        className="w-full"
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-[16px] font-semibold text-white">Eventos de quem segues</p>
                <p className="text-[11px] text-white/60">Descobre onde a tua rede vai estar.</p>
              </div>
              <InvitePeopleCard
                title="Convida pessoas para ORYA"
                description="Partilha o teu link para juntares a tua rede aos eventos."
                ctaLabel="Convidar pessoas"
              />
            </section>

            {isTournaments && (
              <section className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[16px] font-semibold text-white">Padel agora</p>
                  <p className="text-[11px] text-white/60">Liga-te às duplas abertas e ranking.</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-2 text-[12px] text-white/70">
                  <Link
                    href="/padel/duplas"
                    className="flex items-center justify-between rounded-xl border border-white/15 bg-black/40 px-3 py-2 hover:bg-white/5"
                  >
                    <span>Duplas abertas</span>
                    <span className="text-white/40">→</span>
                  </Link>
                  <Link
                    href="/padel/rankings"
                    className="flex items-center justify-between rounded-xl border border-white/15 bg-black/40 px-3 py-2 hover:bg-white/5"
                  >
                    <span>Ranking global</span>
                    <span className="text-white/40">→</span>
                  </Link>
                </div>
              </section>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
