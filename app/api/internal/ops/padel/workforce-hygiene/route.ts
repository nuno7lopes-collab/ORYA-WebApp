import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";

const parseBool = (value: string | null) => value === "true" || value === "1";

type DuplicateRow = {
  padel_club_id: number;
  user_id: string;
  total: number;
};

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const apply = parseBool(req.nextUrl.searchParams.get("apply"));

  const [nullRowsResult, duplicateRows, orphanStaffInvites, orphanTeamInvites] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total
      FROM app_v3.padel_club_staff
      WHERE user_id IS NULL
    `,
    prisma.$queryRaw<DuplicateRow[]>`
      SELECT padel_club_id, user_id::text, COUNT(*)::int AS total
      FROM app_v3.padel_club_staff
      GROUP BY padel_club_id, user_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 1000
    `,
    prisma.padelClubStaffInvite.count({
      where: {
        targetUserId: null,
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
      },
    }),
    prisma.padelTeamMemberInvite.count({
      where: {
        targetUserId: null,
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
      },
    }),
  ]);

  const nullRows = nullRowsResult[0]?.total ?? 0;

  let removedNullRows = 0;
  let removedDuplicateRows = 0;

  if (apply) {
    removedNullRows = await prisma.$executeRaw`
      DELETE FROM app_v3.padel_club_staff
      WHERE user_id IS NULL
    `;

    removedDuplicateRows = await prisma.$executeRaw`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY padel_club_id, user_id
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
          ) AS rn
        FROM app_v3.padel_club_staff
      )
      DELETE FROM app_v3.padel_club_staff staff
      USING ranked
      WHERE ranked.id = staff.id
        AND ranked.rn > 1
    `;
  }

  return jsonWrap(
    {
      ok: true,
      apply,
      summary: {
        nullStaffRows: nullRows,
        duplicateClubUserPairs: duplicateRows.length,
        duplicateRowsPreview: duplicateRows.slice(0, 50),
        pendingUnlinkedClubStaffInvites: orphanStaffInvites,
        pendingUnlinkedTeamMemberInvites: orphanTeamInvites,
        removedNullRows,
        removedDuplicateRows,
      },
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
