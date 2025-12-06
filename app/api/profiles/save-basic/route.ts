

// app/api/profiles/save-basic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { setUsernameForOwner, UsernameTakenError, normalizeAndValidateUsername } from "@/lib/globalUsernames";

interface SaveBasicBody {
  fullName?: string;
  username?: string;
  contactPhone?: string | null;
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
    const rawPhone = body.contactPhone;

    const fullName = rawFullName.trim();
    const username = rawUsername.trim();

    let normalizedPhone: string | null | undefined = undefined;
    if (rawPhone !== undefined) {
      if (rawPhone === null || rawPhone === "") {
        normalizedPhone = null;
      } else if (typeof rawPhone === "string") {
        const parsed = parsePhoneNumberFromString(rawPhone.trim(), "PT");
        if (parsed && parsed.isPossible()) {
          normalizedPhone = parsed.number; // E.164
        } else {
          return NextResponse.json(
            { ok: false, error: "Telefone inválido." },
            { status: 400 },
          );
        }
      }
    }

    const validatedUsername = normalizeAndValidateUsername(username);

    if (!fullName || !validatedUsername.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            validatedUsername.ok
              ? "Nome completo e username são obrigatórios."
              : validatedUsername.error,
        },
        { status: 400 }
      );
    }

    const usernameNormalized = validatedUsername.username;

    const profile = await prisma.$transaction(async (tx) => {
      await setUsernameForOwner({
        username: usernameNormalized,
        ownerType: "user",
        ownerId: userId,
        tx,
      });

      return tx.profile.upsert({
        where: { id: userId },
        update: {
          fullName,
          username: usernameNormalized,
          onboardingDone: true,
          ...(normalizedPhone !== undefined ? { contactPhone: normalizedPhone } : {}),
        },
        create: {
          id: userId,
          fullName,
          username: usernameNormalized,
          onboardingDone: true,
          roles: ["user"],
          contactPhone: normalizedPhone ?? null,
        },
      });
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
    if (err instanceof UsernameTakenError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este username já está a ser utilizado.",
          code: "USERNAME_TAKEN",
        },
        { status: 409 },
      );
    }
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
