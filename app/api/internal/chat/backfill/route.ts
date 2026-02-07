import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

async function _GET(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const events = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT id
      FROM app_v3.events
      WHERE organization_id IS NOT NULL
        AND (COALESCE(ends_at, starts_at) + interval '24 hours') >= now()
    `);

    for (const event of events) {
      await prisma.$executeRaw(Prisma.sql`SELECT app_v3.chat_ensure_event_thread(${event.id})`);
    }

    const bookings = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT id
      FROM app_v3.bookings
      WHERE status IN ('CONFIRMED', 'COMPLETED')
        AND (starts_at + make_interval(mins => duration_minutes) + interval '24 hours') >= now()
    `);

    for (const booking of bookings) {
      await prisma.$executeRaw(Prisma.sql`SELECT app_v3.chat_ensure_booking_thread(${booking.id})`);
    }

    const eventMemberInsert = await prisma.$executeRaw(Prisma.sql`
      INSERT INTO app_v3.chat_members (thread_id, user_id, role, joined_at)
      SELECT DISTINCT
        ct.id,
        COALESCE(t.owner_user_id, t.user_id),
        'PARTICIPANT'::app_v3."ChatMemberRole",
        now()
      FROM app_v3.chat_threads ct
      JOIN app_v3.tickets t ON ct.entity_type = 'EVENT'::app_v3."ChatEntityType" AND ct.entity_id = t.event_id
      WHERE t.status IN ('ACTIVE')
        AND COALESCE(t.owner_user_id, t.user_id) IS NOT NULL
      ON CONFLICT (thread_id, user_id) DO UPDATE
        SET left_at = NULL,
            updated_at = now()
      WHERE app_v3.chat_members.banned_at IS NULL
    `);

    const tournamentMemberInsert = await prisma.$executeRaw(Prisma.sql`
      INSERT INTO app_v3.chat_members (thread_id, user_id, role, joined_at)
      SELECT DISTINCT
        ct.id,
        te.user_id,
        'PARTICIPANT'::app_v3."ChatMemberRole",
        now()
      FROM app_v3.chat_threads ct
      JOIN app_v3.tournament_entries te ON ct.entity_type = 'EVENT'::app_v3."ChatEntityType" AND ct.entity_id = te.event_id
      WHERE te.status = 'CONFIRMED'
        AND te.user_id IS NOT NULL
      ON CONFLICT (thread_id, user_id) DO UPDATE
        SET left_at = NULL,
            updated_at = now()
      WHERE app_v3.chat_members.banned_at IS NULL
    `);

    const bookingMemberInsert = await prisma.$executeRaw(Prisma.sql`
      INSERT INTO app_v3.chat_members (thread_id, user_id, role, joined_at)
      SELECT DISTINCT
        ct.id,
        b.user_id,
        'PARTICIPANT'::app_v3."ChatMemberRole",
        now()
      FROM app_v3.chat_threads ct
      JOIN app_v3.bookings b ON ct.entity_type = 'BOOKING'::app_v3."ChatEntityType" AND ct.entity_id = b.id
      WHERE b.status IN ('CONFIRMED', 'COMPLETED')
        AND b.user_id IS NOT NULL
      ON CONFLICT (thread_id, user_id) DO UPDATE
        SET left_at = NULL,
            updated_at = now()
      WHERE app_v3.chat_members.banned_at IS NULL
    `);

    return jsonWrap({
      ok: true,
      events: events.length,
      bookings: bookings.length,
      eventMembers: Number(eventMemberInsert),
      tournamentMembers: Number(tournamentMemberInsert),
      bookingMembers: Number(bookingMemberInsert),
    });
  } catch (err) {
    logError("internal.chat.backfill_error", err);
    return jsonWrap({ ok: false, error: "Backfill failed" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
