import Link from "next/link";
import Image from "next/image";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CTA_PRIMARY } from "@/app/org/_shared/dashboardUi";
import { getEventLocationDisplay } from "@/lib/location/eventLocation";
import { getEventCoverUrl } from "@/lib/eventCover";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { defaultBlurDataURL } from "@/lib/image";
import { resolveOrganizationIdFromCookies } from "@/lib/organizationId";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import { headers } from "next/headers";
import { resolveLocale, t } from "@/lib/i18n";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

export const dynamic = "force-dynamic";

type EventCard = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  addressId: string | null;
  addressRef: {
    formattedAddress: string | null;
    canonical: Prisma.JsonValue | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  isGratis: boolean;
  priceFrom: number | null;
  coverImageUrl: string | null;
};

type PageProps = {
  searchParams?: { q?: string } | Promise<{ q?: string }>;
};

function formatDate(date: Date | null | undefined, locale: string) {
  if (!date) return t("dateTbd", locale);
  return date.toLocaleString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadEvents(query?: string): Promise<EventCard[]> {
  const filters: Prisma.EventWhereInput[] = [
    { status: { in: PUBLIC_EVENT_DISCOVER_STATUSES } },
    { isDeleted: false },
    { organizationId: { not: null } },
    { organization: { status: "ACTIVE" } },
  ];

  if (query && query.trim().length > 0) {
    const q = query.trim();
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { addressRef: { formattedAddress: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const events = await prisma.event.findMany({
    where: { AND: filters },
    orderBy: { startsAt: "asc" },
    take: 12,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      addressId: true,
      addressRef: {
        select: {
          formattedAddress: true,
          canonical: true,
          latitude: true,
          longitude: true,
        },
      },
      coverImageUrl: true,
      ticketTypes: {
        select: { price: true },
      },
    },
  });

  return events.map((ev) => {
    const ticketPrices = ev.ticketTypes?.map((t) => t.price ?? 0) ?? [];
    const priceFrom = ticketPrices.length > 0 ? Math.min(...ticketPrices) / 100 : null;
    const isGratis = deriveIsFreeEvent({ ticketPrices });

    return {
      id: ev.id,
      slug: ev.slug,
      title: ev.title,
      description: ev.description?.slice(0, 160) ?? null,
      startsAt: ev.startsAt ?? null,
      endsAt: ev.endsAt ?? null,
      addressId: ev.addressId ?? null,
      addressRef: ev.addressRef
        ? {
            formattedAddress: ev.addressRef.formattedAddress ?? null,
            canonical: ev.addressRef.canonical ?? null,
            latitude: ev.addressRef.latitude ?? null,
            longitude: ev.addressRef.longitude ?? null,
          }
        : null,
      isGratis,
      priceFrom,
      coverImageUrl: ev.coverImageUrl ?? null,
    };
  });
}

export default async function EventosFeedPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const search = resolved.q?.trim() ?? "";
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const locale = resolveLocale(acceptLanguage ? acceptLanguage.split(",")[0] : null);
  const events = await loadEvents(search);
  const organizationId = await resolveOrganizationIdFromCookies();
  const createEventHref = organizationId
    ? buildOrgHref(organizationId, "/events/new")
    : buildOrgHubHref("/create");

  return (
    <main className="min-h-screen w-full text-white">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="orya-page-width px-6 md:px-10 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                {t("eventsFeedTitle", locale)}
              </p>
              <p className="text-sm text-white/80">
                {t("eventsFeedSubtitle", locale)}
              </p>
            </div>
          </div>

          <Link
            href={createEventHref}
            className={`${CTA_PRIMARY} hidden sm:inline-flex px-4 py-1.5 text-xs active:scale-95`}
          >
            + {t("eventsFeedCreate", locale)}
          </Link>
        </div>
      </header>

      <section className="orya-page-width px-6 md:px-10 py-8 md:py-10 space-y-6">
        <div className="space-y-4">
          <form className="flex flex-col md:flex-row gap-3 md:items-center" method="get" action="/eventos">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                🔍
              </span>
              <input
                name="q"
                defaultValue={search}
                placeholder={t("eventsFeedSearchPlaceholder", locale)}
                className="w-full rounded-full bg-black/60 border border-white/15 pl-8 pr-24 py-2 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60 transition"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full bg-white/90 text-[11px] font-medium text-black hover:bg-white"
              >
                {t("eventsFeedSearchButton", locale)}
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {events.length === 0 ? (
            <p className="text-sm text-white/60 col-span-full">
              {t("eventsFeedEmpty", locale)}
            </p>
          ) : (
            events.map((ev, index) => {
              const locationDisplay = getEventLocationDisplay(
                {
                  addressRef: ev.addressRef ?? null,
                },
                "Local a definir",
              );
              const cover = ev.coverImageUrl
                ? getEventCoverUrl(ev.coverImageUrl, {
                    seed: ev.slug ?? ev.id,
                    width: 900,
                    quality: 70,
                    format: "webp",
                    square: true,
                  })
                : null;
              return (
                <Link
                  key={ev.id}
                  href={`/eventos/${ev.slug}`}
                  className="group w-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-black/70 to-black/90 overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.7)] hover:border-[#6BFFFF]/60 hover:shadow-[0_0_40px_rgba(107,255,255,0.35)] transition"
                >
                  <div className="relative aspect-square overflow-hidden">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={ev.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        className="object-cover"
                        placeholder="blur"
                        blurDataURL={defaultBlurDataURL}
                        priority={index < 2}
                      />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_top,_#FF00C8_0,_#02020a_65%)] flex items-center justify-center text-xs text-white/60">
                        {t("eventCardFallbackLabel", locale)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/25 to-black/70" />
                    {ev.isGratis && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-[#6BFFFF] border border-[#6BFFFF]/40">
                        {t("eventCardFree", locale)}
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-white/60">
                        {formatDate(ev.startsAt, locale)}
                      </p>
                      {ev.priceFrom !== null && !ev.isGratis && (
                        <p className="text-[11px] text-white">
                          {t("eventCardFrom", locale)}{" "}
                          <span className="font-semibold">{ev.priceFrom} € </span>
                        </p>
                      )}
                    </div>

                    <h2 className="text-sm font-semibold line-clamp-2">{ev.title}</h2>

                    <p className="text-[11px] text-white/60 line-clamp-2">
                      {ev.description || t("eventCardNoDescription", locale)}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[11px] text-white/70 line-clamp-1">
                          {locationDisplay.primary}
                        </p>
                        {locationDisplay.secondary && (
                          <p className="text-[10px] text-white/40 line-clamp-1">
                            {locationDisplay.secondary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
