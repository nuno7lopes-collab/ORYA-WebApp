export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const requests = await prisma.follow_requests.findMany({
    where: { target_id: user.id },
    orderBy: { id: "desc" },
    select: {
      id: true,
      requester_id: true,
      created_at: true,
      profiles_follow_requests_requester: {
        select: { username: true, fullName: true, avatarUrl: true },
      },
    },
  });

  const items = requests.map((req) => ({
    id: req.id,
    requesterId: req.requester_id,
    createdAt: req.created_at,
    username: req.profiles_follow_requests_requester?.username ?? null,
    fullName: req.profiles_follow_requests_requester?.fullName ?? null,
    avatarUrl: req.profiles_follow_requests_requester?.avatarUrl ?? null,
  }));

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
