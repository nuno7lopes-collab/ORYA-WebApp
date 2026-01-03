export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    organizationId?: number | string;
  } | null;
  const rawId = body?.organizationId;
  const organizationId = parseOrganizationId(rawId);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  await prisma.organization_follows.deleteMany({
    where: { follower_id: user.id, organization_id: organizationId },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
