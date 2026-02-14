import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { createOrganizationAtomic } from "@/lib/domain/groupGovernance";
import { listEffectiveOrganizationMembershipsForUser } from "@/lib/organizationMembers";
import { becomeOrganizationSchema } from "@/lib/validation/organization";
import { UsernameTakenError } from "@/lib/globalUsernames";

function errorCodeForStatus(status: number) {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 422) return "VALIDATION_FAILED";
  return "INTERNAL_ERROR";
}

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, message: string) {
  return respondError(
    ctx,
    {
      errorCode: errorCodeForStatus(status),
      message,
      retryable: status >= 500,
    },
    { status },
  );
}

async function _GET() {
  const ctx = getRequestContext();
  try {
    const user = await requireUser();
    const [profile, memberships] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: user.id },
        select: { activeOrganizationId: true },
      }),
      listEffectiveOrganizationMembershipsForUser({ userId: user.id }),
    ]);

    const organizationIds = memberships.map((membership) => membership.organizationId);
    const modulesRows =
      organizationIds.length > 0
        ? await prisma.organizationModuleEntry.findMany({
            where: {
              organizationId: { in: organizationIds },
              enabled: true,
            },
            select: {
              organizationId: true,
              moduleKey: true,
            },
            orderBy: { moduleKey: "asc" },
          })
        : [];

    const modulesByOrg = new Map<number, string[]>();
    for (const moduleRow of modulesRows) {
      const bucket = modulesByOrg.get(moduleRow.organizationId);
      if (bucket) {
        bucket.push(moduleRow.moduleKey);
      } else {
        modulesByOrg.set(moduleRow.organizationId, [moduleRow.moduleKey]);
      }
    }

    const items = memberships
      .map((membership) => ({
        organizationId: membership.organizationId,
        role: membership.role,
        lastUsedAt: profile?.activeOrganizationId === membership.organizationId ? new Date() : null,
        organization: {
          id: membership.organization.id,
          publicName: membership.organization.publicName,
          username: membership.organization.username,
          businessName: membership.organization.businessName,
          entityType: membership.organization.entityType,
          status: membership.organization.status,
          primaryModule: membership.organization.primaryModule,
          modules: modulesByOrg.get(membership.organizationId) ?? [],
        },
      }))
      .sort((a, b) => {
        const aActive = a.organizationId === profile?.activeOrganizationId ? 1 : 0;
        const bActive = b.organizationId === profile?.activeOrganizationId ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return a.organizationId - b.organizationId;
      });

    return respondOk(ctx, { items }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthRequiredError || (err instanceof Error && err.name === "AuthRequiredError")) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("[org-hub/organizations][GET]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return fail(ctx, 400, "INVALID_BODY");
    }

    const parsed = becomeOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return fail(ctx, 422, parsed.error.issues[0]?.message ?? "VALIDATION_FAILED");
    }

    const normalizedBody = body as Record<string, unknown>;
    const organization = await createOrganizationAtomic({
      businessName: parsed.data.businessName,
      publicName: typeof normalizedBody.publicName === "string" ? normalizedBody.publicName : parsed.data.businessName,
      entityType: typeof normalizedBody.entityType === "string" ? normalizedBody.entityType : null,
      addressId: typeof normalizedBody.addressId === "string" ? normalizedBody.addressId : null,
      username: parsed.data.username,
      primaryModule: parsed.data.primaryModule,
      modules: parsed.data.modules,
      publicWebsite: typeof normalizedBody.publicWebsite === "string" ? normalizedBody.publicWebsite : null,
    });

    return respondOk(
      ctx,
      {
        organization: {
          id: organization.id,
          publicName: organization.publicName,
          username: organization.username,
          businessName: organization.businessName,
          entityType: organization.entityType,
          addressId: organization.addressId ?? null,
          primaryModule: organization.primaryModule ?? null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError || (err instanceof Error && err.name === "AuthRequiredError")) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    if (err instanceof UsernameTakenError) {
      return fail(ctx, 409, "USERNAME_TAKEN");
    }
    if (typeof err === "object" && err && "message" in err) {
      const message = String((err as { message?: unknown }).message ?? "");
      if (message === "EMAIL_NOT_VERIFIED") {
        return fail(ctx, 403, "EMAIL_NOT_VERIFIED");
      }
      if (message === "BUSINESS_NAME_REQUIRED") {
        return fail(ctx, 422, "BUSINESS_NAME_REQUIRED");
      }
      if (message === "OFFICIAL_EMAIL_REQUIRED") {
        return fail(ctx, 422, "OFFICIAL_EMAIL_REQUIRED");
      }
      if (message === "INVALID_WEBSITE" || message === "INVALID_ADDRESS") {
        return fail(ctx, 422, message);
      }
      if (message.toUpperCase().includes("USERNAME")) {
        return fail(ctx, 409, "USERNAME_TAKEN");
      }
      if (message === "PROFILE_NOT_FOUND") {
        return fail(ctx, 404, message);
      }
      if (message === "AUTH_REQUIRED") {
        return fail(ctx, 401, "UNAUTHENTICATED");
      }
    }

    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
      return fail(ctx, 409, "USERNAME_TAKEN");
    }

    console.error("[org-hub/organizations][POST]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
