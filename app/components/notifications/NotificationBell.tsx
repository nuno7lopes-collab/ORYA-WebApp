"use client";

import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import PairingInviteCard from "@/app/components/notifications/PairingInviteCard";

type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH";
  readAt?: string | null;
  isRead?: boolean;
  createdAt: string;
  meta?: { isMutual?: boolean };
  payload?: Record<string, unknown> | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABEL: Record<string, string> = {
  ORGANIZATION_INVITE: "Convite de organização",
  PAIRING_INVITE: "Convite para dupla",
  EVENT_SALE: "Venda",
  STRIPE_STATUS: "Stripe",
  EVENT_REMINDER: "Lembrete",
  FOLLOW_REQUEST: "Pedido para seguir",
  FOLLOW_ACCEPT: "Pedido aceite",
  FOLLOWED_YOU: "Segue-te",
  MARKETING_PROMO_ALERT: "Marketing",
  CRM_CAMPAIGN: "Campanha",
  SYSTEM_ANNOUNCE: "Sistema",
  CHAT_OPEN: "Chat",
  CHAT_ANNOUNCEMENT: "Chat",
  CHAT_MESSAGE: "Mensagem de chat",
};

export function NotificationBell({ organizationId }: { organizationId?: number | null }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "sales" | "invites" | "marketing" | "system">("all");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const queryTypes =
    filter === "sales"
      ? "EVENT_SALE,EVENT_PAYOUT_STATUS"
      : filter === "invites"
        ? "ORGANIZATION_INVITE,CLUB_INVITE,ORGANIZATION_TRANSFER"
        : filter === "marketing"
          ? "MARKETING_PROMO_ALERT,CRM_CAMPAIGN"
        : filter === "system"
          ? "STRIPE_STATUS,SYSTEM_ANNOUNCE,CHAT_OPEN,CHAT_ANNOUNCEMENT,CHAT_MESSAGE"
          : undefined;
  const queryParams = useMemo(() => {
    if (!user) return null;
    const params = new URLSearchParams({ status: "all" });
    if (queryTypes) params.set("types", queryTypes);
    if (Number.isFinite(organizationId ?? NaN) && organizationId) {
      params.set("organizationId", String(organizationId));
    }
    return `/api/notifications?${params.toString()}`;
  }, [organizationId, queryTypes, user]);
  const query = user ? queryParams : null;

  const { data, mutate } = useSWR(
    query,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true },
  );

  const items: NotificationDto[] = useMemo(() => data?.items ?? [], [data]);
  const unreadCount = useMemo(
    () => items.filter((n) => n.isRead === false || (!n.isRead && !n.readAt)).length,
    [items],
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
    for (const n of items) {
      const date = new Date(n.createdAt);
      const key = date.toLocaleDateString("pt-PT");
      groups[key] = groups[key] ? [...groups[key], n] : [n];
    }
    return groups;
  }, [items]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20 transition"
        aria-label="Notificações"
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
              {organizationId ? "Notificações da organização" : "Notificações"}
            </span>
            <button
              type="button"
              className="text-[11px] text-white/60 hover:text-white"
              onClick={markAll}
            >
              Marcar todas como lidas
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
              {[
                { key: "all", label: "Todas" },
                { key: "sales", label: "Vendas" },
                { key: "invites", label: "Convites" },
                { key: "marketing", label: "Marketing" },
                { key: "system", label: "Sistema" },
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

          {items.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-3 text-xs text-white/60">
              {organizationId ? "Sem notificações da organização ainda." : "Sem notificações ainda."}
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
                      n.readAt
                        ? "border-white/10 bg-white/3"
                        : "border-sky-400/30 bg-sky-500/10"
                    }`}
                  >
                    {(() => {
                      const typeLabel =
                        n.type === "FOLLOWED_YOU" && n.meta?.isMutual
                          ? "Segue-te de volta"
                          : TYPE_LABEL[n.type] ?? "Atualização";
                      return (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/60">
                          {typeLabel}
                        </span>
                        {(n.isRead === false || (!n.isRead && !n.readAt)) && (
                          <span className="h-2 w-2 rounded-full bg-sky-400" />
                        )}
                      </div>
                      <span className="text-[11px] text-white/45">
                        {formatDistanceToNow(new Date(n.createdAt), { locale: pt, addSuffix: true })}
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
                        <p className="text-white/70">{n.body}</p>
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
