import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

type CalendarItem = {
  id: string;
  type: "EVENTO" | "JOGO" | "INSCRICAO";
  title: string;
  startAt: Date;
  endAt: Date | null;
  status?: string | null;
  label?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
};

type CalendarUnscheduledItem = {
  id: string;
  type: "INSCRICAO";
  title: string;
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

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { organizer } = await getActiveOrganizerForUser(user.id, {
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });

    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }

    const { start, end } = buildRange(req);

    const inscriptionsEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizerId: organizer.id, moduleKey: "INSCRICOES", enabled: true },
      select: { organizerId: true },
    });

    const [events, matches, forms, undatedForms] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizerId: organizer.id,
          isDeleted: false,
          startsAt: { lte: end },
          endsAt: { gte: start },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          status: true,
          templateType: true,
          slug: true,
        },
        orderBy: { startsAt: "asc" },
      }),
      prisma.padelMatch.findMany({
        where: {
          event: { organizerId: organizer.id, isDeleted: false },
          OR: [
            { plannedStartAt: { gte: start, lte: end } },
            { startTime: { gte: start, lte: end } },
            { actualStartAt: { gte: start, lte: end } },
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
          courtNumber: true,
          event: { select: { id: true, title: true, slug: true } },
        },
        orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }],
      }),
      inscriptionsEnabled
        ? prisma.organizationForm.findMany({
            where: {
              organizerId: organizer.id,
              OR: [
                { startAt: { gte: start, lte: end } },
                { endAt: { gte: start, lte: end } },
                { AND: [{ startAt: { lte: start } }, { endAt: { gte: end } }] },
                { AND: [{ startAt: { lte: end } }, { endAt: null }] },
                { AND: [{ endAt: { gte: start } }, { startAt: null }] },
              ],
            },
            select: {
              id: true,
              title: true,
              status: true,
              startAt: true,
              endAt: true,
            },
            orderBy: [{ endAt: "asc" }, { startAt: "asc" }],
          })
        : Promise.resolve([]),
      inscriptionsEnabled
        ? prisma.organizationForm.findMany({
            where: {
              organizerId: organizer.id,
              startAt: null,
              endAt: null,
            },
            select: {
              id: true,
              title: true,
              status: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    const items: CalendarItem[] = [];
    const unscheduled: CalendarUnscheduledItem[] = [];

    events.forEach((event) => {
      items.push({
        id: `event-${event.id}`,
        type: "EVENTO",
        title: event.title,
        startAt: event.startsAt,
        endAt: event.endsAt,
        status: event.status,
        label: templateLabel(event.templateType ?? null),
        ctaHref: `/organizador/eventos/${event.id}`,
        ctaLabel: "Abrir evento",
      });
    });

    matches.forEach((match) => {
      const startAt = match.plannedStartAt ?? match.startTime ?? match.actualStartAt;
      if (!startAt) return;
      const detail =
        match.roundLabel || match.groupLabel || (match.courtName ? `Court ${match.courtName}` : null);
      items.push({
        id: `match-${match.id}`,
        type: "JOGO",
        title: detail ? `${match.event.title} · ${detail}` : `${match.event.title} · Jogo`,
        startAt,
        endAt: match.plannedEndAt ?? null,
        label: "Jogo",
        ctaHref: `/organizador/eventos/${match.event.id}`,
        ctaLabel: "Abrir torneio",
      });
    });

    forms.forEach((form) => {
      const addItem = (date: Date, label: string, suffix: string) => {
        items.push({
          id: `form-${form.id}-${suffix}`,
          type: "INSCRICAO",
          title: form.title,
          startAt: date,
          endAt: null,
          status: form.status,
          label,
          ctaHref: `/organizador/inscricoes/${form.id}`,
          ctaLabel: "Abrir formulário",
        });
      };

      let added = false;
      if (form.startAt && form.startAt >= start && form.startAt <= end) {
        addItem(form.startAt, "Abertura inscrições", "start");
        added = true;
      }
      if (form.endAt && form.endAt >= start && form.endAt <= end) {
        addItem(form.endAt, "Fecho inscrições", "end");
        added = true;
      }
      if (!added) {
        if (form.startAt && form.endAt && form.startAt < start && form.endAt > end) {
          addItem(start, "Inscrições abertas", "window");
        } else if (form.startAt && !form.endAt && form.startAt < start) {
          addItem(start, "Inscrições abertas", "open");
        } else if (!form.startAt && form.endAt && form.endAt > end) {
          addItem(start, "Inscrições abertas", "open");
        }
      }
    });

    undatedForms.forEach((form) => {
      unscheduled.push({
        id: `form-${form.id}-unscheduled`,
        type: "INSCRICAO",
        title: form.title,
        status: form.status,
        label: "Sem datas",
        ctaHref: `/organizador/inscricoes/${form.id}`,
        ctaLabel: "Abrir formulário",
      });
    });

    items.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    return NextResponse.json(
      {
        ok: true,
        range: { start: start.toISOString(), end: end.toISOString() },
        items,
        unscheduled,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizador/calendario][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
