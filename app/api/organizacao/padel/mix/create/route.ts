export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { padel_format, EventAccessMode, EventTemplateType, OrganizationModule } from "@prisma/client";
import { createEventAccessPolicyVersion } from "@/lib/checkin/accessPolicy";
import { resolveEventAccessPolicyInput } from "@/lib/events/accessPolicy";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);

const generateUniqueSlug = async (base: string) => {
  const existing = await prisma.event.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const slugs = new Set(existing.map((row) => row.slug));
  if (!slugs.has(base)) return base;
  let suffix = 2;
  while (slugs.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

type MixPayload = {
  title?: string;
  startsAt?: string;
  durationMinutes?: number;
  teamsCount?: number;
  format?: "NON_STOP" | "FASE_FINALS";
  locationName?: string;
  locationCity?: string;
};

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const body = (await req.json().catch(() => null)) as MixPayload | null;
    if (!body) {
      return fail(400, "BODY_INVALID");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organization || !membership) {
      return fail(403, "FORBIDDEN");
    }
    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(403, "FORBIDDEN");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "PADEL_MIX" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    const title = body.title?.trim() || "Mix rápido";
    const startsAtRaw = body.startsAt ? new Date(body.startsAt) : null;
    if (!startsAtRaw || Number.isNaN(startsAtRaw.getTime())) {
      return fail(400, "START_REQUIRED");
    }

    const durationMinutes = Math.min(300, Math.max(60, Math.round(Number(body.durationMinutes ?? 180))));
    const teamsCount = Math.min(8, Math.max(2, Math.round(Number(body.teamsCount ?? 8))));
    const endsAt = new Date(startsAtRaw.getTime() + durationMinutes * 60 * 1000);
    const locationName = body.locationName?.trim() || organization.publicName || "Mix rápido";
    const locationCity = body.locationCity?.trim() || organization.city || "Lisboa";

    const format =
      body.format === "FASE_FINALS" ? padel_format.GRUPOS_ELIMINATORIAS : padel_format.NON_STOP;

    const categoryLabel = "Mix rápido";
    let category = await prisma.padelCategory.findFirst({
      where: { organizationId: organization.id, label: categoryLabel },
    });
    if (!category) {
      category = await prisma.padelCategory.create({
        data: {
          organizationId: organization.id,
          label: categoryLabel,
          genderRestriction: "MIXED",
          isActive: true,
        },
      });
    }

    const groupsConfig =
      body.format === "FASE_FINALS"
        ? {
            mode: "AUTO",
            groupCount: 2,
            groupSize: Math.ceil(teamsCount / 2),
            qualifyPerGroup: 2,
            extraQualifiers: 0,
            seeding: "SNAKE",
          }
        : null;

    const baseSlug = slugify(title) || "mix";
    const slug = await generateUniqueSlug(baseSlug);

    const policyResolution = resolveEventAccessPolicyInput({
      accessPolicy: {
        mode: EventAccessMode.PUBLIC,
        guestCheckoutAllowed: false,
        inviteTokenAllowed: false,
        requiresEntitlementForEntry: false,
      },
      templateType: EventTemplateType.PADEL,
      defaultMode: EventAccessMode.PUBLIC,
    });

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          title,
          slug,
          description: "Mix rápido de padel (community games).",
          templateType: EventTemplateType.PADEL,
          status: "PUBLISHED",
          pricingMode: "FREE_ONLY",
          locationName,
          locationCity,
          startsAt: startsAtRaw,
          endsAt,
          timezone: organization.language === "en" ? "Europe/Lisbon" : "Europe/Lisbon",
          ownerUserId: user.id,
          organizationId: organization.id,
        },
        select: { id: true, slug: true },
      });

      await createEventAccessPolicyVersion(created.id, policyResolution.policyInput, tx);

      await tx.padelTournamentConfig.create({
        data: {
          eventId: created.id,
          organizationId: organization.id,
          format,
          numberOfCourts: 1,
          defaultCategoryId: category.id,
          advancedSettings: {
            mixMode: true,
            mixTeamsCount: teamsCount,
            competitionState: "PUBLIC",
            ...(groupsConfig ? { groupsConfig } : {}),
          },
        },
      });
      await tx.padelEventCategoryLink.create({
        data: {
          eventId: created.id,
          padelCategoryId: category.id,
          capacityTeams: teamsCount,
          format,
          isEnabled: true,
        },
      });
      return created;
    });

    return respondOk(ctx, { eventId: event.id, slug: event.slug }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED");
    }
    console.error("[padel/mix/create]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

export const POST = withApiEnvelope(_POST);
