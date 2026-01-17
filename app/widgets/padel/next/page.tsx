import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { resolveLocale, t } from "@/lib/i18n";
import NextMatchesWidgetClient from "./NextMatchesWidgetClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type NextResponse = {
  ok?: boolean;
  event?: { id: number; title: string; timezone?: string | null };
  items?: Array<{
    id: number;
    startAt: string | null;
    court: string | null;
    teamA: string;
    teamB: string;
    status: string;
  }>;
};

export default async function WidgetNextMatchesPage({ searchParams }: PageProps) {
  const eventId = typeof searchParams?.eventId === "string" ? searchParams.eventId : undefined;
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : undefined;
  const lang = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;
  const locale = resolveLocale(lang);
  const baseUrl = getAppBaseUrl();
  const url = eventId
    ? `${baseUrl}/api/widgets/padel/next?eventId=${encodeURIComponent(eventId)}`
    : slug
      ? `${baseUrl}/api/widgets/padel/next?slug=${encodeURIComponent(slug)}`
      : null;

  if (!url) {
    return (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventMissing", locale)}</p>
      </div>
    );
  }

  const data: NextResponse | null = url
    ? await fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null)
    : null;

  const items = data?.items ?? [];
  const event = data?.event ?? null;

  return (
    event?.id ? (
      <NextMatchesWidgetClient
        eventId={event.id}
        timezone={event.timezone ?? null}
        locale={locale}
        title={event.title ?? ""}
        initialItems={items}
      />
    ) : (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventMissing", locale)}</p>
      </div>
    )
  );
}
