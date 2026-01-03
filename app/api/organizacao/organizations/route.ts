import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrganizationStatus, OrganizationMemberRole } from "@prisma/client";
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

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    });

    const organizationIds = (memberships || [])
      .map((m) => m.organizationId)
      .filter((id): id is number => typeof id === "number");

    const modulesRows =
      organizationIds.length > 0
        ? await prisma.organizationModuleEntry.findMany({
            where: { organizationId: { in: organizationIds }, enabled: true },
            select: { organizationId: true, moduleKey: true },
            orderBy: { moduleKey: "asc" },
          })
        : [];

    const modulesByOrganization = new Map<number, string[]>();
    for (const row of modulesRows) {
      const current = modulesByOrganization.get(row.organizationId);
      if (current) {
        current.push(row.moduleKey);
      } else {
        modulesByOrganization.set(row.organizationId, [row.moduleKey]);
      }
    }

    const items = (memberships || [])
      .filter((m) => m.organization)
      .map((m) => ({
        organizationId: m.organizationId,
        role: m.role,
        lastUsedAt: (m as { lastUsedAt?: Date | null }).lastUsedAt ?? null,
        organization: {
          id: m.organization!.id,
          publicName: m.organization!.publicName,
          username: m.organization!.username,
          businessName: m.organization!.businessName,
          city: m.organization!.city,
          entityType: m.organization!.entityType,
          status: m.organization!.status,
          organizationCategory:
            (m.organization as { organizationCategory?: string | null }).organizationCategory ??
            DEFAULT_ORGANIZATION_CATEGORY,
          modules: modulesByOrganization.get(m.organizationId) ?? [],
        },
      }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
      return NextResponse.json(
        { ok: false, error: "Base de dados sem tabela organization_members. Corre as migrations." },
        { status: 500 },
      );
    }
    console.error("[organização/organizations][GET]", err);
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
        : bName || "Organização";
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
        { ok: false, error: "organizationCategory inválido. Usa EVENTOS, PADEL ou RESERVAS." },
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

    const modulesToEnable = modulesProvided ? parsedModules ?? [] : DEFAULT_ORGANIZATION_MODULES;

    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          publicName: pName,
          businessName: bName,
          entityType: eType,
          city: cityClean,
          status: OrganizationStatus.ACTIVE,
          username: normalizedUsername,
          organizationCategory: organizationCategory ?? DEFAULT_ORGANIZATION_CATEGORY,
          publicWebsite,
        },
      });
      if (modulesToEnable.length > 0) {
        await tx.organizationModuleEntry.createMany({
          data: modulesToEnable.map((moduleKey) => ({
            organizationId: created.id,
            moduleKey,
            enabled: true,
          })),
        });
      }
      await setUsernameForOwner({
        username: normalizedUsername,
        ownerType: "organization",
        ownerId: created.id,
        tx,
      });
      return created;
    });

    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { role: OrganizationMemberRole.OWNER },
      create: { organizationId: organization.id, userId: user.id, role: OrganizationMemberRole.OWNER },
    });

    return NextResponse.json(
      {
        ok: true,
        organization: {
          id: organization.id,
          publicName: organization.publicName,
          username: organization.username,
          businessName: organization.businessName,
          city: organization.city,
          entityType: organization.entityType,
          organizationCategory:
            (organization as { organizationCategory?: string | null }).organizationCategory ??
            DEFAULT_ORGANIZATION_CATEGORY,
          publicWebsite: (organization as { publicWebsite?: string | null }).publicWebsite ?? publicWebsite ?? null,
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
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
      return NextResponse.json(
        { ok: false, error: "Base de dados sem tabela organization_members. Corre as migrations." },
        { status: 500 },
      );
    }
    console.error("[organização/organizations][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
