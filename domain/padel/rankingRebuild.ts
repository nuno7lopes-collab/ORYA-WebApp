import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { rebuildPadelRatingsForEvent } from "@/domain/padel/ratingEngine";

const DEFAULT_ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export type PadelRankingRebuildOutcome =
  | {
      ok: true;
      result: Awaited<ReturnType<typeof rebuildPadelRatingsForEvent>>;
    }
  | {
      ok: false;
      status: 403 | 404;
      error: "FORBIDDEN" | "EVENT_NOT_FOUND";
    };

const normalizeTier = (raw: string | null | undefined) => {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

export async function executePadelRankingRebuild(params: {
  userId: string;
  eventId: number;
  tier?: string | null;
  roles?: OrganizationMemberRole[];
}): Promise<PadelRankingRebuildOutcome> {
  if (!Number.isInteger(params.eventId) || params.eventId <= 0) {
    return { ok: false, status: 404, error: "EVENT_NOT_FOUND" };
  }
  const eventId = params.eventId;
  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true, templateType: true },
  });
  if (!event || event.organizationId == null || event.templateType !== "PADEL") {
    return { ok: false, status: 404, error: "EVENT_NOT_FOUND" };
  }
  const organizationId = event.organizationId;

  const { organization, membership } = await getActiveOrganizationForUser(params.userId, {
    organizationId,
    roles: params.roles ?? DEFAULT_ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return { ok: false, status: 403, error: "FORBIDDEN" };

  const permission = await ensureMemberModuleAccess({
    organizationId,
    userId: params.userId,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return { ok: false, status: 403, error: "FORBIDDEN" };

  const result = await prisma.$transaction((tx) =>
    rebuildPadelRatingsForEvent({
      tx,
      organizationId,
      eventId: event.id,
      actorUserId: params.userId,
      tier: normalizeTier(params.tier),
    }),
  );
  return { ok: true, result };
}
