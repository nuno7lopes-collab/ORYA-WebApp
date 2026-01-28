import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreProductOptionType } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const createOptionSchema = z.object({
  optionType: z.nativeEnum(StoreProductOptionType),
  label: z.string().trim().min(1, "Label obrigatorio.").max(120),
  required: z.boolean().optional(),
  maxLength: z.number().int().positive().optional().nullable(),
  minValue: z.number().int().optional().nullable(),
  maxValue: z.number().int().optional().nullable(),
  priceDeltaCents: z.number().int().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

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
    select: { id: true, catalogLocked: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, organization, store };
}

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return jsonWrap({ ok: false, error: productId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const items = await prisma.storeProductOption.findMany({
      where: { productId: productId.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        optionType: true,
        label: true,
        required: true,
        maxLength: true,
        minValue: true,
        maxValue: true,
        priceDeltaCents: true,
        sortOrder: true,
      },
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/products/[id]/options error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar opcoes." }, { status: 500 });
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    if (context.store.catalogLocked) {
      return jsonWrap({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return jsonWrap({ ok: false, error: productId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createOptionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const payload = parsed.data;
    const created = await prisma.storeProductOption.create({
      data: {
        productId: productId.id,
        optionType: payload.optionType,
        label: payload.label.trim(),
        required: payload.required ?? false,
        maxLength: payload.maxLength ?? null,
        minValue: payload.minValue ?? null,
        maxValue: payload.maxValue ?? null,
        priceDeltaCents: payload.priceDeltaCents ?? 0,
        sortOrder: payload.sortOrder ?? 0,
      },
      select: {
        id: true,
        optionType: true,
        label: true,
        required: true,
        maxLength: true,
        minValue: true,
        maxValue: true,
        priceDeltaCents: true,
        sortOrder: true,
      },
    });

    return jsonWrap({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/loja/products/[id]/options error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar opcao." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);