import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const updateZoneSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120).optional(),
  countries: z.array(z.string().trim().min(2).max(3)).min(1, "Pais obrigatorio.").optional(),
  isActive: z.boolean().optional(),
});

function normalizeCountries(countries: string[]) {
  const normalized = countries
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length >= 2 && entry.length <= 3);
  return Array.from(new Set(normalized));
}

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
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

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const zoneId = parseId(resolvedParams.zoneId);
    if (!zoneId.ok) {
      return NextResponse.json({ ok: false, error: zoneId.error }, { status: 400 });
    }

    const item = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true, name: true, countries: true, isActive: true },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: "Zona nao encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/shipping/zones/[zoneId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar zona." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
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
    const zoneId = parseId(resolvedParams.zoneId);
    if (!zoneId.ok) {
      return NextResponse.json({ ok: false, error: zoneId.error }, { status: 400 });
    }

    const existing = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true, countries: true, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Zona nao encontrada." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const data: { name?: string; countries?: string[]; isActive?: boolean } = {};

    const nextIsActive = payload.isActive ?? existing.isActive;
    const nextCountries =
      payload.countries !== undefined ? normalizeCountries(payload.countries) : existing.countries;

    if (payload.name !== undefined) {
      data.name = payload.name.trim();
    }

    if (payload.countries !== undefined) {
      if (nextCountries.length === 0) {
        return NextResponse.json({ ok: false, error: "Paises invalidos." }, { status: 400 });
      }
      data.countries = nextCountries;
    }

    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    }

    if (nextIsActive) {
      const overlapping = await prisma.storeShippingZone.findMany({
        where: {
          storeId: context.store.id,
          id: { not: existing.id },
          isActive: true,
          countries: { hasSome: nextCountries },
        },
        select: { id: true },
      });
      if (overlapping.length > 0) {
        return NextResponse.json({ ok: false, error: "Pais ja associado a outra zona ativa." }, { status: 409 });
      }
    }

    const updated = await prisma.storeShippingZone.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true, countries: true, isActive: true },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/shipping/zones/[zoneId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar zona." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
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
    const zoneId = parseId(resolvedParams.zoneId);
    if (!zoneId.ok) {
      return NextResponse.json({ ok: false, error: zoneId.error }, { status: 400 });
    }

    const existing = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Zona nao encontrada." }, { status: 404 });
    }

    await prisma.storeShippingZone.delete({ where: { id: existing.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/me/store/shipping/zones/[zoneId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover zona." }, { status: 500 });
  }
}
