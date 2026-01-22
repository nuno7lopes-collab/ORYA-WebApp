import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { createNotification } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";
import { canManageMembers, isOrgAdminOrAbove, isOrgOwner } from "@/lib/organizationPermissions";
import { ensureUserIsOrganization, setSoleOwner } from "@/lib/organizationRoles";
import { sanitizeProfileVisibility } from "@/lib/profileVisibility";
import { sendEmail } from "@/lib/resendClient";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

const resolveIp = (req: NextRequest) => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return null;
};

const INVITE_EXPIRY_DAYS = 14;

type InviteStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";

const serializeInvite = (
  invite: {
    id: string;
    organizationId: number;
    targetIdentifier: string;
    targetUserId: string | null;
    role: string;
    token: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date | null;
    invitedBy?: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      visibility?: string | null;
      isDeleted?: boolean | null;
    } | null;
    targetUser?: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      visibility?: string | null;
      isDeleted?: boolean | null;
    } | null;
  },
  viewer?: { id: string; username?: string | null; email?: string | null },
) => {
  const now = Date.now();
  const isExpired = !!invite.expiresAt && invite.expiresAt.getTime() < now;
  const status: InviteStatus = invite.cancelledAt
    ? "CANCELLED"
    : invite.acceptedAt
      ? "ACCEPTED"
      : invite.declinedAt
        ? "DECLINED"
        : isExpired
          ? "EXPIRED"
          : "PENDING";

  const normalizedTarget = invite.targetIdentifier.toLowerCase();
  const canRespond =
    !!viewer &&
    (invite.targetUserId === viewer.id ||
      (viewer.username && viewer.username.toLowerCase() === normalizedTarget) ||
      (viewer.email && viewer.email.toLowerCase() === normalizedTarget));

  return {
    id: invite.id,
    organizationId: invite.organizationId,
    role: invite.role,
    targetIdentifier: invite.targetIdentifier,
    targetUserId: invite.targetUserId,
    status,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    createdAt: invite.createdAt?.toISOString() ?? null,
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    declinedAt: invite.declinedAt?.toISOString() ?? null,
    cancelledAt: invite.cancelledAt?.toISOString() ?? null,
    invitedBy: sanitizeProfileVisibility(invite.invitedBy ?? null),
    targetUser: sanitizeProfileVisibility(invite.targetUser ?? null),
    canRespond,
  };
};

async function sendInviteEmail(invite: {
  id: string;
  organizationId: number;
  targetIdentifier: string;
  role: string;
  token: string;
  organization?: { publicName: string | null } | null;
}) {
  const normalized = invite.targetIdentifier.toLowerCase();
  if (!normalized.includes("@")) return;

  const origin = "https://orya.pt";
  const acceptUrl = `${origin}/convites/organizacoes?invite=${invite.id}&token=${invite.token}`;
  const roleLabel =
    invite.role === "OWNER" ? "Owner" : invite.role === "CO_OWNER" ? "Co-owner" : invite.role.toUpperCase();
  const orgName = invite.organization?.publicName ?? "ORYA";

  try {
    await sendEmail({
      to: normalized,
      subject: `Convite para a organização ${orgName}`,
      html: `
        <div style="font-family: Inter, system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #050915; color: #f6f8ff; border-radius: 18px; border: 1px solid rgba(255,255,255,0.08);">
          <h2 style="margin: 0 0 12px; font-size: 22px;">Convite para ${orgName}</h2>
          <p style="margin: 0 0 12px;">Papel: <strong>${roleLabel}</strong></p>
          <p style="margin: 0 0 16px;">Entra e aceita o convite.</p>
          <a href="${acceptUrl}" style="display: inline-block; margin-top: 8px; padding: 12px 18px; background: linear-gradient(90deg,#7cf2ff,#7b7bff,#ff7ddb); color: #0b0f1c; text-decoration: none; font-weight: 700; border-radius: 999px;">Abrir convite</a>
          <p style="margin: 16px 0 0; font-size: 12px; color: rgba(255,255,255,0.7);">Link direto: <a href="${acceptUrl}" style="color: #8fd6ff;">${acceptUrl}</a></p>
        </div>
      `,
      text: `Convite para a organização ${orgName} como ${roleLabel}. Abre: ${acceptUrl}`,
    });
  } catch (err) {
    console.warn("[invite][email] falhou", err);
  }
}

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

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { username: true },
    });

    const url = new URL(req.url);
    const eventIdRaw = url.searchParams.get("eventId");
    let organizationId = resolveOrganizationIdFromParams(url.searchParams);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
    if (!organizationId && eventIdRaw) {
      const eventId = Number(eventIdRaw);
      if (eventId && !Number.isNaN(eventId)) {
        const ev = await prisma.event.findUnique({
          where: { id: eventId },
          select: { organizationId: true },
        });
        organizationId = ev?.organizationId ?? null;
      }
    }
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    const isManager = membership ? isOrgAdminOrAbove(membership.role) : false;

    const viewerEmail = user.email?.toLowerCase() ?? null;
    const viewerUsername = profile?.username ?? null;

    // Se não é manager, só pode ver convites dirigidos a si
    if (!isManager) {
      const inviteForUser = await prisma.organizationMemberInvite.findFirst({
        where: {
          organizationId,
          cancelledAt: null,
          acceptedAt: null,
          OR: [
            { targetUserId: user.id },
            ...(viewerEmail
              ? [{ targetIdentifier: { equals: viewerEmail, mode: Prisma.QueryMode.insensitive } }]
              : []),
            ...(viewerUsername
              ? [{ targetIdentifier: { equals: viewerUsername, mode: Prisma.QueryMode.insensitive } }]
              : []),
          ],
        },
      });
      if (!inviteForUser) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }

    const invites = await prisma.organizationMemberInvite.findMany({
      where: {
        organizationId,
        ...(isManager
          ? {}
          : {
              OR: [
                { targetUserId: user.id },
                ...(viewerEmail
                  ? [{ targetIdentifier: { equals: viewerEmail, mode: Prisma.QueryMode.insensitive } }]
                  : []),
                ...(viewerUsername
                  ? [{ targetIdentifier: { equals: viewerUsername, mode: Prisma.QueryMode.insensitive } }]
                  : []),
              ],
            }),
      },
      include: {
        invitedBy: { select: { id: true, username: true, fullName: true, avatarUrl: true, visibility: true, isDeleted: true } },
        targetUser: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            visibility: true,
            isDeleted: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const viewer = { id: user.id, username: viewerUsername, email: viewerEmail };
    return NextResponse.json(
      {
        ok: true,
        viewerRole: membership?.role ?? null,
        organizationId,
        items: invites.map((inv) => serializeInvite(inv, viewer)),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/members/invites][GET]", err);
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
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : null;
    const roleRaw = typeof body?.role === "string" ? body.role.toUpperCase() : null;

    if (!organizationId || !identifier || !roleRaw) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (!Object.values(OrganizationMemberRole).includes(roleRaw as OrganizationMemberRole)) {
      return NextResponse.json({ ok: false, error: "INVALID_ROLE" }, { status: 400 });
    }
    if (roleRaw === "VIEWER") {
      return NextResponse.json({ ok: false, error: "ROLE_NOT_ALLOWED" }, { status: 400 });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!membership || !canManageMembers(membership.role, null, roleRaw as OrganizationMemberRole)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    if (roleRaw === "OWNER" && !isOrgOwner(membership.role)) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_SET_OWNER" }, { status: 403 });
    }
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    const emailGate = ensureOrganizationEmailVerified(organization ?? {});
    if (!emailGate.ok) {
      return NextResponse.json({ ok: false, error: emailGate.error }, { status: 403 });
    }

    const resolved = await resolveUserIdentifier(identifier);
    const viewerProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { username: true },
    });
    const targetUserId = resolved?.userId ?? null;

    // Bloquear convites para quem já é membro
    if (targetUserId) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: targetUserId } },
      });
      if (existingMember) {
        return NextResponse.json(
          { ok: false, error: "Utilizador já é membro desta organização." },
          { status: 400 },
        );
      }
    }

    const normalizedIdentifier = identifier.toLowerCase();
    await prisma.organizationMemberInvite.updateMany({
      where: {
        organizationId,
        acceptedAt: null,
        cancelledAt: null,
        declinedAt: null,
        OR: [
          { targetIdentifier: { equals: normalizedIdentifier, mode: Prisma.QueryMode.insensitive } },
          ...(targetUserId ? [{ targetUserId }] : []),
        ],
      },
      data: { cancelledAt: new Date() },
    });

    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.organizationMemberInvite.create({
      data: {
        organizationId,
        invitedByUserId: user.id,
        targetIdentifier: identifier,
        targetUserId,
        role: roleRaw as OrganizationMemberRole,
        token: crypto.randomUUID(),
        expiresAt,
      },
      include: {
        invitedBy: { select: { id: true, username: true, fullName: true, avatarUrl: true, visibility: true } },
        targetUser: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            visibility: true,
          },
        },
        organization: { select: { id: true, publicName: true } },
      },
    });

    await recordOrganizationAuditSafe({
      organizationId,
      actorUserId: user.id,
      action: "INVITE_CREATED",
      toUserId: targetUserId,
      metadata: { inviteId: invite.id, role: invite.role, target: invite.targetIdentifier },
      ip: resolveIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    const viewer = {
      id: user.id,
      username: viewerProfile?.username ?? null,
      email: user.email ? user.email.toLowerCase() : null,
    };

    // Notificação para o alvo (se user conhecido)
    if (targetUserId) {
      await createNotification({
        userId: targetUserId,
        type: NotificationType.ORGANIZATION_INVITE,
        title: "Convite para organização",
        body: `Foste convidado para a organização ${invite.organization?.publicName ?? "ORYA"}.`,
        ctaUrl: "/convites/organizacoes",
        ctaLabel: "Ver convites",
        senderVisibility: "PUBLIC",
        fromUserId: user.id,
        organizationId,
        inviteId: invite.id,
        payload: {
          organizationId,
          role: roleRaw,
          actor: { id: user.id, username: viewerProfile?.username },
        },
      }).catch((err) => console.warn("[notification][invite] falhou", err));
    }

    await sendInviteEmail(
      {
        id: invite.id,
        organizationId: invite.organizationId,
        targetIdentifier: invite.targetIdentifier,
        role: invite.role,
        token: invite.token,
        organization: invite.organization,
      },
    );

    return NextResponse.json({ ok: true, invite: serializeInvite(invite, viewer) }, { status: 201 });
  } catch (err) {
    console.error("[organização/members/invites][POST]", err);
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
    let organizationId = parseOrganizationId(body?.organizationId);
    const inviteId = typeof body?.inviteId === "string" ? body.inviteId : null;
    const tokenFromBody = typeof body?.token === "string" ? body.token : null;
    const action = typeof body?.action === "string" ? body.action.toUpperCase() : null;

    if (!action) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (!inviteId && !tokenFromBody) {
      return NextResponse.json({ ok: false, error: "NEED_INVITE_ID_OR_TOKEN" }, { status: 400 });
    }

    if (!organizationId && action !== "ACCEPT" && action !== "DECLINE") {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const invite = await prisma.organizationMemberInvite.findFirst({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(inviteId ? { id: inviteId } : {}),
        ...(tokenFromBody ? { token: tokenFromBody } : {}),
      },
      include: {
        invitedBy: { select: { id: true, username: true, fullName: true, avatarUrl: true, visibility: true } },
        targetUser: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            visibility: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    if (!organizationId) {
      organizationId = invite.organizationId;
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    const isManager = membership ? isOrgAdminOrAbove(membership.role) : false;
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    const emailGate = ensureOrganizationEmailVerified(organization ?? {});
    if (!emailGate.ok) {
      return NextResponse.json({ ok: false, error: emailGate.error }, { status: 403 });
    }

    const viewerProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { username: true, roles: true },
    });
    const viewerEmail = user.email?.toLowerCase() ?? null;
    const viewerUsername = viewerProfile?.username ?? null;

    const normalizedTarget = invite.targetIdentifier.toLowerCase();
    const isTargetUser =
      invite.targetUserId === user.id ||
      (viewerEmail && normalizedTarget === viewerEmail) ||
      (viewerUsername && normalizedTarget === viewerUsername.toLowerCase());
    const matchesToken = tokenFromBody ? invite.token === tokenFromBody : false;

    const isPending = !invite.acceptedAt && !invite.declinedAt && !invite.cancelledAt;
    const isExpired = invite.expiresAt && invite.expiresAt.getTime() < Date.now();

    const isOwnerManager = membership?.role === "OWNER";

    if (action === "CANCEL") {
      if (!isManager) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
      if (invite.role === "OWNER" && !isOwnerManager) {
        return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_CANCEL_OWNER_INVITE" }, { status: 403 });
      }
      await prisma.organizationMemberInvite.update({
        where: { id: invite.id },
        data: { cancelledAt: new Date() },
      });
    } else if (action === "RESEND") {
      if (!isManager) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
      if (invite.role === "OWNER" && !isOwnerManager) {
        return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_SET_OWNER" }, { status: 403 });
      }
      const resolved = await resolveUserIdentifier(invite.targetIdentifier);
      await prisma.organizationMemberInvite.update({
        where: { id: invite.id },
        data: {
          cancelledAt: null,
          declinedAt: null,
          acceptedAt: null,
          targetUserId: resolved?.userId ?? invite.targetUserId,
          token: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        },
      });
    } else if (action === "ACCEPT") {
      if (!isPending) {
        return NextResponse.json({ ok: false, error: "INVITE_NOT_PENDING" }, { status: 400 });
      }
      if (isExpired) {
        return NextResponse.json({ ok: false, error: "INVITE_EXPIRED" }, { status: 400 });
      }
      if (!isTargetUser && !matchesToken) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }

      const role = invite.role as OrganizationMemberRole;
      await prisma.$transaction(async (tx) => {
        const currentMember = await tx.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: user.id } },
        });

        if (currentMember) {
          await tx.organizationMemberInvite.update({
            where: { id: invite.id },
            data: {
              acceptedAt: new Date(),
              declinedAt: null,
              cancelledAt: null,
              targetUserId: user.id,
            },
          });
          const normalizedIdentifiers = [
            invite.targetIdentifier.toLowerCase(),
            viewerEmail,
            viewerUsername?.toLowerCase() ?? null,
          ].filter(Boolean) as string[];
          if (normalizedIdentifiers.length > 0) {
            await tx.organizationMemberInvite.updateMany({
              where: {
                organizationId,
                id: { not: invite.id },
                acceptedAt: null,
                declinedAt: null,
                cancelledAt: null,
                OR: [
                  { targetUserId: user.id },
                  ...normalizedIdentifiers.map((identifier) => ({
                    targetIdentifier: { equals: identifier, mode: Prisma.QueryMode.insensitive },
                  })),
                ],
              },
              data: { cancelledAt: new Date() },
            });
          }
          await ensureUserIsOrganization(tx, user.id);
          return;
        }

        if (role === "OWNER") {
          await setSoleOwner(tx, organizationId, user.id, invite.invitedByUserId);
        } else {
          await tx.organizationMember.upsert({
            where: { organizationId_userId: { organizationId, userId: user.id } },
            update: { role },
            create: {
              organizationId,
              userId: user.id,
              role,
              invitedByUserId: invite.invitedByUserId,
            },
          });
        }

        await tx.organizationMemberInvite.update({
          where: { id: invite.id },
          data: {
            acceptedAt: new Date(),
            declinedAt: null,
            cancelledAt: null,
            targetUserId: user.id,
          },
        });

        await ensureUserIsOrganization(tx, user.id);

        const normalizedIdentifiers = [
          invite.targetIdentifier.toLowerCase(),
          viewerEmail,
          viewerUsername?.toLowerCase() ?? null,
        ].filter(Boolean) as string[];

        if (normalizedIdentifiers.length > 0) {
          await tx.organizationMemberInvite.updateMany({
            where: {
              organizationId,
              id: { not: invite.id },
              acceptedAt: null,
              declinedAt: null,
              cancelledAt: null,
              OR: [
                { targetUserId: user.id },
                ...normalizedIdentifiers.map((identifier) => ({
                  targetIdentifier: { equals: identifier, mode: Prisma.QueryMode.insensitive },
                })),
              ],
            },
            data: { cancelledAt: new Date() },
          });
        }
      }).catch((err: unknown) => {
        if (err instanceof Error && err.message === "LAST_OWNER_BLOCK") {
          throw err;
        }
        throw err;
      });
    } else if (action === "DECLINE") {
      if (!isTargetUser && !matchesToken && !isManager) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
      if (!isPending) {
        return NextResponse.json({ ok: false, error: "INVITE_NOT_PENDING" }, { status: 400 });
      }
      await prisma.organizationMemberInvite.update({
        where: { id: invite.id },
        data: { declinedAt: new Date(), acceptedAt: null, cancelledAt: null, targetUserId: user.id },
      });
    } else {
      return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
    }

    const updated = await prisma.organizationMemberInvite.findUnique({
      where: { id: invite.id },
      include: {
        invitedBy: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        targetUser: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        organization: { select: { id: true, publicName: true } },
      },
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    await recordOrganizationAuditSafe({
      organizationId,
      actorUserId: user.id,
      action:
        action === "CANCEL"
          ? "INVITE_CANCELLED"
          : action === "RESEND"
            ? "INVITE_RESENT"
            : action === "ACCEPT"
              ? "INVITE_ACCEPTED"
              : "INVITE_DECLINED",
      toUserId: updated.targetUserId ?? null,
      metadata: { inviteId: updated.id, role: updated.role, target: updated.targetIdentifier },
      ip: resolveIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    if (action === "ACCEPT") {
      // Evitar propagação de erros de transação
    }

    const viewer = { id: user.id, username: viewerUsername, email: viewerEmail };

    if (action === "RESEND") {
      await sendInviteEmail(
        {
          id: updated.id,
          organizationId,
          targetIdentifier: updated.targetIdentifier,
          role: updated.role,
          token: updated.token,
          organization: updated.organization,
        },
      );
    }

    return NextResponse.json({ ok: true, invite: serializeInvite(updated, viewer) }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "LAST_OWNER_BLOCK") {
      return NextResponse.json(
        { ok: false, error: "Não podes remover o último Owner. Adiciona outro Owner antes." },
        { status: 400 },
      );
    }
    console.error("[organização/members/invites][PATCH]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
