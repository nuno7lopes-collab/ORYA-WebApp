import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreBundlePricingMode, StoreBundleStatus } from "@prisma/client";
import { z } from "zod";

const createBundleSchema = z
  .object({
    name: z.string().trim().min(1, "Nome obrigatorio.").max(120),
    slug: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    pricingMode: z.nativeEnum(StoreBundlePricingMode),
    priceCents: z.number().int().nonnegative().optional().nullable(),
    percentOff: z.number().int().min(1).max(100).optional().nullable(),
    status: z.nativeEnum(StoreBundleStatus).optional(),
    isVisible: z.boolean().optional(),
  })
  .refine(
    (data) =>
      (data.pricingMode === StoreBundlePricingMode.FIXED && data.priceCents !== null && data.priceCents !== undefined) ||
      (data.pricingMode === StoreBundlePricingMode.PERCENT_DISCOUNT &&
        data.percentOff !== null &&
        data.percentOff !== undefined),
    { message: "Pricing invalido." },
  );

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true, catalogLocked: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
}

export async function GET() {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const items = await prisma.storeBundle.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        pricingMode: true,
        priceCents: true,
        percentOff: true,
        status: true,
        isVisible: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/bundles error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar bundles." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    if (context.store.catalogLocked) {
      return NextResponse.json({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createBundleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const name = payload.name.trim();
    const rawSlug = payload.slug?.trim();
    const slug = rawSlug ? slugify(rawSlug) : slugify(name);
    if (!slug) {
      return NextResponse.json({ ok: false, error: "Slug invalido." }, { status: 400 });
    }

    const existingSlug = await prisma.storeBundle.findFirst({
      where: { storeId: context.store.id, slug },
      select: { id: true },
    });
    if (existingSlug) {
      return NextResponse.json({ ok: false, error: "Slug ja existe." }, { status: 409 });
    }

    const created = await prisma.storeBundle.create({
      data: {
        storeId: context.store.id,
        name,
        slug,
        description: payload.description ?? null,
        pricingMode: payload.pricingMode,
        priceCents: payload.pricingMode === StoreBundlePricingMode.FIXED ? payload.priceCents ?? 0 : null,
        percentOff:
          payload.pricingMode === StoreBundlePricingMode.PERCENT_DISCOUNT ? payload.percentOff ?? 0 : null,
        status: payload.status ?? StoreBundleStatus.DRAFT,
        isVisible: payload.isVisible ?? false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        pricingMode: true,
        priceCents: true,
        percentOff: true,
        status: true,
        isVisible: true,
      },
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/bundles error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar bundle." }, { status: 500 });
  }
}
