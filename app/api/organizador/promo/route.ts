import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";
import { OrganizerMemberRole } from "@prisma/client";

async function requireOrganizer() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "UNAUTHENTICATED" as const };
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) return { error: "PROFILE_NOT_FOUND" as const };

  const membership = await prisma.organizerMember.findFirst({
    where: {
      userId: user.id,
      organizer: { status: "ACTIVE" },
    },
    include: { organizer: true },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
  });

  if (!membership || !membership.organizer || !isOrgAdminOrAbove(membership.role as OrganizerMemberRole)) {
    return { error: "ORGANIZER_NOT_FOUND" as const };
  }

  return { organizer: membership.organizer, profile, membership };
}

export async function GET() {
  try {
    const ctx = await requireOrganizer();
    if ("error" in ctx) {
      const status =
        ctx.error === "UNAUTHENTICATED" ? 401 : ctx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ ok: false, error: ctx.error }, { status });
    }

    const promoRepo = (prisma as unknown as {
      promoCode?: {
        findMany: typeof prisma.promoCode.findMany;
      };
    }).promoCode;
    if (!promoRepo) {
      return NextResponse.json(
        { ok: false, error: "Promo codes indisponíveis nesta instância do Prisma." },
        { status: 500 },
      );
    }

    const organizerEvents = await prisma.event.findMany({
      where: { organizerId: ctx.organizer.id },
      select: { id: true, title: true, slug: true },
    });
    const eventIds = organizerEvents.map((e) => e.id);

    const promoCodes = await prisma.promoCode.findMany({
      where: {
        OR: [
          { eventId: null }, // global
          { eventId: { in: eventIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        redemptions: true,
      },
    });

    const promoIds = promoCodes.map((p) => p.id);
    const promoCodesList = promoCodes.map((p) => p.code);

    const validRedemptionSummaryIds = new Set<number>();
    promoCodes.forEach((p) => {
      p.redemptions.forEach((r) => {
        if (r.saleSummaryId) validRedemptionSummaryIds.add(r.saleSummaryId);
      });
    });

    const lines = await prisma.saleLine.findMany({
      where: {
        eventId: { in: eventIds },
        OR: [
          { promoCodeId: { in: promoIds } },
          { promoCodeSnapshot: { in: promoCodesList } },
        ],
        ...(validRedemptionSummaryIds.size > 0
          ? { saleSummaryId: { in: Array.from(validRedemptionSummaryIds) } }
          : {}),
      },
      select: {
        promoCodeId: true,
        promoCodeSnapshot: true,
        quantity: true,
        grossCents: true,
        netCents: true,
        discountPerUnitCents: true,
        platformFeeCents: true,
      },
    });

    type PromoAgg = {
      tickets: number;
      grossCents: number;
      discountCents: number;
      platformFeeCents: number;
      netCents: number;
    };

    const statsMap = new Map<
      string | number,
      PromoAgg & { users: Set<string>; redemptions: number }
    >();
    const ensureAgg = (key: string | number) => {
      const existing = statsMap.get(key);
      if (existing) return existing;
      const base: PromoAgg & { users: Set<string>; redemptions: number } = {
        tickets: 0,
        grossCents: 0,
        discountCents: 0,
        platformFeeCents: 0,
        netCents: 0,
        users: new Set(),
        redemptions: 0,
      };
      statsMap.set(key, base);
      return base;
    };

    for (const l of lines) {
      const key = l.promoCodeId ?? l.promoCodeSnapshot ?? "unknown";
      const agg = ensureAgg(key);
      const qty = l.quantity ?? 0;
      const discountLine = (l.discountPerUnitCents ?? 0) * qty;
      agg.tickets += qty;
      agg.grossCents += l.grossCents ?? 0;
      agg.discountCents += discountLine;
      agg.platformFeeCents += l.platformFeeCents ?? 0;
      agg.netCents += l.netCents ?? 0;
    }

    // Contar redemptions (uses) e users únicos
    promoCodes.forEach((p) => {
      const agg = ensureAgg(p.id);
      agg.redemptions += p.redemptions.length;
      p.redemptions.forEach((r) => {
        if (r.userId) agg.users.add(r.userId);
        else if (r.guestEmail) agg.users.add(r.guestEmail.toLowerCase());
      });
    });

    return NextResponse.json({
      ok: true,
      promoCodes: promoCodes.map((p) => ({
        ...p,
        status:
          !p.active
            ? "INACTIVE"
            : p.validUntil && new Date(p.validUntil) < new Date()
              ? "EXPIRED"
              : "ACTIVE",
        redemptionsCount: statsMap.get(p.id)?.tickets ?? p.redemptions.length,
      })),
      events: organizerEvents,
      promoStats: promoCodes.map((p) => {
        const agg =
          statsMap.get(p.id) ??
          statsMap.get(p.code) ?? {
            tickets: 0,
            grossCents: 0,
            discountCents: 0,
            platformFeeCents: 0,
            netCents: 0,
            users: new Set<string>(),
            redemptions: 0,
          };
        return {
          promoCodeId: p.id,
          tickets: agg.tickets,
          grossCents: agg.grossCents,
          discountCents: agg.discountCents,
          platformFeeCents: agg.platformFeeCents,
          netCents: agg.netCents,
          usesTotal: agg.redemptions,
          usersUnique: agg.users.size,
          totalSavedCents: agg.discountCents,
        };
      }),
    });
  } catch (err) {
    console.error("[organizador/promo][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrganizer();
    if ("error" in ctx) {
      const status =
        ctx.error === "UNAUTHENTICATED" ? 401 : ctx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ ok: false, error: ctx.error }, { status });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }
    const promoRepo = (prisma as unknown as {
      promoCode?: {
        findFirst: typeof prisma.promoCode.findFirst;
        create: typeof prisma.promoCode.create;
      };
    }).promoCode;
    if (!promoRepo) {
      return NextResponse.json(
        { ok: false, error: "Promo codes indisponíveis nesta instância do Prisma." },
        { status: 500 },
      );
    }

    const {
      code,
      type,
      value,
      maxUses,
      perUserLimit,
      validFrom,
      validUntil,
      eventId,
      active,
      autoApply,
      minQuantity,
      minTotalCents,
      name,
      description,
      minCartValueCents,
    } = body as {
      code?: string;
      type?: "PERCENTAGE" | "FIXED";
      value?: number;
      maxUses?: number | null;
      perUserLimit?: number | null;
      validFrom?: string | null;
      validUntil?: string | null;
      eventId?: number | null;
      active?: boolean;
      autoApply?: boolean;
      minQuantity?: number | null;
      minTotalCents?: number | null;
      name?: string | null;
      description?: string | null;
      minCartValueCents?: number | null;
    };

    const cleanCode = (code || "").trim();
    const auto = Boolean(autoApply);
    // Se autoApply e sem código, gerar um placeholder interno
    const finalCode =
      auto && !cleanCode
        ? `AUTO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : cleanCode;
    if (!finalCode) {
      return NextResponse.json({ ok: false, error: "Código em falta." }, { status: 400 });
    }
    if (type !== "PERCENTAGE" && type !== "FIXED") {
      return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });
    }
    const cleanValue = Number(value);
    if (!Number.isFinite(cleanValue) || cleanValue <= 0) {
      return NextResponse.json({ ok: false, error: "Valor inválido." }, { status: 400 });
    }

    let targetEventId: number | null = null;
    if (eventId !== null && eventId !== undefined) {
      const exists = await prisma.event.findFirst({
        where: { id: Number(eventId), organizerId: ctx.organizer.id },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json(
          { ok: false, error: "Evento inválido ou não pertence ao organizador." },
          { status: 400 },
        );
      }
      targetEventId = Number(eventId);
    }

    const parseDate = (d?: string | null) => {
      if (!d) return null;
      const dt = new Date(d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const created = await prisma.promoCode.create({
      data: {
        code: finalCode,
        type,
        value: Math.floor(cleanValue),
        maxUses: maxUses ?? null,
        perUserLimit: perUserLimit ?? null,
        validFrom: parseDate(validFrom),
        validUntil: parseDate(validUntil),
        eventId: targetEventId,
        active: active ?? true,
        autoApply: auto,
        minQuantity: minQuantity ?? null,
        minTotalCents: minTotalCents ?? null,
      },
    });

    return NextResponse.json({ ok: true, promoCode: created }, { status: 200 });
  } catch (err) {
    console.error("[organizador/promo][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireOrganizer();
    if ("error" in ctx) {
      const status =
        ctx.error === "UNAUTHENTICATED" ? 401 : ctx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ ok: false, error: ctx.error }, { status });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.id !== "number") {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const promoRepo = (prisma as unknown as {
      promoCode?: {
        findUnique: typeof prisma.promoCode.findUnique;
        update: typeof prisma.promoCode.update;
      };
    }).promoCode;
    if (!promoRepo) {
      return NextResponse.json(
        { ok: false, error: "Promo codes indisponíveis nesta instância do Prisma." },
        { status: 500 },
      );
    }

    const promo = await promoRepo.findUnique({ where: { id: body.id } });
    if (!promo) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // garantir que pertence ao organizer (ou global)
    if (promo.eventId) {
      const evt = await prisma.event.findFirst({
        where: { id: promo.eventId, organizerId: ctx.organizer.id },
        select: { id: true },
      });
      if (!evt) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN" },
          { status: 403 },
        );
      }
    }

    const {
      active,
      autoApply,
      code,
      type,
      value,
      maxUses,
      perUserLimit,
      validFrom,
      validUntil,
      eventId,
      minQuantity,
      minTotalCents,
      minCartValueCents,
      name,
      description,
    } = body as {
      active?: boolean;
      autoApply?: boolean;
      code?: string;
      type?: "PERCENTAGE" | "FIXED";
      value?: number;
      maxUses?: number | null;
      perUserLimit?: number | null;
      validFrom?: string | null;
      validUntil?: string | null;
      eventId?: number | null;
      minQuantity?: number | null;
      minTotalCents?: number | null;
      minCartValueCents?: number | null;
      name?: string | null;
      description?: string | null;
    };

    let targetEventId: number | null | undefined = undefined;
    if (eventId !== undefined && eventId !== null) {
      const exists = await prisma.event.findFirst({
        where: { id: Number(eventId), organizerId: ctx.organizer.id },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json(
          { ok: false, error: "Evento inválido ou não pertence ao organizador." },
          { status: 400 },
        );
      }
      targetEventId = Number(eventId);
    } else if (eventId === null) {
      targetEventId = null;
    }

    const parseDate = (d?: string | null) => {
      if (!d) return null;
      const dt = new Date(d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const dataUpdate: Record<string, unknown> = {};
    if (typeof active === "boolean") dataUpdate.active = active;
    if (typeof autoApply === "boolean") dataUpdate.autoApply = autoApply;
    if (typeof code === "string" && code.trim()) dataUpdate.code = code.trim();
    if (type === "PERCENTAGE" || type === "FIXED") dataUpdate.type = type;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      dataUpdate.value = Math.floor(value);
    }
    if (maxUses !== undefined) dataUpdate.maxUses = maxUses;
    if (perUserLimit !== undefined) dataUpdate.perUserLimit = perUserLimit;
    if (validFrom !== undefined) dataUpdate.validFrom = parseDate(validFrom);
    if (validUntil !== undefined) dataUpdate.validUntil = parseDate(validUntil);
    if (targetEventId !== undefined) {
      dataUpdate.event = targetEventId === null ? { disconnect: true } : { connect: { id: targetEventId } };
    }
    if (minQuantity !== undefined) dataUpdate.minQuantity = minQuantity;
    if (minTotalCents !== undefined) dataUpdate.minTotalCents = minTotalCents;
    if (minCartValueCents !== undefined) dataUpdate.minCartValueCents = minCartValueCents;
    if (typeof name === "string") dataUpdate.name = name.trim() || null;
    if (typeof description === "string") dataUpdate.description = description.trim() || null;

    const updated = await prisma.promoCode.update({
      where: { id: promo.id },
      data: dataUpdate,
    });

    return NextResponse.json({ ok: true, promoCode: updated }, { status: 200 });
  } catch (err) {
    console.error("[organizador/promo][PATCH]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireOrganizer();
    if ("error" in ctx) {
      const status =
        ctx.error === "UNAUTHENTICATED" ? 401 : ctx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ ok: false, error: ctx.error }, { status });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body.id !== "number") {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const promo = await prisma.promoCode.findUnique({ where: { id: body.id } });
    if (!promo) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (promo.eventId) {
      const evt = await prisma.event.findFirst({
        where: { id: promo.eventId, organizerId: ctx.organizer.id },
        select: { id: true },
      });
      if (!evt) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }

    await prisma.promoCode.delete({
      where: { id: promo.id },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/promo][DELETE]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
