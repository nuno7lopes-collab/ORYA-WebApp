export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  createAccountLink,
  createStripeAccount,
} from "@/domain/finance/gateway/stripeGateway";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { isOrgOwner } from "@/lib/organizationPermissions";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return jsonWrap(
        { ok: false, error: "Perfil não encontrado." },
        { status: 404 },
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER"],
    });

    if (!organization || !membership || !hasOrgOwnerAccess(membership.role)) {
      return jsonWrap(
        { ok: false, error: "APENAS_OWNER" },
        { status: 403 },
      );
    }

    if (organization.status !== "ACTIVE") {
      return jsonWrap(
        {
          ok: false,
          error: "Conta de organização ainda não está ativa.",
          status: organization.status,
        },
        { status: 403 },
      );
    }

    if (organization.orgType === "PLATFORM") {
      return jsonWrap(
        {
          ok: false,
          error: "PLATFORM_ACCOUNT",
          message: "Esta organização recebe pagamentos na conta ORYA, sem Stripe Connect.",
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

    return jsonWrap(
      {
        ok: true,
        url: link.url,
        accountId,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização][payouts][connect] erro:", err);
    return jsonWrap(
      { ok: false, error: "Erro ao gerar onboarding Stripe." },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);