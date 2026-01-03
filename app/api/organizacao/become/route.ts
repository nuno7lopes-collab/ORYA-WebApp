

// app/api/organizacao/become/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import {
  DEFAULT_ORGANIZATION_CATEGORY,
  DEFAULT_ORGANIZATION_MODULES,
  parseOrganizationCategory,
  parseOrganizationModules,
} from "@/lib/organizationCategories";
import { isValidWebsite } from "@/lib/validation/organization";

type OrganizationPayload = {
  entityType?: string | null;
  businessName?: string | null;
  city?: string | null;
  payoutIban?: string | null;
  username?: string | null;
  organizationCategory?: string | null;
  modules?: string[] | null;
  publicWebsite?: string | null;
};

function sanitizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  try {
    const user = await requireUser();

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "Perfil não encontrado." },
      { status: 400 },
    );
  }
  const profileSafe = profile;

    const { organization: activeOrganization } = await getActiveOrganizationForUser(profileSafe.id);
    const fallbackOrganization = activeOrganization ?? null;
    const organizationModules = fallbackOrganization
      ? await prisma.organizationModuleEntry.findMany({
          where: { organizationId: fallbackOrganization.id, enabled: true },
          select: { moduleKey: true },
          orderBy: { moduleKey: "asc" },
        })
      : [];

    return NextResponse.json(
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
              organizationCategory:
                (fallbackOrganization as { organizationCategory?: string | null }).organizationCategory ??
                DEFAULT_ORGANIZATION_CATEGORY,
              modules: organizationModules.map((module) => module.moduleKey),
              publicWebsite: (fallbackOrganization as { publicWebsite?: string | null }).publicWebsite ?? null,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }
    console.error("GET /api/organizacao/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao obter organização." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
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
        const form = await req.formData();
        payload = {
          entityType: form.get("entityType") as string | null,
          businessName: form.get("businessName") as string | null,
          city: form.get("city") as string | null,
          payoutIban: form.get("payoutIban") as string | null,
          username: form.get("username") as string | null,
          organizationCategory: form.get("organizationCategory") as string | null,
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
    const organizationCategoryRaw = payload.organizationCategory;
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
      return NextResponse.json(
        { ok: false, error: "Website inválido. Usa um URL válido (ex: https://orya.pt)." },
        { status: 400 },
      );
    }

    const organizationCategoryProvided = Object.prototype.hasOwnProperty.call(payload, "organizationCategory");
    const modulesProvided = Object.prototype.hasOwnProperty.call(payload, "modules");

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

    // Procurar organization existente para este user
    const { organization: activeOrganization, membership } = await getActiveOrganizationForUser(profile.id);

    // Se já existe organização ativo e o caller não é OWNER dessa organização, bloquear promoção
    if (activeOrganization) {
      const isOwner = membership?.role === "OWNER";
      if (!isOwner) {
        return NextResponse.json(
          { ok: false, error: "Apenas o Owner pode alterar esta organização." },
          { status: 403 },
        );
      }
    }

    let organization = activeOrganization ?? null;

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
      return NextResponse.json({ ok: false, error: validatedUsername.error }, { status: 400 });
    }

    const username = validatedUsername.username;

    const modulesToApply = organization
      ? modulesProvided
        ? parsedModules ?? []
        : null
      : modulesProvided
        ? parsedModules ?? []
        : DEFAULT_ORGANIZATION_MODULES;

    organization = await prisma.$transaction(async (tx) => {
      const nextOrganization = organization
        ? await tx.organization.update({
            where: { id: organization!.id },
            data: {
              status: "ACTIVE",
              publicName: publicNameValue,
              entityType,
              businessName,
              city,
              payoutIban,
              username,
              ...(publicWebsite ? { publicWebsite } : {}),
              ...(organizationCategoryProvided && organizationCategory
                ? { organizationCategory }
                : {}),
            },
          })
        : await tx.organization.create({
            data: {
              publicName: publicNameValue,
              status: "ACTIVE", // self-serve aberto
              entityType,
              businessName,
              city,
              payoutIban,
              username,
              organizationCategory: organizationCategory ?? DEFAULT_ORGANIZATION_CATEGORY,
              publicWebsite,
            },
          });

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

      return nextOrganization;
    });

    // Garante membership OWNER para o utilizador
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: profile.id,
        },
      },
      update: { role: "OWNER" },
      create: {
        organizationId: organization.id,
        userId: profile.id,
        role: "OWNER",
      },
    });

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

    return NextResponse.json(
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
          organizationCategory:
            (organization as { organizationCategory?: string | null }).organizationCategory ??
            DEFAULT_ORGANIZATION_CATEGORY,
          modules: organizationModules,
          publicWebsite: (organization as { publicWebsite?: string | null }).publicWebsite ?? null,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }
    if (err instanceof UsernameTakenError) {
      return NextResponse.json(
        { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    console.error("POST /api/organizacao/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao enviar candidatura de organização." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest) {
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }
    console.error("DELETE /api/organizacao/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao cancelar candidatura." },
      { status: 500 },
    );
  }
}
