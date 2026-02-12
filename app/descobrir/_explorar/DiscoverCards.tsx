"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { defaultBlurDataURL } from "@/lib/image";
import { getEventCoverUrl } from "@/lib/eventCover";
import { formatEventLocationLabel } from "@/lib/location/eventLocation";
import { PadelIcon, PuzzleIcon, TicketIcon } from "./WorldIcons";
import type {
  ExploreItem,
  PadelClubItem,
  PadelOpenPairingItem,
  PadelTournamentItem,
  ServiceItem,
} from "./discoverTypes";
import type { EventSignalPayload } from "./eventSignals";

const CATEGORY_LABELS: Record<string, string> = {
  PADEL: "Padel",
  GERAL: "Eventos gerais",
};

const resolveCover = (
  coverImageUrl: string | null | undefined,
  seed: string | number,
  width = 720,
) => getEventCoverUrl(coverImageUrl, { seed, width, quality: 65, format: "webp" });

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const baseOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  const startStr = startDate.toLocaleString("pt-PT", baseOpts);
  if (sameDay) {
    const endTime = endDate.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${startStr} · ${endTime}`;
  }
  const endStr = endDate.toLocaleString("pt-PT", baseOpts);
  return `${startStr} -> ${endStr}`;
}

function formatServiceAvailability(value: string | null) {
  if (!value) return "Sem horários";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem horários";
  return parsed.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

function formatPadelDate(start: string | null, end: string | null) {
  if (!start) return null;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;
  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime())) {
      return formatDateRange(start, end);
    }
  }
  return startDate.toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPadelFormat(value: string | null) {
  if (!value) return null;
  const labels: Record<string, string> = {
    TODOS_CONTRA_TODOS: "Todos contra todos",
    QUADRO_ELIMINATORIO: "Quadro eliminatório",
    GRUPOS_ELIMINATORIAS: "Grupos + eliminatórias",
    QUADRO_AB: "Quadro A/B",
    DUPLA_ELIMINACAO: "Dupla eliminação",
    NON_STOP: "Non-stop",
    CAMPEONATO_LIGA: "Campeonato/Liga",
  };
  return labels[value] ?? value;
}

function formatPadelEligibility(value: string | null) {
  if (!value) return "Elegibilidade aberta";
  const labels: Record<string, string> = {
    OPEN: "Aberto",
    MALE_ONLY: "Masculino",
    FEMALE_ONLY: "Feminino",
    MIXED: "Misto",
  };
  return labels[value] ?? value;
}

function formatPadelPaymentMode(value: string) {
  if (value === "SPLIT") return "Pagamento dividido";
  if (value === "FULL") return "Pago pelo capitão";
  return "Pagamento";
}

function formatPadelDeadline(value: string | null) {
  if (!value) return "Sem prazo definido";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem prazo definido";
  return parsed.toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function statusTag(status: ExploreItem["status"]) {
  if (status === "CANCELLED") return { text: "Cancelado", className: "text-red-200" };
  if (status === "PAST") return { text: "Já aconteceu", className: "text-white/55" };
  if (status === "DRAFT") return { text: "Rascunho", className: "text-white/60" };
  return { text: "Em breve", className: "text-[#6BFFFF]" };
}

type EventCardProps = {
  item: ExploreItem;
  liked: boolean;
  onLike: (id: number) => void;
  onHide: (id: number) => void;
  onSignal: (payload: EventSignalPayload) => void;
  imagePriority?: boolean;
};

function PriceBadge({ item }: { item: ExploreItem }) {
  if (item.isGratis) {
    return (
      <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10 text-emerald-200">
        Grátis
      </span>
    );
  }
  if (item.priceFrom !== null) {
    return (
      <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
        Desde {item.priceFrom.toFixed(2)} €
      </span>
    );
  }
  return null;
}

export function EventCard({
  item,
  liked,
  onLike,
  onHide,
  onSignal,
  imagePriority,
}: EventCardProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLAnchorElement | null>(null);
  const viewedRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);
  const dwellSentRef = useRef(false);
  const status = statusTag(item.status);
  const dateLabel = formatDateRange(item.startsAt, item.endsAt);
  const venueLabel = formatEventLocationLabel(
    {
      addressRef: {
        formattedAddress: item.location.formattedAddress ?? null,
        latitude: item.location.lat ?? null,
        longitude: item.location.lng ?? null,
      },
    },
    "",
  );
  const hasVenue = Boolean(venueLabel && venueLabel.trim());

  const flushDwell = useCallback(() => {
    const since = visibleSinceRef.current;
    if (!since) return;
    const dwellMs = Date.now() - since;
    visibleSinceRef.current = null;
    if (dwellMs < 1200 || dwellSentRef.current) return;
    dwellSentRef.current = true;
    onSignal({ eventId: item.id, signalType: "DWELL", signalValue: dwellMs });
  }, [item.id, onSignal]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target !== node) return;
          if (entry.isIntersecting) {
            if (!viewedRef.current) {
              viewedRef.current = true;
              onSignal({ eventId: item.id, signalType: "VIEW" });
            }
            if (!visibleSinceRef.current) {
              visibleSinceRef.current = Date.now();
              dwellSentRef.current = false;
            }
          } else {
            flushDwell();
          }
        });
      },
      { threshold: 0.45 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      flushDwell();
    };
  }, [flushDwell, item.id, onSignal]);

  return (
    <Link
      ref={rootRef}
      href={`/eventos/${item.slug}`}
      onClick={() => onSignal({ eventId: item.id, signalType: "CLICK" })}
      className="group w-full rounded-2xl border border-white/12 bg-black/30 overflow-hidden flex flex-col transition-all hover:border-white/20 hover:-translate-y-[4px] shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
    >
      <div className="relative overflow-hidden">
        <div className="aspect-square w-full">
          <Image
            src={resolveCover(item.coverImageUrl, item.slug ?? item.id, 720)}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transform transition-transform duration-300 group-hover:scale-[1.04]"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
            priority={imagePriority}
            fetchPriority={imagePriority ? "high" : "auto"}
          />
        </div>

        <div className="absolute top-2 left-2 flex items-center gap-2 rounded-2xl border border-white/16 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-lg bg-gradient-to-r from-white/12 via-white/9 to-white/6">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px]">
            <TicketIcon className="h-4 w-4" />
          </span>
          <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-[#FF66E0]/70 via-[#8DEFFF]/70 to-[#5270FF]/70" />
          <span className="tracking-wide leading-none">Evento</span>
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!liked) {
                onSignal({ eventId: item.id, signalType: "FAVORITE" });
              }
              onLike(item.id);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 border border-white/30 shadow-[0_0_15px_rgba(0,0,0,0.6)] text-base hover:bg-black/80 transition-all"
            aria-label={liked ? "Remover interesse" : "Marcar interesse"}
          >
            <span
              className={`transition-transform duration-150 ${
                liked ? "scale-110 text-[#FF00C8]" : "scale-100 text-white"
              }`}
            >
              {liked ? "♥" : "♡"}
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSignal({ eventId: item.id, signalType: "HIDE_EVENT" });
              onHide(item.id);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 border border-white/30 shadow-[0_0_15px_rgba(0,0,0,0.6)] text-sm text-white hover:bg-black/80 transition-all"
            aria-label="Ocultar evento"
            title="Ocultar evento"
          >
            ×
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      <div className="p-3 flex flex-col gap-1.5 bg-gradient-to-b from-white/4 via-transparent to-white/2">
        <div className="flex items-center justify-between text-[11px] text-white/75">
          {item.hostUsername ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/${item.hostUsername}`);
              }}
              className="truncate text-left hover:text-[#6BFFFF]"
            >
              {item.hostName || `@${item.hostUsername}`}
            </button>
          ) : (
            <span className="truncate">{item.hostName || "Organização ORYA"}</span>
          )}
          <PriceBadge item={item} />
        </div>

        <h2 className="text-[14px] md:text-[15px] font-semibold leading-snug text-white line-clamp-2">
          {item.title}
        </h2>

        <p className="text-[11px] text-white/80 line-clamp-2">{dateLabel}</p>
        {hasVenue ? <p className="text-[11px] text-white/70">{venueLabel}</p> : null}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.categories.map((category) => (
            <span
              key={category}
              className="text-[10px] rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-white/75"
            >
              {CATEGORY_LABELS[category] ?? category}
            </span>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-black/75 border border-white/22 text-white font-medium">
            {item.isGratis ? "Entrada gratuita" : "Bilhetes disponíveis"}
          </span>
          <span className={status.className}>{status.text}</span>
        </div>
      </div>
    </Link>
  );
}

type ServiceCardProps = {
  item: ServiceItem;
  imagePriority?: boolean;
};

export function ServiceCard({ item, imagePriority }: ServiceCardProps) {
  const organizationName = item.organization.publicName || item.organization.businessName || "Organização";
  const availabilityLabel = formatServiceAvailability(item.nextAvailability);
  const priceLabel = `${(item.unitPriceCents / 100).toFixed(2)} ${item.currency}`;

  return (
    <Link
      href={
        item.organization.username
          ? `/${item.organization.username}?serviceId=${item.id}`
          : `/servicos/${item.id}`
      }
      className="group w-full rounded-2xl border border-white/12 bg-black/30 overflow-hidden flex flex-col transition-all hover:border-white/20 hover:-translate-y-[4px] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
    >
      <div className="relative overflow-hidden">
        <div className="aspect-square w-full">
          <Image
            src={resolveCover(null, `service-${item.id}`, 720)}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transform transition-transform duration-300 group-hover:scale-[1.04]"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
            priority={imagePriority}
            fetchPriority={imagePriority ? "high" : "auto"}
          />
        </div>

        <div className="absolute top-2 left-2 flex items-center gap-2 rounded-2xl border border-white/16 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-lg bg-gradient-to-r from-white/10 via-white/7 to-white/5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px]">
            <PuzzleIcon className="h-4 w-4" />
          </span>
          <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-[#FCD34D] via-[#FB923C] to-[#F97316]" />
          <span className="tracking-wide leading-none">Reserva</span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      <div className="p-3 flex flex-col gap-1.5 bg-gradient-to-b from-white/4 via-transparent to-white/2">
        <div className="flex items-center justify-between text-[11px] text-white/75">
          <span className="truncate">{organizationName}</span>
          {item.addressRef?.formattedAddress || item.organization.addressRef?.formattedAddress ? (
            <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
              {item.addressRef?.formattedAddress || item.organization.addressRef?.formattedAddress}
            </span>
          ) : null}
        </div>

        <h2 className="text-[14px] md:text-[15px] font-semibold leading-snug text-white line-clamp-2">
          {item.title}
        </h2>

        {item.description ? (
          <p className="text-[11px] text-white/80 line-clamp-2">
            {item.description}
          </p>
        ) : null}

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-black/75 border border-white/22 text-white font-medium">
            {item.durationMinutes} min · {priceLabel}
          </span>
          <span className="text-white/70">{availabilityLabel}</span>
        </div>
      </div>
    </Link>
  );
}

type PadelTournamentCardProps = {
  item: PadelTournamentItem;
  imagePriority?: boolean;
};

export function PadelTournamentCard({ item, imagePriority }: PadelTournamentCardProps) {
  const dateLabel = formatPadelDate(item.startsAt, item.endsAt);
  const locationLabel = item.locationFormattedAddress || null;
  const priceLabel =
    item.priceFrom == null ? null : item.priceFrom === 0 ? "Grátis" : `Desde ${item.priceFrom.toFixed(2)} €`;
  const formatLabel = formatPadelFormat(item.format);
  const eligibilityLabel = formatPadelEligibility(item.eligibility);

  return (
    <Link
      href={`/eventos/${item.slug}`}
      className="group w-full rounded-2xl border border-white/12 bg-black/30 overflow-hidden flex flex-col transition-all hover:border-white/20 hover:-translate-y-[4px] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
    >
      <div className="relative overflow-hidden">
        <div className="aspect-square w-full">
          <Image
            src={resolveCover(item.coverImageUrl, item.slug ?? item.id, 720)}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transform transition-transform duration-300 group-hover:scale-[1.04]"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
            priority={imagePriority}
            fetchPriority={imagePriority ? "high" : "auto"}
          />
        </div>
        <div className="absolute top-2 left-2 flex items-center gap-2 rounded-2xl border border-white/16 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-lg bg-gradient-to-r from-white/10 via-white/7 to-white/5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px]">
            <PadelIcon className="h-4 w-4" />
          </span>
          <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-[#6BFFFF] via-[#4ADE80] to-[#1E40AF]" />
          <span className="tracking-wide leading-none">Torneio</span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      <div className="p-3 flex flex-col gap-1.5 bg-gradient-to-b from-white/4 via-transparent to-white/2">
        <div className="flex items-center justify-between text-[11px] text-white/75">
          <span className="truncate">{item.organizationName || "Clube ORYA"}</span>
          {priceLabel ? (
            <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">{priceLabel}</span>
          ) : null}
        </div>

        <h2 className="text-[14px] md:text-[15px] font-semibold leading-snug text-white line-clamp-2">
          {item.title}
        </h2>

        {dateLabel ? <p className="text-[11px] text-white/80">{dateLabel}</p> : null}
        {locationLabel ? <p className="text-[11px] text-white/70">{locationLabel}</p> : null}

        <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] text-white/75">
          {formatLabel ? (
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
              {formatLabel}
            </span>
          ) : null}
          <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
            {eligibilityLabel}
          </span>
          {item.levels.length === 0 && (
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
              Nível aberto
            </span>
          )}
          {item.levels.slice(0, 3).map((level) => (
            <span
              key={level.id}
              className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5"
            >
              {level.label}
            </span>
          ))}
          {item.levels.length > 3 && (
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
              +{item.levels.length - 3}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

type PadelClubCardProps = {
  item: PadelClubItem;
};

export function PadelClubCard({ item }: PadelClubCardProps) {
  const clubHref = item.organizationUsername ? `/${item.organizationUsername}` : null;
  const courts = item.courts ?? [];
  const content = (
    <div className="group rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.4)] transition-all hover:border-white/16 hover:-translate-y-[4px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Clube</p>
          <h3 className="text-lg font-semibold text-white">{item.shortName || item.name}</h3>
          <p className="text-xs text-white/55">
            {item.city || "Cidade"} · {item.courtsCount} courts
          </p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/75">
          {item.address || "Endereço a anunciar"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {courts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
            Courts a anunciar.
          </div>
        ) : (
          courts.slice(0, 4).map((court) => (
            <div
              key={court.id}
              className="rounded-2xl border border-white/12 bg-black/35 px-3 py-2 text-[11px] text-white/75"
            >
              <p className="font-semibold text-white/90">{court.name}</p>
              <p className="text-[10px] text-white/55">
                {court.indoor ? "Indoor" : "Outdoor"}
                {court.surface ? ` · ${court.surface}` : ""}
              </p>
            </div>
          ))
        )}
      </div>
      {clubHref && (
        <div className="mt-4 text-[11px] text-white/70 group-hover:text-white/90">
          Ver perfil do clube -&gt;
        </div>
      )}
    </div>
  );

  if (clubHref) {
    return (
      <Link href={clubHref} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

type PadelOpenPairingCardProps = {
  item: PadelOpenPairingItem;
  onJoin: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  imagePriority?: boolean;
};

export function PadelOpenPairingCard({
  item,
  onJoin,
  isLoading,
  isAuthenticated,
  imagePriority,
}: PadelOpenPairingCardProps) {
  const dateLabel = formatPadelDate(item.event.startsAt, item.event.startsAt);
  const locationLabel = item.event.locationFormattedAddress || null;
  const deadlineLabel = item.isExpired ? "Expirado" : formatPadelDeadline(item.deadlineAt);
  const paymentLabel = formatPadelPaymentMode(item.paymentMode);
  const slotsLabel = item.openSlots === 1 ? "1 vaga" : `${item.openSlots} vagas`;
  const joinLabel = item.isExpired ? "Expirado" : isAuthenticated ? "Juntar-me" : "Iniciar sessão";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.4)]">
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <Image
            src={resolveCover(item.event.coverImageUrl, item.event.slug ?? item.event.id, 240)}
            alt={item.event.title}
            fill
            sizes="80px"
            className="object-cover"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
            priority={imagePriority}
            fetchPriority={imagePriority ? "high" : "auto"}
          />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Dupla aberta</p>
          <Link href={`/eventos/${item.event.slug}`} className="text-base font-semibold text-white hover:text-white/90">
            {item.event.title}
          </Link>
          {dateLabel ? <p className="text-[11px] text-white/65">{dateLabel}</p> : null}
          {locationLabel ? <p className="text-[11px] text-white/55">{locationLabel}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-white/75">
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
              {item.category?.label || "Nível aberto"}
            </span>
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">{slotsLabel}</span>
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">{paymentLabel}</span>
            {item.isExpired && (
              <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-amber-100">
                Expirado
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/55">Prazo: {deadlineLabel}</p>
        <button
          type="button"
          onClick={onJoin}
          disabled={isLoading || item.isExpired}
          className="rounded-full bg-white text-black px-4 py-1.5 text-[11px] font-semibold hover:bg-white/90 disabled:opacity-60"
        >
          {isLoading ? "A entrar..." : joinLabel}
        </button>
      </div>
    </div>
  );
}
