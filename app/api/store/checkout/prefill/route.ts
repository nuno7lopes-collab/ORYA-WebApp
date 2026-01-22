import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreAddressType } from "@prisma/client";

type PrefillResponse = {
  ok: boolean;
  customer?: { name: string | null; email: string | null; phone: string | null };
  shippingAddress?: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string;
    country: string;
    nif: string | null;
  } | null;
  billingAddress?: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string;
    country: string;
    nif: string | null;
  } | null;
  error?: string;
};

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

export async function GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json<PrefillResponse>({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return NextResponse.json<PrefillResponse>({ ok: false, error: storeParsed.error }, { status: 400 });
    }

    const store = await prisma.store.findFirst({
      where: { id: storeParsed.storeId },
      select: { id: true },
    });
    if (!store) {
      return NextResponse.json<PrefillResponse>({ ok: false, error: "Store nao encontrada." }, { status: 404 });
    }

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      return NextResponse.json<PrefillResponse>({ ok: false });
    }

    const [profile, lastOrder] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: user.id },
        select: { fullName: true, contactPhone: true },
      }),
      prisma.storeOrder.findFirst({
        where: { storeId: store.id, userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          addresses: {
            select: {
              addressType: true,
              fullName: true,
              line1: true,
              line2: true,
              city: true,
              region: true,
              postalCode: true,
              country: true,
              nif: true,
            },
          },
        },
      }),
    ]);

    const shippingAddress =
      lastOrder?.addresses.find((address) => address.addressType === StoreAddressType.SHIPPING) ?? null;
    const billingAddress =
      lastOrder?.addresses.find((address) => address.addressType === StoreAddressType.BILLING) ?? null;

    const metadata = user.user_metadata as { full_name?: string; name?: string } | null;
    const customer = {
      name: profile?.fullName ?? lastOrder?.customerName ?? metadata?.full_name ?? metadata?.name ?? null,
      email: user.email ?? lastOrder?.customerEmail ?? null,
      phone: profile?.contactPhone ?? lastOrder?.customerPhone ?? null,
    };

    return NextResponse.json<PrefillResponse>({
      ok: true,
      customer,
      shippingAddress,
      billingAddress,
    });
  } catch (err) {
    console.error("GET /api/store/checkout/prefill error:", err);
    return NextResponse.json<PrefillResponse>({ ok: false, error: "Erro ao carregar prefill." }, { status: 500 });
  }
}
