import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import DiscoverFilters from "@/app/descobrir/_components/DiscoverFilters";
import {
  buildTimingTag,
  formatEventDayLabel,
  formatLocationLabel,
  formatPriceLabel,
  getDiscoverData,
} from "@/app/descobrir/_lib/discoverData";
import {
  EventListCard,
  EventSquareCard,
  InvitePeopleCard,
} from "@/app/components/mobile/MobileCards";
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

  return (
    <main className="min-h-screen text-white pb-24">
      <MobileTopBar />
      <section className="orya-page-width px-4 md:px-8 py-6 space-y-6">
        <div className="space-y-3">
          <p className="orya-mobile-kicker">Descobrir</p>
          <h1 className="text-[20px] font-semibold text-white">{heroTitle}</h1>
          <p className="text-[12px] text-white/60">{heroSubtitle}</p>
        </div>

        <DiscoverFilters
          initialTab={tabParam}
          initialRange={rangeParam}
          initialPriceMin={priceMin}
          initialPriceMax={priceMax}
        />

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-[16px] font-semibold text-white">{primaryTitle}</p>
              <p className="text-[11px] text-white/60">{primarySubtitle}</p>
            </div>
          </div>

          {primaryEvents.length === 0 ? (
            <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
              {isReservations ? "Sem reservas para mostrar por agora." : "Sem eventos a acontecer por agora."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
              {primaryEvents.map((event, index) => {
                const cover = getEventCoverUrl(event.coverImageUrl, {
                  seed: event.slug ?? event.id,
                  width: 900,
                  quality: 70,
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
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-[16px] font-semibold text-white">{secondaryTitle}</p>
              <p className="text-[11px] text-white/60">{secondarySubtitle}</p>
            </div>
          </div>

          {secondaryEvents.length === 0 ? (
            <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
              {isReservations ? "Sem novidades por agora." : "Sem eventos para esta semana."}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              {secondaryEvents.map((event) => {
                const cover = getEventCoverUrl(event.coverImageUrl, {
                  seed: event.slug ?? event.id,
                  width: 600,
                  quality: 70,
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
                    className="w-full max-w-[900px]"
                  />
                );
              })}
            </div>
          )}
        </section>

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
      </section>
    </main>
  );
}
