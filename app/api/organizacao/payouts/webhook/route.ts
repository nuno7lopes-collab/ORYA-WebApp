export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { constructStripeWebhookEvent } from "@/domain/finance/gateway/stripeGateway";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk, respondPlainText } from "@/lib/http/envelope";

const webhookSecret =
  process.env.STRIPE_PAYOUTS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
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

        await prisma.organization.updateMany({
          where: organizationIdNumber
            ? { id: organizationIdNumber }
            : { stripeAccountId: account.id },
          data: {
            stripeChargesEnabled: chargesEnabled,
            stripePayoutsEnabled: payoutsEnabled,
            stripeAccountId: account.id,
          },
        });

        console.log("[Stripe Connect Webhook] account.updated sync", {
          organizationId: organizationIdNumber,
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
  }

  return respondOk(ctx, { received: true }, { status: 200 });
}
