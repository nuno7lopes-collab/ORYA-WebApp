import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { resolveLocale, t } from "@/lib/i18n";
import CalendarWidgetClient from "./CalendarWidgetClient";

type PageProps = {
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

export default async function WidgetPadelCalendarPage({ searchParams }: PageProps) {
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : undefined;
  const requestEventId = typeof searchParams?.eventId === "string" ? searchParams.eventId : undefined;
  const lang = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;
  const locale = resolveLocale(lang);

  if (!slug && !requestEventId) {
    return (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventMissing", locale)}</p>
      </div>
    );
  }

  const baseUrl = getAppBaseUrl();
  const url = new URL("/api/widgets/padel/calendar", baseUrl);
  if (slug) url.searchParams.set("slug", slug);
  if (requestEventId) url.searchParams.set("eventId", requestEventId);

  const res = (await fetch(url.toString(), { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => null)) as CalendarResponse | null;

  if (!res || res.ok === false) {
    const messageKey =
      res?.error === "EVENT_NOT_FOUND"
        ? "eventNotFound"
        : res?.error === "FORBIDDEN"
          ? "eventNotPublic"
          : "eventMissing";
    return (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t(messageKey, locale)}</p>
      </div>
    );
  }

  const days = res.days ?? [];
  const timezone = res.event?.timezone ?? "Europe/Lisbon";
  const eventId = res.event?.id ?? null;

  return (
    eventId ? (
      <CalendarWidgetClient eventId={eventId} timezone={timezone} locale={locale} initialDays={days} />
    ) : (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventMissing", locale)}</p>
      </div>
    )
  );
}
