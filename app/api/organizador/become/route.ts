

// app/api/organizador/become/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";

type OrganizerPayload = {
  entityType?: string | null;
  businessName?: string | null;
  city?: string | null;
  payoutIban?: string | null;
  username?: string | null;
};

function sanitizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 },
      );
    }

    const { organizer: activeOrganizer } = await getActiveOrganizerForUser(profile.id);
    const fallbackOrganizer = activeOrganizer ?? null;

    return NextResponse.json(
      {
        ok: true,
        organizer: fallbackOrganizer
          ? {
              id: fallbackOrganizer.id,
              displayName: fallbackOrganizer.displayName,
              status: fallbackOrganizer.status,
              stripeAccountId: fallbackOrganizer.stripeAccountId,
              entityType: fallbackOrganizer.entityType,
              businessName: fallbackOrganizer.businessName,
              city: fallbackOrganizer.city,
              payoutIban: fallbackOrganizer.payoutIban,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao obter organizador." },
      { status: 500 },
    );
  }
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
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 },
      );
    }

    // Corpo opcional com dados de onboarding
    let payload: OrganizerPayload = {};
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await req.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = await req.formData();
        payload = {
          entityType: form.get("entityType") as string | null,
          businessName: form.get("businessName") as string | null,
          city: form.get("city") as string | null,
          payoutIban: form.get("payoutIban") as string | null,
          username: form.get("username") as string | null,
        };
      }
    } catch {
      /* ignora parsing */
    }

    const entityType = sanitizeString(payload.entityType);
    const businessName = sanitizeString(payload.businessName);
    const city = sanitizeString(payload.city);
    const payoutIban = sanitizeString(payload.payoutIban);
    const usernameRaw = sanitizeString(payload.username);

    // Procurar organizer existente para este user (por membership ou campo legacy)
    const { organizer: activeOrganizer } = await getActiveOrganizerForUser(profile.id);
    let organizer = activeOrganizer ?? null;

    const displayName =
      businessName ||
      profile.fullName?.trim() ||
      profile.username ||
      "Organizador";

    const usernameCandidate = usernameRaw ?? organizer?.username ?? null;
    const validatedUsername = usernameCandidate
      ? normalizeAndValidateUsername(usernameCandidate)
      : { ok: false as const, error: "Escolhe um username ORYA para a organização." };

    if (!validatedUsername.ok) {
      return NextResponse.json({ ok: false, error: validatedUsername.error }, { status: 400 });
    }

    const username = validatedUsername.username;

    organizer = await prisma.$transaction(async (tx) => {
      async function upsertOrganizer(includePublicName: boolean) {
        if (organizer) {
          return tx.organizer.update({
            where: { id: organizer!.id },
            data: {
              status: "ACTIVE",
              displayName,
              ...(includePublicName ? { publicName: displayName } : {}),
              entityType,
              businessName,
              city,
              payoutIban,
              username,
            },
          });
        }
        return tx.organizer.create({
          data: {
            // userId fica como legacy "created_by" histórico
            userId: profile.id,
            displayName,
            ...(includePublicName ? { publicName: displayName } : {}),
            status: "ACTIVE", // self-serve aberto
            entityType,
            businessName,
            city,
            payoutIban,
            username,
          },
        });
      }

      const nextOrganizer = organizer
        ? await upsertOrganizer(true).catch((err) => {
            const code = (err as { code?: string })?.code;
            const message = err instanceof Error ? err.message : "";
            const missingColumn = code === "P2022" && message.toLowerCase().includes("public_name");
            if (!missingColumn) throw err;
            return upsertOrganizer(false);
          })
        : await upsertOrganizer(true).catch((err) => {
            const code = (err as { code?: string })?.code;
            const message = err instanceof Error ? err.message : "";
            const missingColumn = code === "P2022" && message.toLowerCase().includes("public_name");
            if (!missingColumn) throw err;
            return upsertOrganizer(false);
          });

      return nextOrganizer;
    });

    // Garante membership OWNER para o utilizador
    try {
      await prisma.organizerMember.upsert({
        where: {
          organizerId_userId: {
            organizerId: organizer.id,
            userId: profile.id,
          },
        },
        update: { role: "OWNER" },
        create: {
          organizerId: organizer.id,
          userId: profile.id,
          role: "OWNER",
        },
      });
    } catch (err: unknown) {
      if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
        console.warn("[organizador/become] organizer_members table missing; created organizer without membership");
      } else {
        throw err;
      }
    }

    // Reservar username global fora da transação para não abortar criação
    try {
      await setUsernameForOwner({
        username,
        ownerType: "organizer",
        ownerId: organizer.id,
      });
    } catch (err) {
      if (err instanceof UsernameTakenError) {
        return NextResponse.json(
          { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
          { status: 409 },
        );
      }
      console.warn("[organizador/become] username global falhou (ignorado)", err);
    }

    // Garante que o perfil tem role de organizer
    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    if (!roles.includes("organizer")) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { roles: [...roles, "organizer"] },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        organizer: {
          id: organizer.id,
          displayName: organizer.displayName,
          status: organizer.status,
          stripeAccountId: organizer.stripeAccountId,
          entityType: organizer.entityType,
          businessName: organizer.businessName,
          city: organizer.city,
          payoutIban: organizer.payoutIban,
          username: organizer.username,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return NextResponse.json(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    console.error("POST /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao enviar candidatura de organizador." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    await prisma.organizer.deleteMany({
      where: { userId: user.id, status: "PENDING" },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao cancelar candidatura." },
      { status: 500 },
    );
  }
}
