import Link from "next/link";
import { headers } from "next/headers";
import { resolveLocale, t } from "@/lib/i18n";
import PadelRankingsClient from "./PadelRankingsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PadelGlobalRankingsPage() {
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const locale = resolveLocale(acceptLanguage ? acceptLanguage.split(",")[0] : null);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
      <section className="orya-page-width px-6 pb-8 pt-12 md:px-10">
        <div className="space-y-4 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050810]/90 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                {t("padelRankingLabel", locale)}
              </p>
              <h1 className="text-3xl font-semibold">{t("padelRankingTitle", locale)}</h1>
              <p className="text-sm text-white/70">
                {t("padelRankingSubtitle", locale)}
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                <Link
                  href="/padel/duplas"
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  {t("openPairsLabel", locale)}
                </Link>
                <Link
                  href="/descobrir/torneios"
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  {t("discoverTournamentsLabel", locale)}
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-[11px] text-white/65">
              <p className="uppercase tracking-[0.2em] text-white/50">{t("pointsLabel", locale)}</p>
              <p className="mt-2 text-sm text-white/80">
                {t("pointsGeneratedHint", locale)}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-300/35 bg-gradient-to-br from-emerald-500/12 via-lime-400/8 to-orange-400/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-100/85">Grok em breve</p>
                <p className="text-sm font-semibold text-white">Insights inteligentes de ranking</p>
                <p className="text-[12px] text-white/75">
                  Em breve vais receber recomendações automáticas para evolução de nível e próximos desafios.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200/40 bg-emerald-300/10 px-3 py-1 text-[11px] text-emerald-50/90">
                Placeholder ativo
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="orya-page-width px-6 pb-16 md:px-10">
        <PadelRankingsClient locale={locale} />
      </section>
    </main>
  );
}
