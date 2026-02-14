export const runtime = "nodejs";

import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const MAX_HISTORY_ROWS = 250;

async function _GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const rows = await prisma.padelPlayerHistoryProjection.findMany({
    where: {
      playerProfile: {
        userId: user.id,
      },
    },
    select: {
      id: true,
      organizationId: true,
      eventId: true,
      categoryId: true,
      playerProfileId: true,
      partnerPlayerProfileId: true,
      finalPosition: true,
      wonTitle: true,
      bracketSnapshot: true,
      computedAt: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          endsAt: true,
        },
      },
      category: {
        select: {
          id: true,
          label: true,
        },
      },
      partnerPlayerProfile: {
        select: {
          id: true,
          fullName: true,
          displayName: true,
        },
      },
    },
    orderBy: [{ event: { endsAt: "desc" } }, { event: { startsAt: "desc" } }, { computedAt: "desc" }],
    take: MAX_HISTORY_ROWS,
  });

  const history = rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    eventId: row.eventId,
    categoryId: row.categoryId,
    playerProfileId: row.playerProfileId,
    finalPosition: row.finalPosition,
    wonTitle: row.wonTitle,
    computedAt: row.computedAt,
    event: {
      id: row.event.id,
      title: row.event.title,
      slug: row.event.slug,
      startsAt: row.event.startsAt,
      endsAt: row.event.endsAt,
    },
    category: row.category ? { id: row.category.id, label: row.category.label } : null,
    partner: row.partnerPlayerProfile
      ? {
          id: row.partnerPlayerProfile.id,
          name: row.partnerPlayerProfile.displayName || row.partnerPlayerProfile.fullName || "Jogador",
        }
      : null,
    bracketSnapshot: row.bracketSnapshot ?? null,
  }));

  const titles = history.filter((row) => row.wonTitle);

  return jsonWrap(
    {
      ok: true,
      titles,
      history,
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
