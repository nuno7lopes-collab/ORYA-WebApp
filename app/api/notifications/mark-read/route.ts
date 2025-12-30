import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { notificationId, userId } = body as { notificationId?: string; userId?: string };
  if (!notificationId || !userId) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: "notificationId e userId são obrigatórios" },
      { status: 400 },
    );
  }

  const notif = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notif) {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", message: "Notificação não existe" },
      { status: 404 },
    );
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
