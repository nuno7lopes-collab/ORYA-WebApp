import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { OrganizationStatus, OrganizationMemberRole } from "@prisma/client";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { requireUser } from "@/lib/auth/requireUser";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  DEFAULT_PRIMARY_MODULE,
  getDefaultOrganizationModules,
  parsePrimaryModule,
  parseOrganizationModules,
} from "@/lib/organizationCategories";
import { isValidWebsite } from "@/lib/validation/organization";
import { ensureGroupMemberForOrg } from "@/lib/organizationGroupAccess";

async function _GET() {
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
          primaryModule:
            (m.organization as { primaryModule?: string | null }).primaryModule ??
            DEFAULT_PRIMARY_MODULE,
          modules: modulesByOrganization.get(m.organizationId) ?? [],
        },
      }));

    return jsonWrap({ ok: true, items }, { status: 200 });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
      return jsonWrap(
        { ok: false, error: "Base de dados sem tabela organization_members. Corre as migrations." },
        { status: 500 },
      );
    }
    console.error("[organização/organizations][GET]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { businessName, publicName, entityType, city, username } = body as Record<string, unknown>;
    const primaryModuleRaw = (body as Record<string, unknown>).primaryModule;
    const modulesRaw = (body as Record<string, unknown>).modules;
    const publicWebsiteRaw =
      (body as Record<string, unknown>).publicWebsite ?? (body as Record<string, unknown>).website;
    const bName = typeof businessName === "string" ? businessName.trim() : null;
    const pName =
      typeof publicName === "string" && publicName.trim().length > 0
        ? publicName.trim()
        : bName || "Organização";
    const eTypeRaw = typeof entityType === "string" ? entityType.trim() : "";
    const cityRaw = typeof city === "string" ? city.trim() : "";
    const eType = eTypeRaw.length > 0 ? eTypeRaw : null;
    const cityClean = cityRaw.length > 0 ? cityRaw : null;

    const publicWebsite = (() => {
      if (typeof publicWebsiteRaw !== "string") return null;
      const trimmed = publicWebsiteRaw.trim();
      if (!trimmed) return null;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    })();
    if (publicWebsite && !isValidWebsite(publicWebsite)) {
      return jsonWrap(
        { ok: false, error: "Website inválido. Usa um URL válido (ex: https://orya.pt)." },
        { status: 400 },
      );
    }

    if (typeof username !== "string") {
      return jsonWrap(
        { ok: false, error: "Escolhe um username para a organização." },
        { status: 400 },
      );
    }
    const validatedUsername = normalizeAndValidateUsername(username);

    const primaryModuleProvided = Object.prototype.hasOwnProperty.call(body, "primaryModule");
    const modulesProvided = Object.prototype.hasOwnProperty.call(body, "modules");

    const primaryModule = primaryModuleProvided
      ? parsePrimaryModule(primaryModuleRaw)
      : null;

    if (primaryModuleProvided && !primaryModule) {
      return jsonWrap(
        { ok: false, error: "primaryModule inválido. Usa EVENTOS, RESERVAS ou TORNEIOS." },
        { status: 400 },
      );
    }

    const parsedModules = modulesProvided ? parseOrganizationModules(modulesRaw) : null;
    if (modulesProvided && parsedModules === null) {
      return jsonWrap(
        { ok: false, error: "modules inválido. Usa uma lista de módulos válidos." },
        { status: 400 },
      );
    }

    if (!validatedUsername.ok) {
      return jsonWrap(
        { ok: false, error: validatedUsername.error },
        { status: 400 },
      );
    }

    if (!bName) {
      return jsonWrap(
        {
          ok: false,
          error: "Indica o nome da tua organização.",
        },
        { status: 400 },
      );
    }

    const normalizedUsername = validatedUsername.username;

    const primaryFallback = primaryModule ?? DEFAULT_PRIMARY_MODULE;
    const modulesToEnable = modulesProvided
      ? parsedModules ?? []
      : getDefaultOrganizationModules(primaryFallback);

    const organization = await prisma.$transaction(async (tx) => {
      const group = await tx.organizationGroup.create({ data: {} });
      const created = await tx.organization.create({
        data: {
          groupId: group.id,
          publicName: pName,
          businessName: bName,
          entityType: eType,
          city: cityClean,
          status: OrganizationStatus.ACTIVE,
          username: normalizedUsername,
          primaryModule: primaryFallback,
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
      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: created.id, userId: user.id } },
        update: { role: OrganizationMemberRole.OWNER },
        create: { organizationId: created.id, userId: user.id, role: OrganizationMemberRole.OWNER },
      });
      await ensureGroupMemberForOrg({
        organizationId: created.id,
        userId: user.id,
        role: OrganizationMemberRole.OWNER,
        client: tx,
      });
      return created;
    });

    return jsonWrap(
      {
        ok: true,
        organization: {
          id: organization.id,
          publicName: organization.publicName,
          username: organization.username,
          businessName: organization.businessName,
          city: organization.city,
          entityType: organization.entityType,
          primaryModule:
            (organization as { primaryModule?: string | null }).primaryModule ??
            DEFAULT_PRIMARY_MODULE,
          publicWebsite: (organization as { publicWebsite?: string | null }).publicWebsite ?? publicWebsite ?? null,
          modules: modulesToEnable,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (err instanceof UsernameTakenError) {
      return jsonWrap(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
      return jsonWrap(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
      return jsonWrap(
        { ok: false, error: "Base de dados sem tabela organization_members. Corre as migrations." },
        { status: 500 },
      );
    }
    console.error("[organização/organizations][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);