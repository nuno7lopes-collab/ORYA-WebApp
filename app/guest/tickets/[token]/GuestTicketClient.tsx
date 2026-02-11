"use client";

import TicketQrBox from "@/app/components/tickets/TicketQrBox";

type GuestTicketItem = {
  entitlementId: string;
  title: string | null;
  qrToken: string | null;
  status: string;
  consumedAt: string | null;
  info?: string | null;
};

type GuestTicketClientProps = {
  event: {
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    location: string | null;
  };
  purchaseId: string;
  items: GuestTicketItem[];
};

const formatDate = (startsAt?: string | null, endsAt?: string | null) => {
  if (!startsAt) return null;
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const date = new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(start);
    const startTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);
    if (!end || Number.isNaN(end.getTime())) return `${date} · ${startTime}`;
    const endTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(end);
    return `${date} · ${startTime}–${endTime}`;
  } catch {
    return null;
  }
};

export default function GuestTicketClient({ event, purchaseId, items }: GuestTicketClientProps) {
  const when = formatDate(event.startsAt, event.endsAt);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Bilhetes ORYA</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{event.title}</h1>
          {when && <p className="mt-2 text-sm text-white/70">{when}</p>}
          {event.location && <p className="mt-1 text-sm text-white/60">{event.location}</p>}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Não encontrámos bilhetes associados a este link.
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.entitlementId}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    Bilhete {index + 1}
                  </p>
                  <p className="mt-1 text-sm text-white/80">{item.title ?? "Acesso ao evento"}</p>
                </div>
                {item.consumedAt ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/70">
                    Já usado
                  </span>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                {item.qrToken ? (
                  <TicketQrBox qrToken={item.qrToken} purchaseId={purchaseId} />
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-xs text-white/70">
                    {item.info ?? "QR indisponível para este bilhete."}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
