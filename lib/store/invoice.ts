import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { InvoiceKind, InvoiceStatus, SourceType, StoreAddressType, StoreOrderStatus } from "@prisma/client";

type InvoiceOrder = {
  id: number;
  orderNumber: string | null;
  status: StoreOrderStatus;
  purchaseId?: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  createdAt: Date;
  store: {
    id: number;
    ownerOrganizationId?: number | null;
    supportEmail: string | null;
    supportPhone: string | null;
    organization: { username: string | null; publicName: string | null; businessName: string | null } | null;
    ownerUser: { username: string | null; fullName: string | null } | null;
  };
  addresses: Array<{
    addressType: StoreAddressType;
    fullName: string;
    formattedAddress: string | null;
    nif: string | null;
  }>;
  lines: Array<{
    nameSnapshot: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    product: { name: string } | null;
    variant: { label: string } | null;
    personalization?: Array<{ label: string; value: string }>;
  }>;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: Date) {
  return value.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function formatStatusLabel(status: StoreOrderStatus) {
  switch (status) {
    case StoreOrderStatus.PENDING:
      return "Pagamento pendente";
    case StoreOrderStatus.PAID:
      return "Pago";
    case StoreOrderStatus.FULFILLED:
      return "Concluida";
    case StoreOrderStatus.REFUNDED:
      return "Reembolsada";
    case StoreOrderStatus.PARTIAL_REFUND:
      return "Reembolso parcial";
    case StoreOrderStatus.CANCELLED:
      return "Cancelada";
    default:
      return status;
  }
}

function resolveInvoiceStatusForOrder(status: StoreOrderStatus): InvoiceStatus {
  switch (status) {
    case StoreOrderStatus.CANCELLED:
      return InvoiceStatus.CANCELLED;
    case StoreOrderStatus.REFUNDED:
      return InvoiceStatus.VOID;
    default:
      return InvoiceStatus.ISSUED;
  }
}

export async function ensureStoreInvoiceRecord(params: {
  order: {
    id: number;
    orderNumber: string | null;
    status: StoreOrderStatus;
    currency: string;
    totalCents: number;
    createdAt: Date;
    purchaseId?: string | null;
    store: { ownerOrganizationId?: number | null };
  };
  customerIdentityId?: string | null;
}) {
  const { order, customerIdentityId } = params;
  const organizationId = order.store.ownerOrganizationId;
  if (!organizationId) return null;

  const sourceId = String(order.id);
  const invoiceNumber = order.orderNumber ?? sourceId;
  const status = resolveInvoiceStatusForOrder(order.status);

  const existing = await prisma.invoice.findFirst({
    where: { sourceType: SourceType.STORE_ORDER, sourceId },
  });

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (existing.status !== status) updates.status = status;
    if (existing.currency !== order.currency) updates.currency = order.currency;
    if (existing.amountCents !== order.totalCents) updates.amountCents = order.totalCents;
    if (existing.invoiceNumber !== invoiceNumber) updates.invoiceNumber = invoiceNumber;
    if (customerIdentityId && existing.customerIdentityId !== customerIdentityId) {
      updates.customerIdentityId = customerIdentityId;
    }
    if (Object.keys(updates).length === 0) return existing;
    return prisma.invoice.update({ where: { id: existing.id }, data: updates });
  }

  return prisma.invoice.create({
    data: {
      organizationId,
      customerIdentityId: customerIdentityId ?? null,
      sourceType: SourceType.STORE_ORDER,
      sourceId,
      kind: InvoiceKind.CONSUMER,
      status,
      invoiceNumber,
      currency: order.currency,
      amountCents: order.totalCents,
      issuedAt: order.createdAt,
      metadata: {
        storeOrderId: order.id,
        orderNumber: order.orderNumber ?? null,
        purchaseId: order.purchaseId ?? null,
      },
    },
  });
}

export async function buildStoreInvoicePdf(order: InvoiceOrder) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const store = order.store;
  const org = store.organization;
  const owner = store.ownerUser;
  const storeName =
    org?.publicName ||
    org?.businessName ||
    org?.username ||
    owner?.fullName ||
    owner?.username ||
    `Loja ${store.id}`;

  const billing = order.addresses.find((address) => address.addressType === StoreAddressType.BILLING);
  const shipping = order.addresses.find((address) => address.addressType === StoreAddressType.SHIPPING);
  const billingAddress = billing ?? shipping ?? null;

  doc.fontSize(18).fillColor("#111").text("Fatura/Recibo", doc.page.margins.left, doc.y);
  doc.fontSize(10).fillColor("#666").text(`Encomenda ${order.orderNumber ?? order.id}`, doc.page.margins.left, doc.y + 4);
  doc.moveDown(0.8);

  doc.fontSize(10).fillColor("#333");
  doc.text(`Data: ${formatDate(order.createdAt)}`, doc.page.margins.left);
  doc.text(`Estado: ${formatStatusLabel(order.status)}`, doc.page.margins.left);
  doc.moveDown(0.6);

  doc.fontSize(11).fillColor("#111").text("Vendedor", doc.page.margins.left);
  doc.fontSize(10).fillColor("#333");
  doc.text(storeName);
  if (store.supportEmail) doc.text(`Email: ${store.supportEmail}`);
  if (store.supportPhone) doc.text(`Telefone: ${store.supportPhone}`);
  doc.moveDown(0.6);

  doc.fontSize(11).fillColor("#111").text("Comprador", doc.page.margins.left);
  doc.fontSize(10).fillColor("#333");
  doc.text(order.customerName ?? "Cliente");
  if (order.customerEmail) doc.text(`Email: ${order.customerEmail}`);
  if (order.customerPhone) doc.text(`Telefone: ${order.customerPhone}`);
  doc.moveDown(0.6);

  doc.fontSize(11).fillColor("#111").text("Faturacao", doc.page.margins.left);
  doc.fontSize(10).fillColor("#333");
  if (billingAddress) {
    doc.text(billingAddress.fullName);
    if (billingAddress.formattedAddress) {
      doc.text(billingAddress.formattedAddress);
    }
    if (billingAddress.nif) doc.text(`NIF: ${billingAddress.nif}`);
  } else {
    doc.text("Sem morada de faturacao registada.");
  }
  doc.moveDown(0.6);

  const colProduct = doc.page.margins.left;
  const colQty = doc.page.margins.left + pageWidth * 0.55;
  const colUnit = doc.page.margins.left + pageWidth * 0.7;
  const colTotal = doc.page.margins.left + pageWidth * 0.85;

  doc.fontSize(10).fillColor("#111");
  doc.text("Produto", colProduct, doc.y);
  doc.text("Qt", colQty, doc.y, { width: pageWidth * 0.08, align: "right" });
  doc.text("Preco", colUnit, doc.y, { width: pageWidth * 0.12, align: "right" });
  doc.text("Total", colTotal, doc.y, { width: pageWidth * 0.15, align: "right" });
  doc.moveDown(0.4);

  doc.strokeColor("#e5e7eb")
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .stroke();
  doc.moveDown(0.4);

  order.lines.forEach((line) => {
    const name = line.product?.name ?? line.nameSnapshot;
    const variant = line.variant?.label ? ` (${line.variant.label})` : "";
    doc.fontSize(9).fillColor("#333");
    doc.text(`${name}${variant}`, colProduct, doc.y, { width: pageWidth * 0.5 });
    doc.text(String(line.quantity), colQty, doc.y, { width: pageWidth * 0.08, align: "right" });
    doc.text(formatMoney(line.unitPriceCents, order.currency), colUnit, doc.y, { width: pageWidth * 0.12, align: "right" });
    doc.text(formatMoney(line.totalCents, order.currency), colTotal, doc.y, { width: pageWidth * 0.15, align: "right" });
    if (line.personalization && line.personalization.length > 0) {
      const summary = line.personalization.map((entry) => `${entry.label}: ${entry.value}`).join(" · ");
      doc.moveDown(0.2);
      doc.fontSize(8).fillColor("#666");
      doc.text(summary, colProduct, doc.y, { width: pageWidth * 0.5 });
      doc.fontSize(9).fillColor("#333");
    }
    doc.moveDown(0.3);
  });

  doc.moveDown(0.6);
  doc.strokeColor("#e5e7eb")
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .stroke();
  doc.moveDown(0.4);

  const summaryX = doc.page.margins.left + pageWidth * 0.6;
  doc.fontSize(10).fillColor("#333");
  doc.text("Subtotal", summaryX, doc.y, { width: pageWidth * 0.25 });
  doc.text(formatMoney(order.subtotalCents, order.currency), summaryX + pageWidth * 0.25, doc.y, {
    width: pageWidth * 0.15,
    align: "right",
  });
  doc.moveDown(0.3);
  if (order.discountCents > 0) {
    doc.text("Desconto", summaryX, doc.y, { width: pageWidth * 0.25 });
    doc.text(`-${formatMoney(order.discountCents, order.currency)}`, summaryX + pageWidth * 0.25, doc.y, {
      width: pageWidth * 0.15,
      align: "right",
    });
    doc.moveDown(0.3);
  }
  doc.text("Portes", summaryX, doc.y, { width: pageWidth * 0.25 });
  doc.text(formatMoney(order.shippingCents, order.currency), summaryX + pageWidth * 0.25, doc.y, {
    width: pageWidth * 0.15,
    align: "right",
  });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#111");
  doc.text("Total", summaryX, doc.y, { width: pageWidth * 0.25 });
  doc.text(formatMoney(order.totalCents, order.currency), summaryX + pageWidth * 0.25, doc.y, {
    width: pageWidth * 0.15,
    align: "right",
  });

  doc.moveDown(1.2);
  doc.fontSize(9).fillColor("#666").text("Documento gerado automaticamente pela ORYA.", doc.page.margins.left);

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });

  return buffer;
}
