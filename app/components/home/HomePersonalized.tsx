"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { useMemo } from "react";
import { useUser } from "@/app/hooks/useUser";
import { defaultBlurDataURL } from "@/lib/image";
import { getEventCoverUrl } from "@/lib/eventCover";
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

type HomePersonalizedProps = {
  suggestions: SuggestionEvent[];
  variant?: "full" | "compact";
};

export default function HomePersonalized({ suggestions, variant = "full" }: HomePersonalizedProps) {
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
  const panelBase =
    "rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl";
  const compactSuggestions = suggestions.slice(0, 3);

  if (variant === "compact") {
    return (
      <aside className="space-y-4">
        {!user && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-3 text-[12px] text-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <p className="font-semibold text-white/90">Personaliza a tua home</p>
            <p className="mt-1 text-[11px] text-white/60">
              Entra para veres agenda, amigos e recomendações.
            </p>
            <Link
              href="/login"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] text-white hover:bg-white/20"
            >
              Entrar
              <span className="text-[10px]">→</span>
            </Link>
          </div>
        )}

        <div className={panelBase}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Agenda</p>
            <Link href="/me" className="text-[10px] text-white/70 hover:text-white">
              Ver tudo
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Eventos</p>
              {upcomingEvents.length === 0 ? (
                <p className="text-[11px] text-white/55">Sem eventos marcados.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {upcomingEvents.slice(0, 2).map((item) => (
                    <Link
                      key={item.id}
                      href={item.ctaHref ?? "/me"}
                      className="block rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10"
                    >
                      <p className="text-[12px] font-semibold text-white line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-white/60">
                        {formatDateLabel(item.startAt)} · {item.label ?? "Evento"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Reservas</p>
              {upcomingBookings.length === 0 ? (
                <p className="text-[11px] text-white/55">Sem reservas confirmadas.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {upcomingBookings.slice(0, 1).map((item) => (
                    <Link
                      key={item.id}
                      href={item.ctaHref ?? "/me"}
                      className="block rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10"
                    >
                      <p className="text-[12px] font-semibold text-white line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-white/60">
                        {formatDateLabel(item.startAt)} · {item.label ?? "Reserva"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Padel</p>
              {padelItems.length === 0 ? (
                <p className="text-[11px] text-white/55">Sem jogos pendentes.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {padelItems.slice(0, 1).map((item) => (
                    <Link
                      key={item.id}
                      href={item.ctaHref ?? "/padel/duplas"}
                      className="block rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10"
                    >
                      <p className="text-[12px] font-semibold text-white line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-white/60">
                        {formatDateLabel(item.startAt)} · {item.label ?? "Padel"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={panelBase}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Amigos</p>
            <Link href="/explorar?world=eventos" className="text-[10px] text-white/70 hover:text-white">
              Descobrir
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {following.length === 0 ? (
              <p className="text-[11px] text-white/55">Segue amigos para veres a atividade deles.</p>
            ) : (
              following.slice(0, 3).map((f) => (
                <div key={f.userId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <Avatar
                    src={f.avatarUrl}
                    name={f.fullName ?? f.username ?? "Utilizador"}
                    className="h-8 w-8 border border-white/15"
                    textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                    fallbackText="OR"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-white line-clamp-1">
                      {f.fullName ?? "Utilizador ORYA"}
                    </p>
                    <p className="text-[10px] text-white/60">@{f.username ?? "username"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={panelBase}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Sugestões</p>
            <Link href="/explorar" className="text-[10px] text-white/70 hover:text-white">
              Ver mais
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {compactSuggestions.length === 0 && (
              <p className="text-[11px] text-white/55">Sem sugestões para mostrar.</p>
            )}
            {compactSuggestions.map((event) => {
              const coverSrc = getEventCoverUrl(event.coverImageUrl, {
                seed: event.slug ?? event.id,
                width: 160,
                quality: 70,
                format: "webp",
              });
              return (
                <Link
                  key={event.id}
                  href={`/eventos/${event.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/10">
                    <Image
                      src={coverSrc}
                      alt={event.title}
                      width={40}
                      height={40}
                      placeholder="blur"
                      blurDataURL={defaultBlurDataURL}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white line-clamp-1">{event.title}</p>
                    <p className="text-[10px] text-white/60">
                      {formatDateLabel(event.startsAt)} · {event.locationCity ?? "Portugal"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

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
            {suggestions.map((event) => {
              const coverSrc = getEventCoverUrl(event.coverImageUrl, {
                seed: event.slug ?? event.id,
                width: 200,
                quality: 70,
                format: "webp",
              });
              return (
                <Link
                  key={event.id}
                  href={`/eventos/${event.slug}`}
                  className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/10"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/10">
                    <Image
                      src={coverSrc}
                      alt={event.title}
                      width={48}
                      height={48}
                      placeholder="blur"
                      blurDataURL={defaultBlurDataURL}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white group-hover:text-white">{event.title}</p>
                    <p className="text-[12px] text-white/60">
                      {formatDateLabel(event.startsAt)} · {event.locationCity ?? "Portugal"} · {formatPrice(event.priceFrom)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

    </section>
  );
}
