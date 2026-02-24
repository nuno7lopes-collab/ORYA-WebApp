import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole } from "@prisma/client";
import { enforceGroupGovernanceInvariants } from "@/lib/domain/groupGovernanceInvariants";

function parsePositiveInt(raw: string | null | undefined) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function normalizeGroupName(raw: unknown) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  return trimmed;
}

async function resolveGroupAccess(params: { groupId: number; userId: string }) {
  const { groupId, userId } = params;
  const group = await prisma.organizationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, ownerUserId: true, showLinkedOrganizationsPublicly: true },
  });
  if (!group) {
    return { ok: false as const, status: 404, error: "GROUP_NOT_FOUND" };
  }
  const isOwner = group.ownerUserId === userId;
  if (isOwner) {
    return { ok: true as const, group, isOwner };
  }
  const governanceMember = await prisma.organizationGroupMember.findFirst({
    where: {
      groupId,
      userId,
      isGovernance: true,
      role: { in: [OrganizationMemberRole.OWNER, OrganizationMemberRole.CO_OWNER, OrganizationMemberRole.ADMIN] },
    },
    select: { id: true, role: true },
  });
  if (!governanceMember) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }
  return { ok: true as const, group, isOwner: false };
}

async function _GET(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(ctx, { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false }, { status: 400 });
    }

    const access = await resolveGroupAccess({ groupId, userId: user.id });
    if (!access.ok) {
      return respondError(ctx, { errorCode: access.error, message: access.error, retryable: false }, { status: access.status });
    }

    const [organizations, governanceMembers] = await Promise.all([
      prisma.organization.findMany({
        where: { groupId },
        select: { id: true, publicName: true, businessName: true, username: true, status: true },
        orderBy: { id: "asc" },
      }),
      prisma.organizationGroupMember.findMany({
        where: {
          groupId,
          isGovernance: true,
          role: { in: [OrganizationMemberRole.OWNER, OrganizationMemberRole.CO_OWNER, OrganizationMemberRole.ADMIN] },
        },
        select: {
          userId: true,
          role: true,
          user: { select: { fullName: true, username: true, avatarUrl: true, isDeleted: true } },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    return respondOk(
      ctx,
      {
        group: {
          id: access.group.id,
          name: access.group.name,
          ownerUserId: access.group.ownerUserId,
          showLinkedOrganizationsPublicly: access.group.showLinkedOrganizationsPublicly,
        },
        organizations: organizations.map((org) => ({
          id: org.id,
          name: org.publicName?.trim() || org.businessName?.trim() || `Organização #${org.id}`,
          username: org.username,
          status: org.status,
        })),
        governanceMembers: governanceMembers.map((member) => ({
          userId: member.userId,
          role: member.role,
          fullName: member.user?.isDeleted ? null : member.user?.fullName ?? null,
          username: member.user?.isDeleted ? null : member.user?.username ?? null,
          avatarUrl: member.user?.isDeleted ? null : member.user?.avatarUrl ?? null,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return respondError(
        ctx,
        { errorCode: err.code, message: err.code, retryable: false },
        { status: err.status ?? 401 },
      );
    }
    console.error("[org-hub/groups/governance][GET]", err);
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

    const group = await prisma.organizationGroup.findUnique({
      where: { id: groupId },
      select: { id: true, ownerUserId: true, name: true, showLinkedOrganizationsPublicly: true },
    });
    if (!group) {
      return respondError(ctx, { errorCode: "GROUP_NOT_FOUND", message: "GROUP_NOT_FOUND", retryable: false }, { status: 404 });
    }
    if (group.ownerUserId !== user.id) {
      return respondError(ctx, { errorCode: "ONLY_GROUP_OWNER", message: "ONLY_GROUP_OWNER", retryable: false }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const hasNameInput = Object.prototype.hasOwnProperty.call(body ?? {}, "name");
    const hasVisibilityInput = Object.prototype.hasOwnProperty.call(body ?? {}, "showLinkedOrganizationsPublicly");

    const name = hasNameInput ? normalizeGroupName(body?.name) : null;
    if (hasNameInput && !name) {
      return respondError(ctx, { errorCode: "INVALID_NAME", message: "Nome inválido.", retryable: false }, { status: 400 });
    }

    const showLinkedOrganizationsPubliclyInput =
      hasVisibilityInput && typeof body?.showLinkedOrganizationsPublicly === "boolean"
        ? body.showLinkedOrganizationsPublicly
        : undefined;
    if (hasVisibilityInput && showLinkedOrganizationsPubliclyInput === undefined) {
      return respondError(
        ctx,
        {
          errorCode: "INVALID_VISIBILITY_FLAG",
          message: "Valor de visibilidade inválido.",
          retryable: false,
        },
        { status: 400 },
      );
    }

    if (!hasNameInput && !hasVisibilityInput) {
      return respondError(
        ctx,
        {
          errorCode: "NO_UPDATES",
          message: "Sem alterações para aplicar.",
          retryable: false,
        },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updates: { name?: string; showLinkedOrganizationsPublicly?: boolean } = {};
      if (name) updates.name = name;
      if (showLinkedOrganizationsPubliclyInput !== undefined) {
        updates.showLinkedOrganizationsPublicly = showLinkedOrganizationsPubliclyInput;
      }
      const groupUpdated = await tx.organizationGroup.update({
        where: { id: groupId },
        data: updates,
      });
      await enforceGroupGovernanceInvariants(tx, groupId);
      return groupUpdated;
    });

    return respondOk(
      ctx,
      {
        group: {
          id: updated.id,
          name: updated.name,
          ownerUserId: updated.ownerUserId,
          showLinkedOrganizationsPublicly: updated.showLinkedOrganizationsPublicly,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return respondError(
        ctx,
        { errorCode: err.code, message: err.code, retryable: false },
        { status: err.status ?? 401 },
      );
    }
    console.error("[org-hub/groups/governance][PATCH]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
