import { prisma } from "@/lib/prisma";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { NotificationType, OrganizationMemberRole } from "@prisma/client";
import { listEffectiveOrganizationMemberUserIdsByRoles } from "@/lib/organizationMembers";

type BookingChangeResponseStatus = "ACCEPTED" | "DECLINED";

type BookingChangeResponseNotifyParams = {
  organizationId: number;
  bookingId: number;
  requestId: number;
  status: BookingChangeResponseStatus;
  proposedStartsAt: Date;
  priceDeltaCents: number;
  actorUserId?: string | null;
};

const roleAllowlist: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
];

export async function notifyOrganizationBookingChangeResponse(params: BookingChangeResponseNotifyParams) {
  try {
    const { organizationId, bookingId, requestId, status, proposedStartsAt, priceDeltaCents, actorUserId } = params;
    const members = await listEffectiveOrganizationMemberUserIdsByRoles({
      organizationId,
      roles: roleAllowlist,
    });
    const recipients = Array.from(new Set(members)).filter(
      (userId) => userId && userId !== actorUserId,
    );
    if (recipients.length === 0) return;

    const ctaUrl = buildOrgHref(organizationId, "/bookings");
    const timeLabel = proposedStartsAt.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const accepted = status === "ACCEPTED";
    const title = accepted ? "Reagendamento aceite" : "Reagendamento recusado";
    const body = accepted
      ? `O cliente aceitou o reagendamento para ${timeLabel}.`
      : `O cliente recusou o reagendamento para ${timeLabel}.`;

    await Promise.all(
      recipients.map(async (userId) => {
        if (!(await shouldNotify(userId, NotificationType.BOOKING_CHANGE_RESPONSE))) return;
        await createNotification({
          userId,
          type: NotificationType.BOOKING_CHANGE_RESPONSE,
          title,
          body,
          ctaUrl,
          ctaLabel: "Ver reservas",
          organizationId,
          payload: {
            bookingId,
            requestId,
            status,
            proposedStartsAt: proposedStartsAt.toISOString(),
            priceDeltaCents,
          },
        });
      }),
    );
  } catch (err) {
    console.error("notifyOrganizationBookingChangeResponse failed", err);
  }
}
