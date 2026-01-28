import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { retrieveCharge, retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const receiptSchema = z.object({
  orderNumber: z.string().trim().min(3).max(120),
  email: z.string().trim().email(),
});

async function _POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = receiptSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const order = await prisma.storeOrder.findFirst({
      where: {
        orderNumber: payload.orderNumber.trim(),
        customerEmail: payload.email.trim(),
      },
      select: { id: true, paymentIntentId: true },
    });

    if (!order) {
      return jsonWrap({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
    }

    if (!order.paymentIntentId) {
      return jsonWrap({ ok: false, error: "Recibo indisponivel." }, { status: 400 });
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
      return jsonWrap({ ok: false, error: "Recibo indisponivel." }, { status: 404 });
    }

    return jsonWrap({ ok: true, url: receiptUrl });
  } catch (err) {
    console.error("POST /api/store/orders/receipt error:", err);
    return jsonWrap({ ok: false, error: "Erro ao obter recibo." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);