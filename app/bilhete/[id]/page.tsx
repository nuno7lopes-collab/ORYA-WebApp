// app/bilhete/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import TicketLiveQr from "@/app/components/tickets/TicketLiveQr";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login?redirectTo=/me/tickets");
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id, userId: user.id },
    include: {
      event: {
        select: {
          title: true,
          slug: true,
          startsAt: true,
          locationCity: true,
          locationName: true,
        },
      },
      ticketType: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!ticket) {
    notFound();
  }

  const event = ticket.event;
  const dateLabel = event?.startsAt
    ? new Date(event.startsAt).toLocaleString("pt-PT", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Data a confirmar";

  return (
    <main className="min-h-screen orya-body-bg text-white">
      <section className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-[0.2em]">Bilhete ORYA</p>
            <h1 className="text-2xl font-semibold">{event?.title ?? "Evento ORYA"}</h1>
            <p className="text-sm text-white/70">
              {dateLabel} · {event?.locationName || "Local a anunciar"}
              {event?.locationCity ? `, ${event.locationCity}` : ""}
            </p>
            {ticket.ticketType?.name && (
              <p className="text-xs text-white/60 mt-1">Tipo: {ticket.ticketType.name}</p>
            )}
          </div>
          <a
            href={event?.slug ? `/eventos/${event.slug}` : "/me/tickets"}
            className="text-[11px] text-white/70 hover:text-white underline underline-offset-4"
          >
            Voltar
          </a>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.8)] flex flex-col items-center gap-4">
          {ticket.qrSecret ? (
            <TicketLiveQr qrToken={ticket.qrSecret} />
          ) : (
            <p className="text-sm text-white/70">QR code ainda não está disponível para este bilhete.</p>
          )}
        </div>

        <p className="text-[11px] text-white/50 text-center">
          Mostra este QR à entrada. Atualiza a cada 15 segundos para tua segurança.
        </p>
      </section>
    </main>
  );
}
