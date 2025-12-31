import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrganizerStatus, OrganizerMemberRole } from "@prisma/client";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { requireUser } from "@/lib/auth/requireUser";
import {
  DEFAULT_ORGANIZATION_CATEGORY,
  DEFAULT_ORGANIZATION_MODULES,
  parseOrganizationCategory,
  parseOrganizationModules,
} from "@/lib/organizationCategories";
import { isValidWebsite } from "@/lib/validation/organization";

export async function GET() {
  try {
    const user = await requireUser();

    const memberships = await prisma.organizerMember.findMany({
      where: { userId: user.id },
      include: { organizer: true },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    });

    const organizerIds = (memberships || [])
      .map((m) => m.organizerId)
      .filter((id): id is number => typeof id === "number");

    const modulesRows =
      organizerIds.length > 0
        ? await prisma.organizationModuleEntry.findMany({
            where: { organizerId: { in: organizerIds }, enabled: true },
            select: { organizerId: true, moduleKey: true },
            orderBy: { moduleKey: "asc" },
          })
        : [];

    const modulesByOrganizer = new Map<number, string[]>();
    for (const row of modulesRows) {
      const current = modulesByOrganizer.get(row.organizerId);
      if (current) {
        current.push(row.moduleKey);
      } else {
        modulesByOrganizer.set(row.organizerId, [row.moduleKey]);
      }
    }

    const items = (memberships || [])
      .filter((m) => m.organizer)
      .map((m) => ({
        organizerId: m.organizerId,
        role: m.role,
        lastUsedAt: (m as { lastUsedAt?: Date | null }).lastUsedAt ?? null,
        organizer: {
          id: m.organizer!.id,
          publicName: m.organizer!.publicName,
          username: m.organizer!.username,
          businessName: m.organizer!.businessName,
          city: m.organizer!.city,
          entityType: m.organizer!.entityType,
          status: m.organizer!.status,
          organizationCategory:
            (m.organizer as { organizationCategory?: string | null }).organizationCategory ??
            DEFAULT_ORGANIZATION_CATEGORY,
          modules: modulesByOrganizer.get(m.organizerId) ?? [],
        },
      }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
      return NextResponse.json(
        { ok: false, error: "Base de dados sem tabela organizer_members. Corre as migrations." },
        { status: 500 },
      );
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

    const { businessName, publicName, entityType, city, username } = body as Record<string, unknown>;
    const organizationCategoryRaw = (body as Record<string, unknown>).organizationCategory;
    const modulesRaw = (body as Record<string, unknown>).modules;
    const publicWebsiteRaw =
      (body as Record<string, unknown>).publicWebsite ?? (body as Record<string, unknown>).website;
    const bName = typeof businessName === "string" ? businessName.trim() : null;
    const pName =
      typeof publicName === "string" && publicName.trim().length > 0
        ? publicName.trim()
        : bName || "Organizador";
    const eType = typeof entityType === "string" ? entityType.trim() : null;
    const cityClean = typeof city === "string" ? city.trim() : null;

    const publicWebsite = (() => {
      if (typeof publicWebsiteRaw !== "string") return null;
      const trimmed = publicWebsiteRaw.trim();
      if (!trimmed) return null;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    })();
    if (publicWebsite && !isValidWebsite(publicWebsite)) {
      return NextResponse.json(
        { ok: false, error: "Website inválido. Usa um URL válido (ex: https://orya.pt)." },
        { status: 400 },
      );
    }

    if (typeof username !== "string") {
      return NextResponse.json(
        { ok: false, error: "Escolhe um username para a organização." },
        { status: 400 },
      );
    }
    const validatedUsername = normalizeAndValidateUsername(username);

    const organizationCategoryProvided = Object.prototype.hasOwnProperty.call(body, "organizationCategory");
    const modulesProvided = Object.prototype.hasOwnProperty.call(body, "modules");

    const organizationCategory = organizationCategoryProvided
      ? parseOrganizationCategory(organizationCategoryRaw)
      : null;

    if (organizationCategoryProvided && !organizationCategory) {
      return NextResponse.json(
        { ok: false, error: "organizationCategory inválido. Usa EVENTOS, PADEL, RESERVAS ou CLUBS." },
        { status: 400 },
      );
    }

    const parsedModules = modulesProvided ? parseOrganizationModules(modulesRaw) : null;
    if (modulesProvided && parsedModules === null) {
      return NextResponse.json(
        { ok: false, error: "modules inválido. Usa uma lista de módulos válidos (ex.: INSCRICOES)." },
        { status: 400 },
      );
    }

    if (!validatedUsername.ok) {
      return NextResponse.json(
        { ok: false, error: validatedUsername.error },
        { status: 400 },
      );
    }

    if (!bName || !cityClean || !eType) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltam campos obrigatórios: nome, cidade e tipo de entidade.",
        },
        { status: 400 },
      );
    }

    const normalizedUsername = validatedUsername.username;

    // Guardar username reservado em outras entidades
    const existingOrganizer = await prisma.organizer.findFirst({
      where: { username: { equals: normalizedUsername, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingOrganizer) {
      return NextResponse.json(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    const existingProfile = await prisma.profile.findFirst({
      where: { username: { equals: normalizedUsername, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingProfile) {
      return NextResponse.json(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }

    const modulesToEnable = modulesProvided ? parsedModules ?? [] : DEFAULT_ORGANIZATION_MODULES;

    const organizer = await prisma.$transaction(async (tx) => {
      const created = await tx.organizer.create({
        data: {
          publicName: pName,
          businessName: bName,
          entityType: eType,
          city: cityClean,
          status: OrganizerStatus.ACTIVE,
          username: normalizedUsername,
          organizationCategory: organizationCategory ?? DEFAULT_ORGANIZATION_CATEGORY,
          publicWebsite,
        },
      });
      if (modulesToEnable.length > 0) {
        await tx.organizationModuleEntry.createMany({
          data: modulesToEnable.map((moduleKey) => ({
            organizerId: created.id,
            moduleKey,
            enabled: true,
          })),
        });
      }
      const reservation = await setUsernameForOwner({
        username: normalizedUsername,
        ownerType: "organizer",
        ownerId: created.id,
        tx,
      });
      if (!reservation.ok && reservation.error !== "USERNAME_TABLE_MISSING") {
        throw new Error(reservation.error);
      }
      return created;
    });

    await prisma.organizerMember.upsert({
      where: { organizerId_userId: { organizerId: organizer.id, userId: user.id } },
      update: { role: OrganizerMemberRole.OWNER },
      create: { organizerId: organizer.id, userId: user.id, role: OrganizerMemberRole.OWNER },
    });

    return NextResponse.json(
      {
        ok: true,
        organizer: {
          id: organizer.id,
          publicName: organizer.publicName,
          username: organizer.username,
          businessName: organizer.businessName,
          city: organizer.city,
          entityType: organizer.entityType,
          organizationCategory:
            (organizer as { organizationCategory?: string | null }).organizationCategory ??
            DEFAULT_ORGANIZATION_CATEGORY,
          publicWebsite: (organizer as { publicWebsite?: string | null }).publicWebsite ?? publicWebsite ?? null,
          modules: modulesToEnable,
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
