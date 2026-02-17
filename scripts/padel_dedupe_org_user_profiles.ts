import { prisma } from "@/lib/prisma";
import { mergePadelPlayerProfiles } from "@/domain/padel/playerProfile";

const args = process.argv.slice(2);

const getArg = (name: string) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  const next = args[idx + 1];
  return next && !next.startsWith("--") ? next : "true";
};

const toNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const apply = getArg("--apply") === "true";
const limit = toNumber(getArg("--limit"));
const organizationId = toNumber(getArg("--organizationId"));

type DuplicateGroup = {
  organizationId: number;
  userId: string;
  duplicates: number;
};

async function run() {
  const whereOrgClause =
    typeof organizationId === "number" ? `AND organization_id = ${Math.floor(organizationId)}` : "";
  const limitClause = typeof limit === "number" ? `LIMIT ${Math.max(1, Math.floor(limit))}` : "";
  const duplicateGroups = await prisma.$queryRawUnsafe<DuplicateGroup[]>(`
    SELECT
      organization_id::int AS "organizationId",
      user_id::text AS "userId",
      COUNT(*)::int AS "duplicates"
    FROM app_v3.padel_player_profiles
    WHERE user_id IS NOT NULL
      ${whereOrgClause}
    GROUP BY organization_id, user_id
    HAVING COUNT(*) > 1
    ORDER BY organization_id ASC, user_id ASC
    ${limitClause}
  `);
  const report: Array<Record<string, unknown>> = [];
  let mergedProfiles = 0;

  for (const group of duplicateGroups) {
    const profiles = await prisma.padelPlayerProfile.findMany({
      where: {
        organizationId: group.organizationId,
        userId: group.userId,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ratingProfile: {
          select: {
            rating: true,
            matchesPlayed: true,
          },
        },
      },
    });

    const sorted = [...profiles].sort((a, b) => {
      const aMatches = a.ratingProfile?.matchesPlayed ?? -1;
      const bMatches = b.ratingProfile?.matchesPlayed ?? -1;
      if (aMatches !== bMatches) return bMatches - aMatches;

      const aRating = a.ratingProfile?.rating != null ? Number(a.ratingProfile.rating) : -1;
      const bRating = b.ratingProfile?.rating != null ? Number(b.ratingProfile.rating) : -1;
      if (aRating !== bRating) return bRating - aRating;

      const updatedDelta = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (updatedDelta !== 0) return updatedDelta;

      return b.id - a.id;
    });

    const target = sorted[0] ?? null;
    const sources = sorted.slice(1);
    if (!target || sources.length === 0) continue;

    if (apply) {
      await prisma.$transaction(async (tx) => {
        for (const source of sources) {
          await mergePadelPlayerProfiles({
            tx,
            organizationId: group.organizationId,
            userId: group.userId,
            sourceProfileId: source.id,
            targetProfileId: target.id,
            claimKey: "OPS_DEDUPE_ORG_USER",
          });
          mergedProfiles += 1;
        }
      });
    }

    report.push({
      organizationId: group.organizationId,
      userId: group.userId,
      targetProfileId: target.id,
      sourceProfileIds: sources.map((entry) => entry.id),
      duplicates: group.duplicates,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        apply,
        organizationId: organizationId ?? null,
        duplicateGroups: duplicateGroups.length,
        mergedProfiles,
        report,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("padel_dedupe_org_user_profiles_failed", error);
  process.exit(1);
});
