

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

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
        }
      : null;

    return NextResponse.json(
      {
        ok: true,
        profile: profilePayload,
        organizer: organizerPayload,
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