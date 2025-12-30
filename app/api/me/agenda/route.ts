import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

type AgendaItem = {
  id: string;
  type: "EVENTO" | "JOGO" | "INSCRICAO";
  title: string;
  startAt: string;
  endAt: string | null;
  status?: string | null;
  label?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
};

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseMonthParam = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
};

const buildRangeForMonth = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const buildRange = (req: NextRequest) => {
  const startParam = parseDateParam(req.nextUrl.searchParams.get("start"));
  const endParam = parseDateParam(req.nextUrl.searchParams.get("end"));
  if (startParam && endParam) return { start: startParam, end: endParam };
  const monthParam = parseMonthParam(req.nextUrl.searchParams.get("month"));
  if (monthParam) return buildRangeForMonth(monthParam.year, monthParam.month);
  const now = new Date();
  return buildRangeForMonth(now.getFullYear(), now.getMonth() + 1);
};

const templateLabel = (template: string | null) => {
  if (template === "PADEL") return "Torneio";
  if (template === "VOLUNTEERING") return "Ação";
  return "Evento";
};

const participationPriority: Record<string, number> = {
  BILHETE: 5,
  STAFF: 4,
  PARTICIPANTE: 4,
  INSCRITO: 4,
  CONVOCADO: 3,
  RESERVA: 3,
  SEGUINDO: 2,
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const { start, end } = buildRange(req);
    const userId = user.id;

    const [
      ticketRows,
      reservationRows,
      interestRows,
      entryRows,
      staffRows,
      matchRows,
      submissionRows,
    ] = await Promise.all([
      prisma.ticket.findMany({
        where: {
          status: { in: ["ACTIVE", "USED"] },
          OR: [{ userId }, { ownerUserId: userId }],
          event: {
            isDeleted: false,
            startsAt: { lte: end },
            endsAt: { gte: start },
          },
        },
        select: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              status: true,
              templateType: true,
            },
          },
        },
      }),
      prisma.ticketReservation.findMany({
        where: {
          userId,
          status: "ACTIVE",
          expiresAt: { gte: new Date() },
          event: {
            isDeleted: false,
            startsAt: { lte: end },
            endsAt: { gte: start },
          },
        },
        select: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              status: true,
              templateType: true,
            },
          },
        },
      }),
      prisma.eventInterest.findMany({
        where: {
          userId,
          event: {
            isDeleted: false,
            startsAt: { lte: end },
            endsAt: { gte: start },
          },
        },
        select: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              status: true,
              templateType: true,
            },
          },
        },
      }),
      prisma.tournamentEntry.findMany({
        where: {
          userId,
          event: {
            isDeleted: false,
            startsAt: { lte: end },
            endsAt: { gte: start },
          },
        },
        select: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              status: true,
              templateType: true,
            },
          },
        },
      }),
      prisma.staffAssignment.findMany({
        where: {
          userId,
          status: { in: ["PENDING", "ACCEPTED"] },
          eventId: { not: null },
          event: {
            isDeleted: false,
            startsAt: { lte: end },
            endsAt: { gte: start },
          },
        },
        select: {
          status: true,
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              status: true,
              templateType: true,
            },
          },
        },
      }),
      prisma.padelMatch.findMany({
        where: {
          AND: [
            {
              OR: [
                {
                  pairingA: {
                    OR: [{ player1UserId: userId }, { player2UserId: userId }],
                  },
                },
                {
                  pairingB: {
                    OR: [{ player1UserId: userId }, { player2UserId: userId }],
                  },
                },
              ],
            },
            {
              OR: [
                { plannedStartAt: { gte: start, lte: end } },
                { startTime: { gte: start, lte: end } },
                { actualStartAt: { gte: start, lte: end } },
              ],
            },
          ],
        },
        select: {
          id: true,
          startTime: true,
          plannedStartAt: true,
          plannedEndAt: true,
          actualStartAt: true,
          roundLabel: true,
          groupLabel: true,
          courtName: true,
          event: { select: { id: true, title: true, slug: true } },
        },
      }),
      prisma.organizationFormSubmission.findMany({
        where: { userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          form: {
            select: {
              id: true,
              title: true,
              status: true,
              startAt: true,
              endAt: true,
            },
          },
        },
      }),
    ]);

    const eventMap = new Map<number, { priority: number; item: AgendaItem }>();

    const upsertEvent = (
      event: {
        id: number;
        title: string;
        slug: string;
        startsAt: Date;
        endsAt: Date;
        templateType: string | null;
      },
      status: string,
    ) => {
      const priority = participationPriority[status] ?? 1;
      const existing = eventMap.get(event.id);
      if (existing && existing.priority >= priority) return;
      eventMap.set(event.id, {
        priority,
        item: {
          id: `event-${event.id}`,
          type: "EVENTO",
          title: event.title,
          startAt: event.startsAt.toISOString(),
          endAt: event.endsAt ? event.endsAt.toISOString() : null,
          status,
          label: templateLabel(event.templateType ?? null),
          ctaHref: `/eventos/${event.slug}`,
          ctaLabel: "Abrir evento",
        },
      });
    };

    ticketRows.forEach((row) => {
      if (row.event) upsertEvent(row.event, "BILHETE");
    });
    entryRows.forEach((row) => {
      if (row.event) upsertEvent(row.event, "INSCRITO");
    });
    staffRows.forEach((row) => {
      if (!row.event) return;
      const status = row.status === "PENDING" ? "CONVOCADO" : "STAFF";
      upsertEvent(row.event, status);
    });
    reservationRows.forEach((row) => {
      if (row.event) upsertEvent(row.event, "RESERVA");
    });
    interestRows.forEach((row) => {
      if (row.event) upsertEvent(row.event, "SEGUINDO");
    });

    const items: AgendaItem[] = Array.from(eventMap.values()).map((entry) => entry.item);

    matchRows.forEach((match) => {
      const startAt = match.plannedStartAt ?? match.startTime ?? match.actualStartAt;
      if (!startAt) return;
      const detail =
        match.roundLabel || match.groupLabel || (match.courtName ? `Court ${match.courtName}` : null);
      items.push({
        id: `match-${match.id}`,
        type: "JOGO",
        title: detail ? `${match.event.title} · ${detail}` : `${match.event.title} · Jogo`,
        startAt: startAt.toISOString(),
        endAt: match.plannedEndAt ? match.plannedEndAt.toISOString() : null,
        label: "Jogo",
        ctaHref: match.event.slug ? `/eventos/${match.event.slug}/live` : null,
        ctaLabel: "Ver jogo",
      });
    });

    submissionRows.forEach((submission) => {
      const form = submission.form;
      if (!form) return;

      let displayDate: Date | null = null;
      let label = "Inscrição";

      if (form.endAt && form.endAt >= start && form.endAt <= end) {
        displayDate = form.endAt;
        label = "Fecho inscrições";
      } else if (form.startAt && form.startAt >= start && form.startAt <= end) {
        displayDate = form.startAt;
        label = "Abertura inscrições";
      } else if (form.startAt && form.endAt && form.startAt < start && form.endAt > end) {
        displayDate = start;
        label = "Inscrições abertas";
      } else if (submission.createdAt >= start && submission.createdAt <= end) {
        displayDate = submission.createdAt;
        label = "Inscrição submetida";
      }

      if (!displayDate) return;

      items.push({
        id: `form-${form.id}-${submission.id}`,
        type: "INSCRICAO",
        title: form.title,
        startAt: displayDate.toISOString(),
        endAt: null,
        status: submission.status,
        label,
        ctaHref: `/inscricoes/${form.id}`,
        ctaLabel: "Ver inscrição",
      });
    });

    items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return NextResponse.json(
      {
        ok: true,
        range: { start: start.toISOString(), end: end.toISOString() },
        items,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[me/agenda][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
