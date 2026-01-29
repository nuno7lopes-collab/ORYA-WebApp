export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import {
  createAccountLink,
  createStripeAccount,
} from "@/domain/finance/gateway/stripeGateway";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { requireOfficialEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";

export async function POST(req: NextRequest) {
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
        { errorCode: "UNAUTHENTICATED", message: "Não autenticado.", retryable: false },
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return respondError(
        ctx,
        { errorCode: "PROFILE_NOT_FOUND", message: "Perfil não encontrado.", retryable: false },
        { status: 404 },
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER"],
    });

    if (!organization || !membership) {
      return respondError(
        ctx,
        { errorCode: "APENAS_OWNER", message: "Apenas owner.", retryable: false },
        { status: 403 },
      );
    }

    const emailGate = await requireOfficialEmailVerified({
      organizationId: organization.id,
      organization,
      reasonCode: "PAYOUTS_CONNECT",
      actorUserId: profile.id,
    });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "OFFICIAL_EMAIL_REQUIRED",
          message: emailGate.message ?? "Email oficial obrigatório.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    if (organization.status !== "ACTIVE") {
      return respondError(
        ctx,
        {
          errorCode: "ORGANIZATION_NOT_ACTIVE",
          message: "Conta de organização ainda não está ativa.",
          retryable: false,
          details: { status: organization.status },
        },
        { status: 403 },
      );
    }

    if (organization.orgType === "PLATFORM") {
      return respondError(
        ctx,
        {
          errorCode: "PLATFORM_ACCOUNT",
          message: "Esta organização recebe pagamentos na conta ORYA, sem Stripe Connect.",
          retryable: false,
        },
        { status: 409 },
      );
    }

    let accountId = organization.stripeAccountId;

    if (!accountId) {
      const account = await createStripeAccount({
        type: "express",
        country: "PT",
        email: user.email ?? undefined,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          organizationId: String(organization.id),
          userId: profile.id,
        },
      });

      accountId = account.id;

      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          stripeAccountId: accountId,
          stripeChargesEnabled: account.charges_enabled ?? false,
          stripePayoutsEnabled: account.payouts_enabled ?? false,
        },
      });
    }

    const baseUrl = getAppBaseUrl();
    const link = await createAccountLink({
      account: accountId,
      refresh_url: `${baseUrl}/organizacao?tab=analyze&section=financas&onboarding=refresh`,
      return_url: `${baseUrl}/organizacao?tab=analyze&section=financas&onboarding=done`,
      type: "account_onboarding",
    });

    return respondOk(
      ctx,
      {
        url: link.url,
        accountId,
      },
      { status: 200 },
    );
  } catch (err) {
    logError("payouts.connect.error", err, { requestId: ctx.requestId });
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro ao gerar onboarding Stripe.", retryable: true },
      { status: 500 },
    );
  }
}
