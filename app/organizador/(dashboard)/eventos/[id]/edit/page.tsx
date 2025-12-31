// app/organizador/(dashboard)/eventos/[id]/edit/page.tsx
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { canManageEvents } from "@/lib/organizerPermissions";
import { EventEditClient } from "@/app/organizador/(dashboard)/eventos/EventEditClient";
import { CTA_SECONDARY } from "@/app/organizador/dashboardUi";

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
    redirect(`/login?redirectTo=${encodeURIComponent("/organizador?tab=manage")}`);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      ticketTypes: {
        include: {
          padelEventCategoryLink: {
            include: {
              category: { select: { label: true } },
            },
          },
        },
      },
    },
  });

  if (!event || !event.organizerId) notFound();

  const { organizer, membership } = await getActiveOrganizerForUser(data.user.id, {
    organizerId: event.organizerId,
  });

  if (!organizer || !membership) {
    redirect("/organizador");
  }
  if (!canManageEvents(membership.role)) {
    redirect("/organizador?tab=manage");
  }

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
    padelEventCategoryLinkId: t.padelEventCategoryLinkId ?? null,
    padelCategoryLabel: t.padelEventCategoryLink?.category?.label ?? null,
  }));

  return (
    <div className="w-full px-4 py-8 space-y-6 text-white md:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">Editar evento</p>
            <h1 className="text-2xl font-semibold">{event.title}</h1>
            <p className="text-sm text-white/60">
              ID {event.id} · {event.slug}
            </p>
          </div>
          <a
            href={`/eventos/${event.slug}`}
            className={CTA_SECONDARY}
          >
            Ver página pública
          </a>
        </div>
      </div>

      <EventEditClient
        event={{
          id: event.id,
          organizerId: event.organizerId,
          slug: event.slug,
          title: event.title,
          description: event.description,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          locationName: event.locationName,
          locationCity: event.locationCity,
          address: event.address,
          templateType: event.templateType,
          isFree: event.isFree,
          inviteOnly: event.inviteOnly,
          coverImageUrl: event.coverImageUrl,
          liveHubVisibility: event.liveHubVisibility,
          liveStreamUrl: event.liveStreamUrl,
          publicAccessMode: event.publicAccessMode,
          participantAccessMode: event.participantAccessMode,
          publicTicketTypeIds: event.publicTicketTypeIds ?? [],
          participantTicketTypeIds: event.participantTicketTypeIds ?? [],
          payoutMode: event.payoutMode,
        }}
        tickets={tickets}
      />
    </div>
  );
}
