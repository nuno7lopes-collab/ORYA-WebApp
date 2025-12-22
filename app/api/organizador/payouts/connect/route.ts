export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripeClient";
import { OrganizerMemberRole } from "@prisma/client";
import { isOrgOwner } from "@/lib/organizerPermissions";

const DEFAULT_BASE_URL = "http://localhost:3000";

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl?.startsWith("http")) return vercelUrl;
  if (vercelUrl) return `https://${vercelUrl}`;

  return DEFAULT_BASE_URL;
}

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 404 },
      );
    }

    const membership = await prisma.organizerMember.findFirst({
      where: { userId: profile.id, organizer: { status: "ACTIVE" } },
      include: { organizer: true },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    });

    if (!membership || !membership.organizer || !isOrgOwner(membership.role as OrganizerMemberRole)) {
      return NextResponse.json(
        { ok: false, error: "APENAS_OWNER" },
        { status: 403 },
      );
    }

    const organizer = membership.organizer;

    if (organizer.status !== "ACTIVE") {
      return NextResponse.json(
        {
          ok: false,
          error: "Conta de organizador ainda não está ativa.",
          status: organizer.status,
        },
        { status: 403 },
      );
    }

    let accountId = organizer.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "PT",
        email: user.email ?? undefined,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          organizerId: String(organizer.id),
          userId: profile.id,
        },
      });

      accountId = account.id;

      await prisma.organizer.update({
        where: { id: organizer.id },
        data: {
          stripeAccountId: accountId,
          stripeChargesEnabled: account.charges_enabled ?? false,
          stripePayoutsEnabled: account.payouts_enabled ?? false,
        },
      });
    }

    const baseUrl = getBaseUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/organizador?tab=analyze&section=financas&onboarding=refresh`,
      return_url: `${baseUrl}/organizador?tab=analyze&section=financas&onboarding=done`,
      type: "account_onboarding",
    });

    return NextResponse.json(
      {
        ok: true,
        url: link.url,
        accountId,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizador][payouts][connect] erro:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao gerar onboarding Stripe." },
      { status: 500 },
    );
  }
}
