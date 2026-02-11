export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { retrieveStripeAccount } from "@/domain/finance/gateway/stripeGateway";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { listEffectiveOrganizationMemberUserIdsByRoles } from "@/lib/organizationMembers";
import { NotificationType } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError, logInfo } from "@/lib/observability/logger";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return respondError(
        ctx,
        { errorCode: "UNAUTHENTICATED", message: "Sessão inválida.", retryable: false },
        { status: 401 },
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership || membership.role !== "OWNER") {
      return respondError(
        ctx,
        { errorCode: "APENAS_OWNER", message: "Apenas owner.", retryable: false },
        { status: 403 },
      );
    }

    if (organization.orgType === "PLATFORM") {
      return respondOk(ctx, {
        status: "PLATFORM",
        charges_enabled: false,
        payouts_enabled: false,
        requirements_due: [],
      });
    }

    if (!organization.stripeAccountId) {
      logInfo("stripe.status.no_account", { requestId: ctx.requestId, organizationId: organization.id });
      return respondOk(ctx, {
        status: "NOT_CONNECTED",
        charges_enabled: false,
        payouts_enabled: false,
        requirements_due: [],
      });
    }

    const account = await retrieveStripeAccount(organization.stripeAccountId);

    const charges_enabled = account.charges_enabled ?? false;
    const payouts_enabled = account.payouts_enabled ?? false;
    const requirements_due = account.requirements?.currently_due ?? [];

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        stripeAccountId: account.id,
        stripeChargesEnabled: charges_enabled,
        stripePayoutsEnabled: payouts_enabled,
      },
    });

    const status =
      charges_enabled && payouts_enabled && (!requirements_due || requirements_due.length === 0)
        ? "CONNECTED"
        : "INCOMPLETE";

    logInfo("stripe.status.refreshed", {
      requestId: ctx.requestId,
      organizationId: organization.id,
      accountId: account.id,
      charges_enabled,
      payouts_enabled,
      requirements_due,
    });

    // Notificar owner/admin se estado mudou para attention
    if (status === "INCOMPLETE" && requirements_due && requirements_due.length > 0) {
      const statusFingerprint = [
        account.id,
        charges_enabled ? "1" : "0",
        payouts_enabled ? "1" : "0",
        [...requirements_due].sort().join(","),
      ].join("|");
      const recipients = await listEffectiveOrganizationMemberUserIdsByRoles({
        organizationId: organization.id,
        roles: ["OWNER", "CO_OWNER", "ADMIN"],
      });
      const financeHref = appendOrganizationIdToHref("/organizacao/analyze?section=financas", organization.id);
      await Promise.all(
        recipients.map(async (uid) => {
          if (!(await shouldNotify(uid, NotificationType.STRIPE_STATUS))) return;
          await createNotification({
            userId: uid,
            type: NotificationType.STRIPE_STATUS,
            title: "Stripe precisa de atenção",
            body: "Faltam dados no Stripe para ativar pagamentos/payouts.",
            ctaUrl: financeHref,
            ctaLabel: "Rever Stripe",
            organizationId: organization.id,
            dedupeKey: `notification:STRIPE_STATUS:${uid}:${organization.id}:${statusFingerprint}`,
            payload: { requirements_due },
          });
        }),
      );
    }

    return respondOk(ctx, {
      status,
      charges_enabled,
      payouts_enabled,
      requirements_due,
      accountId: account.id,
    });
  } catch (err) {
    logError("stripe.status.error", err, { requestId: ctx.requestId });
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
