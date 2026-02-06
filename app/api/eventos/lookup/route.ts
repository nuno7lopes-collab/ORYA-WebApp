import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const MAX_IDS = 50;

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  const parts = raw.split(",").map((value) => value.trim());
  const ids: number[] = [];
  for (const part of parts) {
    if (!part) continue;
    const id = Number(part);
    if (!Number.isFinite(id)) continue;
    if (ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= MAX_IDS) break;
  }
  return ids;
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    await ensureAuthenticated(supabase);

    const { searchParams } = new URL(req.url);
    const ids = parseIds(searchParams.get("ids"));

    if (ids.length === 0) {
      return jsonWrap({ items: [] }, { status: 200 });
    }

    const events = await prisma.event.findMany({
      where: {
        id: { in: ids },
        isDeleted: false,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        endsAt: true,
        coverImageUrl: true,
        locationName: true,
        locationCity: true,
        status: true,
      },
    });

    return jsonWrap(
      {
        items: events.map((event) => ({
          id: event.id,
          slug: event.slug,
          title: event.title,
          startsAt: event.startsAt ? event.startsAt.toISOString() : null,
          endsAt: event.endsAt ? event.endsAt.toISOString() : null,
          coverImageUrl: event.coverImageUrl ?? null,
          locationName: event.locationName ?? null,
          locationCity: event.locationCity ?? null,
          status: event.status ?? null,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/eventos/lookup] erro", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar eventos." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
