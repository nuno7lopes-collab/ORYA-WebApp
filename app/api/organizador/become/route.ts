

// app/api/organizador/become/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

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
        { status: 401 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 }
      );
    }

    // Procurar organizer existente para este user
    let organizer = await prisma.organizer.findFirst({
      where: { userId: profile.id },
    });

    if (!organizer) {
      const displayName =
        profile.fullName?.trim() || profile.username || "Organizador";

      organizer = await prisma.organizer.create({
        data: {
          userId: profile.id,
          displayName,
          status: "ACTIVE",
        },
      });
    }

    // Garantir que o role "organizer" está presente no profile
    const currentRoles = profile.roles ?? [];
    const hasOrganizerRole = currentRoles.includes("organizer");

    let updatedProfile = profile;

    if (!hasOrganizerRole) {
      updatedProfile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          roles: [...currentRoles, "organizer"],
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        profile: {
          id: updatedProfile.id,
          username: updatedProfile.username,
          fullName: updatedProfile.fullName,
          avatarUrl: updatedProfile.avatarUrl,
          bio: updatedProfile.bio,
          city: updatedProfile.city,
          favouriteCategories: updatedProfile.favouriteCategories,
          onboardingDone: updatedProfile.onboardingDone,
          roles: updatedProfile.roles,
        },
        organizer: {
          id: organizer.id,
          displayName: organizer.displayName,
          status: organizer.status,
          stripeAccountId: organizer.stripeAccountId,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao tornar organizador." },
      { status: 500 }
    );
  }
}