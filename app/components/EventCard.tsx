// app/components/EventCard.tsx
import Link from 'next/link';
import type { Event } from '../../types/event';

type Props = {
  event: Event;
};

function formatPrice(tickets: Event['tickets'], isFree: boolean) {
  if (isFree) return 'Grátis';

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
  const priceLabel = formatPrice(event.tickets, event.isFree);
  const dateLabel = formatDateRange(event.startDate, event.endDate, event.timezone);

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-all duration-300 flex flex-col"
    >
      {/* IMAGE */}
      <div className="relative h-44 w-full overflow-hidden">
        {/* Aqui depois ligamos a cover real (Image do Next) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#FF00C8]/40 via-[#6BFFFF]/20 to-transparent" />
        <div className="absolute inset-0 bg-[url('/images/placeholder-event.jpg')] bg-cover bg-center opacity-60 group-hover:scale-105 transition-transform duration-500" />
      </div>

      {/* CONTENT */}
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-[#6BFFFF]/80 mb-1">
            {dateLabel}
          </div>
          <h3 className="text-lg font-semibold leading-snug mb-1">
            {event.title}
          </h3>
          <p className="text-sm text-white/60 line-clamp-2">
            {event.locationName} · {event.address}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#6BFFFF]">
            {priceLabel}
          </span>

          <div className="flex items-center gap-3 text-white/50">
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