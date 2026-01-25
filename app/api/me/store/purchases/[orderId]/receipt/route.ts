import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { retrieveCharge, retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";

function resolveOrderId(params: { orderId: string }) {
  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, orderId };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const resolvedParams = await params;
    const resolved = resolveOrderId(resolvedParams);
    if (!resolved.ok) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
    }

    const email = user.email ?? null;
    const order = await prisma.storeOrder.findFirst({
      where: {
        id: resolved.orderId,
        OR: [
          { userId: user.id },
          email ? { userId: null, customerEmail: email } : undefined,
        ].filter(Boolean) as object[],
      },
      select: { id: true, paymentIntentId: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
    }

    if (!order.paymentIntentId) {
      return NextResponse.json({ ok: false, error: "Recibo indisponivel." }, { status: 400 });
    }

    const intent = await retrievePaymentIntent(order.paymentIntentId, { expand: ["latest_charge"] });
    let receiptUrl: string | null = null;
    if (typeof intent.latest_charge === "string") {
      const charge = await retrieveCharge(intent.latest_charge);
      receiptUrl = charge.receipt_url ?? null;
    } else {
      receiptUrl = intent.latest_charge?.receipt_url ?? null;
    }

    if (!receiptUrl) {
      return NextResponse.json({ ok: false, error: "Recibo indisponivel." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, url: receiptUrl });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/purchases/[orderId]/receipt error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao obter recibo." }, { status: 500 });
  }
}
