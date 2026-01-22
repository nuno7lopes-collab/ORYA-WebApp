import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreShippingMode } from "@prisma/client";
import { z } from "zod";

const ALLOWED_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const createMethodSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  baseRateCents: z.number().int().nonnegative(),
  mode: z.nativeEnum(StoreShippingMode).optional(),
  freeOverCents: z.number().int().nonnegative().optional().nullable(),
  isDefault: z.boolean().optional(),
  etaMinDays: z.number().int().nonnegative().optional().nullable(),
  etaMaxDays: z.number().int().nonnegative().optional().nullable(),
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
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
    const zoneId = parseId(resolvedParams.zoneId);
    if (!zoneId.ok) {
      return NextResponse.json({ ok: false, error: zoneId.error }, { status: 400 });
    }

    const zone = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!zone) {
      return NextResponse.json({ ok: false, error: "Zona nao encontrada." }, { status: 404 });
    }

    const items = await prisma.storeShippingMethod.findMany({
      where: { zoneId: zoneId.id },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        zoneId: true,
        name: true,
        description: true,
        baseRateCents: true,
        mode: true,
        freeOverCents: true,
        isDefault: true,
        etaMinDays: true,
        etaMaxDays: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/shipping/zones/[zoneId]/methods error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar metodos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
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
    const zoneId = parseId(resolvedParams.zoneId);
    if (!zoneId.ok) {
      return NextResponse.json({ ok: false, error: zoneId.error }, { status: 400 });
    }

    const zone = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!zone) {
      return NextResponse.json({ ok: false, error: "Zona nao encontrada." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createMethodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const etaMinDays = payload.etaMinDays ?? null;
    const etaMaxDays = payload.etaMaxDays ?? null;
    if (etaMinDays !== null && etaMaxDays !== null && etaMinDays > etaMaxDays) {
      return NextResponse.json({ ok: false, error: "ETA invalida." }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.storeShippingMethod.updateMany({
          where: { zoneId: zoneId.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.storeShippingMethod.create({
        data: {
          zoneId: zoneId.id,
          name: payload.name.trim(),
          description: payload.description ?? null,
          baseRateCents: payload.baseRateCents,
          mode: payload.mode ?? StoreShippingMode.FLAT,
          freeOverCents: payload.freeOverCents ?? null,
          isDefault: payload.isDefault ?? false,
          etaMinDays,
          etaMaxDays,
        },
        select: {
          id: true,
          zoneId: true,
          name: true,
          description: true,
          baseRateCents: true,
          mode: true,
          freeOverCents: true,
          isDefault: true,
          etaMinDays: true,
          etaMaxDays: true,
        },
      });
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/loja/shipping/zones/[zoneId]/methods error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar metodo." }, { status: 500 });
  }
}
