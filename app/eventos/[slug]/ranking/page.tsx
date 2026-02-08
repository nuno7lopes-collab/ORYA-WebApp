import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getEventCoverSuggestionIds, getEventCoverUrl } from "@/lib/eventCover";
import { resolveLocale, t } from "@/lib/i18n";
import PadelRankingsClient from "@/app/padel/rankings/PadelRankingsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function EventRankingPage({ params, searchParams }: PageProps) {
  const resolved = await params;
  const slug = resolved.slug;
  const headersList = await headers();
  const langParam =
    typeof searchParams?.lang === "string"
      ? searchParams.lang
      : Array.isArray(searchParams?.lang)
        ? searchParams?.lang?.[0]
        : null;
  const acceptLanguage = headersList.get("accept-language");
  const locale = resolveLocale(langParam ?? (acceptLanguage ? acceptLanguage.split(",")[0] : null));

  const event = await prisma.event.findUnique({
    where: { slug, isDeleted: false },
    select: { id: true, title: true, coverImageUrl: true, templateType: true },
  });
  if (!event) {
    redirect("/?tab=torneios");
  }
  if (event.templateType !== "PADEL") {
    redirect(`/eventos/${slug}`);
  }

  const coverUrl = getEventCoverUrl(event.coverImageUrl, {
    seed: slug,
    suggestedIds: getEventCoverSuggestionIds({ templateType: event.templateType ?? null }),
    width: 1200,
    quality: 70,
    format: "webp",
  });

  return (
    <main className="min-h-screen bg-[#0b0f1d] text-white">
      <section className="orya-page-width px-6 pb-8 pt-12 md:px-10">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050810]/90 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                {t("tournamentRankingLabel", locale)}
              </p>
              <h1 className="text-3xl font-semibold">{event.title}</h1>
              <p className="text-sm text-white/70">
                {t("tournamentRankingSubtitle", locale)}
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                <Link
                  href={`/eventos/${slug}`}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  {t("publicPageLabel", locale)}
                </Link>
                <Link
                  href={`/eventos/${slug}/calendario`}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  {t("calendarLabel", locale)}
                </Link>
                <Link
                  href={`/eventos/${slug}/score`}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  {t("liveScoreButtonLabel", locale)}
                </Link>
              </div>
            </div>
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={event.title}
                className="h-24 w-24 rounded-2xl border border-white/15 object-cover md:h-28 md:w-28"
              />
            )}
          </div>
        </div>
      </section>

      <section className="orya-page-width px-6 pb-16 md:px-10">
        <PadelRankingsClient eventId={event.id} showFilters={false} locale={locale} />
      </section>
    </main>
  );
}
