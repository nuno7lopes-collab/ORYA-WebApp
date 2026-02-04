

// app/api/organizacao/become/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser, ORG_CONTEXT_UI } from "@/lib/organizationContext";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  DEFAULT_PRIMARY_MODULE,
  getDefaultOrganizationModules,
  normalizePrimaryModule,
  parsePrimaryModule,
  parseOrganizationModules,
} from "@/lib/organizationCategories";
import { isValidWebsite } from "@/lib/validation/organization";
import { ensureGroupMemberForOrg } from "@/lib/organizationGroupAccess";

type OrganizationPayload = {
  entityType?: string | null;
  businessName?: string | null;
  city?: string | null;
  payoutIban?: string | null;
  username?: string | null;
  primaryModule?: string | null;
  modules?: string[] | null;
  publicWebsite?: string | null;
};

function sanitizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function _GET() {
  try {
    const user = await requireUser();

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });
    if (!profile) {
      return jsonWrap(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 },
      );
    }
    const profileSafe = profile;

    const { organization: currentOrganization } = await getActiveOrganizationForUser(profileSafe.id, ORG_CONTEXT_UI);
    const fallbackOrganization = currentOrganization ?? null;
    const organizationModules = fallbackOrganization
      ? await prisma.organizationModuleEntry.findMany({
          where: { organizationId: fallbackOrganization.id, enabled: true },
          select: { moduleKey: true },
          orderBy: { moduleKey: "asc" },
        })
      : [];

    return jsonWrap(
      {
        ok: true,
        organization: fallbackOrganization
          ? {
              id: fallbackOrganization.id,
              publicName: fallbackOrganization.publicName,
              status: fallbackOrganization.status,
              stripeAccountId: fallbackOrganization.stripeAccountId,
              entityType: fallbackOrganization.entityType,
              businessName: fallbackOrganization.businessName,
              city: fallbackOrganization.city,
              payoutIban: fallbackOrganization.payoutIban,
              primaryModule: normalizePrimaryModule(fallbackOrganization.primaryModule ?? null),
              modules: organizationModules.map((module) => module.moduleKey),
              publicWebsite: fallbackOrganization.publicWebsite ?? null,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }
    console.error("GET /api/organizacao/become error:", err);
    return jsonWrap(
      { ok: false, error: "Erro interno ao obter organização." },
      { status: 500 },
    );
  }
}

async function _POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return jsonWrap(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 },
      );
    }
    const profileSafe = profile;

    // Corpo opcional com dados de onboarding
    let payload: OrganizationPayload = {};
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await req.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = (await req.formData()) as unknown as { get(name: string): FormDataEntryValue | null };
        payload = {
          entityType: form.get("entityType") as string | null,
          businessName: form.get("businessName") as string | null,
          city: form.get("city") as string | null,
          payoutIban: form.get("payoutIban") as string | null,
          username: form.get("username") as string | null,
          primaryModule: form.get("primaryModule") as string | null,
          publicWebsite: form.get("publicWebsite") as string | null,
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
    const primaryModuleRaw = payload.primaryModule;
    const modulesRaw = payload.modules;
    const publicWebsiteRaw = payload.publicWebsite;

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

    const primaryModuleProvided = Object.prototype.hasOwnProperty.call(payload, "primaryModule");
    const modulesProvided = Object.prototype.hasOwnProperty.call(payload, "modules");

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

    // Procurar organization existente para este user
    const { organization: currentOrganization, membership } = await getActiveOrganizationForUser(
      profile.id,
      ORG_CONTEXT_UI,
    );

    // Se já existe organização ativo e o caller não é OWNER dessa organização, bloquear promoção
    if (currentOrganization) {
      const isOwner = membership?.role === "OWNER";
      if (!isOwner) {
        return jsonWrap(
          { ok: false, error: "Apenas o Owner pode alterar esta organização." },
          { status: 403 },
        );
      }
    }

    const existingOrganization = currentOrganization
      ? await prisma.organization.findUnique({
          where: { id: currentOrganization.id },
        })
      : null;
    let organization = existingOrganization ?? null;

    const publicNameValue =
      businessName ||
      profileSafe.fullName?.trim() ||
      profileSafe.username ||
      "Organização";

    const usernameCandidate = usernameRaw ?? organization?.username ?? null;
    const validatedUsername = usernameCandidate
      ? normalizeAndValidateUsername(usernameCandidate)
      : { ok: false as const, error: "Escolhe um username ORYA para a organização." };

    if (!validatedUsername.ok) {
      return jsonWrap({ ok: false, error: validatedUsername.error }, { status: 400 });
    }

    const username = validatedUsername.username;

    const primaryFallback = primaryModule ?? normalizePrimaryModule(organization?.primaryModule ?? null);
    const modulesToApply = organization
      ? modulesProvided
        ? parsedModules ?? []
        : null
      : modulesProvided
        ? parsedModules ?? []
        : getDefaultOrganizationModules(primaryFallback);

    const nextOrganization = await prisma.$transaction(async (tx) => {
      let nextOrganization;
      if (organization) {
        nextOrganization = await tx.organization.update({
          where: { id: organization.id },
          data: {
            status: "ACTIVE",
            publicName: publicNameValue,
            entityType,
            businessName,
            city,
            payoutIban,
            username,
            ...(publicWebsite ? { publicWebsite } : {}),
            ...(primaryModuleProvided && primaryModule
              ? { primaryModule }
              : {}),
          },
        });
      } else {
        const group = await tx.organizationGroup.create({ data: {} });
        nextOrganization = await tx.organization.create({
          data: {
            groupId: group.id,
            publicName: publicNameValue,
            status: "ACTIVE", // self-serve aberto
            entityType,
            businessName,
            city,
            payoutIban,
            username,
            primaryModule: primaryFallback,
            publicWebsite,
          },
        });
      }

      await setUsernameForOwner({
        username,
        ownerType: "organization",
        ownerId: nextOrganization.id,
        tx,
      });

      if (modulesToApply) {
        await tx.organizationModuleEntry.deleteMany({
          where: { organizationId: nextOrganization.id },
        });
        if (modulesToApply.length > 0) {
          await tx.organizationModuleEntry.createMany({
            data: modulesToApply.map((moduleKey) => ({
              organizationId: nextOrganization.id,
              moduleKey,
              enabled: true,
            })),
          });
        }
      }

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: nextOrganization.id,
            userId: profile.id,
          },
        },
        update: { role: "OWNER" },
        create: {
          organizationId: nextOrganization.id,
          userId: profile.id,
          role: "OWNER",
        },
      });
      await ensureGroupMemberForOrg({
        organizationId: nextOrganization.id,
        userId: profile.id,
        role: "OWNER",
        client: tx,
      });

      return nextOrganization;
    });
    organization = nextOrganization;
    if (!organization) throw new Error("ORGANIZATION_MISSING");

    // Garante que o perfil tem role de organization
    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    if (!roles.includes("organization")) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { roles: [...roles, "organization"] },
      });
    }

    const organizationModules = modulesToApply
      ? modulesToApply
      : (
          await prisma.organizationModuleEntry.findMany({
            where: { organizationId: organization.id, enabled: true },
            select: { moduleKey: true },
            orderBy: { moduleKey: "asc" },
          })
        ).map((module) => module.moduleKey);

    return jsonWrap(
      {
        ok: true,
        organization: {
          id: organization.id,
          publicName: organization.publicName,
          status: organization.status,
          stripeAccountId: organization.stripeAccountId,
          entityType: organization.entityType,
          businessName: organization.businessName,
          city: organization.city,
          payoutIban: organization.payoutIban,
          username: organization.username,
          primaryModule: normalizePrimaryModule(organization.primaryModule ?? null),
          modules: organizationModules,
          publicWebsite: organization.publicWebsite ?? null,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }
    if (err instanceof UsernameTakenError) {
      return jsonWrap(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    console.error("POST /api/organizacao/become error:", err);
    return jsonWrap(
      { ok: false, error: "Erro interno ao enviar candidatura de organização." },
      { status: 500 },
    );
  }
}

async function _DELETE(_req: NextRequest) {
  try {
    const user = await requireUser();

    await prisma.organization.deleteMany({
      where: {
        status: "PENDING",
        members: {
          some: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }
    console.error("DELETE /api/organizacao/become error:", err);
    return jsonWrap(
      { ok: false, error: "Erro interno ao cancelar candidatura." },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
