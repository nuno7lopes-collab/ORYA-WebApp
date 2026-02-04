// app/live/[id]/monitor/page.tsx
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { resolveLocale, t } from "@/lib/i18n";

type PageProps = { params: Promise<{ id: string }> };

async function getStructure(id: number) {
  const baseUrl = getAppBaseUrl();
  const res = await fetch(`${baseUrl}/api/tournaments/${id}/monitor`, {
    cache: "force-cache",
    next: { revalidate: 10 },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function MonitorPage({ params }: PageProps) {
  const resolved = await params;
  const tournamentId = Number(resolved.id);
  if (!Number.isFinite(tournamentId)) notFound();
  const headersList = headers();
  const acceptLanguage = headersList.get("accept-language");
  const locale = resolveLocale(acceptLanguage ? acceptLanguage.split(",")[0] : null);

  const data = await getStructure(tournamentId);
  if (!data?.ok) notFound();

  const tournament = data.tournament;
  const matches = tournament.stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)]);
  const now = new Date();

  const upcoming = matches
    .filter((m: any) => m.startAt && new Date(m.startAt) > now && m.status !== "DONE")
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 8);
  const live = matches.filter((m: any) => m.status === "IN_PROGRESS").slice(0, 6);

  return (
    <div className="min-h-screen text-white p-4">
      <div className="orya-page-width space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("monitorSimpleTitle", locale)}</p>
            <h1 className="text-2xl font-semibold">{tournament?.event?.title ?? t("tournament", locale)}</h1>
            <p className="text-white/60 text-sm">{t("monitorFormatLabel", locale)}: {tournament.format}</p>
          </div>
          <p className="text-white/60 text-sm">{t("monitorRefreshHint", locale)}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("monitorLiveSection", locale)}</h2>
              <span className="text-white/60 text-sm">{live.length} {t("matches", locale)}</span>
            </div>
            {live.length === 0 && <p className="text-white/60 text-sm">{t("monitorLiveEmpty", locale)}</p>}
            {live.map((m: any) => (
              <div key={m.id} className="rounded-lg border border-green-400/30 bg-green-500/10 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                  <span className="text-[11px] text-white/70">{m.statusLabel}</span>
                </div>
                <p className="text-[11px] text-white/60">
                  {t("court", locale)} {m.courtId ?? "—"} · {m.startAt ? new Date(m.startAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("monitorUpcomingSection", locale)}</h2>
              <span className="text-white/60 text-sm">{upcoming.length} {t("monitorScheduledLabel", locale)}</span>
            </div>
            {upcoming.length === 0 && <p className="text-white/60 text-sm">{t("monitorUpcomingEmpty", locale)}</p>}
            {upcoming.map((m: any) => (
              <div key={m.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                  <span className="text-[11px] text-white/70">{m.statusLabel}</span>
                </div>
                <p className="text-[11px] text-white/60">
                  {t("court", locale)} {m.courtId ?? "—"} · {m.startAt ? new Date(m.startAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}
                </p>
              </div>
            ))}
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("monitorBracketSection", locale)}</h2>
            <span className="text-white/60 text-sm">{t("monitorSummaryLabel", locale)}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tournament.stages.map((stage: any) => (
              <div key={stage.id} className="rounded-xl border border-white/10 bg-black/30 p-2 space-y-1">
                <p className="text-white font-semibold">{stage.name || stage.stageType}</p>
                {stage.groups.map((g: any) => (
                  <div key={g.id} className="rounded-lg border border-white/10 bg-white/5 p-2 space-y-1 text-[12px] text-white/80">
                    <p className="text-white text-sm">{g.name}</p>
                    <p className="text-white/60 text-[11px]">
                      {t("monitorGroupMatchesLabel", locale).replace("{count}", String(g.matches.length))}
                    </p>
                    {g.standings?.length ? (
                      <div className="space-y-1">
                        {g.standings.slice(0, 4).map((s: any, idx: number) => (
                          <div key={s.pairingId} className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-2 py-1">
                            <span className="text-white">{idx + 1}º · {t("pairing", locale)} #{s.pairingId}</span>
                            <span className="text-white/60">
                              {t("monitorStandingsLine", locale)
                                .replace("{wins}", String(s.wins))
                                .replace("{setDiff}", String(s.setDiff))}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/60">{t("monitorStandingsEmpty", locale)}</p>
                    )}
                  </div>
                ))}
                {stage.matches.length > 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] text-white/80 space-y-1">
                    <p className="text-white text-sm">{t("monitorPlayoffsLabel", locale)}</p>
                    {stage.matches.slice(0, 4).map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-2 py-1">
                        <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                        <span className="text-white/60 text-[11px]">{m.statusLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
