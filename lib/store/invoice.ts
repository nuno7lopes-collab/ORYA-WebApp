import PDFDocument from "pdfkit";
import { StoreAddressType, StoreOrderStatus } from "@prisma/client";

type InvoiceOrder = {
  id: number;
  orderNumber: string | null;
  status: StoreOrderStatus;
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
    supportEmail: string | null;
    supportPhone: string | null;
    organization: { username: string | null; publicName: string | null; businessName: string | null } | null;
    ownerUser: { username: string | null; fullName: string | null } | null;
  };
  addresses: Array<{
    addressType: StoreAddressType;
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string;
    country: string;
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
    doc.text(billingAddress.line1);
    if (billingAddress.line2) doc.text(billingAddress.line2);
    doc.text(
      `${billingAddress.postalCode} ${billingAddress.city}${billingAddress.region ? `, ${billingAddress.region}` : ""}`,
    );
    doc.text(billingAddress.country);
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
