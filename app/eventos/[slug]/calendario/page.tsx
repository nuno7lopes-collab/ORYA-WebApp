import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { resolveLocale, t } from "@/lib/i18n";
import { getEventCoverSuggestionIds, getEventCoverUrl } from "@/lib/eventCover";
import CalendarWidgetClient from "@/app/widgets/padel/calendar/CalendarWidgetClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const resolveMessageKey = (error?: string | null) => {
  if (error === "EVENT_NOT_FOUND") return "eventNotFound";
  if (error === "FORBIDDEN") return "eventNotPublic";
  return "eventMissing";
};

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

type CalendarMatch = {
  id: number;
  startAt: string;
  endAt: string | null;
  status: string;
  roundLabel: string | null;
  groupLabel: string | null;
  courtId: number | null;
  courtLabel: string;
  teamA: string;
  teamB: string;
  delayStatus: string | null;
  dayKey: string;
};

type CalendarDay = {
  date: string;
  courts: Array<{ courtId: number | null; courtLabel: string; matches: CalendarMatch[] }>;
};

type CalendarResponse = {
  ok?: boolean;
  event?: { id: number; title: string; timezone: string };
  days?: CalendarDay[];
  error?: string;
};

export default async function EventCalendarPage({ params, searchParams }: PageProps) {
  const resolved = await params;
  const slug = resolved.slug;
  const lang = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;
  const locale = resolveLocale(lang);

  const event = await prisma.event.findUnique({
    where: { slug, isDeleted: false },
    select: { id: true, title: true, coverImageUrl: true, templateType: true },
  });
  if (!event) {
    redirect("/descobrir?tab=torneios");
  }
  if (event.templateType !== "PADEL") {
    redirect(`/eventos/${slug}`);
  }

  const baseUrl = getAppBaseUrl();
  const calendarUrl = new URL("/api/padel/public/calendar", baseUrl);
  calendarUrl.searchParams.set("slug", slug);

  const res = (await fetch(calendarUrl.toString(), { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => null)) as CalendarResponse | null;

  const hasError = !res || res.ok === false;
  const calendarDays = res?.ok ? res.days ?? [] : [];
  const timezone = res?.event?.timezone ?? "Europe/Lisbon";

  const coverUrl = getEventCoverUrl(event.coverImageUrl, {
    seed: slug,
    suggestedIds: getEventCoverSuggestionIds({ templateType: event.templateType ?? null }),
    width: 1400,
    quality: 70,
    format: "webp",
  });

  return (
    <main className="min-h-screen bg-[#0b0f1d] text-white">
      <section className="orya-page-width px-6 pb-6 pt-10 md:px-10">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050810]/90 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                Calendário público
              </p>
              <h1 className="text-2xl font-semibold md:text-3xl">{event.title}</h1>
              <p className="text-sm text-white/70">
                Agenda oficial com horários por court e ordem de jogo.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                <Link
                  href={`/eventos/${slug}`}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  Página pública
                </Link>
                <Link
                  href={`/eventos/${slug}/ranking`}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  Ranking
                </Link>
                <Link
                  href={`/eventos/${slug}/monitor`}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  Monitor TV
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

      {hasError ? (
        <section className="orya-page-width px-6 pb-16 md:px-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
            {t(resolveMessageKey(res?.error), locale)}
          </div>
        </section>
      ) : (
        <section className="orya-page-width px-6 pb-16 md:px-10">
          <CalendarWidgetClient
            eventId={event.id}
            timezone={timezone}
            locale={locale}
            initialDays={calendarDays}
            showHeader={false}
            containerClassName="text-white"
          />
        </section>
      )}
    </main>
  );
}
