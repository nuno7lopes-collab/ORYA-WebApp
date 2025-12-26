import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";

const CATEGORY_VALUES = ["TODAY", "CHANGES", "RESULTS", "CALL_UPS"] as const;
const STATUS_VALUES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

type Category = (typeof CATEGORY_VALUES)[number];
type Status = (typeof STATUS_VALUES)[number];

const parseCategory = (value: unknown): Category | null => {
  if (typeof value !== "string") return null;
  return CATEGORY_VALUES.includes(value as Category) ? (value as Category) : null;
};

const parseStatus = (value: unknown): Status | null => {
  if (typeof value !== "string") return null;
  return STATUS_VALUES.includes(value as Status) ? (value as Status) : null;
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const eventIdRaw = params.get("eventId");
    const statusRaw = params.get("status");
    const eventId = eventIdRaw ? Number(eventIdRaw) : null;
    const status = parseStatus(statusRaw);

    const where: Record<string, unknown> = {
      organizerId: organizer.id,
    };
    if (eventId && Number.isFinite(eventId)) {
      where.eventId = eventId;
    }
    if (status) {
      where.status = status;
    }

    const updates = await prisma.organizationUpdate.findMany({
      where,
      include: {
        event: { select: { id: true, title: true } },
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(
      {
        ok: true,
        items: updates.map((update) => ({
          id: update.id,
          title: update.title,
          body: update.body,
          category: update.category,
          status: update.status,
          isPinned: update.isPinned,
          event: update.event ? { id: update.event.id, title: update.event.title } : null,
          publishedAt: update.publishedAt,
          createdAt: update.createdAt,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizador/updates][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const titleRaw = (body as Record<string, unknown>).title;
    const bodyRaw = (body as Record<string, unknown>).body;
    const categoryRaw = (body as Record<string, unknown>).category;
    const statusRaw = (body as Record<string, unknown>).status;
    const isPinnedRaw = (body as Record<string, unknown>).isPinned;
    const eventIdRaw = (body as Record<string, unknown>).eventId;

    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
    const content = typeof bodyRaw === "string" ? bodyRaw.trim() : "";
    const category = parseCategory(categoryRaw) ?? "TODAY";
    const status = parseStatus(statusRaw) ?? "DRAFT";
    const isPinned = typeof isPinnedRaw === "boolean" ? isPinnedRaw : false;

    if (!title) {
      return NextResponse.json({ ok: false, error: "Indica um título curto." }, { status: 400 });
    }

    let eventId: number | null = null;
    if (eventIdRaw !== undefined && eventIdRaw !== null && eventIdRaw !== "") {
      const parsedId = Number(eventIdRaw);
      if (!Number.isFinite(parsedId)) {
        return NextResponse.json({ ok: false, error: "Evento inválido." }, { status: 400 });
      }
      const event = await prisma.event.findFirst({
        where: { id: parsedId, organizerId: organizer.id, isDeleted: false },
        select: { id: true },
      });
      if (!event) {
        return NextResponse.json({ ok: false, error: "Evento não encontrado." }, { status: 404 });
      }
      eventId = event.id;
    }

    const publishedAt = status === "PUBLISHED" ? new Date() : null;

    const update = await prisma.organizationUpdate.create({
      data: {
        organizerId: organizer.id,
        eventId,
        title,
        body: content || null,
        category,
        status,
        isPinned,
        publishedAt,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        update: {
          id: update.id,
          title: update.title,
          body: update.body,
          category: update.category,
          status: update.status,
          isPinned: update.isPinned,
          publishedAt: update.publishedAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[organizador/updates][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
