import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getEventCoverUrl } from "@/lib/eventCover";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { PUBLIC_EVENT_STATUSES } from "@/domain/events/publicStatus";
import { isPublicEventCardComplete } from "@/domain/events/publicEventCard";
import { resolveEventLocation } from "@/lib/location/eventLocation";
import { listEffectiveOrganizationMembershipsForUser } from "@/lib/organizationMembers";
import { OrganizationStatus } from "@prisma/client";

type AgendaItem = {
  id: string;
  type: "EVENTO" | "JOGO" | "INSCRICAO" | "RESERVA";
  title: string;
  startAt: string;
  endAt: string | null;
  coverImageUrl?: string | null;
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

const toAbsoluteUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = getAppBaseUrl().replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};

const resolveEventCover = (coverImageUrl: string | null | undefined, seed: string | number) =>
  toAbsoluteUrl(
    getEventCoverUrl(coverImageUrl ?? null, {
      seed,
      width: 320,
      quality: 70,
      format: "webp",
    }),
  );

const isAgendaEventComplete = (event: {
  title: string;
  startsAt: Date;
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: any | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}) => {
  const location = resolveEventLocation({ addressRef: event.addressRef ?? null });
  return isPublicEventCardComplete({
    title: event.title,
    startsAt: event.startsAt,
    location: { formattedAddress: location.formattedAddress, city: location.city },
  });
};

const participationPriority: Record<string, number> = {
  BILHETE: 5,
  STAFF: 4,
  PARTICIPANTE: 4,
  INSCRITO: 4,
  RESERVA: 3,
};

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const { start, end } = buildRange(req);
    const userId = user.id;

    const [
      ticketRows,
      reservationRows,
      entryRows,
      matchRows,
      submissionRows,
    ] = await Promise.all([
      prisma.ticket.findMany({
        where: {
          status: { in: ["ACTIVE"] },
          OR: [{ userId }, { ownerUserId: userId }],
          event: {
            isDeleted: false,
            status: { in: PUBLIC_EVENT_STATUSES },
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
              coverImageUrl: true,
              addressRef: {
                select: {
                  formattedAddress: true,
                  canonical: true,
                  latitude: true,
                  longitude: true,
                },
              },
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
            status: { in: PUBLIC_EVENT_STATUSES },
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
              coverImageUrl: true,
              addressRef: {
                select: {
                  formattedAddress: true,
                  canonical: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
        },
      }),
      prisma.tournamentEntry.findMany({
        where: {
          userId,
          event: {
            isDeleted: false,
            status: { in: PUBLIC_EVENT_STATUSES },
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
              coverImageUrl: true,
              addressRef: {
                select: {
                  formattedAddress: true,
                  canonical: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
        },
      }),
      prisma.eventMatchSlot.findMany({
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
            {
              event: { isDeleted: false, status: { in: PUBLIC_EVENT_STATUSES } },
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
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              startsAt: true,
              coverImageUrl: true,
              addressRef: {
                select: {
                  formattedAddress: true,
                  canonical: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
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

    const staffMemberships = await listEffectiveOrganizationMembershipsForUser({
      userId,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
      allowedStatuses: [OrganizationStatus.ACTIVE],
    });
    const staffOrganizationIds = Array.from(
      new Set(staffMemberships.map((membership) => membership.organizationId)),
    );

    const staffEvents = staffOrganizationIds.length
      ? await prisma.event.findMany({
          where: {
            isDeleted: false,
            status: { in: PUBLIC_EVENT_STATUSES },
            startsAt: { lte: end },
            endsAt: { gte: start },
            organizationId: { in: staffOrganizationIds },
          },
          select: {
            id: true,
            title: true,
            slug: true,
            startsAt: true,
            endsAt: true,
            status: true,
            templateType: true,
            coverImageUrl: true,
            addressRef: {
              select: {
                formattedAddress: true,
                canonical: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        })
      : [];

    const eventMap = new Map<number, { priority: number; item: AgendaItem }>();

    const upsertEvent = (
      event: {
        id: number;
        title: string;
        slug: string;
        startsAt: Date;
        endsAt: Date;
        templateType: string | null;
        coverImageUrl?: string | null;
        addressRef?: {
          formattedAddress?: string | null;
          canonical?: any | null;
          latitude?: number | null;
          longitude?: number | null;
        } | null;
      },
      status: string,
    ) => {
      if (!isAgendaEventComplete(event)) return;
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
          coverImageUrl: resolveEventCover(event.coverImageUrl ?? null, event.slug ?? event.id),
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
    staffEvents.forEach((event) => {
      upsertEvent(event, "STAFF");
    });
    reservationRows.forEach((row) => {
      if (row.event) upsertEvent(row.event, "RESERVA");
    });

    const items: AgendaItem[] = Array.from(eventMap.values()).map((entry) => entry.item);

    matchRows.forEach((match) => {
      if (!isAgendaEventComplete(match.event)) return;
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
        coverImageUrl: resolveEventCover(match.event.coverImageUrl ?? null, match.event.slug ?? match.event.id),
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

    return jsonWrap(
      {
        ok: true,
        range: { start: start.toISOString(), end: end.toISOString() },
        items,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[me/agenda][GET]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
