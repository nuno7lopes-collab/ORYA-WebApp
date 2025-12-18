"use server";

import { sendEmail, assertResendReady } from "@/lib/resendClient";
import {
  renderPurchaseConfirmationEmail,
  renderTournamentScheduleEmail,
  renderOwnerTransferEmail,
  renderOfficialEmailVerificationEmail,
} from "@/lib/emailTemplates";
import { format } from "date-fns";

type PurchaseEmailInput = {
  to: string;
  eventTitle: string;
  eventSlug: string;
  startsAt?: string | null;
  endsAt?: string | null;
  locationName?: string | null;
  ticketsCount: number;
  ticketUrl: string;
};

export async function sendPurchaseConfirmationEmail(input: PurchaseEmailInput) {
  assertResendReady();
  const { subject, html, text } = renderPurchaseConfirmationEmail({
    eventTitle: input.eventTitle,
    eventSlug: input.eventSlug,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    locationName: input.locationName,
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

type DeliveredEmailInput = {
  to: string;
  eventTitle: string;
  startsAt?: string | null;
  venue?: string | null;
  ticketUrl: string;
};

export async function sendEntitlementDeliveredEmail(input: DeliveredEmailInput) {
  assertResendReady();
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
  assertResendReady();
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
  assertResendReady();
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
  assertResendReady();
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

type TournamentEmailInput = {
  to: string;
  eventTitle: string;
  scheduleHtml?: string;
  scheduleText?: string;
  ticketUrl?: string;
};

export async function sendTournamentScheduleEmail(input: TournamentEmailInput) {
  assertResendReady();
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

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://orya.pt"
  );
}

type OwnerTransferEmailInput = {
  to: string;
  organizerName: string;
  actorName: string;
  token: string;
  expiresAt?: Date | null;
};

export async function sendOwnerTransferEmail(input: OwnerTransferEmailInput) {
  assertResendReady();
  const baseUrl = getAppBaseUrl();
  const confirmUrl = `${baseUrl}/organizador/owner/confirm?token=${encodeURIComponent(input.token)}`;
  const { subject, html, text } = renderOwnerTransferEmail({
    organizerName: input.organizerName,
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
  organizerName: string;
  token: string;
  pendingEmail: string;
  expiresAt?: Date | null;
};

export async function sendOfficialEmailVerificationEmail(input: OfficialEmailVerificationInput) {
  assertResendReady();
  const baseUrl = getAppBaseUrl();
  const confirmUrl = `${baseUrl}/organizador/settings/verify?token=${encodeURIComponent(input.token)}`;
  const { subject, html, text } = renderOfficialEmailVerificationEmail({
    organizerName: input.organizerName,
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
