import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole } from "@prisma/client";
import { z } from "zod";

const ALLOWED_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const updateTierSchema = z.object({
  minSubtotalCents: z.number().int().nonnegative().optional(),
  maxSubtotalCents: z.number().int().nonnegative().optional().nullable(),
  rateCents: z.number().int().nonnegative().optional(),
});

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

async function getOrganizationContext(req: NextRequest, userId: string, options?: { requireVerifiedEmail?: boolean }) {
  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(userId, {
    organizationId: organizationId ?? undefined,
    roles: [...ALLOWED_ROLES],
  });

  if (!organization || !membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }

  const lojaAccess = await ensureLojaModuleAccess(organization, undefined, options);
  if (!lojaAccess.ok) {
    return { ok: false as const, error: lojaAccess.error };
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
    select: { id: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
}

export async function GET(req: NextRequest, { params }: { params: { tierId: string } }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const tierId = parseId(params.tierId);
    if (!tierId.ok) {
      return NextResponse.json({ ok: false, error: tierId.error }, { status: 400 });
    }

    const item = await prisma.storeShippingTier.findFirst({
      where: { id: tierId.id, method: { zone: { storeId: context.store.id } } },
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
        rateCents: true,
      },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: "Tier nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/shipping/tiers/[tierId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar tier." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { tierId: string } }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const tierId = parseId(params.tierId);
    if (!tierId.ok) {
      return NextResponse.json({ ok: false, error: tierId.error }, { status: 400 });
    }

    const existing = await prisma.storeShippingTier.findFirst({
      where: { id: tierId.id, method: { zone: { storeId: context.store.id } } },
      select: {
        id: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Tier nao encontrado." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateTierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const nextMin = payload.minSubtotalCents ?? existing.minSubtotalCents;
    const nextMax = payload.maxSubtotalCents === undefined ? existing.maxSubtotalCents : payload.maxSubtotalCents;
    if (nextMax !== null && nextMax < nextMin) {
      return NextResponse.json({ ok: false, error: "Intervalo invalido." }, { status: 400 });
    }

    const data: {
      minSubtotalCents?: number;
      maxSubtotalCents?: number | null;
      rateCents?: number;
    } = {};

    if (payload.minSubtotalCents !== undefined) {
      data.minSubtotalCents = payload.minSubtotalCents;
    }
    if (payload.maxSubtotalCents !== undefined) {
      data.maxSubtotalCents = payload.maxSubtotalCents;
    }
    if (payload.rateCents !== undefined) {
      data.rateCents = payload.rateCents;
    }

    const updated = await prisma.storeShippingTier.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
        rateCents: true,
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/loja/shipping/tiers/[tierId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar tier." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { tierId: string } }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const tierId = parseId(params.tierId);
    if (!tierId.ok) {
      return NextResponse.json({ ok: false, error: tierId.error }, { status: 400 });
    }

    const existing = await prisma.storeShippingTier.findFirst({
      where: { id: tierId.id, method: { zone: { storeId: context.store.id } } },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Tier nao encontrado." }, { status: 404 });
    }

    await prisma.storeShippingTier.delete({ where: { id: existing.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/loja/shipping/tiers/[tierId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover tier." }, { status: 500 });
  }
}
