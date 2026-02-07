"use client";

import Link from "next/link";
import { getEventCoverUrl } from "@/lib/eventCover";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

export type TicketCardProps = {
  id: string;
  quantity: number;
  pricePaid: number; // total pago por esta compra
  currency: string;
  createdAt?: string;
  event: {
    slug?: string;
    title: string;
    startDate?: string;
    locationFormattedAddress?: string | null;
    coverImageUrl?: string | null;
  };
  ticket: {
    name: string; // wave / tipo de bilhete
    description?: string | null;
  };
  qrToken?: string | null;
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatPrice(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return "";
  return `${amount.toFixed(2)} ${currency || "EUR"}`;
}

export function TicketCard(props: TicketCardProps) {
  const { id, quantity, pricePaid, currency, event, ticket, qrToken } = props;

  const dateLabel = formatDate(event.startDate ?? props.createdAt);
  const totalLabel = formatPrice(pricePaid, currency);
  const unitPrice = quantity > 0 ? pricePaid / quantity : pricePaid;
  const unitPriceLabel = formatPrice(unitPrice, currency);

  const eventDateObj = event.startDate ? new Date(event.startDate) : null;
  const now = new Date();

  let statusLabel = "Confirmado";
  let statusClass =
    "border-emerald-400/50 bg-emerald-500/10 text-emerald-200";

  if (eventDateObj && !Number.isNaN(eventDateObj.getTime())) {
    const isPast = eventDateObj.getTime() < now.getTime();

    const isSameDay =
      eventDateObj.getFullYear() === now.getFullYear() &&
      eventDateObj.getMonth() === now.getMonth() &&
      eventDateObj.getDate() === now.getDate();

    if (isPast) {
      statusLabel = "Já aconteceu";
      statusClass = "border-white/25 bg-white/5 text-white/80";
    } else if (isSameDay) {
      statusLabel = "É hoje";
      statusClass = "border-sky-400/60 bg-sky-500/10 text-sky-100";
    }
  }

  const coverSrc = getEventCoverUrl(event.coverImageUrl, {
    seed: event.slug ?? event.title ?? id,
    width: 800,
    quality: 70,
    format: "webp",
  });

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-black/80 to-black/95 hover:border-[#6BFFFF]/70 transition-colors shadow-[0_16px_45px_rgba(0,0,0,0.75)]">
      {/* Poster visual */}
      <div className="relative w-full overflow-hidden">
        <div className="relative aspect-[3/4] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverSrc}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />

          {/* Overlay gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Badges no topo */}
          <div className="absolute left-2 right-2 top-2 flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass}`}
            >
              {statusLabel}
            </span>
            <span className="inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white/85">
              {quantity > 1 ? `${quantity} bilhetes` : "1 bilhete"}
            </span>
          </div>

          {/* Título + local + data na base do poster */}
          <div className="absolute inset-x-2 bottom-2 space-y-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
              Bilhete ORYA
            </p>
            <h3 className="text-sm font-semibold leading-snug line-clamp-2">
              {event.title}
            </h3>
            {event.locationFormattedAddress && (
              <p className="text-[11px] text-white/70 line-clamp-1">
                {event.locationFormattedAddress}
              </p>
            )}
            {dateLabel && (
              <p className="text-[11px] text-white/80">{dateLabel}</p>
            )}
          </div>
        </div>
      </div>

      {/* Zona de detalhes por baixo do poster */}
      <div className="relative border-t border-white/10 bg-black/80 px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="space-y-1">
            <p className="text-white/50">Total pago</p>
            <p className="text-white/90">{totalLabel}</p>
          </div>
          <div className="space-y-1">
            <p className="text-white/50">Preço unitário</p>
            <p className="text-white/90">{unitPriceLabel}</p>
          </div>
          <div className="space-y-1">
            <p className="text-white/50">Tipo de bilhete</p>
            <p className="text-white/90 line-clamp-1">{ticket.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-white/50">Referência</p>
            <p className="text-white/80 text-[10px] break-all">{id}</p>
          </div>
        </div>

        <p className="mt-1 text-[10px] text-white/40">
          QR code disponível neste bilhete. Em breve vais poder transferir
          bilhetes, revender e gerir tudo diretamente nesta página.
        </p>

        {/* Preview do QR Code pequeno, no canto inferior direito */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1 text-[11px] text-white/70">
            <span className="inline-flex rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/75">
              {quantity > 1 ? `${quantity} entradas` : "Entrada única"}
            </span>
            {ticket.description && (
              <span className="line-clamp-2 text-[10px] text-white/55">
                {ticket.description}
              </span>
            )}
          </div>

          {qrToken ? (
            <div className="shrink-0 rounded-2xl bg-white p-2 shadow-[0_0_28px_rgba(255,0,200,0.35)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${qrToken}?theme=dark`}
                alt="QR Code do bilhete ORYA"
                className="h-20 w-20 object-contain"
              />
            </div>
          ) : (
            <div className="shrink-0 rounded-2xl border border-dashed border-white/25 bg-black/40 px-3 py-2 text-[10px] text-white/60 text-center max-w-[140px]">
              A preparar o QR deste bilhete…
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1 text-white/80 hover:bg-white/10 transition-colors"
          >
            <Link href={event.slug ? `/eventos/${event.slug}` : "/explorar/eventos"}>
              Ver evento
            </Link>
          </button>
          <Link
            href={`/bilhete/${id}`}
            className={`${CTA_PRIMARY} px-3 py-1 text-[11px] active:scale-95`}
          >
            Abrir bilhete
          </Link>
        </div>
      </div>
    </article>
  );
}
