export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { constructStripeWebhookEvent } from "@/domain/finance/gateway/stripeGateway";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk, respondPlainText } from "@/lib/http/envelope";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { getStripePayoutsWebhookSecret } from "@/lib/stripeKeys";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const webhookSecret = getStripePayoutsWebhookSecret();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return respondPlainText(ctx, "Missing signature", { status: 400 });
  }

  if (!webhookSecret) {
    logError("stripe.connect.webhook.missing_secret", null, { requestId: ctx.requestId });
    return respondPlainText(ctx, "Server misconfigured", { status: 500 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(body, sig, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown signature validation error";
    logWarn("stripe.connect.webhook.invalid_signature", { requestId: ctx.requestId, message });
    return respondPlainText(ctx, "Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const organizationIdRaw = account.metadata?.organizationId;
        const organizationIdNumber =
          organizationIdRaw && Number.isFinite(Number(organizationIdRaw))
            ? Number(organizationIdRaw)
            : null;

        const chargesEnabled = Boolean(account.charges_enabled);
        const payoutsEnabled = Boolean(account.payouts_enabled);

        const mappedOrganization = organizationIdNumber
          ? await prisma.organization.findUnique({
              where: { id: organizationIdNumber },
              select: { id: true, stripeAccountId: true },
            })
          : await prisma.organization.findFirst({
              where: { stripeAccountId: account.id },
              select: { id: true, stripeAccountId: true },
            });

        if (!mappedOrganization) {
          logError("stripe.connect.webhook.organization_not_found", null, {
            requestId: ctx.requestId,
            organizationId: organizationIdNumber,
            accountId: account.id,
          });
          return respondPlainText(ctx, "Organization mapping not found", { status: 422 });
        }

        if (
          organizationIdNumber &&
          mappedOrganization.stripeAccountId &&
          mappedOrganization.stripeAccountId !== account.id
        ) {
          logError("stripe.connect.webhook.account_mismatch", null, {
            requestId: ctx.requestId,
            organizationId: mappedOrganization.id,
            accountId: account.id,
            mappedAccountId: mappedOrganization.stripeAccountId,
          });
          return respondPlainText(ctx, "Account mapping mismatch", { status: 409 });
        }

        const updated = await prisma.organization.updateMany({
          where: { id: mappedOrganization.id },
          data: {
            stripeChargesEnabled: chargesEnabled,
            stripePayoutsEnabled: payoutsEnabled,
            stripeAccountId: account.id,
          },
        });
        if (updated.count !== 1) {
          logError("stripe.connect.webhook.update_failed", null, {
            requestId: ctx.requestId,
            organizationId: mappedOrganization.id,
            accountId: account.id,
            updateCount: updated.count,
          });
          return respondPlainText(ctx, "Organization update failed", { status: 500 });
        }

        logInfo("stripe.connect.webhook.account_updated", {
          requestId: ctx.requestId,
          organizationId: mappedOrganization.id,
          accountId: account.id,
          chargesEnabled,
          payoutsEnabled,
        });
        break;
      }

      default:
        logInfo("stripe.connect.webhook.event_ignored", {
          requestId: ctx.requestId,
          eventType: event.type,
        });
        break;
    }
  } catch (err) {
    logError("stripe.connect.webhook.processing_failed", err, { requestId: ctx.requestId });
    return respondPlainText(ctx, "Webhook processing failed", { status: 500 });
  }

  return respondOk(ctx, { received: true }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
