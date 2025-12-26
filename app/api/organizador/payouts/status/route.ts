export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripeClient";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { isOrgOwner } from "@/lib/organizerPermissions";
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

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
    });

    if (!organizer || !membership || !isOrgOwner(membership.role)) {
      return NextResponse.json({ ok: false, error: "APENAS_OWNER" }, { status: 403 });
    }

    if (!organizer.stripeAccountId) {
      console.log("[stripe][status] no account", { organizerId: organizer.id });
      return NextResponse.json({
        ok: true,
        status: "NOT_CONNECTED",
        charges_enabled: false,
        payouts_enabled: false,
        requirements_due: [],
      });
    }

    const account = await stripe.accounts.retrieve(organizer.stripeAccountId);

    const charges_enabled = account.charges_enabled ?? false;
    const payouts_enabled = account.payouts_enabled ?? false;
    const requirements_due = account.requirements?.currently_due ?? [];

    await prisma.organizer.update({
      where: { id: organizer.id },
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
      organizerId: organizer.id,
      accountId: account.id,
      charges_enabled,
      payouts_enabled,
      requirements_due,
    });

    // Notificar owner/admin se estado mudou para attention
    if (status === "INCOMPLETE" && requirements_due && requirements_due.length > 0) {
      const owners = await prisma.organizerMember.findMany({
        where: { organizerId: organizer.id, role: { in: ["OWNER", "CO_OWNER", "ADMIN"] } },
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
            ctaUrl: "/organizador?tab=analyze&section=financas",
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
