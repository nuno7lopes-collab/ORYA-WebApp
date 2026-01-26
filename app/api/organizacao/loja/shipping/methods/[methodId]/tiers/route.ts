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

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const createTierSchema = z.object({
  minSubtotalCents: z.number().int().nonnegative(),
  maxSubtotalCents: z.number().int().nonnegative().optional().nullable(),
  rateCents: z.number().int().nonnegative(),
});

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

function rangesOverlap(minA: number, maxA: number | null, minB: number, maxB: number | null) {
  const aMax = maxA ?? Number.POSITIVE_INFINITY;
  const bMax = maxB ?? Number.POSITIVE_INFINITY;
  return minA <= bMax && minB <= aMax;
}

async function getOrganizationContext(req: NextRequest, userId: string, options?: { requireVerifiedEmail?: boolean }) {
  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(userId, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
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

    const resolvedParams = await params;
    const methodId = parseId(resolvedParams.methodId);
    if (!methodId.ok) {
      return NextResponse.json({ ok: false, error: methodId.error }, { status: 400 });
    }

    const method = await prisma.storeShippingMethod.findFirst({
      where: { id: methodId.id, zone: { storeId: context.store.id } },
      select: { id: true },
    });
    if (!method) {
      return NextResponse.json({ ok: false, error: "Metodo nao encontrado." }, { status: 404 });
    }

    const items = await prisma.storeShippingTier.findMany({
      where: { methodId: methodId.id },
      orderBy: [{ minSubtotalCents: "asc" }],
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
        rateCents: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/shipping/methods/[methodId]/tiers error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar tiers." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
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

    const resolvedParams = await params;
    const methodId = parseId(resolvedParams.methodId);
    if (!methodId.ok) {
      return NextResponse.json({ ok: false, error: methodId.error }, { status: 400 });
    }

    const method = await prisma.storeShippingMethod.findFirst({
      where: { id: methodId.id, zone: { storeId: context.store.id } },
      select: { id: true },
    });
    if (!method) {
      return NextResponse.json({ ok: false, error: "Metodo nao encontrado." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createTierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    if (payload.maxSubtotalCents !== null && payload.maxSubtotalCents !== undefined) {
      if (payload.maxSubtotalCents < payload.minSubtotalCents) {
        return NextResponse.json({ ok: false, error: "Intervalo invalido." }, { status: 400 });
      }
    }

    const existingTiers = await prisma.storeShippingTier.findMany({
      where: { methodId: methodId.id },
      select: { id: true, minSubtotalCents: true, maxSubtotalCents: true },
    });
    const overlap = existingTiers.some((tier) =>
      rangesOverlap(
        payload.minSubtotalCents,
        payload.maxSubtotalCents ?? null,
        tier.minSubtotalCents,
        tier.maxSubtotalCents,
      ),
    );
    if (overlap) {
      return NextResponse.json({ ok: false, error: "Tier sobrepoe-se a outro intervalo." }, { status: 409 });
    }

    const created = await prisma.storeShippingTier.create({
      data: {
        methodId: methodId.id,
        minSubtotalCents: payload.minSubtotalCents,
        maxSubtotalCents: payload.maxSubtotalCents ?? null,
        rateCents: payload.rateCents,
      },
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
        rateCents: true,
      },
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/loja/shipping/methods/[methodId]/tiers error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar tier." }, { status: 500 });
  }
}
