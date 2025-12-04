// app/api/tickets/migrate-guest/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

function normalizeEmail(email: string | null | undefined) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function POST() {
  try {
    const supabase = await createSupabaseServer();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData?.user) {
      return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });
    }

    const userId = userData.user.id;
    const userEmail = normalizeEmail(userData.user.email);

    if (!userEmail) {
      return NextResponse.json(
        { ok: false, error: "USER_EMAIL_MISSING" },
        { status: 400 },
      );
    }

    const links = await prisma.guestTicketLink.findMany({
      where: {
        guestEmail: { equals: userEmail, mode: "insensitive" },
        OR: [{ migratedToUserId: null }, { migratedToUserId: { not: userId } }],
      },
      select: { ticketId: true },
    });

    if (links.length === 0) {
      return NextResponse.json({ ok: true, migrated: 0 });
    }

    const ticketIds = links.map((l) => l.ticketId);

    const result = await prisma.$transaction([
      prisma.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: { userId },
      }),
      prisma.guestTicketLink.updateMany({
        where: { ticketId: { in: ticketIds } },
        data: { migratedToUserId: userId, migratedAt: new Date() },
      }),
    ]);

    const migratedCount = result[0].count;

    return NextResponse.json({ ok: true, migrated: migratedCount });
  } catch (err) {
    console.error("[migrate-guest] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
