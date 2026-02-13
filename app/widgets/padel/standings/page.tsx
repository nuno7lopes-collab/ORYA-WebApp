import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { resolveLocale, t } from "@/lib/i18n";
import StandingsWidgetClient from "./StandingsWidgetClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type StandingRow = {
  entityId: number;
  pairingId: number | null;
  playerId?: number | null;
  points: number;
  wins: number;
  draws?: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
  label?: string | null;
};

type StandingsResponse = {
  ok?: boolean;
  event?: { id?: number; slug?: string | null } | null;
  entityType?: "PAIRING" | "PLAYER";
  rows?: StandingRow[];
  groups?: Record<string, StandingRow[]>;
};

export default async function WidgetStandingsPage({ searchParams }: PageProps) {
  const eventId = typeof searchParams?.eventId === "string" ? searchParams.eventId : undefined;
  const eventSlug = typeof searchParams?.slug === "string" ? searchParams.slug : undefined;
  const lang = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;
  const locale = resolveLocale(lang);
  if (!eventId) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventMissing", locale)}</p>
      </div>
    );
  }
  const baseUrl = getAppBaseUrl();
  const query = new URLSearchParams({ eventId });
  if (eventSlug) query.set("slug", eventSlug);
  const res = await fetch(`${baseUrl}/api/widgets/padel/standings?${query.toString()}`, {
    cache: "no-store",
  }).then((r) => r.json()).catch(() => null) as StandingsResponse | null;

  const standings = res?.groups ?? {};
  const entityType = res?.entityType === "PLAYER" ? "PLAYER" : "PAIRING";
  const eventIdNumber = Number(eventId);
  if (!Number.isFinite(eventIdNumber)) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventInvalid", locale)}</p>
      </div>
    );
  }

  return (
    <StandingsWidgetClient
      eventId={eventIdNumber}
      eventSlug={res?.event?.slug ?? eventSlug ?? null}
      initialEntityType={entityType}
      initialStandings={standings}
      locale={locale}
    />
  );
}
