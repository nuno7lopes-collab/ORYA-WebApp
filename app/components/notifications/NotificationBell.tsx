"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

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
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABEL: Record<string, string> = {
  ORGANIZATION_INVITE: "Convite de organização",
  EVENT_SALE: "Venda",
  STRIPE_STATUS: "Stripe",
  EVENT_REMINDER: "Lembrete",
  FRIEND_REQUEST: "Pedido de amizade",
  FRIEND_ACCEPT: "Amigo aceitou",
  FOLLOWED_YOU: "Segue-te",
  MARKETING_PROMO_ALERT: "Marketing",
  SYSTEM_ANNOUNCE: "Sistema",
};

export function NotificationBell() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "sales" | "invites" | "system" | "social">("all");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const queryTypes =
    filter === "sales"
      ? "EVENT_SALE"
      : filter === "invites"
        ? "ORGANIZATION_INVITE"
        : filter === "system"
          ? "STRIPE_STATUS,MARKETING_PROMO_ALERT,SYSTEM_ANNOUNCE"
          : filter === "social"
            ? "FRIEND_REQUEST,FRIEND_ACCEPT,FOLLOWED_YOU"
            : undefined;
  const query = user
    ? `/api/notifications?status=all${queryTypes ? `&types=${encodeURIComponent(queryTypes)}` : ""}`
    : null;

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
      body: JSON.stringify({ markAll: true }),
    });
    mutate();
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
        className="relative rounded-full border border-white/15 bg-white/5 p-2 text-white/80 hover:bg-white/10 transition"
        aria-label="Notificações"
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-emerald-500 px-1 text-[11px] font-semibold text-black text-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-[#0b0f18]/95 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl p-3 text-white/80 z-50"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-white">Notificações</span>
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
              { key: "system", label: "Sistema" },
              { key: "social", label: "Social" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key as typeof filter)}
                className={`rounded-full border px-2.5 py-1 ${
                  filter === item.key
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {items.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-3 text-xs text-white/60">
              Sem notificações ainda.
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
                        : "border-emerald-400/30 bg-emerald-500/8"
                    }`}
                  >
                    {(() => {
                      const typeLabel =
                        n.type === "FOLLOWED_YOU" && n.meta?.isMutual
                          ? "Teu amigo"
                          : TYPE_LABEL[n.type] ?? "Atualização";
                      return (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/60">
                          {typeLabel}
                        </span>
                        {(n.isRead === false || (!n.isRead && !n.readAt)) && (
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <span className="text-[11px] text-white/45">
                        {formatDistanceToNow(new Date(n.createdAt), { locale: pt, addSuffix: true })}
                      </span>
                    </div>
                      );
                    })()}
                    <p className="mt-1 text-[13px] font-semibold text-white">{n.title}</p>
                    <p className="text-white/70">{n.body}</p>
                    {n.ctaUrl && n.ctaLabel && (
                      <Link
                        href={n.ctaUrl}
                        className="mt-2 inline-flex text-[11px] text-[#6BFFFF] hover:underline"
                      >
                        {n.ctaLabel}
                      </Link>
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
