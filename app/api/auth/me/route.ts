// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import type { User } from "@supabase/supabase-js";

type SupabaseUserMetadata = {
  full_name?: string;
  name?: string;
  avatar_url?: string;
};

type ApiAuthMeResponse = {
  user: {
    id: string;
    email: string | null;
    emailConfirmed: boolean;
  } | null;
  profile: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    city: string | null;
    contactPhone: string | null;
    favouriteCategories: string[];
    onboardingDone: boolean;
    roles: string[];
    visibility: string;
    allowEmailNotifications: boolean;
    allowEventReminders: boolean;
    allowFriendRequests: boolean;
  } | null;
  needsEmailConfirmation?: boolean;
};

export async function GET() {
  try {
     const supabase = await createSupabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      // Sessão ausente ou inválida → 401 limpo (evita spam de logs)
      return NextResponse.json<ApiAuthMeResponse>(
        { user: null, profile: null },
        { status: 401 },
      );
    }

    const supaUser = user as User;
    const emailConfirmed =
      Boolean(supaUser.email_confirmed_at) ||
      Boolean((supaUser as { confirmed_at?: string | null })?.confirmed_at) ||
      false;

    const userMetadata = (user.user_metadata ?? {}) as SupabaseUserMetadata;

    const userId = user.id;

    // Garantir Profile 1-1 com auth.users
    let profile = await prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          id: userId,
          username: null,
          fullName: userMetadata.full_name ?? userMetadata.name ?? null,
          avatarUrl: userMetadata.avatar_url ?? null,
          roles: ["user"],
          visibility: "PUBLIC",
          allowEmailNotifications: true,
          allowEventReminders: true,
          allowFriendRequests: true,
        },
      });
    }

    const safeProfile = {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      city: profile.city,
      contactPhone: profile.contactPhone,
      favouriteCategories: profile.favouriteCategories,
      onboardingDone: profile.onboardingDone,
      roles: profile.roles,
      visibility: profile.visibility,
      allowEmailNotifications: profile.allowEmailNotifications,
      allowEventReminders: profile.allowEventReminders,
      allowFriendRequests: profile.allowFriendRequests,
    };

    // Se email não está confirmado, força o frontend a continuar em modo "verify"
    if (!emailConfirmed) {
      return NextResponse.json<ApiAuthMeResponse>(
        {
          user: {
            id: user.id,
            email: user.email ?? null,
            emailConfirmed,
          },
          profile: null,
          needsEmailConfirmation: true,
        },
        { status: 401 },
      );
    }

    return NextResponse.json<ApiAuthMeResponse>(
      {
        user: {
          id: user.id,
          email: user.email ?? null,
          emailConfirmed,
        },
        profile: safeProfile,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json<ApiAuthMeResponse>(
      { user: null, profile: null },
      { status: 200 }
    );
  }
}
