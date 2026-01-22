export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";
import { isOrganizationFollowed } from "@/domain/social/follows";

export async function GET(req: NextRequest) {
  const organizationId = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!organization) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const isFollowing = await isOrganizationFollowed(user.id, organizationId);

  return NextResponse.json({ ok: true, isFollowing }, { status: 200 });
}
