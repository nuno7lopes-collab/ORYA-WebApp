import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { OrganizerStatus, OrganizerMemberRole } from "@prisma/client";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { requireUser } from "@/lib/auth/requireUser";

export async function GET() {
  try {
    const user = await requireUser();

    const memberships = await prisma.organizerMember.findMany({
      where: { userId: user.id },
      include: { organizer: true },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    });

    const items = (memberships || [])
      .filter((m) => m.organizer)
      .map((m) => ({
        organizerId: m.organizerId,
        role: m.role,
        lastUsedAt: (m as { lastUsedAt?: Date | null }).lastUsedAt ?? null,
        organizer: {
          id: m.organizer!.id,
          displayName: m.organizer!.displayName,
          username: m.organizer!.username,
          businessName: m.organizer!.businessName,
          city: m.organizer!.city,
          entityType: m.organizer!.entityType,
          status: m.organizer!.status,
        },
      }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
      try {
        const supabase = await createSupabaseServer();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const legacyOrganizers = user
          ? await prisma.organizer.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: "asc" },
            })
          : [];
        return NextResponse.json(
          {
            ok: true,
            items: legacyOrganizers.map((org) => ({
              organizerId: org.id,
              role: "OWNER" as OrganizerMemberRole,
              lastUsedAt: null,
              organizer: {
                id: org.id,
                username: org.username,
                displayName: org.displayName,
                businessName: org.businessName,
                city: org.city,
                entityType: org.entityType,
                status: org.status,
              },
            })),
            warning: "Tabela organizer_members em falta. A usar dados legacy.",
          },
          { status: 200 },
        );
      } catch (fallbackErr) {
        console.error("[organizador/organizations][GET] fallback error", fallbackErr);
        return NextResponse.json(
          { ok: false, error: "Base de dados sem tabela organizer_members. Corre as migrations." },
          { status: 500 },
        );
      }
    }
    console.error("[organizador/organizations][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { businessName, displayName, entityType, city, username } = body as Record<string, unknown>;
    const bName = typeof businessName === "string" ? businessName.trim() : null;
    const dName =
      typeof displayName === "string" && displayName.trim().length > 0
        ? displayName.trim()
        : bName || "Organizador";
    const eType = typeof entityType === "string" ? entityType.trim() : null;
    const cityClean = typeof city === "string" ? city.trim() : null;

    const validatedUsername = typeof username === "string" ? normalizeAndValidateUsername(username) : { ok: false, error: "Escolhe um username para a organização." };

    if (!bName || !cityClean || !eType || !validatedUsername.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            !validatedUsername.ok
              ? validatedUsername.error
              : "Faltam campos obrigatórios: nome, cidade e tipo de entidade.",
        },
        { status: 400 },
      );
    }

    // Guardar username reservado em outras entidades
    const existingOrganizer = await prisma.organizer.findFirst({
      where: { username: { equals: validatedUsername.username, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingOrganizer) {
      return NextResponse.json(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    const existingProfile = await prisma.profile.findFirst({
      where: { username: { equals: validatedUsername.username, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingProfile) {
      return NextResponse.json(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }

    const organizer = await prisma.$transaction(async (tx) => {
      async function createOrganizer(includePublicName: boolean) {
        return tx.organizer.create({
          data: {
            userId: user.id, // legacy compat
            displayName: dName,
            ...(includePublicName ? { publicName: dName } : {}),
            businessName: bName,
            entityType: eType,
            city: cityClean,
            status: OrganizerStatus.ACTIVE,
            username: validatedUsername.username,
          },
        });
      }

      try {
        return await createOrganizer(true);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        const message = err instanceof Error ? err.message : "";
        const missingColumn = code === "P2022" && message.toLowerCase().includes("public_name");
        if (!missingColumn) throw err;
        return createOrganizer(false);
      }
    });

    try {
      await prisma.organizerMember.upsert({
        where: { organizerId_userId: { organizerId: organizer.id, userId: user.id } },
        update: { role: OrganizerMemberRole.OWNER },
        create: { organizerId: organizer.id, userId: user.id, role: OrganizerMemberRole.OWNER },
      });
    } catch (err: unknown) {
      if (!(typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021")) {
        throw err;
      }
      console.warn("[organizador/organizations][POST] organizer_members em falta; criámos org sem membership");
    }

    // Reservar username global fora da transação para não abortar criação
    try {
      await setUsernameForOwner({
        username: validatedUsername.username,
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
      console.warn("[organizador/organizations][POST] username global falhou (ignorado)", err);
    }

    return NextResponse.json(
      {
        ok: true,
        organizer: {
          id: organizer.id,
          displayName: organizer.displayName,
          username: organizer.username,
          businessName: organizer.businessName,
          city: organizer.city,
          entityType: organizer.entityType,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (err instanceof UsernameTakenError) {
      return NextResponse.json(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
      return NextResponse.json(
        { ok: false, error: "Base de dados sem tabela organizer_members. Corre as migrations." },
        { status: 500 },
      );
    }
    console.error("[organizador/organizations][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
