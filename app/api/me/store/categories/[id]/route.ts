import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    slug: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    coverImageUrl: z.string().trim().url().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const categoryId = Number(resolvedParams.id);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ ok: false, error: "ID invalido." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const data: {
      name?: string;
      slug?: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      coverImageUrl?: string | null;
    } = {};

    if (payload.name) data.name = payload.name.trim();
    if (payload.slug) {
      const slug = slugify(payload.slug.trim());
      if (!slug) {
        return NextResponse.json({ ok: false, error: "Slug invalido." }, { status: 400 });
      }
      data.slug = slug;
    }
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;
    if (payload.coverImageUrl !== undefined) data.coverImageUrl = payload.coverImageUrl ?? null;

    const existing = await prisma.storeCategory.findFirst({
      where: { id: categoryId, storeId: context.store.id },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Categoria nao encontrada." }, { status: 404 });
    }

    const updated = await prisma.storeCategory.update({
      where: { id: categoryId },
      data,
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/categories/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar categoria." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const categoryId = Number(resolvedParams.id);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ ok: false, error: "ID invalido." }, { status: 400 });
    }

    const existing = await prisma.storeCategory.findFirst({
      where: { id: categoryId, storeId: context.store.id },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Categoria nao encontrada." }, { status: 404 });
    }

    await prisma.storeCategory.delete({ where: { id: categoryId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/me/store/categories/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover categoria." }, { status: 500 });
  }
}
