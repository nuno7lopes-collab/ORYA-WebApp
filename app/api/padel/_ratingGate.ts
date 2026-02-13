import { prisma } from "@/lib/prisma";
import { ensurePadelPlayerProfileId } from "@/domain/padel/playerProfile";

type RatingGateResult =
  | { ok: true; playerId: number }
  | { ok: false; error: "RANKING_SANCTION_BLOCK"; playerId: number; blockedUntil: string | null };

export async function ensurePadelRatingActionAllowed(params: {
  organizationId: number;
  userId: string;
}): Promise<RatingGateResult> {
  const playerId = await ensurePadelPlayerProfileId(prisma, {
    organizationId: params.organizationId,
    userId: params.userId,
  });
  const profile = await prisma.padelRatingProfile.findFirst({
    where: {
      organizationId: params.organizationId,
      playerId,
    },
    select: {
      blockedNewMatches: true,
      suspensionEndsAt: true,
    },
  });

  const now = new Date();
  const suspensionActive = Boolean(profile?.suspensionEndsAt && profile.suspensionEndsAt > now);
  const blocked = Boolean(profile?.blockedNewMatches || suspensionActive);
  if (!blocked) {
    return { ok: true, playerId };
  }

  return {
    ok: false,
    error: "RANKING_SANCTION_BLOCK",
    playerId,
    blockedUntil: profile?.suspensionEndsAt ? profile.suspensionEndsAt.toISOString() : null,
  };
}
