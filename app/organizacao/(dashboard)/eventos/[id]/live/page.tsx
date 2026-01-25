// app/organizacao/(dashboard)/eventos/[id]/live/page.tsx
import { notFound, redirect } from "next/navigation";
import { OrganizationModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import EventLiveDashboardClient from "@/app/organizacao/(dashboard)/eventos/EventLiveDashboardClient";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizationEventLivePrepPage({ params }: PageProps) {
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
    select: {
      id: true,
      slug: true,
      title: true,
      organizationId: true,
      liveHubVisibility: true,
      liveStreamUrl: true,
      templateType: true,
      tournament: { select: { id: true } },
    },
  });
  if (!event || !event.organizationId) notFound();

  const fallbackHref = event.templateType === "PADEL" ? "/organizacao/torneios" : "/organizacao/eventos";

  const { organization, membership } = await getActiveOrganizationForUser(data.user.id, {
    organizationId: event.organizationId,
  });

  if (!organization || !membership) redirect("/organizacao");
  const access = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: data.user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.EVENTOS,
    required: "EDIT",
  });
  if (!access.ok) redirect(fallbackHref);
  const canManageLiveConfig = access.ok;

  return (
    <div className={cn("w-full py-8 text-white")}>
      <EventLiveDashboardClient
        event={{
          id: event.id,
          slug: event.slug,
          title: event.title,
          liveHubVisibility: event.liveHubVisibility ?? "PUBLIC",
          liveStreamUrl: event.liveStreamUrl ?? null,
          templateType: event.templateType ?? null,
        }}
        tournamentId={event.tournament?.id ?? null}
        canManageLiveConfig={canManageLiveConfig}
      />
    </div>
  );
}
