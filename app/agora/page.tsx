"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import { getEventCoverUrl } from "@/lib/eventCover";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AgendaItem = {
  id: string;
  type: "EVENTO" | "JOGO" | "INSCRICAO" | "RESERVA";
  title: string;
  startAt: string;
  endAt: string | null;
  label?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDayLabel(value?: string | null) {
  if (!value) return "Data a anunciar";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data a anunciar";
  return parsed.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function buildCountdownLabel(startAt: Date, now: Date) {
  const diffMs = Math.max(startAt.getTime() - now.getTime(), 0);
  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) return `Falta ${diffMinutes} min`;
  const diffHours = Math.ceil(diffMinutes / 60);
  if (diffHours < 24) return `Falta ${diffHours} h`;
  const diffDays = Math.ceil(diffHours / 24);
  return `Falta ${diffDays} d`;
}

function extractEventSlug(href?: string | null) {
  if (!href) return null;
  const cleanHref = href.split("?")[0]?.split("#")[0] ?? href;
  const match = cleanHref.match(/\/eventos\/([^/]+)/);
  return match?.[1] ?? null;
}

export default function AgoraPage() {
  const { user, isLoggedIn } = useUser();
  const { openModal: openAuthModal, isOpen: isAuthOpen } = useAuthModal();
  const { startIso, endIso } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, []);

  const agendaUrl = user
    ? `/api/me/agenda?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`
    : null;
  const { data } = useSWR<{ ok: boolean; items?: AgendaItem[] }>(agendaUrl, fetcher);
  const agendaItems = data?.items ?? [];

  const now = new Date();
  const activeItem = agendaItems.find((item) => {
    const start = parseDate(item.startAt);
    const end = parseDate(item.endAt) ?? start;
    if (!start || !end) return false;
    return start <= now && end >= now;
  });

  const upcomingItems = agendaItems
    .filter((item) => {
      const start = parseDate(item.startAt);
      return start ? start.getTime() > now.getTime() : false;
    })
    .slice(0, 6);

  const spotlightItem = activeItem ?? upcomingItems[0] ?? null;
  const upcomingList = spotlightItem ? upcomingItems.filter((i) => i.id !== spotlightItem.id) : upcomingItems;

  return (
    <main className="min-h-screen text-white pb-24">
      <MobileTopBar />
      <section className="orya-page-width px-4 md:px-8 py-6 space-y-6">
        <div className="space-y-2">
          <p className="orya-mobile-kicker">Agora</p>
          <h1 className="text-[20px] font-semibold text-white">Os teus eventos</h1>
          <p className="text-[12px] text-white/60">
            Acompanha o que decorre agora e os encontros seguintes.
          </p>
        </div>

        {!isLoggedIn && (
          <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/70">
            <p>Entra para veres os teus eventos.</p>
            <button
              type="button"
              onClick={() => {
                if (!isAuthOpen) {
                  openAuthModal({ mode: "login", redirectTo: "/agora", showGoogle: true });
                }
              }}
              className="btn-orya mt-3 inline-flex text-[11px] font-semibold"
            >
              Entrar
            </button>
          </div>
        )}

        {isLoggedIn && (
          <>
            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-[16px] font-semibold text-white">A acontecer agora</p>
                <p className="text-[11px] text-white/60">
                  {activeItem ? "A decorrer neste momento" : "Evento seguinte"}
                </p>
              </div>

              {!spotlightItem ? (
                <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                  Sem eventos a decorrer ou agendados.
                </div>
              ) : (
                <AgendaCard item={spotlightItem} highlightLabel={activeItem ? "Agora" : undefined} />
              )}
            </section>

            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-[16px] font-semibold text-white">Eventos seguintes</p>
                <p className="text-[11px] text-white/60">Agenda para os dias seguintes.</p>
              </div>
              {upcomingList.length === 0 ? (
                <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                  Sem eventos futuros por agora.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingList.map((item) => {
                    const start = parseDate(item.startAt);
                    const label = start ? buildCountdownLabel(start, now) : null;
                    return (
                      <AgendaCard
                        key={item.id}
                        item={item}
                        highlightLabel={label ?? undefined}
                        showChat={item.type === "EVENTO"}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function AgendaCard({
  item,
  highlightLabel,
  showChat,
}: {
  item: AgendaItem;
  highlightLabel?: string;
  showChat?: boolean;
}) {
  const slug = extractEventSlug(item.ctaHref);
  const detailHref = item.ctaHref ?? (slug ? `/eventos/${slug}` : null);
  const chatHref = slug ? `/eventos/${slug}/live` : null;
  const cover = getEventCoverUrl(null, {
    seed: slug ?? item.id,
    width: 600,
    quality: 70,
    format: "webp",
    square: true,
  });

  return (
    <div className="orya-mobile-surface-soft p-3">
      <div className="flex gap-3">
        <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-2xl border border-white/10">
          <Image
            src={cover}
            alt={item.title}
            fill
            sizes="84px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/25 to-black/70" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/60">
              {formatDayLabel(item.startAt)}
            </span>
            {highlightLabel && (
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/85">
                {highlightLabel}
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-white line-clamp-1">{item.title}</p>
          <p className="text-[11px] text-white/65 line-clamp-1">{item.label ?? "Evento"}</p>
          <div className="mt-2 flex items-center gap-2">
            {detailHref && (
              <Link
                href={detailHref}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80"
              >
                {item.ctaLabel ?? "Abrir"}
              </Link>
            )}
            {showChat && chatHref && (
              <Link
                href={chatHref}
                className="rounded-full border border-[#6bffff]/40 bg-[#6bffff]/10 px-3 py-1 text-[10px] font-semibold text-[#d9ffff]"
              >
                Chat
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
