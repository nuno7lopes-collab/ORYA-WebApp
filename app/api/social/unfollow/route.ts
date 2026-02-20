export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
    if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { targetUserId?: string } | null;
    const targetUserId = body?.targetUserId?.trim();
    if (!targetUserId) return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });

    await prisma.follows.deleteMany({
      where: { follower_id: user.id, following_id: targetUserId },
    });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[social/unfollow]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);