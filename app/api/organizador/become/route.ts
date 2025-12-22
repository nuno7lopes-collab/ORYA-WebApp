

// app/api/organizador/become/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import {
  DEFAULT_ORGANIZATION_CATEGORY,
  DEFAULT_ORGANIZATION_MODULES,
  parseOrganizationCategory,
  parseOrganizationModules,
} from "@/lib/organizationCategories";
import { isValidWebsite } from "@/lib/validation/organization";

type OrganizerPayload = {
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

    const { organizer: activeOrganizer } = await getActiveOrganizerForUser(profileSafe.id);
    const fallbackOrganizer = activeOrganizer ?? null;
    const organizerModules = fallbackOrganizer
      ? await prisma.organizationModuleEntry.findMany({
          where: { organizerId: fallbackOrganizer.id, enabled: true },
          select: { moduleKey: true },
          orderBy: { moduleKey: "asc" },
        })
      : [];

    return NextResponse.json(
      {
        ok: true,
        organizer: fallbackOrganizer
          ? {
              id: fallbackOrganizer.id,
              publicName: fallbackOrganizer.publicName,
              status: fallbackOrganizer.status,
              stripeAccountId: fallbackOrganizer.stripeAccountId,
              entityType: fallbackOrganizer.entityType,
              businessName: fallbackOrganizer.businessName,
              city: fallbackOrganizer.city,
              payoutIban: fallbackOrganizer.payoutIban,
              organizationCategory:
                (fallbackOrganizer as { organizationCategory?: string | null }).organizationCategory ??
                DEFAULT_ORGANIZATION_CATEGORY,
              modules: organizerModules.map((module) => module.moduleKey),
              publicWebsite: (fallbackOrganizer as { publicWebsite?: string | null }).publicWebsite ?? null,
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
        { ok: false, error: "organizationCategory inválido. Usa EVENTOS, PADEL ou VOLUNTARIADO." },
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

    // Procurar organizer existente para este user
    const { organizer: activeOrganizer, membership } = await getActiveOrganizerForUser(profile.id);

    // Se já existe organizador ativo e o caller não é OWNER dessa organização, bloquear promoção
    if (activeOrganizer) {
      const isOwner = membership?.role === "OWNER";
      if (!isOwner) {
        return NextResponse.json(
          { ok: false, error: "Apenas o Owner pode alterar esta organização." },
          { status: 403 },
        );
      }
    }

    let organizer = activeOrganizer ?? null;

    const publicNameValue =
      businessName ||
      profileSafe.fullName?.trim() ||
      profileSafe.username ||
      "Organizador";

    const usernameCandidate = usernameRaw ?? organizer?.username ?? null;
    const validatedUsername = usernameCandidate
      ? normalizeAndValidateUsername(usernameCandidate)
      : { ok: false as const, error: "Escolhe um username ORYA para a organização." };

    if (!validatedUsername.ok) {
      return NextResponse.json({ ok: false, error: validatedUsername.error }, { status: 400 });
    }

    const username = validatedUsername.username;

    const modulesToApply = organizer
      ? modulesProvided
        ? parsedModules ?? []
        : null
      : modulesProvided
        ? parsedModules ?? []
        : DEFAULT_ORGANIZATION_MODULES;

    organizer = await prisma.$transaction(async (tx) => {
      const nextOrganizer = organizer
        ? await tx.organizer.update({
            where: { id: organizer!.id },
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
        : await tx.organizer.create({
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

      const reservation = await setUsernameForOwner({
        username,
        ownerType: "organizer",
        ownerId: nextOrganizer.id,
        tx,
      });
      if (!reservation.ok && reservation.error !== "USERNAME_TABLE_MISSING") {
        throw new Error(reservation.error);
      }

      if (modulesToApply) {
        await tx.organizationModuleEntry.deleteMany({
          where: { organizerId: nextOrganizer.id },
        });
        if (modulesToApply.length > 0) {
          await tx.organizationModuleEntry.createMany({
            data: modulesToApply.map((moduleKey) => ({
              organizerId: nextOrganizer.id,
              moduleKey,
              enabled: true,
            })),
          });
        }
      }

      return nextOrganizer;
    });

    // Garante membership OWNER para o utilizador
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

    // Garante que o perfil tem role de organizer
    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    if (!roles.includes("organizer")) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { roles: [...roles, "organizer"] },
      });
    }

    const organizerModules = modulesToApply
      ? modulesToApply
      : (
          await prisma.organizationModuleEntry.findMany({
            where: { organizerId: organizer.id, enabled: true },
            select: { moduleKey: true },
            orderBy: { moduleKey: "asc" },
          })
        ).map((module) => module.moduleKey);

    return NextResponse.json(
      {
        ok: true,
        organizer: {
          id: organizer.id,
          publicName: organizer.publicName,
          status: organizer.status,
          stripeAccountId: organizer.stripeAccountId,
          entityType: organizer.entityType,
          businessName: organizer.businessName,
          city: organizer.city,
          payoutIban: organizer.payoutIban,
          username: organizer.username,
          organizationCategory:
            (organizer as { organizationCategory?: string | null }).organizationCategory ??
            DEFAULT_ORGANIZATION_CATEGORY,
          modules: organizerModules,
          publicWebsite: (organizer as { publicWebsite?: string | null }).publicWebsite ?? null,
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
