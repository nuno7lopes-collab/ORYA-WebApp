import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole, StoreOwnerType, StoreStatus } from "@prisma/client";
import { z } from "zod";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
];

function normalizeStore(store: {
  id: number;
  status: StoreStatus;
  catalogLocked: boolean;
  checkoutEnabled: boolean;
  showOnProfile: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: store.id,
    status: store.status,
    catalogLocked: store.catalogLocked,
    checkoutEnabled: store.checkoutEnabled,
    showOnProfile: store.showOnProfile,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}

const updateStoreSchema = z.object({
  status: z.nativeEnum(StoreStatus).optional(),
  catalogLocked: z.boolean().optional(),
  checkoutEnabled: z.boolean().optional(),
  showOnProfile: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return NextResponse.json({ ok: false, error: emailGate.error }, { status: 403 });
    }
    const lojaAccess = await ensureLojaModuleAccess(organization);
    if (!lojaAccess.ok) {
      return NextResponse.json({ ok: false, error: lojaAccess.error }, { status: 403 });
    }

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
      select: {
        id: true,
        status: true,
        catalogLocked: true,
        checkoutEnabled: true,
        showOnProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, store: store ? normalizeStore(store) : null });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar loja." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return NextResponse.json({ ok: false, error: emailGate.error }, { status: 403 });
    }
    const lojaAccess = await ensureLojaModuleAccess(organization);
    if (!lojaAccess.ok) {
      return NextResponse.json({ ok: false, error: lojaAccess.error }, { status: 403 });
    }

    const existing = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
      select: {
        id: true,
        status: true,
        catalogLocked: true,
        checkoutEnabled: true,
        showOnProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (existing) {
      return NextResponse.json({ ok: true, store: normalizeStore(existing) });
    }

    const created = await prisma.store.create({
      data: {
        ownerType: StoreOwnerType.ORG,
        ownerOrganizationId: organization.id,
        status: StoreStatus.CLOSED,
        catalogLocked: true,
        checkoutEnabled: false,
        showOnProfile: false,
        currency: "EUR",
      },
      select: {
        id: true,
        status: true,
        catalogLocked: true,
        checkoutEnabled: true,
        showOnProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, store: normalizeStore(created) }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/loja error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar loja." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const lojaAccess = await ensureLojaModuleAccess(organization);
    if (!lojaAccess.ok) {
      return NextResponse.json({ ok: false, error: lojaAccess.error }, { status: 403 });
    }

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
      select: { id: true },
    });
    if (!store) {
      return NextResponse.json({ ok: false, error: "Loja ainda nao criada." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateStoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        status: payload.status ?? undefined,
        catalogLocked: payload.catalogLocked ?? undefined,
        checkoutEnabled: payload.checkoutEnabled ?? undefined,
        showOnProfile: payload.showOnProfile ?? undefined,
      },
      select: {
        id: true,
        status: true,
        catalogLocked: true,
        checkoutEnabled: true,
        showOnProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, store: normalizeStore(updated) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/loja error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar loja." }, { status: 500 });
  }
}
