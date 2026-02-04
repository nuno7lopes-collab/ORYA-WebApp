"use server";

import { sendEmail, assertEmailReady } from "@/lib/emailClient";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import {
  renderPurchaseConfirmationEmail,
  renderTournamentScheduleEmail,
  renderOwnerTransferEmail,
  renderOfficialEmailVerificationEmail,
  renderCrmCampaignEmail,
  renderStoreOrderConfirmationEmail,
} from "@/lib/emailTemplates";
import { format } from "date-fns";

type PurchaseEmailInput = {
  to: string;
  eventTitle: string;
  eventSlug: string;
  startsAt?: string | null;
  endsAt?: string | null;
  locationName?: string | null;
  locationCity?: string | null;
  address?: string | null;
  locationSource?: "APPLE_MAPS" | "OSM" | "MANUAL" | null;
  locationFormattedAddress?: string | null;
  locationComponents?: Record<string, unknown> | null;
  locationOverrides?: Record<string, unknown> | null;
  ticketsCount: number;
  ticketUrl: string;
};

export async function sendPurchaseConfirmationEmail(input: PurchaseEmailInput) {
  assertEmailReady();
  const { subject, html, text } = renderPurchaseConfirmationEmail({
    eventTitle: input.eventTitle,
    eventSlug: input.eventSlug,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    locationName: input.locationName,
    locationCity: input.locationCity,
    address: input.address,
    locationSource: input.locationSource,
    locationFormattedAddress: input.locationFormattedAddress,
    locationComponents: input.locationComponents,
    locationOverrides: input.locationOverrides,
    ticketsCount: input.ticketsCount,
    ticketUrl: input.ticketUrl,
  });

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}

type StoreOrderEmailInput = {
  to: string;
  storeName: string;
  orderNumber: string;
  orderTotal: string;
  items: Array<{ name: string; quantity: number }>;
  trackingUrl: string;
  orderUrl?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  replyTo?: string | null;
};

export async function sendStoreOrderConfirmationEmail(input: StoreOrderEmailInput) {
  assertEmailReady();
  const { subject, html, text } = renderStoreOrderConfirmationEmail({
    storeName: input.storeName,
    orderNumber: input.orderNumber,
    orderTotal: input.orderTotal,
    items: input.items,
    trackingUrl: input.trackingUrl,
    orderUrl: input.orderUrl ?? null,
    supportEmail: input.supportEmail ?? null,
    supportPhone: input.supportPhone ?? null,
  });

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
    replyTo: input.replyTo ?? undefined,
  });
}

type DeliveredEmailInput = {
  to: string;
  eventTitle: string;
  startsAt?: string | null;
  venue?: string | null;
  ticketUrl: string;
};

export async function sendEntitlementDeliveredEmail(input: DeliveredEmailInput) {
  assertEmailReady();
  const when = input.startsAt
    ? format(new Date(input.startsAt), "dd/MM/yyyy HH:mm")
    : null;
  const subject = `🎟️ Bilhete pronto – ${input.eventTitle}`;
  const text = `O teu bilhete para ${input.eventTitle} está pronto.
${when ? `Data: ${when}` : ""}
${input.venue ? `Local: ${input.venue}` : ""}
Ver na carteira: ${input.ticketUrl}
`;
  const html = `
    <div style="font-family: Arial,sans-serif; color:#0f172a;">
      <h2>Bilhete pronto – ${input.eventTitle}</h2>
      <p>Podes aceder ao QR e detalhes na tua carteira.</p>
      <ul>
        ${when ? `<li><strong>Data:</strong> ${when}</li>` : ""}
        ${input.venue ? `<li><strong>Local:</strong> ${input.venue}</li>` : ""}
      </ul>
      <p><a href="${input.ticketUrl}" style="color:#2563eb;font-weight:bold;">Abrir carteira</a></p>
    </div>
  `;
  return sendEmail({ to: input.to, subject, html, text });
}

type ClaimEmailInput = { to: string; eventTitle: string; ticketUrl: string };

export async function sendClaimEmail(input: ClaimEmailInput) {
  assertEmailReady();
  const subject = `✅ Claim concluído – ${input.eventTitle}`;
  const text = `Reassociação feita. Vê os teus bilhetes em ${input.ticketUrl}`;
  const html = `
    <div style="font-family: Arial,sans-serif; color:#0f172a;">
      <h2>Claim concluído</h2>
      <p>Os teus bilhetes para <strong>${input.eventTitle}</strong> estão agora na tua conta.</p>
      <p><a href="${input.ticketUrl}" style="color:#2563eb;font-weight:bold;">Abrir carteira</a></p>
    </div>
  `;
  return sendEmail({ to: input.to, subject, html, text });
}

type RefundEmailInput = {
  to: string;
  eventTitle: string;
  amountRefundedBaseCents?: number | null;
  reason?: string | null;
  ticketUrl?: string | null;
};

export async function sendRefundEmail(input: RefundEmailInput) {
  assertEmailReady();
  const subject = `💸 Refund processado – ${input.eventTitle}`;
  const amount =
    typeof input.amountRefundedBaseCents === "number"
      ? `${(input.amountRefundedBaseCents / 100).toFixed(2)} €`
      : "valor base";
  const reason = input.reason ? `Motivo: ${input.reason}` : "Refund aplicado conforme política.";
  const text = `O acesso foi bloqueado e o refund base foi processado.
${reason}
${input.ticketUrl ? `Ver estado: ${input.ticketUrl}` : ""}`;
  const html = `
    <div style="font-family: Arial,sans-serif; color:#0f172a;">
      <h2>Refund processado – ${input.eventTitle}</h2>
      <p>Valor reembolsado (base): <strong>${amount}</strong></p>
      <p>${reason}</p>
      ${input.ticketUrl ? `<p><a href="${input.ticketUrl}" style="color:#2563eb;font-weight:bold;">Ver estado na carteira</a></p>` : ""}
      <p style="font-size:12px;color:#6b7280;">Fees ORYA/Stripe não são reembolsáveis.</p>
    </div>
  `;
  return sendEmail({ to: input.to, subject, html, text });
}

type ImportantUpdateEmailInput = {
  to: string;
  eventTitle: string;
  message: string;
  ticketUrl?: string | null;
};

export async function sendImportantUpdateEmail(input: ImportantUpdateEmailInput) {
  assertEmailReady();
  const subject = `ℹ️ Atualização importante – ${input.eventTitle}`;
  const text = `${input.message}\n${input.ticketUrl ? `Detalhes: ${input.ticketUrl}` : ""}`;
  const html = `
    <div style="font-family: Arial,sans-serif; color:#0f172a;">
      <h2>Atualização – ${input.eventTitle}</h2>
      <p>${input.message}</p>
      ${input.ticketUrl ? `<p><a href="${input.ticketUrl}" style="color:#2563eb;font-weight:bold;">Ver detalhes</a></p>` : ""}
    </div>
  `;
  return sendEmail({ to: input.to, subject, html, text });
}

type BookingInviteEmailInput = {
  to: string;
  serviceTitle: string;
  organizationName: string;
  startsAt: string | Date | null;
  timeZone?: string | null;
  inviteUrl: string;
  inviterName?: string | null;
  guestName?: string | null;
  message?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value: string | Date | null, timeZone?: string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    }).format(date);
  } catch (err) {
    return date.toLocaleString("pt-PT", { dateStyle: "full", timeStyle: "short" });
  }
}

export async function sendBookingInviteEmail(input: BookingInviteEmailInput) {
  assertEmailReady();
  const serviceTitle = input.serviceTitle?.trim() || "Serviço";
  const organizationName = input.organizationName?.trim() || "Organização";
  const inviteUrl = input.inviteUrl;
  const dateLabel = formatDateTime(input.startsAt ?? null, input.timeZone);
  const guestNameRaw = input.guestName?.trim() || null;
  const inviterNameRaw = input.inviterName?.trim() || null;
  const messageRaw = input.message?.trim() || null;
  const guestName = guestNameRaw ? escapeHtml(guestNameRaw) : null;
  const inviterName = inviterNameRaw ? escapeHtml(inviterNameRaw) : null;
  const message = messageRaw ? escapeHtml(messageRaw) : null;

  const subject = `Convite para ${serviceTitle} – ${organizationName}`;
  const text = [
    guestNameRaw ? `Olá ${guestNameRaw},` : "Olá,",
    inviterNameRaw
      ? `${inviterNameRaw} convidou-te para uma reserva.`
      : "Tens um convite para uma reserva.",
    `${serviceTitle} · ${organizationName}`,
    dateLabel ? `Quando: ${dateLabel}` : null,
    messageRaw ? `Mensagem: ${messageRaw}` : null,
    `Responder: ${inviteUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial,sans-serif; color:#0f172a;">
      <h2>Convite para ${escapeHtml(serviceTitle)}</h2>
      <p>${guestName ? `Olá ${guestName},` : "Olá,"}</p>
      <p>
        ${inviterName ? `${inviterName} convidou-te` : "Foste convidado"} para uma reserva em
        <strong>${escapeHtml(organizationName)}</strong>.
      </p>
      <p><strong>${escapeHtml(serviceTitle)}</strong>${dateLabel ? ` · ${dateLabel}` : ""}</p>
      ${message ? `<p><em>Mensagem:</em> ${message}</p>` : ""}
      <p><a href="${inviteUrl}" style="color:#2563eb;font-weight:bold;">Responder ao convite</a></p>
    </div>
  `;

  return sendEmail({ to: input.to, subject, html, text });
}

type TournamentEmailInput = {
  to: string;
  eventTitle: string;
  scheduleHtml?: string;
  scheduleText?: string;
  ticketUrl?: string;
};

export async function sendTournamentScheduleEmail(input: TournamentEmailInput) {
  assertEmailReady();
  const { subject, html, text } = renderTournamentScheduleEmail({
    eventTitle: input.eventTitle,
    scheduleHtml: input.scheduleHtml,
    scheduleText: input.scheduleText,
    ticketUrl: input.ticketUrl,
  });

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}

type OwnerTransferEmailInput = {
  to: string;
  organizationName: string;
  actorName: string;
  token: string;
  expiresAt?: Date | null;
  organizationId?: number | null;
};

export async function sendOwnerTransferEmail(input: OwnerTransferEmailInput) {
  assertEmailReady();
  const baseUrl = getAppBaseUrl();
  const confirmPath = appendOrganizationIdToHref(
    `/organizacao/owner/confirm?token=${encodeURIComponent(input.token)}`,
    input.organizationId ?? null,
  );
  const confirmUrl = `${baseUrl}${confirmPath}`;
  const { subject, html, text } = renderOwnerTransferEmail({
    organizationName: input.organizationName,
    actorName: input.actorName,
    confirmUrl,
    expiresAt: input.expiresAt,
  });

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}

type OfficialEmailVerificationInput = {
  to: string;
  organizationName: string;
  token: string;
  pendingEmail: string;
  expiresAt?: Date | null;
  organizationId?: number | null;
};

export async function sendOfficialEmailVerificationEmail(input: OfficialEmailVerificationInput) {
  assertEmailReady();
  const baseUrl = getAppBaseUrl();
  const confirmPath = appendOrganizationIdToHref(
    `/organizacao/settings/verify?token=${encodeURIComponent(input.token)}`,
    input.organizationId ?? null,
  );
  const confirmUrl = `${baseUrl}${confirmPath}`;
  const { subject, html, text } = renderOfficialEmailVerificationEmail({
    organizationName: input.organizationName,
    confirmUrl,
    expiresAt: input.expiresAt,
    pendingEmail: input.pendingEmail,
  });

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}

type CrmCampaignEmailInput = {
  to: string;
  subject: string;
  organizationName: string;
  title: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  previewText?: string | null;
  replyTo?: string | null;
};

export async function sendCrmCampaignEmail(input: CrmCampaignEmailInput) {
  assertEmailReady();
  const { html, text } = renderCrmCampaignEmail({
    organizationName: input.organizationName,
    title: input.title,
    body: input.body,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    previewText: input.previewText,
  });

  return sendEmail({
    to: input.to,
    subject: input.subject,
    html,
    text,
    replyTo: input.replyTo ?? undefined,
  });
}
