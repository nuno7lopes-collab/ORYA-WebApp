export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripeClient";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { isOrgOwner } from "@/lib/organizationPermissions";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership || !isOrgOwner(membership.role)) {
      return NextResponse.json({ ok: false, error: "APENAS_OWNER" }, { status: 403 });
    }

    if (organization.orgType === "PLATFORM") {
      return NextResponse.json({
        ok: true,
        status: "PLATFORM",
        charges_enabled: false,
        payouts_enabled: false,
        requirements_due: [],
      });
    }

    if (!organization.stripeAccountId) {
      console.log("[stripe][status] no account", { organizationId: organization.id });
      return NextResponse.json({
        ok: true,
        status: "NOT_CONNECTED",
        charges_enabled: false,
        payouts_enabled: false,
        requirements_due: [],
      });
    }

    const account = await stripe.accounts.retrieve(organization.stripeAccountId);

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

    console.log("[stripe][status] refreshed", {
      organizationId: organization.id,
      accountId: account.id,
      charges_enabled,
      payouts_enabled,
      requirements_due,
    });

    // Notificar owner/admin se estado mudou para attention
    if (status === "INCOMPLETE" && requirements_due && requirements_due.length > 0) {
      const owners = await prisma.organizationMember.findMany({
        where: { organizationId: organization.id, role: { in: ["OWNER", "CO_OWNER", "ADMIN"] } },
        select: { userId: true },
      });
      const uniq = Array.from(new Set(owners.map((o) => o.userId)));
      await Promise.all(
        uniq.map(async (uid) => {
          if (!(await shouldNotify(uid, NotificationType.STRIPE_STATUS))) return;
          await createNotification({
            userId: uid,
            type: NotificationType.STRIPE_STATUS,
            title: "Stripe precisa de atenção",
            body: "Faltam dados no Stripe para ativar pagamentos/payouts.",
            ctaUrl: "/organizacao?tab=analyze&section=financas",
            ctaLabel: "Rever Stripe",
            payload: { requirements_due },
          });
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      status,
      charges_enabled,
      payouts_enabled,
      requirements_due,
      accountId: account.id,
    });
  } catch (err) {
    console.error("[stripe][status] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
