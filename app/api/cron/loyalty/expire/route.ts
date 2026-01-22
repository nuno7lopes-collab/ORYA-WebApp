export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LoyaltyEntryType, LoyaltyProgramStatus, LoyaltySourceType, Prisma } from "@prisma/client";

const CRON_HEADER = "X-ORYA-CRON-SECRET";

type ExpireRow = {
  user_id: string;
  to_expire: number;
};

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get(CRON_HEADER);
    const expected = process.env.ORYA_CRON_SECRET;
    if (!expected || !secret || secret !== expected) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const now = new Date();
    const programs = await prisma.loyaltyProgram.findMany({
      where: {
        status: LoyaltyProgramStatus.ACTIVE,
        pointsExpiryDays: { not: null },
      },
      select: { id: true, organizationId: true, pointsExpiryDays: true },
    });

    let expiredEntries = 0;
    let expiredUsers = 0;

    for (const program of programs) {
      if (!program.pointsExpiryDays || program.pointsExpiryDays <= 0) {
        continue;
      }
      const cutoff = new Date(now.getTime() - program.pointsExpiryDays * 24 * 60 * 60 * 1000);

      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`loyalty-expire:${program.id}`}))`,
        );

        const expirable = await tx.$queryRaw<ExpireRow[]>(Prisma.sql`
          WITH expirable AS (
            SELECT user_id, SUM(points)::int AS earned_points
            FROM app_v3.loyalty_ledger
            WHERE program_id = ${program.id}
              AND entry_type = 'EARN'
              AND (
                (expires_at IS NOT NULL AND expires_at <= ${now})
                OR (expires_at IS NULL AND created_at <= ${cutoff})
              )
            GROUP BY user_id
          ),
          consumed AS (
            SELECT user_id,
              SUM(CASE
                WHEN entry_type IN ('SPEND', 'EXPIRE') THEN points
                WHEN entry_type = 'ADJUST' AND points < 0 THEN -points
                ELSE 0
              END)::int AS consumed_points
            FROM app_v3.loyalty_ledger
            WHERE program_id = ${program.id}
            GROUP BY user_id
          )
          SELECT expirable.user_id,
            (expirable.earned_points - COALESCE(consumed.consumed_points, 0))::int AS to_expire
          FROM expirable
          LEFT JOIN consumed ON expirable.user_id = consumed.user_id
          WHERE expirable.earned_points - COALESCE(consumed.consumed_points, 0) > 0
        `);

        if (!expirable.length) {
          return { entries: 0, users: 0 };
        }

        const entries = expirable
          .map((row) => ({
            organizationId: program.organizationId,
            programId: program.id,
            userId: row.user_id,
            entryType: LoyaltyEntryType.EXPIRE,
            points: Number(row.to_expire),
            sourceType: LoyaltySourceType.MANUAL,
            sourceId: `auto-expire:${now.toISOString()}`,
            note: "Expiracao automatica",
            createdAt: now,
          }))
          .filter((entry) => entry.points > 0);

        if (!entries.length) {
          return { entries: 0, users: 0 };
        }

        const created = await tx.loyaltyLedger.createMany({ data: entries });
        return { entries: created.count, users: entries.length };
      });

      expiredEntries += result.entries;
      expiredUsers += result.users;
    }

    console.info("[loyalty][expire] cron", { programs: programs.length, expiredEntries, expiredUsers });

    return NextResponse.json(
      { ok: true, programs: programs.length, expiredEntries, expiredUsers },
      { status: 200 },
    );
  } catch (err) {
    console.error("[loyalty][expire] cron error", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
