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

type Params = { id: string };

export async function PATCH(req: NextRequest, context: { params: Params | Promise<Params> }) {
  try {
    const { id } = await context.params;
    const updateId = Number(id);
    if (!Number.isFinite(updateId)) {
      return NextResponse.json({ ok: false, error: "Update inválido." }, { status: 400 });
    }

    const user = await requireUser();
    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }

    const existing = await prisma.organizationUpdate.findUnique({
      where: { id: updateId },
      select: { id: true, organizerId: true, status: true, publishedAt: true },
    });
    if (!existing || existing.organizerId !== organizer.id) {
      return NextResponse.json({ ok: false, error: "Update não encontrado." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const titleRaw = (body as Record<string, unknown>).title;
    const bodyRaw = (body as Record<string, unknown>).body;
    const categoryRaw = (body as Record<string, unknown>).category;
    const statusRaw = (body as Record<string, unknown>).status;
    const isPinnedRaw = (body as Record<string, unknown>).isPinned;

    if (typeof titleRaw === "string") {
      const title = titleRaw.trim();
      if (!title) {
        return NextResponse.json({ ok: false, error: "Indica um título curto." }, { status: 400 });
      }
      updates.title = title;
    }
    if (typeof bodyRaw === "string") {
      const content = bodyRaw.trim();
      updates.body = content || null;
    }
    if (categoryRaw !== undefined) {
      const category = parseCategory(categoryRaw);
      if (!category) {
        return NextResponse.json({ ok: false, error: "Categoria inválida." }, { status: 400 });
      }
      updates.category = category;
    }
    if (statusRaw !== undefined) {
      const status = parseStatus(statusRaw);
      if (!status) {
        return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });
      }
      updates.status = status;
      if (status === "PUBLISHED" && !existing.publishedAt) {
        updates.publishedAt = new Date();
      }
      if (status === "DRAFT") {
        updates.publishedAt = null;
      }
    }
    if (typeof isPinnedRaw === "boolean") {
      updates.isPinned = isPinnedRaw;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada para atualizar." }, { status: 400 });
    }

    const updated = await prisma.organizationUpdate.update({
      where: { id: updateId },
      data: updates,
    });

    return NextResponse.json(
      {
        ok: true,
        update: {
          id: updated.id,
          title: updated.title,
          body: updated.body,
          category: updated.category,
          status: updated.status,
          isPinned: updated.isPinned,
          publishedAt: updated.publishedAt,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizador/updates][PATCH]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Params | Promise<Params> }) {
  try {
    const { id } = await context.params;
    const updateId = Number(id);
    if (!Number.isFinite(updateId)) {
      return NextResponse.json({ ok: false, error: "Update inválido." }, { status: 400 });
    }

    const user = await requireUser();
    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }

    const existing = await prisma.organizationUpdate.findUnique({
      where: { id: updateId },
      select: { id: true, organizerId: true },
    });
    if (!existing || existing.organizerId !== organizer.id) {
      return NextResponse.json({ ok: false, error: "Update não encontrado." }, { status: 404 });
    }

    const updated = await prisma.organizationUpdate.update({
      where: { id: updateId },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({ ok: true, updateId: updated.id }, { status: 200 });
  } catch (err) {
    console.error("[organizador/updates][DELETE]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
