import Link from "next/link";
import { headers } from "next/headers";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import HomeHeroMedia from "@/app/components/home/HomeHeroMedia";
import HomeCityPicker from "@/app/components/home/HomeCityPicker";
import HomePopularCarousel from "@/app/components/home/HomePopularCarousel";
import HomeFooter from "@/app/components/home/HomeFooter";
import { fetchDiscoverFeed } from "@/app/descobrir/_lib/discoverFeed";
import {
  buildTimingTag,
  formatLocationLabel,
  formatPriceLabel,
} from "@/app/descobrir/_lib/discoverFormat";
import { getEventCoverUrl } from "@/lib/eventCover";
import type { PublicEventCard } from "@/domain/events/publicEventCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CarouselItem = {
  key: string;
  href: string;
  imageUrl: string;
  title: string;
  location?: string | null;
  tagLabel?: string;
  metaLabel?: string | null;
};

type HeaderSource = {
  get(name: string): string | null;
};

type IpLocation = {
  city: string | null;
  region: string | null;
  country: string | null;
};

const pickHeader = (hdrs: HeaderSource, names: string[]) => {
  for (const name of names) {
    const value = hdrs.get(name);
    if (value && value.trim()) return value.trim();
  }
  return null;
};

const resolveIpLocation = async (): Promise<IpLocation> => {
  const hdrs = await headers();
  const city =
    pickHeader(hdrs, ["cf-ipcity", "x-geo-city", "x-country-city"]) ?? null;
  const region =
    pickHeader(hdrs, ["cf-region", "x-geo-region", "x-country-region"]) ?? null;
  const country =
    pickHeader(hdrs, ["cf-ipcountry", "cloudfront-viewer-country", "x-geo-country"]) ??
    null;
  return { city, region, country };
};

const normalizeCity = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= 2 ? trimmed : null;
};

const isUpcomingEvent = (event: PublicEventCard, now: Date) => {
  const end = event.endsAt ? new Date(event.endsAt) : null;
  if (end && !Number.isNaN(end.getTime())) {
    return end.getTime() >= now.getTime();
  }
  const start = event.startsAt ? new Date(event.startsAt) : null;
  if (start && !Number.isNaN(start.getTime())) {
    return start.getTime() >= now.getTime();
  }
  return false;
};

const sortPopularEvents = (a: PublicEventCard, b: PublicEventCard) => {
  const highlight = Number(b.isHighlighted) - Number(a.isHighlighted);
  if (highlight !== 0) return highlight;
  const aStart = new Date(a.startsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const aValue = Number.isNaN(aStart) ? Number.MAX_SAFE_INTEGER : aStart;
  const bValue = Number.isNaN(bStart) ? Number.MAX_SAFE_INTEGER : bStart;
  return aValue - bValue;
};

export default async function HomePage() {
  const location = await resolveIpLocation();
  const city = normalizeCity(location.city);
  const now = new Date();

  const feed = await fetchDiscoverFeed({
    worlds: ["events"],
    city: city ?? undefined,
    eventLimit: 36,
  });

  const buildPopularEvents = (events: PublicEventCard[]) =>
    events
      .filter((event) => event.status === "ACTIVE" && isUpcomingEvent(event, now))
      .sort(sortPopularEvents);

  const basePopular = buildPopularEvents(feed.events);
  let popularEvents = basePopular.slice(0, 12);
  let isCityScoped = Boolean(city && basePopular.length > 0);

  if (city && basePopular.length < 6) {
    const fallbackFeed = await fetchDiscoverFeed({
      worlds: ["events"],
      eventLimit: 36,
    });
    const fallbackPopular = buildPopularEvents(fallbackFeed.events);
    if (basePopular.length === 0) {
      isCityScoped = false;
      popularEvents = fallbackPopular.slice(0, 12);
    } else {
      const seen = new Set(basePopular.map((event) => event.id));
      const merged = [...basePopular];
      fallbackPopular.forEach((event) => {
        if (!seen.has(event.id)) merged.push(event);
      });
      popularEvents = merged.slice(0, 12);
    }
  }

  const carouselItems: CarouselItem[] = popularEvents.map((event) => {
    const cover = getEventCoverUrl(event.coverImageUrl, {
      seed: event.slug ?? event.id,
      width: 512,
      quality: 62,
      format: "webp",
      square: true,
    });
    const tag = buildTimingTag(event, now);
    const priceLabel = formatPriceLabel(event);
    return {
      key: `${event.id}-${event.slug}`,
      href: `/eventos/${event.slug}`,
      imageUrl: cover,
      title: event.title,
      location: formatLocationLabel(event),
      tagLabel: tag.label,
      metaLabel: priceLabel,
    };
  });

  const locationLabel = isCityScoped && city ? city : "perto de ti";
  const discoverHref =
    isCityScoped && city ? `/descobrir?city=${encodeURIComponent(city)}` : "/descobrir";
  const showCityPicker = !isCityScoped;
  const primaryCtaClass =
    "inline-flex items-center justify-center rounded-full border border-white/60 bg-white px-6 py-3 text-[13px] font-semibold !text-black shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition hover:-translate-y-[1px] hover:shadow-[0_22px_50px_rgba(0,0,0,0.5)]";
  const ghostCtaClass =
    "inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-[13px] text-white/85 hover:border-white/35 hover:bg-white/10 transition";
  const heroVideoSrc = "/videos/app-hero.mp4";

  return (
    <main className="min-h-0 bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white flex flex-col">
      <MobileTopBar />

      <section className="orya-page-width px-4 md:px-8 pt-24 pb-12 lg:pt-24">
        <div className="grid gap-20 md:grid-cols-2 md:items-stretch lg:gap-12">
          <div className="flex min-h-[460px] flex-col justify-center rounded-[32px] bg-transparent p-8 text-white md:min-h-[560px] md:p-10 lg:min-h-[600px] lg:p-12">
            <h1 className="text-4xl font-semibold leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] md:text-5xl lg:text-[60px]">
              Leva a ORYA no bolso e descobre o que acontece agora.
            </h1>
            <p className="mt-5 max-w-[520px] text-sm text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] md:text-base leading-relaxed">
              Eventos, padel e experiências num só lugar. Segue a tua rede, guarda planos e compra bilhetes em
              segundos.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/signup" className={primaryCtaClass}>
                Quero a app
              </Link>
              <Link href={discoverHref} className={ghostCtaClass}>
                Ver eventos
              </Link>
            </div>
          </div>

          <div className="min-h-[460px] rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_28px_60px_rgba(0,0,0,0.18)] md:min-h-[560px] md:p-10 lg:min-h-[600px] lg:p-12">
            <HomeHeroMedia videoSrc={heroVideoSrc} />
          </div>
        </div>
      </section>

      <section className="orya-page-width px-4 md:px-8 pb-8 md:pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[16px] font-semibold text-white">
                Eventos populares {locationLabel}
              </p>
              {showCityPicker ? <HomeCityPicker baseHref="/descobrir" /> : null}
            </div>
            <p className="text-[11px] text-white/60">
              Curadoria com base na tua localização aproximada.
            </p>
          </div>
          <Link href={discoverHref} className="text-[11px] text-white/70 hover:text-white/90 transition">
            Descobrir mais
          </Link>
        </div>

        {carouselItems.length === 0 ? (
          <div className="orya-mobile-surface-soft mt-5 p-4 text-[12px] text-white/60">
            Ainda não temos eventos populares para mostrar.
          </div>
        ) : (
          <div className="mt-6">
            <HomePopularCarousel items={carouselItems} />
          </div>
        )}
      </section>

      <HomeFooter />
    </main>
  );
}
