import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { EventAccessMode } from "@prisma/client";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { resolveLocale, t } from "@/lib/i18n";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function WidgetInscricoesPage({ searchParams }: PageProps) {
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : undefined;
  const lang = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;
  const locale = resolveLocale(lang);
  if (!slug) {
    return (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("slugMissing", locale)}</p>
      </div>
    );
  }

  const event = await prisma.event.findUnique({
    where: { slug, isDeleted: false },
    select: {
      title: true,
      status: true,
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
      padelTournamentConfig: { select: { advancedSettings: true } },
    },
  });
  if (!event) {
    return (
      <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
        <p className="text-sm text-white/70">{t("eventNotFound", locale)}</p>
      </div>
    );
  }

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
  });
  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0], EventAccessMode.INVITE_ONLY);
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";

  return (
    <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
      <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">{t("registrations", locale)}</p>
        <h1 className="text-base font-semibold">{event.title}</h1>
        <p className="text-[12px] text-white/70">
          {isPublicEvent ? t("registrationsOpen", locale) : t("registrationsClosed", locale)}
        </p>
        {isPublicEvent && (
          <a
            href={`/eventos/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black"
          >
            {t("registerNow", locale)}
          </a>
        )}
      </div>
    </div>
  );
}
