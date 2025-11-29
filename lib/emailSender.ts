"use server";

import { sendEmail, assertResendReady } from "@/lib/resendClient";
import {
  renderPurchaseConfirmationEmail,
  renderTournamentScheduleEmail,
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
