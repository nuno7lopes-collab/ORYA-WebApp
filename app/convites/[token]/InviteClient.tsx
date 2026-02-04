"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { resolveLocale, t } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type InvitePayload = {
  invite: {
    id: number;
    token: string;
    targetName: string | null;
    targetContact: string | null;
    message: string | null;
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    respondedAt: string | null;
  };
  booking: {
    id: number;
    startsAt: string;
    durationMinutes: number;
    status: string;
    locationText: string | null;
    snapshotTimezone: string | null;
  };
  service: { id: number; title: string | null } | null;
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
  } | null;
};

function formatDateTime(value: string, locale: string, timeZone?: string | null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    }).format(date);
  } catch (err) {
    return date.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" });
  }
}

function formatTime(value: Date, locale: string, timeZone?: string | null) {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    }).format(value);
  } catch (err) {
    return value.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
}

function formatInviteStatus(status: string, locale: string) {
  if (status === "ACCEPTED") return t("serviceInviteStatusAccepted", locale);
  if (status === "DECLINED") return t("serviceInviteStatusDeclined", locale);
  return t("serviceInviteStatusPending", locale);
}

export default function InviteClient({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang") ?? (typeof navigator !== "undefined" ? navigator.language : null));
  const { data, isLoading, mutate } = useSWR(token ? `/api/convites/${encodeURIComponent(token)}` : null, fetcher);
  const [actionLoading, setActionLoading] = useState<"accept" | "decline" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const payload: InvitePayload | null = data?.ok ? (data.data as InvitePayload) : null;
  const loadError = data && data.ok === false ? data.message || data.error || t("serviceInviteLoadError", locale) : null;

  const schedule = useMemo(() => {
    if (!payload?.booking?.startsAt || !payload.booking.durationMinutes) return null;
    const start = new Date(payload.booking.startsAt);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + payload.booking.durationMinutes * 60 * 1000);
    return {
      start,
      end,
      timeZone: payload.booking.snapshotTimezone,
    };
  }, [payload?.booking]);

  const handleResponse = async (response: "accept" | "decline") => {
    if (actionLoading) return;
    setActionLoading(response);
    setActionError(null);
    try {
      const res = await fetch(`/api/convites/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || t("serviceInviteRespondError", locale));
      }
      await mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("serviceInviteRespondError", locale);
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const status = payload?.invite?.status ?? null;
  const bookingStatus = payload?.booking?.status ?? null;
  const canRespond = status === "PENDING" && bookingStatus === "CONFIRMED";
  const statusLabel = status ? formatInviteStatus(status, locale) : null;
  const orgName =
    payload?.organization?.publicName || payload?.organization?.businessName || t("serviceInviteOrgFallback", locale);
  const serviceName = payload?.service?.title || t("serviceInviteServiceFallback", locale);

  return (
    <main className="min-h-screen w-full bg-[#0b0f1d] text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("serviceInviteKicker", locale)}</p>
          <h1 className="text-3xl font-semibold text-white">{serviceName}</h1>
          <p className="text-sm text-white/65">{t("serviceInviteSubtitle", locale)}</p>
        </div>

        <section className="rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {isLoading && <div className="h-40 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />}

          {!isLoading && loadError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && payload && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/10">
                  {payload.organization?.brandingAvatarUrl ? (
                    <img
                      src={payload.organization.brandingAvatarUrl}
                      alt={orgName}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{orgName}</p>
                  {payload.organization?.city && (
                    <p className="text-[12px] text-white/60">{payload.organization.city}</p>
                  )}
                </div>
                {statusLabel && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                    {statusLabel}
                  </span>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <p className="text-sm font-semibold text-white">{serviceName}</p>
                {schedule && (
                  <p className="text-[12px] text-white/70">
                    {formatDateTime(schedule.start.toISOString(), locale, schedule.timeZone)}
                    <span className="text-white/50">
                      {" "}
                      · {formatTime(schedule.start, locale, schedule.timeZone)} - {formatTime(schedule.end, locale, schedule.timeZone)}
                    </span>
                  </p>
                )}
                {payload.booking.locationText && (
                  <p className="text-[12px] text-white/60">{payload.booking.locationText}</p>
                )}
              </div>

              {payload.invite.message && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  {payload.invite.message}
                </div>
              )}

              {actionError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {actionError}
                </div>
              )}

              {bookingStatus !== "CONFIRMED" && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  {t("serviceInviteNotConfirmed", locale)}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                  onClick={() => handleResponse("accept")}
                  disabled={!canRespond || actionLoading !== null}
                >
                  {actionLoading === "accept" ? t("serviceInviteAccepting", locale) : t("serviceInviteAccept", locale)}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-[12px] text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                  onClick={() => handleResponse("decline")}
                  disabled={!canRespond || actionLoading !== null}
                >
                  {actionLoading === "decline" ? t("serviceInviteDeclining", locale) : t("serviceInviteDecline", locale)}
                </button>
                {payload.organization?.username && (
                  <Link
                    href={`/${payload.organization.username}`}
                    className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] text-white/70 hover:border-white/40"
                  >
                    {t("serviceInviteViewOrg", locale)}
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
