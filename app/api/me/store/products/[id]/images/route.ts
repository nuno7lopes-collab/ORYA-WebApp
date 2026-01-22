import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const createImageSchema = z.object({
  url: z.string().trim().min(1).max(500),
  altText: z.string().trim().max(140).optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
});

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

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return NextResponse.json({ ok: false, error: productId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const items = await prisma.storeProductImage.findMany({
      where: { productId: productId.id },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/products/[id]/images error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar imagens." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return NextResponse.json({ ok: false, error: productId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createImageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const payload = parsed.data;
    const sortOrder = payload.sortOrder ?? (await prisma.storeProductImage
      .findFirst({
        where: { productId: productId.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      })
      .then((last) => (last?.sortOrder ?? 0) + 1));

    const created = await prisma.$transaction(async (tx) => {
      if (payload.isPrimary) {
        await tx.storeProductImage.updateMany({
          where: { productId: productId.id },
          data: { isPrimary: false },
        });
      }

      return tx.storeProductImage.create({
        data: {
          productId: productId.id,
          url: payload.url.trim(),
          altText: payload.altText ?? null,
          sortOrder,
          isPrimary: payload.isPrimary ?? false,
        },
        select: {
          id: true,
          url: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
        },
      });
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/products/[id]/images error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar imagem." }, { status: 500 });
  }
}
