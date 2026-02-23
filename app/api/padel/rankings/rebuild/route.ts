export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { executePadelRankingRebuild } from "@/domain/padel/rankingRebuild";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) return jsonWrap({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });

  const outcome = await executePadelRankingRebuild({
    userId: user.id,
    eventId,
    tier: typeof body.tier === "string" ? body.tier : null,
  });
  if (!outcome.ok) return jsonWrap({ ok: false, error: outcome.error }, { status: outcome.status });

  return jsonWrap({ ok: true, result: outcome.result }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
