"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { resolveLocale, t } from "@/lib/i18n";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";

type Props = {
  eventId: number;
  organizationId: number | null;
  ticketTypeId: number | null;
  categoryId?: number | null;
  padelV2Enabled: boolean;
  templateType?: string | null;
  slug: string;
};

export default function PadelSignupInline({
  eventId,
  organizationId,
  ticketTypeId,
  categoryId,
  padelV2Enabled,
  templateType,
  slug,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang") ?? (typeof navigator !== "undefined" ? navigator.language : null));
  const [loadingFull, setLoadingFull] = useState(false);
  const [loadingSplit, setLoadingSplit] = useState(false);

  const isPadelV2 = templateType === "PADEL" && padelV2Enabled;
  const canProceed = isPadelV2 && organizationId && ticketTypeId;

  const redirectToPadelOnboarding = () => {
    const params = new URLSearchParams();
    const current =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    params.set("redirectTo", current);
    router.push(`/onboarding/padel?${params.toString()}`);
  };

  const createPairing = async (mode: "FULL" | "SPLIT") => {
    if (!canProceed) {
      alert(t("padelSignupConfigMissing", locale));
      return;
    }
    const setLoading = mode === "FULL" ? setLoadingFull : setLoadingSplit;
    setLoading(true);
    try {
      const res = await fetch("/api/padel/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          organizationId,
          categoryId: categoryId ?? undefined,
          paymentMode: mode,
        }),
      });
      const json = await res.json();
      const resolvePadelError = (code?: string | null) => {
        switch (code) {
          case "CATEGORY_FULL":
          case "CATEGORY_PLAYERS_FULL":
            return t("padelSignupCategoryFull", locale);
          case "ALREADY_IN_CATEGORY":
            return t("padelSignupAlreadyInCategory", locale);
          case "MAX_CATEGORIES":
            return t("padelSignupMaxCategories", locale);
          case "EVENT_FULL":
            return t("padelSignupEventFull", locale);
          case "EVENT_NOT_PUBLISHED":
            return t("padelRegistrationEventNotPublished", locale);
          case "INSCRIPTIONS_NOT_OPEN":
            return t("padelRegistrationNotOpen", locale);
          case "INSCRIPTIONS_CLOSED":
            return t("padelRegistrationClosed", locale);
          case "TOURNAMENT_STARTED":
            return t("padelSignupTournamentStarted", locale);
          case "SPLIT_DEADLINE_PASSED":
            return t("padelSignupSplitDeadlinePassed", locale);
          case "CATEGORY_GENDER_MISMATCH":
            return t("padelSignupCategoryGenderMismatch", locale);
          case "CATEGORY_LEVEL_MISMATCH":
            return t("padelSignupCategoryLevelMismatch", locale);
          case "GENDER_REQUIRED_FOR_TOURNAMENT":
            return t("padelSignupGenderRequired", locale);
          default:
            return t("padelSignupErrorDefault", locale);
        }
      };
      if (!res.ok || !json?.ok) {
        if (json?.error === "PADEL_ONBOARDING_REQUIRED") {
          redirectToPadelOnboarding();
          return;
        }
        throw new Error(resolvePadelError(json?.error));
      }
      if (json?.waitlist) {
        alert(t("padelSignupWaitlist", locale));
        return;
      }
      if (!json?.pairing?.id) {
        throw new Error(sanitizeUiErrorMessage(json?.error, t("padelSignupErrorDefault", locale)));
      }
      const pairingId = json.pairing.id as number;
      if (mode === "SPLIT") {
        router.push(`/eventos/${slug}?pairingId=${pairingId}`);
      } else {
        router.push(`/eventos/${slug}?pairingId=${pairingId}&mode=full`);
      }
    } catch (err) {
      console.error("[PadelSignupInline] erro", err);
      alert(err instanceof Error ? err.message : t("padelSignupStartError", locale));
    } finally {
      setLoading(false);
    }
  };

  if (!isPadelV2 || !ticketTypeId) return null;

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-black/45 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-white/60">{t("padelSignupTitle", locale)}</p>
          <h4 className="text-lg font-semibold text-white">{t("padelSignupChoosePayment", locale)}</h4>
        </div>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          disabled={!canProceed || loadingFull}
          onClick={() => createPairing("FULL")}
          className="w-full rounded-full bg-white text-black px-4 py-2 font-semibold shadow hover:brightness-105 disabled:opacity-60"
        >
          {loadingFull ? t("padelSignupPreparing", locale) : t("padelSignupPayTeam", locale)}
        </button>
        <button
          type="button"
          disabled={!canProceed || loadingSplit}
          onClick={() => createPairing("SPLIT")}
          className="w-full rounded-full border border-white/20 px-4 py-2 font-semibold text-white hover:bg-white/10 disabled:opacity-60"
        >
          {loadingSplit ? t("padelSignupPreparing", locale) : t("padelSignupPaySpot", locale)}
        </button>
        {!canProceed && (
          <p className="text-[12px] text-amber-200">{t("padelSignupUnavailable", locale)}</p>
        )}
      </div>
    </div>
  );
}
