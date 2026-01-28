export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreOrderStatus } from "@prisma/client";
import { buildStoreInvoicePdf } from "@/lib/store/invoice";
import { buildPersonalizationSummary } from "@/lib/store/personalization";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function resolveOrderId(params: { orderId: string }) {
  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, orderId };
}


async function _GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const email = user.email ?? null;

    const resolvedParams = await params;
    const resolved = resolveOrderId(resolvedParams);
    if (!resolved.ok) {
      return jsonWrap({ ok: false, error: resolved.error }, { status: 400 });
    }

    const order = await prisma.storeOrder.findFirst({
      where: {
        id: resolved.orderId,
        OR: [
          { userId: user.id },
          email ? { userId: null, customerEmail: email } : undefined,
        ].filter(Boolean) as object[],
        status: { in: [StoreOrderStatus.PAID, StoreOrderStatus.FULFILLED, StoreOrderStatus.REFUNDED, StoreOrderStatus.PARTIAL_REFUND] },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        subtotalCents: true,
        discountCents: true,
        shippingCents: true,
        totalCents: true,
        currency: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        createdAt: true,
        store: {
          select: {
            id: true,
            supportEmail: true,
            supportPhone: true,
            organization: { select: { username: true, publicName: true, businessName: true } },
            ownerUser: { select: { username: true, fullName: true } },
          },
        },
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
        lines: {
          select: {
            productId: true,
            nameSnapshot: true,
            quantity: true,
            unitPriceCents: true,
            totalCents: true,
            personalization: true,
            product: { select: { name: true } },
            variant: { select: { label: true } },
          },
        },
      },
    });

    if (!order) {
      return jsonWrap({ ok: false, error: "Fatura indisponivel." }, { status: 404 });
    }

    const productIds = Array.from(
      new Set(order.lines.map((line) => line.productId).filter((id): id is number => Boolean(id))),
    );
    const options = productIds.length
      ? await prisma.storeProductOption.findMany({
          where: { productId: { in: productIds } },
          select: { id: true, productId: true, optionType: true, label: true },
        })
      : [];
    const optionIds = options.map((option) => option.id);
    const values = optionIds.length
      ? await prisma.storeProductOptionValue.findMany({
          where: { optionId: { in: optionIds } },
          select: { id: true, optionId: true, value: true, label: true },
        })
      : [];
    const optionsByProduct = new Map<number, typeof options>();
    options.forEach((option) => {
      const existing = optionsByProduct.get(option.productId) ?? [];
      existing.push(option);
      optionsByProduct.set(option.productId, existing);
    });
    const valuesByOption = new Map<number, typeof values>();
    values.forEach((value) => {
      const existing = valuesByOption.get(value.optionId) ?? [];
      existing.push(value);
      valuesByOption.set(value.optionId, existing);
    });

    const orderWithPersonalization = {
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        personalization: buildPersonalizationSummary({
          personalization: line.personalization,
          options: line.productId ? optionsByProduct.get(line.productId) ?? [] : [],
          values: line.productId
            ? (optionsByProduct.get(line.productId) ?? []).flatMap(
                (option) => valuesByOption.get(option.id) ?? [],
              )
            : [],
        }),
      })),
    };

    const pdf = await buildStoreInvoicePdf(orderWithPersonalization);
    const filenameBase = `fatura_${order.orderNumber ?? order.id}`;

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/purchases/[orderId]/invoice error:", err);
    return jsonWrap({ ok: false, error: "Erro ao gerar fatura." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);