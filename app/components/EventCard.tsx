// app/components/EventCard.tsx
import Link from 'next/link';
import { getEventCoverFallback } from '@/lib/eventCover';
import { getEventLocationDisplay } from '@/lib/location/eventLocation';

type EventTicket = { price: number };

type EventForCard = {
  slug: string;
  title: string;
  startDate: string;
  endDate: string;
  timezone: string;
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: Record<string, unknown> | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  isGratis: boolean;
  tickets?: EventTicket[];
  interestedCount: number;
  goingCount: number;
};

type Props = {
  event: EventForCard;
};

function formatPrice(tickets: EventTicket[] | undefined, isGratis: boolean) {
  if (isGratis) return 'Grátis';

  const list = tickets || []; // <— Evita undefined

  if (!list.length) return 'Preço a definir';

  const min = Math.min(...list.map(t => t.price));
  const max = Math.max(...list.map(t => t.price));

  if (min === 0 && max === 0) return 'Grátis';
  if (min === max) return `${min.toFixed(2)} €`;

  return `${min.toFixed(2)} – ${max.toFixed(2)} €`;
}

function formatDateRange(startDate: string, endDate: string, timezone: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const optsDay: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  };

  const optsTime: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  const dayStr = new Intl.DateTimeFormat('pt-PT', { ...optsDay, timeZone: timezone }).format(start);
  const startTimeStr = new Intl.DateTimeFormat('pt-PT', { ...optsTime, timeZone: timezone }).format(start);
  const endTimeStr = new Intl.DateTimeFormat('pt-PT', { ...optsTime, timeZone: timezone }).format(end);

  return `${dayStr} · ${startTimeStr} – ${endTimeStr}`;
}

export default function EventCard({ event }: Props) {
  const priceLabel = formatPrice(event.tickets, event.isGratis);
  const dateLabel = formatDateRange(event.startDate, event.endDate, event.timezone);
  const coverUrl = getEventCoverFallback(event.slug);
  const locationDisplay = getEventLocationDisplay(
    {
      addressRef: event.addressRef ?? null,
    },
    'Local a anunciar'
  );

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-all duration-300 flex flex-col"
    >
      {/* IMAGE */}
      <div className="relative aspect-square w-full overflow-hidden">
        {/* Aqui depois ligamos a cover real (Image do Next) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#FF00C8]/40 via-[#6BFFFF]/20 to-transparent" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:scale-105 transition-transform duration-500"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      </div>

      {/* CONTENT */}
      <div className="flex-1 p-3 flex flex-col justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[#6BFFFF]/80 mb-1">
            {dateLabel}
          </div>
          <h3 className="text-[15px] font-semibold leading-snug mb-1">
            {event.title}
          </h3>
          <p className="text-[12px] text-white/60 line-clamp-2">
            {locationDisplay.primary}
            {locationDisplay.secondary ? ` · ${locationDisplay.secondary}` : ""}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-[#6BFFFF]">
            {priceLabel}
          </span>

          <div className="flex items-center gap-3 text-white/50 text-[12px]">
            <span className="inline-flex items-center gap-1">
              <span className="text-xs">❤️</span>
              <span>{event.interestedCount}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-xs">👥</span>
              <span>{event.goingCount}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
