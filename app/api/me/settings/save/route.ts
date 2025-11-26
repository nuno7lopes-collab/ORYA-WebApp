import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

type Body = {
  visibility?: "PUBLIC" | "PRIVATE";
  allowEmailNotifications?: boolean;
  allowEventReminders?: boolean;
  allowFriendRequests?: boolean;
};

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
    }

    const visibility = body.visibility;
    if (visibility && visibility !== "PUBLIC" && visibility !== "PRIVATE") {
      return NextResponse.json({ ok: false, error: "Visibilidade inválida." }, { status: 400 });
    }

    const dataToUpdate: Record<string, unknown> = {};
    if (visibility) dataToUpdate.visibility = visibility;
    if (typeof body.allowEmailNotifications === "boolean") {
      dataToUpdate.allowEmailNotifications = body.allowEmailNotifications;
    }
    if (typeof body.allowEventReminders === "boolean") {
      dataToUpdate.allowEventReminders = body.allowEventReminders;
    }
    if (typeof body.allowFriendRequests === "boolean") {
      dataToUpdate.allowFriendRequests = body.allowFriendRequests;
    }

    const profile = await prisma.profile.upsert({
      where: { id: user.id },
      update: dataToUpdate,
      create: {
        id: user.id,
        roles: ["user"],
        favouriteCategories: [],
        onboardingDone: false,
        visibility: dataToUpdate.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
        allowEmailNotifications: Boolean(dataToUpdate.allowEmailNotifications ?? true),
        allowEventReminders: Boolean(dataToUpdate.allowEventReminders ?? true),
        allowFriendRequests: Boolean(dataToUpdate.allowFriendRequests ?? true),
      },
    });

    return NextResponse.json({
      ok: true,
      profile: {
        visibility: profile.visibility,
        allowEmailNotifications: profile.allowEmailNotifications,
        allowEventReminders: profile.allowEventReminders,
        allowFriendRequests: profile.allowFriendRequests,
      },
    });
  } catch (err) {
    console.error("[settings/save] erro:", err);
    return NextResponse.json({ ok: false, error: "Erro a guardar definições." }, { status: 500 });
  }
}
