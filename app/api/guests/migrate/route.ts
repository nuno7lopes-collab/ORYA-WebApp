import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as { email?: string } | null;
    const emailRaw = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
    if (!emailRaw) {
      return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }

    const userId = user.id;
    const now = new Date();

    const links = await prisma.guestTicketLink.findMany({
      where: { guestEmail: emailRaw },
      select: { ticketId: true },
    });

    if (links.length === 0) {
      return NextResponse.json({ ok: true, migrated: 0 }, { status: 200 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: { id: { in: links.map((l) => l.ticketId) } },
        data: { userId },
      });
      await tx.guestTicketLink.updateMany({
        where: { guestEmail: emailRaw },
        data: { migratedToUserId: userId, migratedAt: now },
      });
    });

    return NextResponse.json({ ok: true, migrated: links.length }, { status: 200 });
  } catch (err) {
    console.error("[guests/migrate][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
