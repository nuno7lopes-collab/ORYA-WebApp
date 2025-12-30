export const runtime = "nodejs";

import { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { EventSidebar } from "@/components/event-sidebar";
import { OrganizerShell } from "@/app/organizador/OrganizerShell";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { prisma } from "@/lib/prisma";

type EventSidebarPayload = {
  id: number;
  slug: string;
  title: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  locationName: string | null;
  locationCity: string | null;
  coverImageUrl: string | null;
  tournamentId: number | null;
};

export default async function OrganizerEventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/organizador");
  }

  const eventId = Number(resolvedParams.id);
  if (!Number.isFinite(eventId)) {
    notFound();
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      locationName: true,
      locationCity: true,
      coverImageUrl: true,
      organizerId: true,
      tournament: { select: { id: true } },
    },
  });

  if (!event || !event.organizerId) {
    notFound();
  }

  const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
  });

  if (!organizer || !membership) {
    redirect("/organizador");
  }

  let profile: { fullName: string | null; username: string | null; avatarUrl: string | null } | null = null;
  try {
    profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { fullName: true, username: true, avatarUrl: true },
    });
  } catch {
    profile = null;
  }

  const organizerUsername = (organizer as { username?: string | null }).username ?? null;
  const organizerAvatarUrl = (organizer as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null;
  const brandPrimary = (organizer as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? undefined;
  const brandSecondary = (organizer as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? undefined;
  const organizerLanguage = (organizer as { language?: string | null }).language ?? "pt";

  const userInfo = {
    id: user.id,
    name: profile?.fullName || profile?.username || user.email || null,
    email: user.email ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  };

  const eventSidebar: EventSidebarPayload = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    locationName: event.locationName,
    locationCity: event.locationCity,
    coverImageUrl: event.coverImageUrl ?? organizerAvatarUrl ?? null,
    tournamentId: event.tournament?.id ?? null,
  };

  return (
    <OrganizerShell
      organizerLanguage={organizerLanguage}
      organizerUsername={organizerUsername ?? null}
      brandPrimary={brandPrimary}
      brandSecondary={brandSecondary}
      sidebar={<EventSidebar event={eventSidebar} user={userInfo} />}
    >
      {children}
    </OrganizerShell>
  );
}
