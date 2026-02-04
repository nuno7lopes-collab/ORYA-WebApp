"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import WavesSectionClient, { type WaveTicket } from "./WavesSectionClient";
import { getTicketCopy } from "@/app/components/checkout/checkoutCopy";
import { t } from "@/lib/i18n";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type InviteGateClientProps = {
  slug: string;
  isGratis: boolean;
  isAuthenticated: boolean;
  hasUsername: boolean;
  userEmailNormalized: string | null;
  usernameNormalized: string | null;
  uiTickets: WaveTicket[];
  checkoutUiVariant: "DEFAULT" | "PADEL";
  locale?: string | null;
  padelMeta?: {
    eventId: number;
    organizationId: number | null;
    categoryId?: number | null;
    categoryLinkId?: number | null;
  };
};

type CheckResponse = {
  ok?: boolean;
  invited?: boolean;
  type?: "email" | "username";
  normalized?: string;
  error?: string;
};

export default function InviteGateClient({
  slug,
  isGratis,
  isAuthenticated,
  hasUsername,
  userEmailNormalized,
  usernameNormalized,
  uiTickets,
  checkoutUiVariant,
  locale,
  padelMeta,
}: InviteGateClientProps) {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteType, setInviteType] = useState<"email" | "username" | null>(null);
  const [inviteNormalized, setInviteNormalized] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [inviteTicketTypeId, setInviteTicketTypeId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const inviteTokenParam = searchParams.get("inviteToken");
  const tokenHandledRef = useRef<string | null>(null);
  const ticketCopy = getTicketCopy(checkoutUiVariant, locale);
  const freeLabelLower = ticketCopy.freeLabel.toLowerCase();

  useEffect(() => {
    if (!inviteTokenParam || checkoutUiVariant === "PADEL") return;
    if (tokenHandledRef.current === inviteTokenParam) return;
    tokenHandledRef.current = inviteTokenParam;

    let cancelled = false;

    const resolveToken = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/eventos/${encodeURIComponent(slug)}/invite-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteTokenParam }),
        });
        const json = (await res.json().catch(() => null)) as
          | {
              ok?: boolean;
              allow?: boolean;
              normalized?: string;
              ticketTypeId?: number | null;
              reason?: string;
            }
          | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok || !json.allow) {
          throw new Error(json?.reason || t("inviteErrorDefault", locale));
        }
        setInviteType("email");
        setInviteNormalized(typeof json.normalized === "string" ? json.normalized : null);
        setInviteTicketTypeId(
          typeof json.ticketTypeId === "number" && Number.isFinite(json.ticketTypeId) ? json.ticketTypeId : null,
        );
        setValidated(true);
      } catch (err) {
        setValidated(false);
        setInviteType(null);
        setInviteNormalized(null);
        setInviteTicketTypeId(null);
        setError(err instanceof Error ? err.message : t("inviteGateCheckError", locale));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void resolveToken();

    return () => {
      cancelled = true;
    };
  }, [inviteTokenParam, checkoutUiVariant, slug, locale]);

  const handleCheck = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError(t("inviteGatePrompt", locale));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/eventos/${encodeURIComponent(slug)}/invites/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: trimmed, scope: "PUBLIC" }),
      });
      const json = (await res.json().catch(() => null)) as CheckResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || t("inviteGateCheckError", locale));
      }
      if (!json.invited) {
        setValidated(false);
        setInviteType(null);
        setInviteNormalized(null);
        setError(t("inviteGateNoInvite", locale));
        return;
      }
      const type = json.type === "username" ? "username" : "email";
      setInviteType(type);
      setValidated(true);
      setInviteNormalized(json.normalized ?? trimmed);
    } catch (err) {
      setValidated(false);
      setInviteType(null);
      setInviteNormalized(null);
      setError(err instanceof Error ? err.message : t("inviteGateCheckError", locale));
    } finally {
      setLoading(false);
    }
  };

  const inviteMatchesAccount =
    validated &&
    isAuthenticated &&
    ((inviteType === "email" &&
      inviteNormalized &&
      userEmailNormalized &&
      inviteNormalized === userEmailNormalized) ||
      (inviteType === "username" &&
        inviteNormalized &&
        usernameNormalized &&
        inviteNormalized === usernameNormalized));

  const paidInviteMatches = inviteMatchesAccount && !isGratis;
  const freeInviteMatches = inviteMatchesAccount && isGratis && hasUsername;
  const restrictedTickets =
    inviteTicketTypeId && Number.isFinite(inviteTicketTypeId)
      ? uiTickets.filter((ticket) => Number(ticket.id) === inviteTicketTypeId)
      : uiTickets;

  const gateMessage = (() => {
    if (!validated) return null;
    if (!isAuthenticated) {
      return t("inviteGateLoginToContinue", locale);
    }
    if (inviteType === "email") {
      if (!inviteNormalized || !userEmailNormalized || inviteNormalized !== userEmailNormalized) {
        return t("inviteGateEmailMismatch", locale);
      }
      if (isGratis && !hasUsername) {
        return t("inviteGateUsernameRequired", locale).replace("{action}", freeLabelLower);
      }
      return isGratis
        ? t("inviteGateContinueFree", locale).replace("{action}", freeLabelLower)
        : t("inviteGateContinueCheckout", locale);
    }
    if (inviteType === "username") {
      if (!hasUsername) {
        return t("inviteGateUsernameRequiredShort", locale);
      }
      if (!inviteNormalized || !usernameNormalized || inviteNormalized !== usernameNormalized) {
        return t("inviteGateUsernameMismatch", locale);
      }
      return isGratis
        ? t("inviteGateContinueFree", locale).replace("{action}", freeLabelLower)
        : t("inviteGateContinueCheckout", locale);
    }
    return null;
  })();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(6,10,24,0.9))] px-4 py-4 text-sm text-white/85 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
          <span>{t("inviteGateExclusiveAccess", locale)}</span>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <span>{t("inviteGateOryaInvites", locale)}</span>
        </div>
        <p className="mt-2 text-base font-semibold text-white">{t("inviteGateEventInviteOnly", locale)}</p>
        <p className="text-[12px] text-white/65">
          {t("inviteGateHelper", locale)}
        </p>
      </div>

      <div className="rounded-2xl border border-white/12 bg-black/50 px-4 py-4 text-sm text-white/80">
        <label className="text-[11px] uppercase tracking-[0.18em] text-white/60">
          {t("inviteGateHaveInvite", locale)}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t("inviteGatePlaceholder", locale)}
            className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading}
            className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? t("inviteGateValidating", locale) : t("inviteGateValidate", locale)}
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] font-semibold text-amber-100">{error}</p>}

        {gateMessage && <p className="mt-2 text-[12px] text-amber-100">{gateMessage}</p>}
        {!validated && !error && (
          <p className="mt-2 text-[12px] text-white/60">
            {isAuthenticated
              ? t("inviteGateNoInviteAuthenticated", locale)
              : t("inviteGateNoInviteUnauthenticated", locale)}
          </p>
        )}
      </div>

      {paidInviteMatches && (
        <WavesSectionClient
          slug={slug}
          tickets={restrictedTickets}
          checkoutUiVariant={checkoutUiVariant}
          locale={locale}
          padelMeta={padelMeta}
          inviteEmail={inviteType === "email" ? inviteNormalized ?? undefined : undefined}
        />
      )}

      {freeInviteMatches && (
        <WavesSectionClient
          slug={slug}
          tickets={restrictedTickets}
          isGratisEvent
          checkoutUiVariant={checkoutUiVariant}
          locale={locale}
          padelMeta={padelMeta}
        />
      )}

      {!validated && identifier.trim() && EMAIL_REGEX.test(identifier.trim()) && !isGratis && (
        <div className="rounded-xl border border-white/12 bg-black/50 px-3.5 py-2.5 text-[11px] text-white/65">
          {t("inviteGateUseSameEmail", locale)}
        </div>
      )}
    </div>
  );
}
