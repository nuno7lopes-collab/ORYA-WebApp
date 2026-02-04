import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { EventAccessMode } from "@prisma/client";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import PadelMonitorClient from "./PadelMonitorClient";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function PadelMonitorPage({ params, searchParams }: PageProps) {
  const resolved = await params;
  const slug = resolved.slug;
  if (!slug) notFound();
  const lang = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      status: true,
      timezone: true,
      organizationId: true,
      padelTournamentConfig: { select: { advancedSettings: true, lifecycleStatus: true, padelClubId: true } },
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
    },
  });
  if (!event) notFound();

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
  });
  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0], EventAccessMode.INVITE_ONLY);
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";
  if (!isPublicEvent) notFound();

  const advancedSettings = (event.padelTournamentConfig?.advancedSettings as any) ?? {};
  const tvMonitor = (advancedSettings?.tvMonitor ?? {}) as {
    footerText?: string | null;
    sponsors?: string[];
  };
  const courtIds =
    Array.isArray(advancedSettings?.courtIds) && advancedSettings.courtIds.length > 0
      ? advancedSettings.courtIds.filter((id: unknown) => Number.isFinite(Number(id))).map((id: unknown) => Number(id))
      : null;

  const [courts, canOperate] = await Promise.all([
    courtIds && courtIds.length > 0
      ? prisma.padelClubCourt.findMany({
          where: { id: { in: courtIds }, isActive: true },
          select: { id: true, name: true, displayOrder: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        })
      : event.padelTournamentConfig?.padelClubId
        ? prisma.padelClubCourt.findMany({
            where: { padelClubId: event.padelTournamentConfig.padelClubId, isActive: true },
            select: { id: true, name: true, displayOrder: true },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
    (async () => {
      if (!event.organizationId) return false;
      const supabase = await createSupabaseServer();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return false;
      const { membership } = await getActiveOrganizationForUser(data.user.id, {
        organizationId: event.organizationId,
        allowFallback: true,
      });
      if (!membership) return false;
      const access = await ensureMemberModuleAccess({
        organizationId: event.organizationId,
        userId: data.user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.TORNEIOS,
        required: "EDIT",
      });
      return access.ok;
    })(),
  ]);

  const matches = await prisma.eventMatchSlot.findMany({
    where: {
      eventId: event.id,
      OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
    },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });

  return (
      <PadelMonitorClient
        event={{ id: event.id, title: event.title, timezone: event.timezone ?? null }}
        initialMatches={matches as any}
        lang={lang}
        tvMonitor={tvMonitor}
        courtOptions={courts}
        canOperate={canOperate}
      />
    );
}
