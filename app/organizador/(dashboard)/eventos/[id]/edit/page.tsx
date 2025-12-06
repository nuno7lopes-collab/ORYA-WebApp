// app/organizador/(dashboard)/eventos/[id]/edit/page.tsx
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { EventEditClient } from "@/app/organizador/(dashboard)/eventos/EventEditClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizerEventEditPage({ params }: PageProps) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/login?redirectTo=/organizador/(dashboard)/eventos");
  }

  const organizer = await prisma.organizer.findFirst({
    where: { userId: data.user.id },
  });
  if (!organizer) {
    redirect("/organizador");
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId: organizer.id },
    include: {
      ticketTypes: true,
    },
  });

  if (!event) notFound();

  const tickets = event.ticketTypes.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price: t.price,
    currency: t.currency,
    totalQuantity: t.totalQuantity,
    soldQuantity: t.soldQuantity,
    status: t.status,
    startsAt: t.startsAt ? t.startsAt.toISOString() : null,
    endsAt: t.endsAt ? t.endsAt.toISOString() : null,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6 text-white md:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Editar evento</p>
          <h1 className="text-2xl font-semibold">{event.title}</h1>
          <p className="text-sm text-white/60">ID {event.id} · {event.slug}</p>
        </div>
        <a
          href={`/eventos/${event.slug}`}
          className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 text-[11px] font-semibold text-black shadow"
        >
          Ver página pública
        </a>
      </div>

      <EventEditClient
        event={{
          id: event.id,
          title: event.title,
          description: event.description,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          locationName: event.locationName,
          locationCity: event.locationCity,
          address: event.address,
          templateType: event.templateType,
          isFree: event.isFree,
          coverImageUrl: event.coverImageUrl,
          feeModeOverride: event.feeModeOverride,
          platformFeeBpsOverride: event.platformFeeBpsOverride,
          platformFeeFixedCentsOverride: event.platformFeeFixedCentsOverride,
          payoutMode: event.payoutMode,
        }}
        tickets={tickets}
      />
    </div>
  );
}
