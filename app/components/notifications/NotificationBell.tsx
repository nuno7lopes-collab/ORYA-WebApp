"use client";

import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { enUS, es, pt } from "date-fns/locale";
import PairingInviteCard from "@/app/components/notifications/PairingInviteCard";
import { useSearchParams } from "next/navigation";
import { resolveLocale, t } from "@/lib/i18n";

type NotificationDto = {
  id: string;
  type: string;
  category: "network" | "events" | "system" | "marketing" | "chat";
  title: string;
  body?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  createdAt: string;
  isRead?: boolean;
  organizationId?: number | null;
  eventId?: number | null;
  actions?: Array<{ type: string; label: string; style?: string; payload?: Record<string, unknown> }>;
  payload?: Record<string, unknown> | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INVITE_TYPES = new Set(["ORGANIZATION_INVITE", "CLUB_INVITE", "ORGANIZATION_TRANSFER", "EVENT_INVITE", "PAIRING_INVITE"]);

export function NotificationBell({ organizationId }: { organizationId?: number | null }) {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang") ?? (typeof navigator !== "undefined" ? navigator.language : null));
  const distanceLocale = locale === "en-US" ? enUS : locale === "es-ES" ? es : pt;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "invites">("all");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const queryParams = useMemo(() => {
    if (!user) return null;
    const params = new URLSearchParams();
    params.set("limit", "60");
    return `/api/me/notifications/feed?${params.toString()}`;
  }, [user]);
  const query = user ? queryParams : null;

  const { data, mutate } = useSWR(
    query,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true },
  );

  const items: NotificationDto[] = useMemo(() => data?.items ?? [], [data]);
  const unreadCount = useMemo(() => Number(data?.unreadCount ?? 0), [data?.unreadCount]);
  const filteredItems = useMemo(() => {
    let list = items;
    if (Number.isFinite(organizationId ?? NaN) && organizationId) {
      list = list.filter((item) => item.organizationId === organizationId);
    }
    if (filter === "invites") {
      return list.filter((item) => INVITE_TYPES.has(item.type));
    }
    return list;
  }, [filter, items, organizationId]);
  const typeLabels = useMemo(
    () => ({
      ORGANIZATION_INVITE: t("notificationsTypeOrganizationInvite", locale),
      ORGANIZATION_TRANSFER: t("notificationsTypeOrganizationTransfer", locale),
      CLUB_INVITE: t("notificationsTypeClubInvite", locale),
      PAIRING_INVITE: t("notificationsTypePairingInvite", locale),
      EVENT_SALE: t("notificationsTypeEventSale", locale),
      EVENT_PAYOUT_STATUS: t("notificationsTypeEventPayout", locale),
      STRIPE_STATUS: t("notificationsTypeStripe", locale),
      EVENT_REMINDER: t("notificationsTypeReminder", locale),
      FOLLOW_REQUEST: t("notificationsTypeFollowRequest", locale),
      FOLLOW_ACCEPT: t("notificationsTypeFollowAccept", locale),
      FOLLOWED_YOU: t("notificationsTypeFollowedYou", locale),
      FRIEND_GOING_TO_EVENT: t("notificationsTypeFriendGoingEvent", locale),
      EVENT_INVITE: t("notificationsTypeEventInvite", locale),
      NEW_EVENT_FROM_FOLLOWED_ORGANIZATION: t("notificationsTypeNewEvent", locale),
      CHECKIN_READY: t("notificationsTypeCheckin", locale),
      TICKET_SHARED: t("notificationsTypeTicket", locale),
      TICKET_TRANSFER_RECEIVED: t("notificationsTypeTicketTransfer", locale),
      TICKET_TRANSFER_ACCEPTED: t("notificationsTypeTicketTransfer", locale),
      TICKET_TRANSFER_DECLINED: t("notificationsTypeTicketTransfer", locale),
      MARKETING_PROMO_ALERT: t("notificationsTypeMarketing", locale),
      CRM_CAMPAIGN: t("notificationsTypeCampaign", locale),
      SYSTEM_ANNOUNCE: t("notificationsTypeSystem", locale),
      CHAT_AVAILABLE: t("notificationsTypeChat", locale),
      CHAT_OPEN: t("notificationsTypeChat", locale),
      CHAT_ANNOUNCEMENT: t("notificationsTypeChat", locale),
      CHAT_MESSAGE: t("notificationsTypeChatMessage", locale),
    }),
    [locale],
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markAll = async () => {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markAll: true,
        organizationId: Number.isFinite(organizationId ?? NaN) ? organizationId : null,
      }),
    });
    mutate();
  };

  const markClick = (notificationId: string) => {
    if (!notificationId) return;
    fetch("/api/notifications/mark-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
      keepalive: true,
    }).catch(() => null);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, NotificationDto[]> = {};
    for (const n of filteredItems) {
      const date = new Date(n.createdAt);
      const key = date.toLocaleDateString(locale);
      groups[key] = groups[key] ? [...groups[key], n] : [n];
    }
    return groups;
  }, [filteredItems, locale]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20 transition sm:h-10 sm:w-10"
        aria-label={t("notificationBellLabel", locale)}
      >
        <BellIcon className="h-4 w-4 text-amber-100" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#ff5bd6] px-1 text-[11px] font-semibold text-white text-center shadow-[0_0_10px_rgba(255,91,214,0.7)]">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 rounded-2xl orya-menu-surface p-3 text-white/80 backdrop-blur-xl z-50"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-white">
              {organizationId ? t("notificationsOrgTitle", locale) : t("notificationsTitle", locale)}
            </span>
            <button
              type="button"
              className="text-[11px] text-white/60 hover:text-white"
              onClick={markAll}
            >
              {t("notificationsMarkAllRead", locale)}
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
              {[
                { key: "all", label: t("notificationsFilterAll", locale) },
                { key: "invites", label: t("notificationsFilterInvites", locale) },
              ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key as typeof filter)}
                className={`rounded-full border px-2.5 py-1 ${
                  filter === item.key
                    ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-3 text-xs text-white/60">
              {organizationId ? t("notificationsEmptyOrg", locale) : t("notificationsEmpty", locale)}
            </div>
          )}

          {Object.entries(grouped).map(([day, list]) => (
            <div key={day} className="mb-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50 mb-1">{day}</p>
              <div className="space-y-1.5">
                {list.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      n.isRead
                        ? "border-white/10 bg-white/3"
                        : "border-sky-400/30 bg-sky-500/10"
                    }`}
                  >
                    {(() => {
                      const typeLabel =
                        typeLabels[n.type as keyof typeof typeLabels] ?? t("notificationsTypeUpdateFallback", locale);
                      return (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/60">
                          {typeLabel}
                        </span>
                    {!n.isRead && (
                          <span className="h-2 w-2 rounded-full bg-sky-400" />
                        )}
                      </div>
                      <span className="text-[11px] text-white/45">
                        {formatDistanceToNow(new Date(n.createdAt), { locale: distanceLocale, addSuffix: true })}
                      </span>
                    </div>
                      );
                    })()}
                    <p className="mt-1 text-[13px] font-semibold text-white">{n.title}</p>
                    {n.type === "PAIRING_INVITE" ? (
                      <div className="mt-2">
                        <PairingInviteCard
                          title={n.title}
                          body={n.body}
                          payload={n.payload}
                          fallbackUrl={n.ctaUrl ?? null}
                          fallbackLabel={n.ctaLabel ?? null}
                          compact
                        />
                      </div>
                    ) : (
                      <>
                        {n.body ? <p className="text-white/70">{n.body}</p> : null}
                        {n.ctaUrl && n.ctaLabel && (
                          <Link
                            href={n.ctaUrl}
                            className="mt-2 inline-flex text-[11px] text-[#6BFFFF] hover:underline"
                            onClick={() => markClick(n.id)}
                          >
                            {n.ctaLabel}
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function BellIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillOpacity="0.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6.8 9.5a5.2 5.2 0 0 1 10.4 0v3.7c0 .8.3 1.6.8 2.2l.7.9H5.3l.7-.9c.5-.6.8-1.4.8-2.2V9.5Z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}
