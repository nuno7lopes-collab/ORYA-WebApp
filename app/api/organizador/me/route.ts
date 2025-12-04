

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getPlatformFees } from "@/lib/platformSettings";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Não autenticado.",
          profile: null,
          organizer: null,
        },
        { status: 401 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });
    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error: "Perfil não encontrado.",
          profile: null,
          organizer: null,
        },
        { status: 404 }
      );
    }

    const organizer = await prisma.organizer.findFirst({
      where: { userId: profile.id },
    });
    const platformFees = await getPlatformFees();

    const profilePayload = {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      city: profile.city,
      favouriteCategories: profile.favouriteCategories,
      onboardingDone: profile.onboardingDone,
      roles: profile.roles,
    };

    const organizerPayload = organizer
      ? {
          id: organizer.id,
          displayName: organizer.displayName,
          stripeAccountId: organizer.stripeAccountId,
          status: organizer.status,
          stripeChargesEnabled: organizer.stripeChargesEnabled,
          stripePayoutsEnabled: organizer.stripePayoutsEnabled,
          feeMode: organizer.feeMode,
          platformFeeBps: organizer.platformFeeBps,
          platformFeeFixedCents: organizer.platformFeeFixedCents,
          businessName: organizer.businessName,
          entityType: organizer.entityType,
          city: organizer.city,
          payoutIban: organizer.payoutIban,
        }
      : null;

    const profileStatus =
      organizer &&
      organizer.businessName &&
      organizer.entityType &&
      organizer.city &&
      user.email
        ? "OK"
        : "MISSING_CONTACT";
    const paymentsStatus = organizer
      ? organizer.stripeAccountId
        ? organizer.stripeChargesEnabled && organizer.stripePayoutsEnabled
          ? "READY"
          : "PENDING"
        : "NO_STRIPE"
      : "NO_STRIPE";

    return NextResponse.json(
      {
        ok: true,
        profile: profilePayload,
        organizer: organizerPayload,
        platformFees,
        contactEmail: user.email,
        profileStatus,
        paymentsStatus,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/organizador/me error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno.",
        profile: null,
        organizer: null,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user || error) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
    }

    const { displayName, businessName, entityType, city, payoutIban, fullName, contactPhone } = body as Record<string, unknown>;

    const profileUpdates: Record<string, unknown> = {};
    if (typeof fullName === "string") profileUpdates.fullName = fullName.trim() || null;
    if (typeof city === "string") profileUpdates.city = city.trim() || null;
    if (typeof contactPhone === "string") profileUpdates.contactPhone = contactPhone.trim() || null;

    const organizerUpdates: Record<string, unknown> = {};
    if (typeof displayName === "string") organizerUpdates.displayName = displayName.trim() || null;
    if (typeof businessName === "string") organizerUpdates.businessName = businessName.trim() || null;
    if (typeof entityType === "string") organizerUpdates.entityType = entityType.trim() || null;
    if (typeof city === "string") organizerUpdates.city = city.trim() || null;
    if (typeof payoutIban === "string") organizerUpdates.payoutIban = payoutIban.trim() || null;

    // Garantir que existe organizer
    const organizer = await prisma.organizer.findFirst({
      where: { userId: user.id },
    });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Ainda não és organizador." }, { status: 403 });
    }

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.profile.update({
        where: { id: user.id },
        data: profileUpdates,
      });
    }

    if (Object.keys(organizerUpdates).length > 0) {
      await prisma.organizer.update({
        where: { id: organizer.id },
        data: organizerUpdates,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/organizador/me error:", err);
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
