export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  AgendaResourceClaimStatus,
  AgendaResourceClaimType,
  OrganizationMemberRole,
  OrganizationModule,
  Prisma,
  SourceType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";

type ClaimInput = {
  resourceType: AgendaResourceClaimType;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
  sourceType: SourceType;
  sourceId: string;
  metadata: Prisma.JsonObject;
};

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeClaimInput(
  raw: unknown,
  fallbackSourceType: SourceType,
  fallbackSourceId: string,
): ClaimInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const resourceTypeRaw = typeof input.resourceType === "string" ? input.resourceType.trim().toUpperCase() : "";
  const resourceType = Object.values(AgendaResourceClaimType).includes(resourceTypeRaw as AgendaResourceClaimType)
    ? (resourceTypeRaw as AgendaResourceClaimType)
    : null;
  if (!resourceType) return null;

  const resourceId =
    typeof input.resourceId === "string"
      ? input.resourceId.trim()
      : typeof input.resourceId === "number"
        ? String(Math.floor(input.resourceId))
        : "";
  if (!resourceId) return null;

  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  if (!startsAt || !endsAt || endsAt <= startsAt) return null;

  const sourceTypeRaw = typeof input.sourceType === "string" ? input.sourceType.trim().toUpperCase() : "";
  const sourceType = Object.values(SourceType).includes(sourceTypeRaw as SourceType)
    ? (sourceTypeRaw as SourceType)
    : fallbackSourceType;

  const sourceId =
    typeof input.sourceId === "string" && input.sourceId.trim().length > 0
      ? input.sourceId.trim()
      : fallbackSourceId;

  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? (input.metadata as Prisma.JsonObject)
      : {};

  return {
    resourceType,
    resourceId,
    startsAt,
    endsAt,
    sourceType,
    sourceId,
    metadata,
  };
}

function mapPrismaError(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (err.code === "P2002" || err.code === "P2004") {
    return { status: 409, error: "RESOURCE_CLAIM_CONFLICT" };
  }
  return null;
}

async function ensureOrganization(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "UNAUTHENTICATED" };

  const organizationId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(organizationId) ? organizationId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return { ok: false as const, status: 403, error: "NO_ORGANIZATION" };

  const permission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return { ok: false as const, status: 403, error: "FORBIDDEN" };

  return { ok: true as const, organizationId: organization.id, userId: user.id };
}

async function _POST(req: NextRequest) {
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

  const auth = await ensureOrganization(req);
  if (!auth.ok) return jsonWrap({ ok: false, error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });

  const event = await prisma.event.findFirst({
    where: { id: Math.floor(eventId), organizationId: auth.organizationId },
    select: { id: true },
  });
  if (!event) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const fallbackSourceTypeRaw = typeof body.sourceType === "string" ? body.sourceType.trim().toUpperCase() : "";
  const fallbackSourceType = Object.values(SourceType).includes(fallbackSourceTypeRaw as SourceType)
    ? (fallbackSourceTypeRaw as SourceType)
    : SourceType.EVENT;
  const fallbackSourceId =
    typeof body.sourceId === "string" && body.sourceId.trim().length > 0
      ? body.sourceId.trim()
      : String(event.id);

  const claimsRaw = Array.isArray(body.resourceClaims) ? body.resourceClaims : [];
  if (claimsRaw.length === 0) {
    return jsonWrap({ ok: false, error: "RESOURCE_CLAIMS_REQUIRED" }, { status: 400 });
  }
  if (claimsRaw.length > 32) {
    return jsonWrap({ ok: false, error: "RESOURCE_CLAIMS_LIMIT_EXCEEDED" }, { status: 400 });
  }

  const claims = claimsRaw
    .map((item) => normalizeClaimInput(item, fallbackSourceType, fallbackSourceId))
    .filter((item): item is ClaimInput => Boolean(item));
  if (claims.length !== claimsRaw.length) {
    return jsonWrap({ ok: false, error: "INVALID_RESOURCE_CLAIM" }, { status: 400 });
  }

  const lockKeys = Array.from(
    new Set(
      claims
        .map((claim) => `${auth.organizationId}:${claim.resourceType}:${claim.resourceId}`)
        .sort((a, b) => a.localeCompare(b)),
    ),
  );

  const bundleId = crypto.randomUUID();

  try {
    const created = await prisma.$transaction(async (tx) => {
      for (const key of lockKeys) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      }

      for (const claim of claims) {
        const conflict = await tx.agendaResourceClaim.findFirst({
          where: {
            organizationId: auth.organizationId,
            resourceType: claim.resourceType,
            resourceId: claim.resourceId,
            status: AgendaResourceClaimStatus.CLAIMED,
            startsAt: { lt: claim.endsAt },
            endsAt: { gt: claim.startsAt },
          },
          select: {
            id: true,
            sourceType: true,
            sourceId: true,
            startsAt: true,
            endsAt: true,
            resourceType: true,
            resourceId: true,
          },
        });
        if (conflict) {
          throw Object.assign(new Error("RESOURCE_CLAIM_CONFLICT"), {
            status: 409,
            conflict,
          });
        }
      }

      await tx.agendaResourceClaim.createMany({
        data: claims.map((claim) => ({
          bundleId,
          organizationId: auth.organizationId,
          eventId: event.id,
          sourceType: claim.sourceType,
          sourceId: claim.sourceId,
          resourceType: claim.resourceType,
          resourceId: claim.resourceId,
          startsAt: claim.startsAt,
          endsAt: claim.endsAt,
          status: AgendaResourceClaimStatus.CLAIMED,
          metadata: claim.metadata,
        })),
      });

      return tx.agendaResourceClaim.findMany({
        where: { organizationId: auth.organizationId, bundleId },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      });
    });

    await recordOrganizationAuditSafe({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: "PADEL_CALENDAR_CLAIMS_COMMIT",
      metadata: {
        eventId: event.id,
        bundleId,
        claimCount: created.length,
        claims: created.map((claim) => ({
          id: claim.id,
          resourceType: claim.resourceType,
          resourceId: claim.resourceId,
          startsAt: claim.startsAt,
          endsAt: claim.endsAt,
          sourceType: claim.sourceType,
          sourceId: claim.sourceId,
        })),
      },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    });

    return jsonWrap({ ok: true, bundleId, claims: created }, { status: 201 });
  } catch (error) {
    const prismaError = mapPrismaError(error);
    if (prismaError) return jsonWrap({ ok: false, error: prismaError.error }, { status: prismaError.status });

    const status =
      error && typeof error === "object" && "status" in error && typeof (error as { status?: unknown }).status === "number"
        ? ((error as { status: number }).status as number)
        : 500;
    const conflict =
      error && typeof error === "object" && "conflict" in error
        ? (error as { conflict?: unknown }).conflict
        : undefined;
    const message =
      error instanceof Error && error.message === "RESOURCE_CLAIM_CONFLICT"
        ? "RESOURCE_CLAIM_CONFLICT"
        : "CLAIMS_COMMIT_FAILED";
    return jsonWrap({ ok: false, error: message, ...(conflict ? { conflict } : {}) }, { status });
  }
}

export const POST = withApiEnvelope(_POST);
