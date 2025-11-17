// app/bilhete/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

type PageParams = {
  id: string;
};

type PageProps = {
  // Next 16 → params é uma Promise
  params: Promise<PageParams>;
};

function formatDateRange(start: Date, end: Date) {
  const sameDay =
    start.toDateString() === end.toDateString();

  const date = start.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const startTime = start.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime = end.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) {
    return {
      date:
        date.charAt(0).toUpperCase() + date.slice(1),
      time: `${startTime} – ${endTime}`,
    };
  }

  const endDate = end.toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return {
    date:
      date.charAt(0).toUpperCase() + date.slice(1),
    time: `${startTime} · termina ${endDate} às ${endTime}`,
  };
}

export default async function TicketPage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  // 1) Verificar sessão
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect(`/login?redirect=/bilhete/${encodeURIComponent(id)}`);
  }

  const userId = userData.user.id;

  // 2) Buscar compra + evento + ticket, garantindo que pertence ao user
  const purchase = await prisma.ticketPurchase.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      event: true,
      ticket: true,
    },
  });

  if (!purchase) {
    notFound();
  }

  const event = purchase.event;
  const ticket = purchase.ticket;

  const startDate = event.startDate;
  const endDate = event.endDate;

  const { date, time } = formatDateRange(startDate, endDate);

  const cover =
    event.coverImageUrl && event.coverImageUrl.trim().length > 0
      ? event.coverImageUrl
      : "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600";

  const location = event.locationName || "Local a anunciar";

  const totalEuros = (purchase.pricePaid / 100).toFixed(2);

  const shortId =
    purchase.id.slice(-8).toUpperCase();
  const ticketCode = `ORYA-${shortId}`;

  const quantity = purchase.quantity;
  // eslint-disable-next-line react-hooks/purity
  const isPast = endDate.getTime() < Date.now();

  const statusLabel = isPast ? "Evento terminado" : "A caminho";
  const statusTag =
    isPast
      ? "bg-white/10 border-white/30 text-white/80"
      : "bg-emerald-500/15 border-emerald-400/60 text-emerald-100";

  return (
    <main className="orya-body-bg min-h-screen text-white">
      {/* HERO */}
      <section className="relative w-full">
        {/* Background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={event.title}
          className="absolute inset-0 h-[50vh] w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/80 to-[#020617]" />

        <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-6 px-5 pt-8 pb-10 md:pt-10 md:pb-14">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
                OR
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                  Bilhete digital
                </p>
                <p className="text-sm text-white/85">
                  Mostra este bilhete à entrada do evento.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 text-[11px]">
              <span
                className={`rounded-full border px-3 py-1 ${statusTag}`}
              >
                {statusLabel}
              </span>
              <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[10px] text-white/75">
                Código:{" "}
                <span className="font-mono font-semibold text-white">
                  {ticketCode}
                </span>
              </span>
            </div>
          </header>

          {/* Cartões */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)]">
            {/* Lado esquerdo — info do evento */}
            <div className="rounded-3xl border border-white/18 bg-gradient-to-br from-[#0f172a] via-[#020617e8] to-black px-5 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.9)] backdrop-blur-2xl md:px-6 md:py-6">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">
                Evento
              </p>
              <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-2xl font-extrabold leading-tight text-transparent md:text-3xl">
                {event.title}
              </h1>

              <div className="mt-4 space-y-2 text-sm text-white/85">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-lg">📅</span>
                  <div>
                    <p className="font-medium">
                      {date}
                    </p>
                    <p className="text-white/70">{time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-lg">📍</span>
                  <div>
                    <p className="font-medium">
                      {location}
                    </p>
                    {event.address && (
                      <p className="text-white/70">
                        {event.address}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-2xl border border-white/18 bg-white/[0.03] px-4 py-3">
                  <p className="text-white/60">
                    Tipo de bilhete
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {ticket.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/50">
                    Válido para{" "}
                    {quantity === 1
                      ? "1 entrada"
                      : `${quantity} entradas`}.
                  </p>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/50 bg-fuchsia-500/12 px-4 py-3">
                  <p className="text-fuchsia-100/85">
                    Total pago
                  </p>
                  <p className="mt-1 text-sm font-semibold text-fuchsia-100">
                    {totalEuros} €
                  </p>
                  <p className="mt-0.5 text-[10px] text-fuchsia-100/80">
                    Inclui todas as taxas aplicadas.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-white/60">
                Este bilhete está ligado à tua conta ORYA
                ({userData.user.email ?? "email da conta"}). Em
                caso de dúvida, mostra este ecrã à equipa do
                evento.
              </p>
            </div>

            {/* Lado direito — “cartão” + pseudo-QR + buttons */}
            <div className="flex flex-col gap-4">
              <div className="rounded-3xl border border-[#6BFFFF]/40 bg-gradient-to-br from-[#020617f2] via-slate-950 to-black px-5 py-5 shadow-[0_22px_60px_rgba(15,23,42,0.9)] backdrop-blur-2xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
                  Bilhete ORYA
                </p>

                <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                  {/* “QR” placeholder bonito */}
                  <div className="flex items-center justify-center rounded-2xl border border-white/20 bg-black/60 p-3">
                    <div className="h-32 w-32 rounded-2xl bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.38),transparent),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.32),transparent)] flex items-center justify-center border border-white/15">
                      <div className="grid h-24 w-24 grid-cols-6 grid-rows-6 gap-[2px]">
                        {Array.from({ length: 36 }).map((_, i) => (
                          <span
                            key={i}
                            className={`block rounded-[2px] ${
                              i % 3 === 0 || i % 5 === 0
                                ? "bg-white"
                                : "bg-slate-800"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 text-[11px] text-white/80 md:pl-2">
                    <p className="text-sm font-semibold text-white">
                      Bilhete digital pronto
                    </p>
                    <p>
                      Mantém o ecrã com bom brilho e não faças zoom excessivo. O código vai ser lido à
                      entrada para validarmos a tua entrada.
                    </p>
                    <p className="text-white/60">
                      Código do bilhete:{" "}
                      <span className="font-mono text-[11px] text-white">
                        {ticketCode}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Botões de ações do bilhete */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/eventos/${event.slug}`}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_10px_30px_rgba(15,23,42,0.8)] transition hover:brightness-110"
                  >
                    Ver evento
                  </Link>
                  <Link
                    href="/me/bilhetes"
                    className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10"
                  >
                    Ver todos os meus bilhetes
                  </Link>
                </div>
              </div>

              {/* Info extra */}
              <div className="rounded-2xl border border-white/12 bg-black/60 px-4 py-3 text-[10px] text-white/65">
                <p className="mb-1 font-medium text-white/85">Notas importantes</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>
                    Este bilhete é pessoal e está ligado à tua conta ORYA. Não partilhes screenshots
                    publicamente.
                  </li>
                  <li>
                    Em caso de cancelamento ou alteração do evento, vais receber informação no email da
                    tua conta ORYA.
                  </li>
                  <li>
                    Se tiveres mais do que um bilhete nesta compra, o staff no local vê o número total de
                    entradas associadas a este código.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}