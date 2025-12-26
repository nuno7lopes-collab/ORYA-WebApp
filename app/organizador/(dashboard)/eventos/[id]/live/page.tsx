// app/organizador/(dashboard)/eventos/[id]/live/page.tsx
import { notFound, redirect } from "next/navigation";
import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { canManageEvents } from "@/lib/organizerPermissions";
import EventLiveDashboardClient from "@/app/organizador/(dashboard)/eventos/EventLiveDashboardClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizerEventLivePrepPage({ params }: PageProps) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect(`/login?redirectTo=${encodeURIComponent(`/organizador/eventos/${eventId}/live`)}`);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      organizerId: true,
      liveHubMode: true,
      liveHubVisibility: true,
      liveStreamUrl: true,
      templateType: true,
      tournament: { select: { id: true } },
    },
  });
  if (!event || !event.organizerId) notFound();

  let { organizer, membership } = await getActiveOrganizerForUser(data.user.id, {
    organizerId: event.organizerId,
  });
  if (!organizer) {
    const legacyOrganizer = await prisma.organizer.findFirst({
      where: { id: event.organizerId, userId: data.user.id },
    });
    if (legacyOrganizer) {
      organizer = legacyOrganizer;
      membership = { role: OrganizerMemberRole.OWNER };
    }
  }

  if (!organizer || !membership) redirect("/organizador");
  if (!canManageEvents(membership.role)) redirect("/organizador?tab=manage");

  return (
    <div className="w-full px-4 py-8 text-white md:px-6 lg:px-8">
      <EventLiveDashboardClient
        event={{
          id: event.id,
          slug: event.slug,
          title: event.title,
          liveHubMode: event.liveHubMode ?? "DEFAULT",
          liveHubVisibility: event.liveHubVisibility ?? "PUBLIC",
          liveStreamUrl: event.liveStreamUrl ?? null,
          templateType: event.templateType ?? null,
        }}
        organizer={{
          id: organizer.id,
          liveHubPremiumEnabled: organizer.liveHubPremiumEnabled,
          username: organizer.username ?? null,
        }}
        tournamentId={event.tournament?.id ?? null}
      />
    </div>
  );
}
