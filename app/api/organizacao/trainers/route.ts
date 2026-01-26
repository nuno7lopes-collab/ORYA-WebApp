import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { NotificationType, OrganizationMemberRole, OrganizationModule, TrainerProfileReviewStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { createNotification } from "@/lib/notifications";
import { ensureGroupMemberForOrg } from "@/lib/organizationGroupAccess";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const organizationId = parseOrganizationId(url.searchParams.get("organizationId"));

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "VIEW",
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const trainerMembers = await prisma.organizationMember.findMany({
      where: { organizationId: organization.id, role: OrganizationMemberRole.TRAINER },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const trainerUserIds = trainerMembers.map((m) => m.userId);
    const trainerProfiles = trainerUserIds.length
      ? await prisma.trainerProfile.findMany({
          where: { organizationId: organization.id, userId: { in: trainerUserIds } },
        })
      : [];

    const profileByUser = new Map(trainerProfiles.map((profile) => [profile.userId, profile]));

    const items = trainerMembers.map((member) => {
      const profile = profileByUser.get(member.userId) ?? null;
      return {
        userId: member.userId,
        fullName: member.user?.fullName ?? null,
        username: member.user?.username ?? null,
        avatarUrl: member.user?.avatarUrl ?? null,
        isPublished: profile?.isPublished ?? false,
        reviewStatus: profile?.reviewStatus ?? TrainerProfileReviewStatus.DRAFT,
        reviewNote: profile?.reviewNote ?? null,
        reviewRequestedAt: profile?.reviewRequestedAt?.toISOString() ?? null,
        profile,
      };
    });

    return NextResponse.json({ ok: true, items, organizationId: organization.id }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/trainers][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const action = typeof body?.action === "string" ? body.action.toUpperCase() : null;
    const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim() : null;

    if (!targetUserId || !action) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "EDIT",
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const trainerMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: targetUserId } },
    });

    if (!trainerMembership || trainerMembership.role !== OrganizationMemberRole.TRAINER) {
      return NextResponse.json({ ok: false, error: "NOT_TRAINER" }, { status: 404 });
    }

    const existingProfile = await prisma.trainerProfile.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: targetUserId } },
    });

    const allowedActions = new Set(["APPROVE", "REJECT", "HIDE", "PUBLISH"]);
    if (!allowedActions.has(action)) {
      return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
    }
    if (action === "PUBLISH" && existingProfile?.reviewStatus !== TrainerProfileReviewStatus.APPROVED) {
      return NextResponse.json({ ok: false, error: "NEEDS_APPROVAL" }, { status: 400 });
    }

    const now = new Date();

    const profile = await prisma.trainerProfile.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: targetUserId } },
      update: (() => {
        if (action === "APPROVE") {
          return {
            isPublished: true,
            reviewStatus: TrainerProfileReviewStatus.APPROVED,
            reviewNote: null,
            reviewRequestedAt: null,
            reviewedAt: now,
            reviewedByUserId: user.id,
          };
        }
        if (action === "REJECT") {
          return {
            isPublished: false,
            reviewStatus: TrainerProfileReviewStatus.REJECTED,
            reviewNote,
            reviewRequestedAt: null,
            reviewedAt: now,
            reviewedByUserId: user.id,
          };
        }
        if (action === "HIDE") {
          return {
            isPublished: false,
          };
        }
        if (action === "PUBLISH") {
          return {
            isPublished: true,
          };
        }
        return {};
      })(),
      create: {
        organizationId: organization.id,
        userId: targetUserId,
        isPublished: action === "APPROVE" || action === "PUBLISH",
        reviewStatus:
          action === "APPROVE"
            ? TrainerProfileReviewStatus.APPROVED
            : action === "REJECT"
              ? TrainerProfileReviewStatus.REJECTED
              : TrainerProfileReviewStatus.DRAFT,
        reviewNote: action === "REJECT" ? reviewNote : null,
        reviewedAt: action === "APPROVE" || action === "REJECT" ? now : null,
        reviewedByUserId: action === "APPROVE" || action === "REJECT" ? user.id : null,
      },
    });

    if (action === "APPROVE" || action === "REJECT") {
      await createNotification({
        userId: targetUserId,
        type: NotificationType.SYSTEM_ANNOUNCE,
        title: action === "APPROVE" ? "Perfil aprovado" : "Perfil recusado",
        body:
          action === "APPROVE"
            ? `A organização ${organization.publicName ?? "ORYA"} aprovou o teu perfil de treinador.`
            : `A organização ${organization.publicName ?? "ORYA"} recusou o teu perfil. ${reviewNote ? `Motivo: ${reviewNote}` : ""}`,
        ctaUrl: "/organizacao/treinadores",
        ctaLabel: "Ver perfil",
        organizationId: organization.id,
      }).catch((err) => console.warn("[trainer][review] notification fail", err));
    }

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/trainers][PATCH]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
    const rawUsername = typeof body?.username === "string" ? body.username.trim() : "";
    const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;

    if (!username) {
      return NextResponse.json({ ok: false, error: "MISSING_USERNAME" }, { status: 400 });
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "EDIT",
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const targetProfile = await prisma.profile.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true },
    });

    if (!targetProfile) {
      return NextResponse.json({ ok: false, error: "USERNAME_NOT_FOUND" }, { status: 404 });
    }

    const existingMember = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: targetProfile.id } },
    });

    let assignedTrainerRole = false;
    if (!existingMember) {
      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: targetProfile.id,
          role: OrganizationMemberRole.TRAINER,
          status: "ACTIVE",
        },
      });
      assignedTrainerRole = true;
    } else if (
      existingMember.role !== OrganizationMemberRole.TRAINER &&
      ![OrganizationMemberRole.OWNER, OrganizationMemberRole.CO_OWNER, OrganizationMemberRole.ADMIN].includes(existingMember.role)
    ) {
      await prisma.organizationMember.update({
        where: { organizationId_userId: { organizationId: organization.id, userId: targetProfile.id } },
        data: { role: OrganizationMemberRole.TRAINER },
      });
      assignedTrainerRole = true;
    }

    if (assignedTrainerRole) {
      const org = await prisma.organization.findUnique({
        where: { id: organization.id },
        select: { groupId: true },
      });
      if (!org?.groupId) {
        throw new Error("ORG_GROUP_NOT_FOUND");
      }

      const targetGroup = await prisma.organizationGroupMember.findUnique({
        where: { groupId_userId: { groupId: org.groupId, userId: targetProfile.id } },
        select: { id: true, scopeAllOrgs: true, scopeOrgIds: true, role: true },
      });

      if (!targetGroup) {
        await ensureGroupMemberForOrg({
          organizationId: organization.id,
          userId: targetProfile.id,
          role: OrganizationMemberRole.TRAINER,
        });
      } else {
        const scopeOrgIds = targetGroup.scopeOrgIds ?? [];
        const hasMultipleScopes = targetGroup.scopeAllOrgs || scopeOrgIds.length > 1;
        if (hasMultipleScopes && targetGroup.role !== OrganizationMemberRole.TRAINER) {
          await prisma.organizationGroupMemberOrganizationOverride.upsert({
            where: {
              groupMemberId_organizationId: {
                groupMemberId: targetGroup.id,
                organizationId: organization.id,
              },
            },
            update: { roleOverride: OrganizationMemberRole.TRAINER, revokedAt: null },
            create: {
              groupMemberId: targetGroup.id,
              organizationId: organization.id,
              roleOverride: OrganizationMemberRole.TRAINER,
            },
          });
        } else {
          await prisma.organizationGroupMember.update({
            where: { id: targetGroup.id },
            data: { role: OrganizationMemberRole.TRAINER },
          });
          await prisma.organizationGroupMemberOrganizationOverride.deleteMany({
            where: { groupMemberId: targetGroup.id, organizationId: organization.id },
          });
        }
      }
    }

    const profile = await prisma.trainerProfile.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: targetProfile.id } },
      update: {},
      create: {
        organizationId: organization.id,
        userId: targetProfile.id,
        isPublished: false,
        reviewStatus: TrainerProfileReviewStatus.DRAFT,
      },
    });

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/trainers][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
