import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { NextRequest, NextResponse } from "next/server";

// Lista notificações com badge de não lidas; usa auth, opcionalmente permite userId (admin/tools)
export async function GET(req: NextRequest) {
  const urlUserId = req.nextUrl.searchParams.get("userId");
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolvedUserId = urlUserId || user?.id;
  if (!resolvedUserId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Sessão em falta" },
      { status: 401 },
    );
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: resolvedUserId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json({ ok: true, unreadCount, notifications });
}
