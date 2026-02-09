import Link from "next/link";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import DiscoverFilters from "@/app/descobrir/_components/DiscoverFilters";
import ServiceCard from "@/app/descobrir/_components/ServiceCard";
import { EventListCard, EventSquareCard } from "@/app/components/mobile/MobileCards.server";
import InvitePeopleCard from "@/app/components/mobile/InvitePeopleCard";
import { getEventCoverUrl } from "@/lib/eventCover";
import {
  fetchDiscoverFeed,
  splitDiscoverEvents,
  type DiscoverDateFilter,
  type DiscoverWorld,
} from "@/app/descobrir/_lib/discoverFeed";
import {
  buildTimingTag,
  formatEventDayLabel,
  formatLocationLabel,
  formatPriceLabel,
} from "@/app/descobrir/_lib/discoverFormat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = {
  worlds?: string;
  q?: string;
  city?: string;
  date?: string;
  day?: string;
  priceMin?: string;
  priceMax?: string;
  distanceKm?: string;
  lat?: string;
  lng?: string;
  tab?: string;
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const WORLD_ORDER: DiscoverWorld[] = ["padel", "events", "services"];

const toNumber = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseWorlds = (worldsParam?: string, tabParam?: string): DiscoverWorld[] => {
  if (worldsParam) {
    const raw = worldsParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean) as DiscoverWorld[];
    const unique = Array.from(new Set(raw)).filter((value) => WORLD_ORDER.includes(value));
    return unique.length ? WORLD_ORDER.filter((value) => unique.includes(value)) : [...WORLD_ORDER];
  }
  if (tabParam === "torneios") return ["padel"];
  if (tabParam === "reservas") return ["services"];
  if (tabParam === "eventos") return ["events"];
  return [...WORLD_ORDER];
};

const parseDate = (value?: string): DiscoverDateFilter => {
  if (!value) return "all";
  if (value === "today" || value === "upcoming" || value === "weekend" || value === "day") return value;
  return "all";
};

export default async function DescobrirPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const worlds = parseWorlds(resolvedParams.worlds, resolvedParams.tab);
  const q = resolvedParams.q ?? "";
  const city = resolvedParams.city ?? "";
  const date = parseDate(resolvedParams.date);
  const day = resolvedParams.day ?? "";
  const priceMin = toNumber(resolvedParams.priceMin) ?? 0;
  const priceMax = toNumber(resolvedParams.priceMax) ?? 100;
  const lat = toNumber(resolvedParams.lat);
  const lng = toNumber(resolvedParams.lng);
  const distanceParam = toNumber(resolvedParams.distanceKm);
  const hasCoords = typeof lat === "number" && typeof lng === "number";
  const distanceKm = hasCoords ? distanceParam ?? 5 : null;

  const priceMinFilter = priceMin > 0 ? priceMin : null;
  const priceMaxFilter = priceMax < 100 ? priceMax : null;

  const feed = await fetchDiscoverFeed({
    worlds,
    q,
    city,
    date,
    day,
    priceMin: priceMinFilter,
    priceMax: priceMaxFilter,
    lat,
    lng,
    distanceKm,
    eventLimit: 50,
    serviceLimit: 20,
  });

  const now = new Date();
  const { liveEvents, soonEvents, cityEvents } = splitDiscoverEvents(feed.events, {
    now,
    soonHours: 72,
    city,
    lat,
    lng,
    distanceKm,
  });

  const usedEventIds = new Set([...liveEvents, ...soonEvents, ...cityEvents].map((event) => event.id));
  const exploreOffers = feed.offers.filter((offer) =>
    offer.type === "event" ? !usedEventIds.has(offer.event.id) : true,
  );

  const showEvents = worlds.includes("events") || worlds.includes("padel");
  const showServices = worlds.includes("services") || worlds.includes("padel");

  const heroTitle = showServices && !showEvents
    ? "Reservas e serviços"
    : showEvents && !showServices
      ? "Eventos e planos"
      : "Descobrir agora";
  const heroSubtitle = showServices && !showEvents
    ? "Reservas e experiências prontas a marcar."
    : showEvents && !showServices
      ? "Encontra o que acontece agora e planeia a tua semana."
      : "Eventos, padel e serviços com curadoria para ti.";

  const hasActiveFilters =
    q.trim() ||
    city.trim() ||
    date !== "all" ||
    priceMin > 0 ||
    priceMax < 100 ||
    worlds.length !== WORLD_ORDER.length ||
    hasCoords;

  return (
    <main className="min-h-screen text-white pb-24">
      <MobileTopBar />
      <section className="orya-page-width px-4 md:px-8 pt-10 pb-8 md:pt-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-8">
            <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              <div className="space-y-3">
                <p className="orya-mobile-kicker">Descobrir</p>
                <h1 className="text-2xl font-semibold text-white md:text-3xl">{heroTitle}</h1>
                <p className="text-sm text-white/60">{heroSubtitle}</p>
              </div>
              <div className="mt-5">
                <DiscoverFilters
                  initialWorlds={worlds}
                  initialQuery={q}
                  initialCity={city}
                  initialDate={date}
                  initialDay={day}
                  initialPriceMin={priceMin}
                  initialPriceMax={priceMax}
                  initialDistanceKm={distanceKm}
                />
              </div>
            </div>

            {showEvents && (
              <section className="space-y-4">
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-[16px] font-semibold text-white">A acontecer</p>
                    <p className="text-[11px] text-white/60">Eventos a decorrer agora.</p>
                  </div>
                </div>

                {liveEvents.length === 0 ? (
                  <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                    Sem eventos a acontecer agora.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
                    {liveEvents.slice(0, 8).map((event, index) => {
                      const cover = getEventCoverUrl(event.coverImageUrl, {
                        seed: event.slug ?? event.id,
                        width: 512,
                        quality: 62,
                        format: "webp",
                        square: true,
                      });
                      const tag = buildTimingTag(event, now);
                      return (
                        <EventSquareCard
                          key={event.id}
                          href={`/eventos/${event.slug}`}
                          imageUrl={cover}
                          title={event.title}
                          location={formatLocationLabel(event)}
                          tagLabel={tag.label}
                          tagTone={tag.tone}
                          meta={[{ label: formatPriceLabel(event) ?? "—" }]}
                          imagePriority={index < 4}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {showEvents && (
              <section className="space-y-4">
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-[16px] font-semibold text-white">A seguir</p>
                    <p className="text-[11px] text-white/60">Próximas 24-72h.</p>
                  </div>
                </div>

                {soonEvents.length === 0 ? (
                  <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                    Sem eventos a seguir nas próximas horas.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
                    {soonEvents.slice(0, 8).map((event, index) => {
                      const cover = getEventCoverUrl(event.coverImageUrl, {
                        seed: event.slug ?? event.id,
                        width: 512,
                        quality: 62,
                        format: "webp",
                        square: true,
                      });
                      const tag = buildTimingTag(event, now);
                      return (
                        <EventSquareCard
                          key={event.id}
                          href={`/eventos/${event.slug}`}
                          imageUrl={cover}
                          title={event.title}
                          location={formatLocationLabel(event)}
                          tagLabel={tag.label}
                          tagTone={tag.tone}
                          meta={[{ label: formatPriceLabel(event) ?? "—" }]}
                          imagePriority={index < 4}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {showEvents && (
              <section className="space-y-4">
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-[16px] font-semibold text-white">Na tua cidade</p>
                    <p className="text-[11px] text-white/60">Curadoria perto de ti.</p>
                  </div>
                </div>

                {cityEvents.length === 0 ? (
                  <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                    Sem eventos próximos para mostrar.
                    {hasActiveFilters && (
                      <div className="mt-3">
                        <Link href="/" className="btn-orya inline-flex text-[11px] font-semibold">
                          Limpar filtros
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3">
                    {cityEvents.slice(0, 6).map((event, index) => {
                      const cover = getEventCoverUrl(event.coverImageUrl, {
                        seed: event.slug ?? event.id,
                        width: 192,
                        quality: 58,
                        format: "webp",
                        square: true,
                      });
                      return (
                        <EventListCard
                          key={event.id}
                          href={`/eventos/${event.slug}`}
                          imageUrl={cover}
                          title={event.title}
                          subtitle={formatLocationLabel(event) ?? undefined}
                          dateLabel={formatEventDayLabel(event) ?? undefined}
                          meta={[{ label: formatPriceLabel(event) ?? "—" }]}
                          className="w-full"
                          imagePriority={index === 0}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-[16px] font-semibold text-white">Explorar</p>
                  <p className="text-[11px] text-white/60">Mais sugestões para ti.</p>
                </div>
              </div>

              {exploreOffers.length === 0 ? (
                <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                  Sem sugestões adicionais por agora.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {exploreOffers.slice(0, 10).map((offer) =>
                    offer.type === "event" ? (
                      <EventListCard
                        key={offer.key}
                        href={`/eventos/${offer.event.slug}`}
                        imageUrl={getEventCoverUrl(offer.event.coverImageUrl, {
                          seed: offer.event.slug ?? offer.event.id,
                          width: 192,
                          quality: 58,
                          format: "webp",
                          square: true,
                        })}
                        title={offer.event.title}
                        subtitle={formatLocationLabel(offer.event) ?? undefined}
                        dateLabel={formatEventDayLabel(offer.event) ?? undefined}
                        meta={[{ label: formatPriceLabel(offer.event) ?? "—" }]}
                        className="w-full"
                      />
                    ) : (
                      <ServiceCard key={offer.key} service={offer.service} />
                    ),
                  )}
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
          </aside>
        </div>
      </section>
    </main>
  );
}
