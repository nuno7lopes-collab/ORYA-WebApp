import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const createZoneSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120),
  countries: z.array(z.string().trim().min(2).max(3)).min(1, "Pais obrigatorio."),
  isActive: z.boolean().optional(),
});

function normalizeCountries(countries: string[]) {
  const normalized = countries
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length >= 2 && entry.length <= 3);
  return Array.from(new Set(normalized));
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

async function _GET() {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    const items = await prisma.storeShippingZone.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        countries: true,
        isActive: true,
      },
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/shipping/zones error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar zonas." }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createZoneSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const countries = normalizeCountries(payload.countries);
    if (countries.length === 0) {
      return jsonWrap({ ok: false, error: "Paises invalidos." }, { status: 400 });
    }

    if (payload.isActive ?? true) {
      const overlapping = await prisma.storeShippingZone.findMany({
        where: {
          storeId: context.store.id,
          isActive: true,
          countries: { hasSome: countries },
        },
        select: { id: true },
      });
      if (overlapping.length > 0) {
        return jsonWrap({ ok: false, error: "Pais ja associado a outra zona ativa." }, { status: 409 });
      }
    }

    const created = await prisma.storeShippingZone.create({
      data: {
        storeId: context.store.id,
        name: payload.name.trim(),
        countries,
        isActive: payload.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        countries: true,
        isActive: true,
      },
    });

    return jsonWrap({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/shipping/zones error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar zona." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);