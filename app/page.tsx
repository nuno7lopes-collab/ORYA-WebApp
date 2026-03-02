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
import {
  ORYA_APP_INSTALL_CTA_LABEL,
  ORYA_APP_INSTALL_HINT,
  ORYA_APP_INSTALL_URL,
} from "@/lib/mobileAppInstall";
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
      key: "demo-padel-1",
      title: "Open de Padel Matinal",
      imageUrl: "https://images.unsplash.com/photo-1543351611-58f69d4a9f5b?auto=format&fit=crop&w=1200&q=80",
      tag: "Hoje · 09:30",
      meta: "Desde 15€",
    },
    {
      key: "demo-padel-2",
      title: "Liga M3 Weekend",
      imageUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=80",
      tag: "Sáb · 10:00",
      meta: "Desde 20€",
    },
    {
      key: "demo-padel-3",
      title: "Duplas Abertas Prime",
      imageUrl: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1200&q=80",
      tag: "Dom · 11:30",
      meta: "Split disponível",
    },
    {
      key: "demo-padel-4",
      title: "Campus Intensivo de Jogo",
      imageUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
      tag: "Ter · 20:00",
      meta: "Desde 12€",
    },
    {
      key: "demo-padel-5",
      title: "Treino Técnico com Coach",
      imageUrl: "https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=1200&q=80",
      tag: "Qua · 19:00",
      meta: "Aula",
    },
    {
      key: "demo-padel-6",
      title: "Night Session Club Series",
      imageUrl: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80",
      tag: "Qui · 21:30",
      meta: "Desde 9€",
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
    worlds: ["padel"],
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
  if (city && basePopular.length < 6) {
    const fallbackFeed = await fetchDiscoverFeed({
      worlds: ["padel"],
      date: "upcoming",
      eventLimit: 36,
    });
    const fallbackPopular = buildPopularEvents(fallbackFeed.events);
    if (basePopular.length === 0) {
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

  const discoverHref = city
    ? `/descobrir?tab=torneios&city=${encodeURIComponent(city)}`
    : "/descobrir";
  const cityLabel = city ?? location.region ?? "perto de ti";
  const finalCarouselItems =
    carouselItems.length > 0 ? carouselItems : buildDemoCarouselItems(discoverHref, cityLabel);
  const usingDemoCarousel = carouselItems.length === 0;
  const primaryCtaClass =
    "inline-flex items-center justify-center rounded-full border border-white/60 bg-white px-6 py-3 text-[13px] font-semibold !text-black shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition hover:-translate-y-[1px] hover:shadow-[0_22px_50px_rgba(0,0,0,0.5)]";

  return (
    <main className="min-h-0 flex flex-1 flex-col bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
      <MobileTopBar />

      <section className="orya-page-width px-4 md:px-8 pt-36 md:pt-40 pb-6 lg:pt-44">
        <div className="mx-auto max-w-[920px] text-center">
          <h1 className="text-4xl font-semibold leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] md:text-5xl lg:text-[64px]">
            A melhor app de padel.
          </h1>
          <p className="mx-auto mt-6 max-w-[700px] text-sm leading-relaxed text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] md:text-lg">
            Instala a ORYA para descobrir torneios perto de ti e entrar em jogo mais rápido.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <a href={ORYA_APP_INSTALL_URL} className={primaryCtaClass}>
              {ORYA_APP_INSTALL_CTA_LABEL}
            </a>
          </div>
          <p className="mt-3 text-[12px] text-white/62">{ORYA_APP_INSTALL_HINT}</p>
        </div>
      </section>

      <section className="orya-page-width mt-10 px-4 pb-16 md:mt-14 md:px-8 md:pb-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-white md:text-[40px]">
              Torneios perto de ti
            </p>
          </div>
          <Link href={discoverHref} className="text-[12px] text-white/75 hover:text-white/95 transition">
            Ver todos
          </Link>
        </div>

        {usingDemoCarousel ? (
          <p className="mt-3 text-[11px] text-white/55">
            Sem torneios públicos no índice neste ambiente. A mostrar sugestões de demonstração com fotografias reais.
          </p>
        ) : null}

        <div className="mt-8">
          <HomePopularCarousel items={finalCarouselItems} />
        </div>
      </section>

      <div className="mt-auto">
        <HomeFooter />
      </div>
    </main>
  );
}
