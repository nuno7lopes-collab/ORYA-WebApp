export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { constructStripeWebhookEvent } from "@/domain/finance/gateway/stripeGateway";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondPlainText } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { jsonWrap } from "@/lib/api/wrapResponse";

const webhookSecret =
  process.env.STRIPE_PAYOUTS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return respondPlainText(ctx, "Missing signature", { status: 400 });
  }

  if (!webhookSecret) {
    console.error("[Stripe Connect Webhook] Missing webhook secret env");
    return respondPlainText(ctx, "Server misconfigured", { status: 500 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(body, sig, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown signature validation error";
    console.error("[Stripe Connect Webhook] Invalid signature:", message);
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

        const organization = await prisma.organization.findFirst({
          where: organizationIdNumber
            ? { id: organizationIdNumber }
            : { stripeAccountId: account.id },
          select: { id: true },
        });
        if (!organization) {
          return respondPlainText(ctx, "ORG_NOT_RESOLVED", { status: 422 });
        }

        await prisma.organization.update({
          where: { id: organization.id },
          data: {
            stripeChargesEnabled: chargesEnabled,
            stripePayoutsEnabled: payoutsEnabled,
            stripeAccountId: account.id,
          },
        });

        console.log("[Stripe Connect Webhook] account.updated sync", {
          organizationId: organization.id,
          accountId: account.id,
          chargesEnabled,
          payoutsEnabled,
        });
        break;
      }

      default:
        console.log(
          "[Stripe Connect Webhook] Event ignorado:",
          event.type,
        );
        break;
    }
  } catch (err) {
    console.error("[Stripe Connect Webhook] Error processing event:", err);
    return respondPlainText(ctx, "WEBHOOK_PROCESSING_ERROR", { status: 500 });
  }

  return jsonWrap({ ok: true, received: true }, { status: 200, req });
}
export const POST = withApiEnvelope(_POST);
