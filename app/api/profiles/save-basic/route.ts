

// app/api/profiles/save-basic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

interface SaveBasicBody {
  fullName?: string;
  username?: string;
}

export async function POST(req: NextRequest) {
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

    const userId = user.id;

    const body = (await req.json().catch(() => null)) as SaveBasicBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const rawFullName = body.fullName ?? "";
    const rawUsername = body.username ?? "";

    const fullName = rawFullName.trim();
    const username = rawUsername.trim();

    const usernameValid = /^[A-Za-z]{1,16}$/.test(username);

    if (!fullName || !usernameValid) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nome completo e username são obrigatórios e o username só pode ter letras (até 16).",
        },
        { status: 400 }
      );
    }

    const usernameNormalized = username.toLowerCase();

    // Verificar se username já está em uso por outro utilizador
    const existing = await prisma.profile.findFirst({
      where: {
        username: usernameNormalized,
        NOT: { id: userId },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este username já está a ser utilizado.",
          code: "USERNAME_TAKEN",
        },
        { status: 409 }
      );
    }

    const profile = await prisma.profile.upsert({
      where: { id: userId },
      update: {
        fullName,
        username: usernameNormalized,
        onboardingDone: true,
      },
      create: {
        id: userId,
        fullName,
        username: usernameNormalized,
        onboardingDone: true,
        roles: ["user"],
      },
    });

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

    return NextResponse.json(
      {
        ok: true,
        profile: safeProfile,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/profiles/save-basic error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao guardar perfil.",
      },
      { status: 500 }
    );
  }
}
