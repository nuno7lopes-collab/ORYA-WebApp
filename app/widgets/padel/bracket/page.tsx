import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { resolveLocale, t } from "@/lib/i18n";
import BracketWidgetClient from "./BracketWidgetClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type BracketResponse = {
  ok?: boolean;
  event?: { id: number; title: string };
  rounds?: Array<{
    label: string;
    matches: Array<{ id: number; status: string; score: string; teamA: string; teamB: string }>;
  }>;
};

export default async function WidgetBracketPage({ searchParams }: PageProps) {
  const requestEventId = typeof searchParams?.eventId === "string" ? searchParams.eventId : undefined;
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : undefined;
  const lang = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;
  const locale = resolveLocale(lang);
  const baseUrl = getAppBaseUrl();
  const url = requestEventId
    ? `${baseUrl}/api/widgets/padel/bracket?eventId=${encodeURIComponent(requestEventId)}`
    : slug
      ? `${baseUrl}/api/widgets/padel/bracket?slug=${encodeURIComponent(slug)}`
      : null;

  if (!url) {
    return (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventMissing", locale)}</p>
      </div>
    );
  }

  const data = (await fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null)) as
    | BracketResponse
    | null;
  const rounds = data?.rounds ?? [];
  const eventId = data?.event?.id ?? null;

  return (
    eventId ? (
      <BracketWidgetClient
        eventId={eventId}
        title={data?.event?.title ?? ""}
        initialRounds={rounds}
        locale={locale}
      />
    ) : (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventMissing", locale)}</p>
      </div>
    )
  );
}
