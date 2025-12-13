export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const usernameRaw = typeof body?.username === "string" ? body.username : "";
    const username = normalizeUsername(usernameRaw);

    if (!username || username.length < 3) {
      return NextResponse.json(
        { ok: false, error: "Escolhe um username com pelo menos 3 caracteres." },
        { status: 400 },
      );
    }
    const pattern = /^[a-z0-9_-]+$/;
    if (!pattern.test(username)) {
      return NextResponse.json(
        { ok: false, error: "Usa apenas letras minúsculas, números, - ou _." },
        { status: 400 },
      );
    }

    const { organizer } = await getActiveOrganizerForUser(user.id, { roles: ["OWNER", "CO_OWNER", "ADMIN"] });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Organizador não encontrado." }, { status: 403 });
    }

    const existingOrganizer = await prisma.organizer.findFirst({
      where: { username: { equals: username, mode: "insensitive" }, NOT: { id: organizer.id } },
      select: { id: true },
    });
    if (existingOrganizer) {
      return NextResponse.json({ ok: false, error: "Este username já está a ser usado." }, { status: 409 });
    }

    const existingProfile = await prisma.profile.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingProfile) {
      return NextResponse.json({ ok: false, error: "Este username já está a ser usado." }, { status: 409 });
    }

    await prisma.organizer.update({
      where: { id: organizer.id },
      data: { username },
    });

    return NextResponse.json({ ok: true, username }, { status: 200 });
  } catch (err) {
    console.error("[organizador/username][PATCH]", err);
    const isUnique = err instanceof Error && err.message.toLowerCase().includes("unique");
    const message = isUnique ? "Este username já está a ser usado." : "Erro ao atualizar username.";
    return NextResponse.json({ ok: false, error: message }, { status: isUnique ? 409 : 500 });
  }
}
