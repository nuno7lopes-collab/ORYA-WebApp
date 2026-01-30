export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
const REMINDER_MINUTES = 30;
const WINDOW_MINUTES = 10;
const MAX_MATCHES = 120;

const formatTime = (value: Date, timezone?: string | null) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: timezone || "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);

const formatPairing = (pairing: {
  slots?: Array<{
    playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
    profile?: { fullName?: string | null; username?: string | null } | null;
    invitedContact?: string | null;
  }>;
}) => {
  const names =
    pairing?.slots
      ?.map((slot) =>
        slot.playerProfile?.displayName ||
        slot.playerProfile?.fullName ||
        slot.profile?.fullName ||
        slot.profile?.username ||
        slot.invitedContact ||
        null,
      )
      .filter((name): name is string => Boolean(name)) || [];
  if (names.length === 0) return "Dupla";
  return names.slice(0, 2).join(" / ");
};

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_MINUTES - WINDOW_MINUTES) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMINDER_MINUTES + WINDOW_MINUTES) * 60 * 1000);

  const matches = (await prisma.padelMatch.findMany({
    where: {
      status: "PENDING",
      pairingAId: { not: null },
      pairingBId: { not: null },
      OR: [
        { plannedStartAt: { gte: windowStart, lte: windowEnd } },
        { startTime: { gte: windowStart, lte: windowEnd } },
      ],
    },
    take: MAX_MATCHES,
    include: {
      event: { select: { id: true, title: true, slug: true, organizationId: true, timezone: true } },
      court: { select: { name: true } },
      pairingA: {
        select: {
          id: true,
          slots: {
            select: {
              invitedContact: true,
              profile: { select: { id: true, fullName: true, username: true } },
              playerProfile: { select: { displayName: true, fullName: true } },
            },
          },
        },
      },
      pairingB: {
        select: {
          id: true,
          slots: {
            select: {
              invitedContact: true,
              profile: { select: { id: true, fullName: true, username: true } },
              playerProfile: { select: { displayName: true, fullName: true } },
            },
          },
        },
      },
    },
  })) as Prisma.PadelMatchGetPayload<{
    include: {
      event: { select: { id: true; title: true; slug: true; organizationId: true; timezone: true } };
      court: { select: { name: true } };
      pairingA: {
        select: {
          id: true;
          slots: {
            select: {
              invitedContact: true;
              profile: { select: { id: true; fullName: true; username: true } };
              playerProfile: { select: { displayName: true; fullName: true } };
            };
          };
        };
      };
      pairingB: {
        select: {
          id: true;
          slots: {
            select: {
              invitedContact: true;
              profile: { select: { id: true; fullName: true; username: true } };
              playerProfile: { select: { displayName: true; fullName: true } };
            };
          };
        };
      };
    };
  }>[];

  let sent = 0;
  let skipped = 0;

  const notifyCache = new Map<string, boolean>();

  for (const match of matches) {
    const startAt = match.plannedStartAt ?? match.startTime;
    if (!startAt) {
      skipped += 1;
      continue;
    }

    const pairingALabel = formatPairing(match.pairingA || {});
    const pairingBLabel = formatPairing(match.pairingB || {});
    const timeLabel = formatTime(startAt, match.event?.timezone);
    const courtLabel = String(match.court?.name || match.courtName || match.courtNumber || match.courtId || "Quadra");

    const participants = new Set<string>();
    (match.pairingA?.slots ?? []).forEach((slot) => {
      if (slot.profile?.id) participants.add(slot.profile.id);
    });
    (match.pairingB?.slots ?? []).forEach((slot) => {
      if (slot.profile?.id) participants.add(slot.profile.id);
    });

    for (const userId of participants) {
      const allow =
        notifyCache.get(userId) ?? (await shouldNotify(userId, "EVENT_REMINDER").catch(() => false));
      notifyCache.set(userId, allow);
      if (!allow) {
        skipped += 1;
        continue;
      }

      const dedupeKey = `REMINDER_30:${match.id}:${userId}`;
      try {
        await prisma.matchNotification["create"]({
          data: {
            matchId: match.id,
            dedupeKey,
            payload: { type: "REMINDER_30", startAt: startAt.toISOString() },
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped += 1;
          continue;
        }
        throw err;
      }

      await createNotification({
        userId,
        type: "EVENT_REMINDER",
        title: `Jogo em ${REMINDER_MINUTES} min`,
        body: `${pairingALabel} vs ${pairingBLabel} · ${timeLabel} · ${courtLabel}`,
        eventId: match.event?.id ?? null,
        organizationId: match.event?.organizationId ?? null,
        ctaUrl: match.event?.slug ? `/eventos/${match.event.slug}` : null,
        ctaLabel: "Ver torneio",
        payload: {
          matchId: match.id,
          eventId: match.event?.id ?? null,
          categoryId: match.categoryId ?? null,
          startAt: startAt.toISOString(),
        },
      });
      sent += 1;
    }
  }

    await recordCronHeartbeat("padel-reminders", { status: "SUCCESS", startedAt });
    return jsonWrap(
      { ok: true, windowStart, windowEnd, sent, skipped, matches: matches.length },
      { status: 200 },
    );
  } catch (err) {
    await recordCronHeartbeat("padel-reminders", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
