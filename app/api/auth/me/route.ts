// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

type SupabaseUserMetadata = {
  full_name?: string;
  name?: string;
  avatar_url?: string;
};

type ApiAuthMeResponse = {
  user: {
    id: string;
    email: string | null;
  } | null;
  profile: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    city: string | null;
    favouriteCategories: string[];
    onboardingDone: boolean;
    roles: string[];
  } | null;
};

export async function GET() {
  try {
     const supabase = await createSupabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("auth.getUser error:", error);
      return NextResponse.json<ApiAuthMeResponse>({ user: null, profile: null }, { status: 200 });
    }

    if (!user) {
      return NextResponse.json<ApiAuthMeResponse>({ user: null, profile: null }, { status: 200 });
    }

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
      favouriteCategories: profile.favouriteCategories,
      onboardingDone: profile.onboardingDone,
      roles: profile.roles,
    };

    return NextResponse.json<ApiAuthMeResponse>(
      {
       user: {
  id: user.id,
  email: user.email ?? null,
},
        profile: safeProfile,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json<ApiAuthMeResponse>(
      { user: null, profile: null },
      { status: 200 }
    );
  }
}