import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

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

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/shipping/zones error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar zonas." }, { status: 500 });
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

    const body = await req.json().catch(() => null);
    const parsed = createZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const countries = normalizeCountries(payload.countries);
    if (countries.length === 0) {
      return NextResponse.json({ ok: false, error: "Paises invalidos." }, { status: 400 });
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

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/shipping/zones error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar zona." }, { status: 500 });
  }
}
