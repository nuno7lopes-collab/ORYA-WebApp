import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("X-ORYA-CRON-SECRET");
    if (!secret || secret !== process.env.ORYA_CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const now = new Date();

    const threadsToNotify = await prisma.chatThread.findMany({
      where: {
        openNotifiedAt: null,
        openAt: { lte: now },
        status: { in: ["ANNOUNCEMENTS", "OPEN"] },
      },
      select: {
        id: true,
        entityType: true,
        entityId: true,
      },
    });

    const threadIds = threadsToNotify.map((thread) => thread.id);

    if (threadIds.length) {
      const members = await prisma.chatMember.findMany({
        where: {
          threadId: { in: threadIds },
          leftAt: null,
          role: "PARTICIPANT",
        },
        select: { threadId: true, userId: true },
      });

      const userIds = Array.from(new Set(members.map((member) => member.userId)));
      const prefs = userIds.length
        ? await prisma.notificationPreference.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, allowSystemAnnouncements: true },
          })
        : [];
      const prefsMap = new Map(prefs.map((pref) => [pref.userId, pref.allowSystemAnnouncements]));

      const membersByThread = new Map<string, string[]>();
      for (const member of members) {
        const list = membersByThread.get(member.threadId) ?? [];
        list.push(member.userId);
        membersByThread.set(member.threadId, list);
      }

      const eventIds = threadsToNotify
        .filter((thread) => thread.entityType === "EVENT")
        .map((thread) => thread.entityId);
      const bookingIds = threadsToNotify
        .filter((thread) => thread.entityType === "BOOKING")
        .map((thread) => thread.entityId);

      const [events, bookings] = await Promise.all([
        eventIds.length
          ? prisma.event.findMany({
              where: { id: { in: eventIds } },
              select: { id: true, title: true, slug: true, organizationId: true },
            })
          : Promise.resolve([]),
        bookingIds.length
          ? prisma.booking.findMany({
              where: { id: { in: bookingIds } },
              select: {
                id: true,
                startsAt: true,
                service: { select: { title: true } },
                organization: { select: { publicName: true, businessName: true } },
              },
            })
          : Promise.resolve([]),
      ]);

      const eventMap = new Map(events.map((event) => [event.id, event]));
      const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));

      for (const thread of threadsToNotify) {
        const recipients = membersByThread.get(thread.id) ?? [];
        if (!recipients.length) continue;

        if (thread.entityType === "EVENT") {
          const event = eventMap.get(thread.entityId);
          const title = event?.title ?? "Evento";
          const ctaUrl = event?.slug ? `/eventos/${event.slug}/live` : "/eventos";

          for (const userId of recipients) {
            const allow = prefsMap.get(userId);
            if (allow === false) continue;
            await createNotification({
              userId,
              type: "CHAT_OPEN",
              title: "Chat aberto",
              body: `O chat do evento ${title} ja esta disponivel.`,
              ctaUrl,
              ctaLabel: "Abrir chat",
              organizationId: event?.organizationId ?? null,
              eventId: event?.id ?? null,
            });
          }
        } else {
          const booking = bookingMap.get(thread.entityId);
          const serviceTitle = booking?.service?.title ?? "Reserva";
          const orgName = booking?.organization?.publicName || booking?.organization?.businessName || "organizador";

          for (const userId of recipients) {
            const allow = prefsMap.get(userId);
            if (allow === false) continue;
            await createNotification({
              userId,
              type: "CHAT_OPEN",
              title: "Chat disponivel",
              body: `Podes falar com ${orgName} sobre a tua reserva de ${serviceTitle}.`,
              ctaUrl: "/me/reservas",
              ctaLabel: "Abrir reserva",
            });
          }
        }
      }

      await prisma.chatThread.updateMany({
        where: { id: { in: threadIds } },
        data: { openNotifiedAt: now },
      });
    }

    await prisma.$executeRaw`
      UPDATE app_v3.chat_threads
      SET status = (
        CASE
          WHEN now() < open_at THEN 'ANNOUNCEMENTS'
          WHEN now() < read_only_at THEN 'OPEN'
          WHEN now() < close_at THEN 'READ_ONLY'
          ELSE 'CLOSED'
        END
      )::app_v3."ChatThreadStatus",
      updated_at = now()
      WHERE status IS DISTINCT FROM (
        CASE
          WHEN now() < open_at THEN 'ANNOUNCEMENTS'
          WHEN now() < read_only_at THEN 'OPEN'
          WHEN now() < close_at THEN 'READ_ONLY'
          ELSE 'CLOSED'
        END
      )::app_v3."ChatThreadStatus"
    `;

    const expiredThreads = await prisma.chatThread.findMany({
      where: {
        deleteAfter: { lte: now },
        OR: [{ legalHoldUntil: null }, { legalHoldUntil: { lt: now } }],
      },
      select: { id: true },
    });

    const expiredIds = expiredThreads.map((thread) => thread.id);
    if (expiredIds.length) {
      await prisma.chatMessage.deleteMany({ where: { threadId: { in: expiredIds } } });
      await prisma.chatReadState.deleteMany({ where: { threadId: { in: expiredIds } } });
    }

    return NextResponse.json({
      ok: true,
      notifiedThreads: threadIds.length,
      expiredThreads: expiredIds.length,
    });
  } catch (err) {
    console.error("[CRON CHAT MAINTENANCE]", err);
    return NextResponse.json({ ok: false, error: "Internal chat maintenance error" }, { status: 500 });
  }
}
