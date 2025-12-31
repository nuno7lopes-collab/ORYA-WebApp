"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { useMemo } from "react";
import { useUser } from "@/app/hooks/useUser";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";
import { Avatar } from "@/components/ui/avatar";

type SuggestionEvent = {
  id: number;
  slug: string;
  title: string;
  startsAt?: string | null;
  coverImageUrl?: string | null;
  priceFrom?: number | null;
  locationCity?: string | null;
};

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

type AgendaResponse = { ok: boolean; items?: AgendaItem[]; error?: string };
type FollowResponse = {
  ok: boolean;
  items?: Array<{ userId: string; username: string | null; fullName: string | null; avatarUrl: string | null }>;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDateLabel(value?: string | null) {
  if (!value) return "Data a anunciar";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data a anunciar";
  return parsed.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function formatPrice(value?: number | null) {
  if (value == null) return "Preço a anunciar";
  if (value === 0) return "Grátis";
  return `Desde ${value.toFixed(2)} €`;
}

export default function HomePersonalized({ suggestions }: { suggestions: SuggestionEvent[] }) {
  const { user } = useUser();
  const { startIso, endIso } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 30);
    end.setHours(23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, []);

  const agendaUrl = user ? `/api/me/agenda?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}` : null;
  const { data: agendaData } = useSWR<AgendaResponse>(agendaUrl, fetcher);
  const { data: followingData } = useSWR<FollowResponse>(
    user ? `/api/social/following?userId=${user.id}&limit=6` : null,
    fetcher,
  );

  const agendaItems = agendaData?.items ?? [];
  const upcomingEvents = agendaItems.filter((i) => i.type === "EVENTO").slice(0, 3);
  const upcomingBookings = agendaItems.filter((i) => i.type === "RESERVA").slice(0, 3);
  const padelItems = agendaItems.filter((i) => i.type === "JOGO" || i.type === "INSCRICAO").slice(0, 3);
  const following = followingData?.items ?? [];
  const cardBase =
    "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl";

  return (
    <section className="orya-page-width px-4 md:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Para ti</p>
          <h2 className="text-2xl font-semibold text-white">Agenda pessoal e recomendações</h2>
          <p className="text-sm text-white/65">Tudo o que te interessa, com o ritmo certo.</p>
        </div>
        {!user && (
          <Link
            href="/login"
            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] text-white hover:bg-white/20"
          >
            Entrar para ver a tua agenda
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cardBase}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Próximos eventos</p>
          <div className="mt-3 space-y-3">
            {upcomingEvents.length === 0 && <p className="text-sm text-white/60">Sem eventos marcados.</p>}
            {upcomingEvents.map((item) => (
              <Link key={item.id} href={item.ctaHref ?? "/me"} className="block rounded-2xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-[12px] text-white/60">{formatDateLabel(item.startAt)} · {item.label ?? "Evento"}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className={cardBase}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Próximas reservas</p>
          <div className="mt-3 space-y-3">
            {upcomingBookings.length === 0 && <p className="text-sm text-white/60">Sem reservas confirmadas.</p>}
            {upcomingBookings.map((item) => (
              <Link key={item.id} href={item.ctaHref ?? "/me"} className="block rounded-2xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-[12px] text-white/60">{formatDateLabel(item.startAt)} · {item.label ?? "Reserva"}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className={cardBase}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Padel</p>
          <div className="mt-3 space-y-3">
            {padelItems.length === 0 && <p className="text-sm text-white/60">Sem jogos/inscrições pendentes.</p>}
            {padelItems.map((item) => (
              <Link key={item.id} href={item.ctaHref ?? "/padel/duplas"} className="block rounded-2xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-[12px] text-white/60">{formatDateLabel(item.startAt)} · {item.label ?? "Padel"}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardBase}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Onde os amigos vão</p>
          <div className="mt-3 space-y-2">
            {following.length === 0 && (
              <p className="text-sm text-white/60">Segue amigos para veres a atividade deles.</p>
            )}
            {following.map((f) => (
              <div key={f.userId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                <Avatar
                  src={f.avatarUrl}
                  name={f.fullName ?? f.username ?? "Utilizador"}
                  className="h-9 w-9 border border-white/15"
                  textClassName="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80"
                  fallbackText="OR"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{f.fullName ?? "Utilizador ORYA"}</p>
                  <p className="text-[12px] text-white/60">@{f.username ?? "username"}</p>
                </div>
              </div>
            ))}
            {following.length === 0 && (
              <Link href="/explorar?world=eventos" className="inline-flex text-[12px] text-white/70 hover:text-white">
                Encontrar pessoas e eventos →
              </Link>
            )}
          </div>
        </div>

        <div className={cardBase}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Sugestões</p>
          <div className="mt-3 space-y-3">
            {suggestions.length === 0 && <p className="text-sm text-white/60">Sem sugestões para mostrar.</p>}
            {suggestions.map((event) => (
              <Link key={event.id} href={`/eventos/${event.slug}`} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10">
                <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/10">
                  {event.coverImageUrl ? (
                    <Image
                      src={optimizeImageUrl(event.coverImageUrl, 200, 70, "webp") || event.coverImageUrl}
                      alt={event.title}
                      width={48}
                      height={48}
                      placeholder="blur"
                      blurDataURL={defaultBlurDataURL}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-white/10" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white group-hover:text-white">{event.title}</p>
                  <p className="text-[12px] text-white/60">
                    {formatDateLabel(event.startsAt)} · {event.locationCity ?? "Portugal"} · {formatPrice(event.priceFrom)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}
