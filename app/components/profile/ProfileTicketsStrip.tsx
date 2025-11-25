import Link from "next/link";

// Tipo de bilhete simplificado para uso no perfil
// Mantém compatibilidade com a estrutura vinda de /me e /me/tickets
export type ProfileTicketItem = {
  id: string;
  quantity?: number | null;
  createdAt?: string | null;
  event?: {
    slug?: string | null;
    title?: string | null;
    startDate?: string | null;
    locationName?: string | null;
    coverImageUrl?: string | null;
  } | null;
  ticket?: {
    name?: string | null;
  } | null;
};

export type ProfileTicketsStripProps = {
  tickets: ProfileTicketItem[];
  /**
   * Se for o próprio dono do perfil (vista privada em /me)
   * → mostra copy "Os teus próximos eventos" + CTA "Ver todos os bilhetes".
   * Caso contrário (perfil público /u/[username])
   * → copy diferente e sem botão de abrir bilhete.
   */
  isOwner?: boolean;
  username?: string | null;
  className?: string;
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function buildStatusLabel(startDate?: string | null) {
  if (!startDate) {
    return { label: "Confirmado", className: "border-emerald-400/50 bg-emerald-500/10 text-emerald-200" };
  }

  const now = new Date();
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) {
    return { label: "Confirmado", className: "border-emerald-400/50 bg-emerald-500/10 text-emerald-200" };
  }

  const isPast = d.getTime() < now.getTime();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isPast) {
    return {
      label: "Já aconteceu",
      className: "border-white/25 bg-white/5 text-white/80",
    };
  }

  if (isSameDay) {
    return {
      label: "É hoje",
      className: "border-sky-400/60 bg-sky-500/10 text-sky-100",
    };
  }

  return {
    label: "Em breve",
    className: "border-[#6BFFFF]/60 bg-[#6BFFFF]/10 text-[#6BFFFF]",
  };
}

export default function ProfileTicketsStrip({
  tickets,
  isOwner = false,
  username,
  className,
}: ProfileTicketsStripProps) {
  // Filtrar e ordenar: focar nos próximos eventos
  const now = new Date();
  const upcoming = [...tickets]
    .filter((t) => {
      const dateStr = t.event?.startDate ?? t.createdAt ?? null;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return false;
      // Consideramos "próximo" tudo o que ainda não aconteceu
      return d.getTime() >= now.getTime();
    })
    .sort((a, b) => {
      const da = a.event?.startDate ?? a.createdAt ?? "";
      const db = b.event?.startDate ?? b.createdAt ?? "";
      const daNum = new Date(da).getTime();
      const dbNum = new Date(db).getTime();
      return daNum - dbNum;
    })
    .slice(0, 4); // só 3–4 itens

  if (upcoming.length === 0) {
    // Se não há eventos próximos, podemos simplesmente não mostrar a secção
    return null;
  }

  const title = isOwner
    ? "Os teus próximos eventos"
    : username
      ? `Eventos onde ${username} vai estar`
      : "Eventos onde este utilizador vai estar";

  const subtitle = isOwner
    ? "Um resumo rápido dos próximos eventos para os quais já tens bilhete."
    : "Uma amostra dos eventos públicos onde esta pessoa planeia estar presente.";

  return (
    <section
      aria-label={title}
      className={[
        "mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/60 px-4 py-4 md:px-5 md:py-5 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.8)]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm md:text-base font-semibold text-white/90">
            {title}
          </h2>
          <p className="text-[11px] md:text-xs text-white/60 max-w-md">
            {subtitle}
          </p>
        </div>

        {isOwner ? (
          <Link
            href="/me/tickets"
            className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            Ver todos os bilhetes
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <Link
            href="/explorar"
            className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            Ver eventos na ORYA
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>

      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
        {upcoming.map((t) => {
          const event = t.event ?? {};
          const ticket = t.ticket ?? {};
          const dateLabel = formatDate(event.startDate ?? t.createdAt ?? undefined);
          const { label: statusLabel, className: statusClass } = buildStatusLabel(
            event.startDate ?? t.createdAt ?? undefined,
          );

          const quantity = t.quantity ?? 1;

          return (
            <article
              key={t.id}
              className="group relative flex min-w-[230px] flex-col overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-white/5 via-black/80 to-black/95 shadow-[0_14px_45px_rgba(0,0,0,0.85)] hover:border-[#6BFFFF]/70 transition-colors"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                {event.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.coverImageUrl}
                    alt={event.title ?? "Evento ORYA"}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1b1b2f] via-black to-[#141421] text-[11px] text-white/40">
                    Evento ORYA
                  </div>
                )}

                {/* Overlay + badges */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass}`}
                  >
                    {statusLabel}
                  </span>

                  <span className="inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white/85">
                    {quantity > 1 ? `${quantity} bilhetes` : "1 bilhete"}
                  </span>
                </div>

                <div className="absolute inset-x-2 bottom-2 space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">
                    Bilhete ORYA
                  </p>
                  <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                    {event.title ?? "Evento ORYA"}
                  </h3>
                  {event.locationName && (
                    <p className="text-[11px] text-white/70 line-clamp-1">
                      {event.locationName}
                    </p>
                  )}
                  {dateLabel && (
                    <p className="text-[11px] text-white/80">{dateLabel}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 bg-black/85 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="space-y-1">
                    <p className="text-white/50">Tipo de bilhete</p>
                    <p className="text-white/90 line-clamp-1">
                      {ticket.name ?? "Geral / Wave"}
                    </p>
                  </div>
                  {isOwner && event.slug && (
                    <Link
                      href={`/bilhete/${t.id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1 font-semibold text-[11px] text-black shadow-[0_0_20px_rgba(107,255,255,0.7)] hover:scale-[1.03] active:scale-95 transition-transform"
                    >
                      Abrir bilhete
                    </Link>
                  )}
                </div>

                {isOwner && event.slug && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[10px] text-white/45 hover:text-white/70 transition-colors"
                    // No futuro podes ligar a uma ação de partilha específica
                  >
                    <span aria-hidden>🔗</span> Partilhar com amigos (em breve)
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* CTA mobile */}
      <div className="mt-3 flex justify-end sm:hidden">
        {isOwner ? (
          <Link
            href="/me/tickets"
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            Ver todos os bilhetes
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <Link
            href="/explorar"
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            Ver eventos na ORYA
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </section>
  );
}
