import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clearUsernameForOwner } from "@/lib/globalUsernames";
import { logAccountEvent } from "@/lib/accountEvents";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError, logWarn } from "@/lib/observability/logger";
import { getRequestContext } from "@/lib/http/requestContext";
import { DsarCaseStatus, DsarCaseType, SaleSummaryStatus, TicketStatus } from "@prisma/client";

async function resolveLegalHold(userId: string) {
  const [disputedTickets, disputedSales] = await Promise.all([
    prisma.ticket.count({ where: { ownerUserId: userId, status: TicketStatus.DISPUTED } }),
    prisma.saleSummary.count({
      where: {
        status: SaleSummaryStatus.DISPUTED,
        OR: [{ ownerUserId: userId }, { userId }],
      },
    }),
  ]);
  const reasons: string[] = [];
  if (disputedTickets > 0) reasons.push("DISPUTED_TICKETS");
  if (disputedSales > 0) reasons.push("DISPUTED_SALES");
  return { active: reasons.length > 0, reasons };
}

async function _POST(req: NextRequest) {
  try {
    const ctx = getRequestContext(req);
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const now = new Date();
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);

    const pending = await prisma.profile.findMany({
      where: {
        status: "PENDING_DELETE",
        deletionScheduledFor: { lte: now },
      },
      take: limit,
      select: { id: true, username: true, fullName: true, roles: true },
    });

    const processedUserIds: string[] = [];
    for (const profile of pending) {
      try {
        const legalHold = await resolveLegalHold(profile.id);
        await prisma.$transaction(async (tx) => {
          await tx.profile.update({
            where: { id: profile.id },
            data: {
              status: "DELETED",
              deletedAtFinal: now,
              isDeleted: true,
              visibility: "PRIVATE",
              username: null,
              fullName: "Conta apagada",
              bio: null,
              avatarUrl: null,
              contactPhone: null,
              roles: ["user"],
            },
          });

          await clearUsernameForOwner({ ownerType: "user", ownerId: profile.id, tx });

          await tx.organizationMember.deleteMany({
            where: { userId: profile.id },
          });

          await tx.notification.deleteMany({ where: { userId: profile.id } });
          await tx.notificationPreference.deleteMany({ where: { userId: profile.id } });

          await tx.storeOrder.updateMany({
            where: { userId: profile.id },
            data: {
              customerEmail: null,
              customerName: "Conta apagada",
              customerPhone: null,
              notes: null,
            },
          });
          await tx.storeOrderAddress.deleteMany({
            where: { order: { userId: profile.id } },
          });
        });

        await logAccountEvent({
          userId: profile.id,
          type: "account_delete_completed",
          metadata: { reason: "scheduled_purge", legalHold: legalHold.active, legalHoldReasons: legalHold.reasons },
        });

        await prisma.dsarCase.updateMany({
          where: {
            userId: profile.id,
            type: DsarCaseType.DELETE,
            status: { in: [DsarCaseStatus.REQUESTED, DsarCaseStatus.IN_PROGRESS] },
          },
          data: {
            status: DsarCaseStatus.COMPLETED,
            completedAt: now,
            metadata: {
              action: "account_delete_completed",
              reason: "scheduled_purge",
              legalHold: legalHold.active,
              legalHoldReasons: legalHold.reasons,
            },
          },
        });

        try {
          await supabaseAdmin.auth.admin.deleteUser(profile.id);
        } catch (authErr) {
          logWarn("admin.users.purge_pending_auth_remove_failed", { error: authErr, userId: profile.id });
        }
        processedUserIds.push(profile.id);
      } catch (userErr) {
        logError("admin.users.purge_pending_anonymize_failed", userErr, { userId: profile.id });
      }
    }

    await auditAdminAction({
      action: "USERS_PURGE_PENDING",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: {
        processed: processedUserIds.length,
        attempted: pending.length,
        userIds: processedUserIds.slice(0, 25),
      },
    });

    return jsonWrap({ ok: true, processed: pending.length }, { status: 200 });
  } catch (err) {
    logError("admin.users.purge_pending_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
