"use server";

import { sendEmail, assertResendReady } from "@/lib/resendClient";
import {
  renderPurchaseConfirmationEmail,
  renderTournamentScheduleEmail,
  renderOwnerTransferEmail,
  renderOfficialEmailVerificationEmail,
} from "@/lib/emailTemplates";

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
