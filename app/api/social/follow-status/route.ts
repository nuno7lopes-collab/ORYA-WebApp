export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getUserFollowStatus } from "@/domain/social/follows";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const targetId = req.nextUrl.searchParams.get("userId");
  if (!targetId) return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });

  const status = await getUserFollowStatus(user.id, targetId);

  return NextResponse.json(
    {
      ok: true,
      ...status,
    },
    { status: 200 },
  );
}
