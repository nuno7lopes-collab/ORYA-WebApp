export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";

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
    const validated = normalizeAndValidateUsername(usernameRaw);
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
    }
    const username = validated.username;

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "ADMIN"],
    });
    if (!organizer || !membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { ok: false, error: "Apenas Owner ou Admin podem alterar o username." },
        { status: 403 },
      );
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

    await prisma.$transaction(async (tx) => {
      await setUsernameForOwner({
        username,
        ownerType: "organizer",
        ownerId: organizer.id,
        tx,
      });
      await tx.organizer.update({
        where: { id: organizer.id },
        data: { username },
      });
    });

    return NextResponse.json({ ok: true, username }, { status: 200 });
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return NextResponse.json({ ok: false, error: "Este username já está a ser usado." }, { status: 409 });
    }
    console.error("[organizador/username][PATCH]", err);
    const isUnique = err instanceof Error && err.message.toLowerCase().includes("unique");
    const message = isUnique ? "Este username já está a ser usado." : "Erro ao atualizar username.";
    return NextResponse.json({ ok: false, error: message }, { status: isUnique ? 409 : 500 });
  }
}
