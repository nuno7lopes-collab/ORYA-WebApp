// app/organizacao/(dashboard)/eventos/[id]/edit/page.tsx
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { canManageEvents } from "@/lib/organizationPermissions";
import { EventEditClient } from "@/app/organizacao/(dashboard)/eventos/EventEditClient";
import { CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizationEventEditPage({ params }: PageProps) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return <AuthGate />;
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

  if (!event || !event.organizationId) notFound();

  const isPadelEvent = event.templateType === "PADEL";
  const eventRouteBase = isPadelEvent ? "/organizacao/torneios" : "/organizacao/eventos";
  const primaryLabelTitle = isPadelEvent ? "Torneio" : "Evento";
  const fallbackHref = eventRouteBase;

  const { organization, membership } = await getActiveOrganizationForUser(data.user.id, {
    organizationId: event.organizationId,
  });

  if (!organization || !membership) {
    redirect("/organizacao");
  }
  if (!canManageEvents(membership.role)) {
    redirect(fallbackHref);
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
    <div className={cn("w-full py-8 space-y-6 text-white")}>
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">Editar {primaryLabelTitle.toLowerCase()}</p>
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
          organizationId: event.organizationId,
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
