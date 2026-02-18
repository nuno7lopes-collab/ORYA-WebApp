import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole } from "@prisma/client";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { enforceGroupGovernanceInvariants } from "@/lib/domain/groupGovernanceInvariants";

function parsePositiveInt(raw: string | null | undefined) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function normalizeRole(raw: unknown) {
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  if (upper === "CO_OWNER" || upper === "ADMIN") return upper as OrganizationMemberRole;
  return null;
}

async function resolveOwnerGroup(params: { groupId: number; userId: string }) {
  const group = await prisma.organizationGroup.findUnique({
    where: { id: params.groupId },
    select: { id: true, ownerUserId: true },
  });
  if (!group) {
    return { ok: false as const, status: 404, error: "GROUP_NOT_FOUND" };
  }
  if (group.ownerUserId !== params.userId) {
    return { ok: false as const, status: 403, error: "ONLY_GROUP_OWNER" };
  }
  return { ok: true as const, group };
}

async function _POST(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(ctx, { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false }, { status: 400 });
    }

    const access = await resolveOwnerGroup({ groupId, userId: user.id });
    if (!access.ok) {
      return respondError(ctx, { errorCode: access.error, message: access.error, retryable: false }, { status: access.status });
    }

    const body = await req.json().catch(() => null);
    const userIdentifier = typeof body?.userIdentifier === "string" ? body.userIdentifier.trim() : "";
    const role = normalizeRole(body?.role);
    if (!userIdentifier || !role) {
      return respondError(ctx, { errorCode: "INVALID_BODY", message: "Dados inválidos.", retryable: false }, { status: 400 });
    }

    const resolved = await resolveUserIdentifier(userIdentifier);
    const targetUserId = resolved?.userId ?? null;
    if (!targetUserId) {
      return respondError(ctx, { errorCode: "USER_NOT_FOUND", message: "USER_NOT_FOUND", retryable: false }, { status: 404 });
    }
    if (targetUserId === access.group.ownerUserId) {
      return respondError(ctx, { errorCode: "GROUP_OWNER_INVARIANT", message: "GROUP_OWNER_INVARIANT", retryable: false }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationGroupMember.upsert({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        update: {
          isGovernance: true,
          role,
          rolePack: null,
          scopeAllOrgs: true,
          scopeOrgIds: [],
        },
        create: {
          groupId,
          userId: targetUserId,
          isGovernance: true,
          role,
          rolePack: null,
          scopeAllOrgs: true,
          scopeOrgIds: [],
        },
      });
      await enforceGroupGovernanceInvariants(tx, groupId);
    });

    return respondOk(ctx, { ok: true }, { status: 200 });
  } catch (err) {
    console.error("[org-hub/groups/governance/members][POST]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

async function _PATCH(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(ctx, { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false }, { status: 400 });
    }

    const access = await resolveOwnerGroup({ groupId, userId: user.id });
    if (!access.ok) {
      return respondError(ctx, { errorCode: access.error, message: access.error, retryable: false }, { status: access.status });
    }

    const body = await req.json().catch(() => null);
    const targetUserId = typeof body?.userId === "string" ? body.userId : "";
    const role = normalizeRole(body?.role);
    if (!targetUserId || !role) {
      return respondError(ctx, { errorCode: "INVALID_BODY", message: "Dados inválidos.", retryable: false }, { status: 400 });
    }
    if (targetUserId === access.group.ownerUserId) {
      return respondError(ctx, { errorCode: "GROUP_OWNER_INVARIANT", message: "GROUP_OWNER_INVARIANT", retryable: false }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const member = await tx.organizationGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        select: { id: true },
      });
      if (!member) {
        throw new Error("GROUP_MEMBER_NOT_FOUND");
      }
      await tx.organizationGroupMember.update({
        where: { id: member.id },
        data: {
          isGovernance: true,
          role,
          rolePack: null,
          scopeAllOrgs: true,
          scopeOrgIds: [],
        },
      });
      await enforceGroupGovernanceInvariants(tx, groupId);
    });

    return respondOk(ctx, { ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "GROUP_MEMBER_NOT_FOUND") {
      return respondError(
        ctx,
        { errorCode: "GROUP_MEMBER_NOT_FOUND", message: "GROUP_MEMBER_NOT_FOUND", retryable: false },
        { status: 404 },
      );
    }
    console.error("[org-hub/groups/governance/members][PATCH]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

async function _DELETE(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(ctx, { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false }, { status: 400 });
    }

    const access = await resolveOwnerGroup({ groupId, userId: user.id });
    if (!access.ok) {
      return respondError(ctx, { errorCode: access.error, message: access.error, retryable: false }, { status: access.status });
    }

    const body = await req.json().catch(() => null);
    const targetUserId = typeof body?.userId === "string" ? body.userId : "";
    if (!targetUserId) {
      return respondError(ctx, { errorCode: "INVALID_BODY", message: "Dados inválidos.", retryable: false }, { status: 400 });
    }
    if (targetUserId === access.group.ownerUserId) {
      return respondError(ctx, { errorCode: "GROUP_OWNER_INVARIANT", message: "GROUP_OWNER_INVARIANT", retryable: false }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const member = await tx.organizationGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        select: { id: true },
      });
      if (!member) {
        throw new Error("GROUP_MEMBER_NOT_FOUND");
      }
      await tx.organizationGroupMemberOrganizationOverride.deleteMany({
        where: { groupMemberId: member.id },
      });
      await tx.organizationGroupMember.delete({ where: { id: member.id } });
      await enforceGroupGovernanceInvariants(tx, groupId);
    });

    return respondOk(ctx, { ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "GROUP_MEMBER_NOT_FOUND") {
      return respondError(
        ctx,
        { errorCode: "GROUP_MEMBER_NOT_FOUND", message: "GROUP_MEMBER_NOT_FOUND", retryable: false },
        { status: 404 },
      );
    }
    console.error("[org-hub/groups/governance/members][DELETE]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
