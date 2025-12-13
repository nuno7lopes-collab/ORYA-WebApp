import { NextRequest, NextResponse } from "next/server";
import { NotificationPriority, NotificationType, Prisma } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const type = url.searchParams.get("type");
  const typeList = url.searchParams.get("types");
  const cursor = url.searchParams.get("cursor");
  const cursorDate = cursor ? new Date(cursor) : null;

  const where: any = { userId: user.id };
  if (status === "unread") where.isRead = false;
  if (type) where.type = type as NotificationType;
  if (typeList) {
    const arr = typeList.split(",").filter(Boolean) as NotificationType[];
    where.type = { in: arr };
  }
  if (cursorDate && !Number.isNaN(cursorDate.getTime())) {
    where.createdAt = { lt: cursorDate };
  }

  try {
    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
    });

    const hasMore = items.length > PAGE_SIZE;
    const trimmed = hasMore ? items.slice(0, PAGE_SIZE) : items;

    return NextResponse.json({
      ok: true,
      items: trimmed,
      nextCursor: hasMore ? trimmed[trimmed.length - 1]?.createdAt?.toISOString() ?? null : null,
    });
  } catch (err) {
    const isMissingTable =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
    if (isMissingTable) {
      console.warn("[notifications][GET] Tabela notifications em falta – a devolver lista vazia");
      return NextResponse.json({ ok: true, items: [], nextCursor: null });
    }
    console.error("[notifications][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId : null;
    const type = body?.type as NotificationType | undefined;
    const title = typeof body?.title === "string" ? body.title : null;
    const notifBody = typeof body?.body === "string" ? body.body : null;
    const payload = body?.payload && typeof body.payload === "object" ? body.payload : undefined;
    const ctaUrl = typeof body?.ctaUrl === "string" ? body.ctaUrl : undefined;
    const ctaLabel = typeof body?.ctaLabel === "string" ? body.ctaLabel : undefined;
    const priority = body?.priority as NotificationPriority | undefined;
    const senderVisibility = body?.senderVisibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    const fromUserId = typeof body?.fromUserId === "string" ? body.fromUserId : null;
    const organizerId =
      typeof body?.organizerId === "number" ? body.organizerId : Number.isFinite(Number(body?.organizerId)) ? Number(body?.organizerId) : null;
    const eventId =
      typeof body?.eventId === "number" ? body.eventId : Number.isFinite(Number(body?.eventId)) ? Number(body?.eventId) : null;
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId : null;
    const inviteId = typeof body?.inviteId === "string" ? body.inviteId : null;

    if (!userId || !type) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const notif = await createNotification({
      userId,
      type,
      title,
      body: notifBody,
      payload,
      ctaUrl,
      ctaLabel,
      priority,
      senderVisibility,
      fromUserId,
      organizerId,
      eventId,
      ticketId,
      inviteId,
    });

    return NextResponse.json({ ok: true, notification: notif }, { status: 201 });
  } catch (err) {
    const isMissingTable =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
    if (isMissingTable) {
      console.warn("[notifications][POST] Tabela notifications em falta – ignorar pedido");
      return NextResponse.json({ ok: false, error: "NOTIFICATIONS_DISABLED" }, { status: 503 });
    }
    console.error("[notifications][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
