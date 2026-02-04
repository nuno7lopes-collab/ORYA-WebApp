"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { appendOrganizationIdToHref, getOrganizationIdFromBrowser } from "@/lib/organizationIdUtils";
import { resolveLocale, t } from "@/lib/i18n";

export default function NovaEventoPage() {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang") ?? (typeof navigator !== "undefined" ? navigator.language : null));
  const orgId = getOrganizationIdFromBrowser();
  const becomeHref = appendOrganizationIdToHref("/organizacao/become", orgId);
  const dashboardHref = appendOrganizationIdToHref("/organizacao?tab=create", orgId);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 text-white">
      <div className="orya-page-width flex justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/70 to-[#050810]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/70">{t("eventsNewTitle", locale)}</p>
          <h1 className="mt-2 text-2xl font-semibold">{t("eventsNewHeadline", locale)}</h1>
          <p className="mt-3 text-sm text-white/70">
            {t("eventsNewBody", locale)}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={becomeHref} className={CTA_PRIMARY}>
              {t("eventsNewCreateOrg", locale)}
            </Link>
            <Link href={dashboardHref} className={CTA_SECONDARY}>
              {t("eventsNewDashboard", locale)}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
