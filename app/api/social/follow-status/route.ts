export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getUserFollowStatus } from "@/domain/social/follows";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const targetId = req.nextUrl.searchParams.get("userId");
  if (!targetId) return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });

  const status = await getUserFollowStatus(user.id, targetId);

  return jsonWrap(
    {
      ok: true,
      ...status,
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);