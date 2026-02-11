export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { Prisma, StoreOrderStatus, StoreProductOptionType } from "@prisma/client";
import { buildStoreInvoicePdf, ensureStoreInvoiceRecord } from "@/lib/store/invoice";
import { buildPersonalizationSummary } from "@/lib/store/personalization";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const invoiceSchema = z.object({
  orderNumber: z.string().trim().min(3).max(120),
  email: z.string().trim().email(),
});

async function _POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = invoiceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const orderSelect = {
      id: true,
      orderNumber: true,
      status: true,
      purchaseId: true,
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
          ownerOrganizationId: true,
          supportEmail: true,
          supportPhone: true,
          organization: { select: { username: true, publicName: true, businessName: true } },
        },
      },
      addresses: {
        select: {
          addressType: true,
          addressId: true,
          fullName: true,
          nif: true,
          addressRef: { select: { formattedAddress: true } },
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
    } as const;

    const order = await prisma.storeOrder.findFirst({
      where: {
        orderNumber: payload.orderNumber.trim(),
        customerEmail: payload.email.trim(),
        status: { in: [StoreOrderStatus.PAID, StoreOrderStatus.FULFILLED, StoreOrderStatus.REFUNDED, StoreOrderStatus.PARTIAL_REFUND] },
      },
      select: orderSelect,
    });

    if (!order) {
      return jsonWrap({ ok: false, error: "Fatura indisponivel." }, { status: 404 });
    }

    const payment = order.purchaseId
      ? await prisma.payment.findUnique({
          where: { id: order.purchaseId },
          select: { customerIdentityId: true },
        })
      : null;
    await ensureStoreInvoiceRecord({
      order,
      customerIdentityId: payment?.customerIdentityId ?? null,
    });

    const productIds = Array.from(
      new Set(order.lines.map((line) => line.productId).filter((id): id is number => Boolean(id))),
    );
    const options: Array<{ id: number; productId: number; optionType: StoreProductOptionType; label: string }> =
      productIds.length
      ? await prisma.storeProductOption.findMany({
          where: { productId: { in: productIds } },
          select: { id: true, productId: true, optionType: true, label: true },
        })
      : [];
    const optionIds = options.map((option) => option.id);
    const values: Array<{ id: number; optionId: number; value: string; label: string | null; priceDeltaCents: number }> =
      optionIds.length
      ? await prisma.storeProductOptionValue.findMany({
          where: { optionId: { in: optionIds } },
          select: { id: true, optionId: true, value: true, label: true, priceDeltaCents: true },
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
      addresses: order.addresses.map((address) => ({
        addressType: address.addressType,
        fullName: address.fullName,
        formattedAddress: address.addressRef?.formattedAddress ?? null,
        nif: address.nif ?? null,
      })),
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
    console.error("POST /api/public/store/orders/invoice error:", err);
    return jsonWrap({ ok: false, error: "Erro ao gerar fatura." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
