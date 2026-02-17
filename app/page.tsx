import Link from "next/link";
import { headers } from "next/headers";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
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

const buildDemoCarouselItems = (discoverHref: string, cityLabel: string): CarouselItem[] => {
  const demoSpecs = [
    {
      key: "demo-night",
      title: "Noite Social Club",
      imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
      tag: "Hoje · 21:00",
      meta: "Desde 12€",
    },
    {
      key: "demo-sunset",
      title: "Sunset Networking",
      imageUrl: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80",
      tag: "Sex · 19:00",
      meta: "Desde 9€",
    },
    {
      key: "demo-padel",
      title: "Padel Open Session",
      imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
      tag: "Sáb · 10:00",
      meta: "Desde 15€",
    },
    {
      key: "demo-jazz",
      title: "Jazz & Friends",
      imageUrl: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80",
      tag: "Dom · 18:30",
      meta: "Desde 18€",
    },
    {
      key: "demo-food",
      title: "Food Market Night",
      imageUrl: "https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1200&q=80",
      tag: "Qua · 20:00",
      meta: "Entrada livre",
    },
    {
      key: "demo-startup",
      title: "Startup Afterwork",
      imageUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80",
      tag: "Qui · 18:00",
      meta: "Desde 7€",
    },
  ];

  return demoSpecs.map((item) => ({
    key: item.key,
    href: `${discoverHref}${discoverHref.includes("?") ? "&" : "?"}demo=1`,
    imageUrl: item.imageUrl,
    title: item.title,
    location: cityLabel,
    tagLabel: item.tag,
    metaLabel: item.meta,
  }));
};

export default async function HomePage() {
  const location = await resolveIpLocation();
  const city = normalizeCity(location.city);
  const now = new Date();

  const feed = await fetchDiscoverFeed({
    worlds: ["events"],
    date: "upcoming",
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
      date: "upcoming",
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

  const discoverHref = city ? `/descobrir?city=${encodeURIComponent(city)}` : "/descobrir";
  const cityLabel = city ?? location.region ?? "perto de ti";
  const finalCarouselItems =
    carouselItems.length > 0 ? carouselItems : buildDemoCarouselItems(discoverHref, cityLabel);
  const usingDemoCarousel = carouselItems.length === 0;
  const primaryCtaClass =
    "inline-flex items-center justify-center rounded-full border border-white/60 bg-white px-6 py-3 text-[13px] font-semibold !text-black shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition hover:-translate-y-[1px] hover:shadow-[0_22px_50px_rgba(0,0,0,0.5)]";
  const ghostCtaClass =
    "inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-[13px] text-white/85 hover:border-white/35 hover:bg-white/10 transition";

  return (
    <main className="min-h-0 bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white flex flex-col">
      <MobileTopBar />

      <section className="orya-page-width px-4 md:px-8 pt-36 md:pt-40 pb-6 lg:pt-44">
        <div className="mx-auto max-w-[920px] text-center">
          <h1 className="text-4xl font-semibold leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] md:text-5xl lg:text-[64px]">
            Leva a ORYA no bolso e descobre o que acontece agora.
          </h1>
          <p className="mx-auto mt-6 max-w-[700px] text-sm leading-relaxed text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] md:text-lg">
            Eventos, padel e experiências num só lugar. Segue a tua rede, guarda planos e compra bilhetes em segundos.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className={primaryCtaClass}>
              Quero a app
            </Link>
            <Link href={discoverHref} className={ghostCtaClass}>
              Ver eventos
            </Link>
          </div>
        </div>
      </section>

      <section className="orya-page-width px-4 md:px-8 pb-10 md:pb-6 mt-10 md:mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-white md:text-[40px]">
              Eventos populares perto de ti
            </p>
            <p className="text-[12px] text-white/65">
              Curadoria por localização via IP, com prioridade para eventos ativos e próximos.
            </p>
          </div>
          <Link href={discoverHref} className="text-[12px] text-white/75 hover:text-white/95 transition">
            Descobrir mais
          </Link>
        </div>

        {usingDemoCarousel ? (
          <p className="mt-3 text-[11px] text-white/55">
            Sem eventos públicos no índice neste ambiente. A mostrar eventos de demonstração com fotografias reais.
          </p>
        ) : null}

        <div className="mt-8">
          <HomePopularCarousel items={finalCarouselItems} />
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}
