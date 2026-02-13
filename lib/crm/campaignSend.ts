import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { resolveSegmentContactIds } from "@/lib/crm/segmentQuery";
import { normalizeCampaignChannels } from "@/lib/crm/campaignChannels";
import { sendCrmCampaignEmail } from "@/lib/emailSender";
import { assertEmailReady } from "@/lib/emailClient";
import { getPlatformOfficialEmail } from "@/lib/platformSettings";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { ensureCrmPolicy, policyToConfig } from "@/lib/crm/policy";
import {
  CrmCampaignApprovalState,
  CrmCampaignDeliveryChannel,
  CrmCampaignStatus,
  CrmDeliveryStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";

const MAX_RECIPIENTS = 1000;
const MAX_CAMPAIGNS_PER_DAY = 5;

type SendCampaignError = {
  ok: false;
  message: string;
  status: number;
  code: string;
};

export type SendCrmCampaignResult =
  | {
      ok: true;
      sentCount: number;
      failedCount: number;
      totalEligible: number;
      suppressedByCap: number;
      suppressedByConsent: number;
      suppressedByQuietHours: number;
    }
  | SendCampaignError;

export type SendCrmCampaignOptions = {
  organizationId: number;
  campaignId: string;
  allowedStatuses?: CrmCampaignStatus[];
};

function buildError(message: string, status: number, code: string): SendCampaignError {
  return { ok: false, message, status, code };
}

function minuteInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function isInQuietHours(minute: number, startMinute: number, endMinute: number) {
  if (startMinute === endMinute) return false;
  if (startMinute < endMinute) {
    return minute >= startMinute && minute < endMinute;
  }
  return minute >= startMinute || minute < endMinute;
}

function withinWindow(date: Date, hoursBack: number) {
  return new Date(date.getTime() - hoursBack * 60 * 60 * 1000);
}

function toCountMap(rows: Array<{ contactId: string; _count: { _all: number } }>) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(row.contactId, row._count._all);
  });
  return map;
}

async function createDelivery(params: {
  organizationId: number;
  campaignId: string;
  contactId: string;
  userId?: string | null;
  channel: CrmCampaignDeliveryChannel;
  status: CrmDeliveryStatus;
  sentAt?: Date | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  try {
    await prisma.crmCampaignDelivery.create({
      data: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        contactId: params.contactId,
        ...(params.userId ? { userId: params.userId } : {}),
        channel: params.channel,
        status: params.status,
        ...(params.sentAt ? { sentAt: params.sentAt } : {}),
        ...(params.errorCode ? { errorCode: params.errorCode } : {}),
        ...(params.errorMessage ? { errorMessage: params.errorMessage.slice(0, 200) } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return;
    }
    console.error("CRM campaign delivery error:", err);
  }
}

export async function sendCrmCampaign(options: SendCrmCampaignOptions): Promise<SendCrmCampaignResult> {
  const allowedStatuses = options.allowedStatuses ?? [
    CrmCampaignStatus.DRAFT,
    CrmCampaignStatus.PAUSED,
    CrmCampaignStatus.SCHEDULED,
  ];

  let locked = false;
  let previousStatus: CrmCampaignStatus | null = null;

  try {
    const campaign = await prisma.crmCampaign.findFirst({
      where: { id: options.campaignId, organizationId: options.organizationId },
      select: {
        id: true,
        status: true,
        approvalState: true,
        name: true,
        segmentId: true,
        payload: true,
        channels: true,
      },
    });

    if (!campaign) {
      return buildError("Campanha nao encontrada.", 404, "NOT_FOUND");
    }

    previousStatus = campaign.status;

    if (campaign.status === CrmCampaignStatus.SENT || campaign.status === CrmCampaignStatus.SENDING) {
      return buildError("Campanha ja enviada.", 409, "ALREADY_SENT");
    }

    if (!allowedStatuses.includes(campaign.status)) {
      return buildError("Campanha invalida.", 409, "INVALID_STATUS");
    }

    if (campaign.approvalState !== CrmCampaignApprovalState.APPROVED) {
      return buildError("Campanha exige aprovação.", 409, "APPROVAL_REQUIRED");
    }

    const lockResult = await prisma.crmCampaign.updateMany({
      where: {
        id: campaign.id,
        status: { in: allowedStatuses },
        approvalState: CrmCampaignApprovalState.APPROVED,
      },
      data: { status: CrmCampaignStatus.SENDING },
    });

    if (lockResult.count === 0) {
      return buildError("Campanha em envio.", 409, "LOCKED");
    }

    locked = true;

    const revertStatus = async () => {
      if (!locked || !previousStatus) return;
      try {
        await prisma.crmCampaign.updateMany({
          where: { id: campaign.id, status: CrmCampaignStatus.SENDING },
          data: { status: previousStatus },
        });
      } catch (err) {
        console.warn("[crm][campanha] falha ao reverter status", err);
      }
    };

    const abort = async (message: string, status: number, code: string) => {
      await revertStatus();
      return buildError(message, status, code);
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentToday = await prisma.crmCampaign.count({
      where: { organizationId: options.organizationId, sentAt: { gte: today } },
    });

    if (sentToday >= MAX_CAMPAIGNS_PER_DAY) {
      return await abort("Limite diario de campanhas atingido.", 429, "DAILY_LIMIT");
    }

    const policy = await ensureCrmPolicy(prisma, options.organizationId);
    const config = policyToConfig(policy);
    const now = new Date();
    const currentMinute = minuteInTimezone(now, config.timezone);

    if (isInQuietHours(currentMinute, config.quietHoursStartMinute, config.quietHoursEndMinute)) {
      return await abort("Quiet hours ativas para a organização.", 409, "QUIET_HOURS_ACTIVE");
    }

    let recipientContactIds: string[] = [];
    let estimatedTotal = 0;

    if (campaign.segmentId) {
      const segment = await prisma.crmSegment.findFirst({
        where: { id: campaign.segmentId, organizationId: options.organizationId },
        select: { rules: true },
      });
      if (!segment) {
        return await abort("Segmento invalido.", 400, "SEGMENT_INVALID");
      }

      const resolved = await resolveSegmentContactIds({
        organizationId: options.organizationId,
        rules: segment.rules,
        maxContacts: MAX_RECIPIENTS,
      });

      estimatedTotal = resolved.total;
      recipientContactIds = resolved.contactIds;

      try {
        await prisma.crmSegment.update({
          where: { id: campaign.segmentId },
          data: { sizeCache: resolved.total, lastComputedAt: new Date() },
        });
      } catch (err) {
        console.warn("[crm][campanha] falha ao atualizar cache do segmento", err);
      }
    } else {
      const payload = campaign.payload as { userIds?: unknown; contactIds?: unknown } | null;
      if (payload?.contactIds && Array.isArray(payload.contactIds)) {
        const uniqueContactIds = Array.from(
          new Set(payload.contactIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)),
        );
        estimatedTotal = uniqueContactIds.length;
        if (estimatedTotal > MAX_RECIPIENTS) {
          return await abort("Segmento demasiado grande para envio imediato.", 413, "SEGMENT_TOO_LARGE");
        }
        recipientContactIds = uniqueContactIds;
      } else if (payload?.userIds && Array.isArray(payload.userIds)) {
        const uniqueUserIds = Array.from(
          new Set(payload.userIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)),
        );
        estimatedTotal = uniqueUserIds.length;
        if (estimatedTotal > MAX_RECIPIENTS) {
          return await abort("Segmento demasiado grande para envio imediato.", 413, "SEGMENT_TOO_LARGE");
        }
        if (uniqueUserIds.length) {
          const eligibleContacts = await prisma.crmContact.findMany({
            where: {
              organizationId: options.organizationId,
              userId: { in: uniqueUserIds },
            },
            select: { id: true },
          });
          recipientContactIds = eligibleContacts.map((item) => item.id);
        }
      }
    }

    if (!recipientContactIds.length) {
      return await abort("Segmento vazio.", 400, "SEGMENT_EMPTY");
    }

    if (estimatedTotal > MAX_RECIPIENTS) {
      return await abort("Segmento demasiado grande para envio imediato.", 413, "SEGMENT_TOO_LARGE");
    }

    const campaignPayload =
      campaign.payload && typeof campaign.payload === "object" ? (campaign.payload as Record<string, unknown>) : {};
    const channels = normalizeCampaignChannels(campaign.channels ?? campaignPayload.channels);
    const inAppEnabled = channels.inApp;
    let emailEnabled = channels.email;

    if (!inAppEnabled && !emailEnabled) {
      return await abort("Campanha sem canais definidos.", 400, "NO_CHANNELS");
    }

    if (emailEnabled) {
      try {
        assertEmailReady();
      } catch {
        emailEnabled = false;
        if (!inAppEnabled) {
          return await abort("Envio por email indisponível.", 503, "EMAIL_NOT_CONFIGURED");
        }
      }
    }

    const contacts = await prisma.crmContact.findMany({
      where: {
        organizationId: options.organizationId,
        id: { in: recipientContactIds },
      },
      select: {
        id: true,
        userId: true,
        contactEmail: true,
        marketingEmailOptIn: true,
        marketingPushOptIn: true,
      },
    });

    if (!contacts.length) {
      return await abort("Sem destinatarios elegiveis.", 400, "NO_ELIGIBLE");
    }

    const eligibleUserIds = contacts
      .map((contact) => contact.userId)
      .filter((id): id is string => typeof id === "string");

    const prefs = eligibleUserIds.length
      ? await prisma.notificationPreference.findMany({
          where: { userId: { in: eligibleUserIds } },
          select: { userId: true, allowMarketingCampaigns: true, allowEmailNotifications: true },
        })
      : [];

    const prefsMap = new Map(
      prefs.map((pref) => [
        pref.userId,
        { allowMarketingCampaigns: pref.allowMarketingCampaigns, allowEmailNotifications: pref.allowEmailNotifications },
      ]),
    );

    const dayWindowStart = withinWindow(now, 24);
    const weekWindowStart = withinWindow(now, 24 * 7);
    const monthWindowStart = withinWindow(now, 24 * 30);

    const [sentDay, sentWeek, sentMonth] = await Promise.all([
      prisma.crmCampaignDelivery.groupBy({
        by: ["contactId"],
        where: {
          organizationId: options.organizationId,
          contactId: { in: contacts.map((contact) => contact.id) },
          status: CrmDeliveryStatus.SENT,
          sentAt: { gte: dayWindowStart },
        },
        _count: { _all: true },
      }),
      prisma.crmCampaignDelivery.groupBy({
        by: ["contactId"],
        where: {
          organizationId: options.organizationId,
          contactId: { in: contacts.map((contact) => contact.id) },
          status: CrmDeliveryStatus.SENT,
          sentAt: { gte: weekWindowStart },
        },
        _count: { _all: true },
      }),
      prisma.crmCampaignDelivery.groupBy({
        by: ["contactId"],
        where: {
          organizationId: options.organizationId,
          contactId: { in: contacts.map((contact) => contact.id) },
          status: CrmDeliveryStatus.SENT,
          sentAt: { gte: monthWindowStart },
        },
        _count: { _all: true },
      }),
    ]);

    const capDayMap = toCountMap(sentDay);
    const capWeekMap = toCountMap(sentWeek);
    const capMonthMap = toCountMap(sentMonth);

    const title = typeof campaignPayload.title === "string" ? campaignPayload.title : campaign.name;
    const body = typeof campaignPayload.body === "string" ? campaignPayload.body : null;
    const ctaUrl = typeof campaignPayload.ctaUrl === "string" ? campaignPayload.ctaUrl : null;
    const ctaLabel = typeof campaignPayload.ctaLabel === "string" ? campaignPayload.ctaLabel : null;
    const previewText = typeof campaignPayload.previewText === "string" ? campaignPayload.previewText : null;
    const emailSubject =
      typeof campaignPayload.emailSubject === "string" && campaignPayload.emailSubject.trim()
        ? campaignPayload.emailSubject.trim()
        : title;

    const organization = emailEnabled
      ? await prisma.organization.findUnique({
          where: { id: options.organizationId },
          select: { publicName: true, officialEmail: true, officialEmailVerifiedAt: true },
        })
      : null;
    const organizationName = organization?.publicName ?? "Organização";
    const officialEmailNormalized = normalizeOfficialEmail(organization?.officialEmail ?? null);
    const platformOfficialEmail = emailEnabled ? await getPlatformOfficialEmail() : null;
    const replyTo =
      organization?.officialEmailVerifiedAt && officialEmailNormalized
        ? officialEmailNormalized
        : platformOfficialEmail;

    const sentAt = new Date();
    let sentCount = 0;
    let failedCount = 0;
    let suppressedByCap = 0;
    let suppressedByConsent = 0;

    for (const contact of contacts) {
      const dayCount = capDayMap.get(contact.id) ?? 0;
      const weekCount = capWeekMap.get(contact.id) ?? 0;
      const monthCount = capMonthMap.get(contact.id) ?? 0;

      if (dayCount >= config.capPerDay || weekCount >= config.capPerWeek || monthCount >= config.capPerMonth) {
        suppressedByCap += 1;
        continue;
      }

      const recipientId = contact.userId ?? null;
      const pref = recipientId ? prefsMap.get(recipientId) : null;
      const allowMarketing = pref?.allowMarketingCampaigns ?? true;
      const allowEmailPref = pref?.allowEmailNotifications ?? true;
      const marketingGranted = contact.marketingEmailOptIn || contact.marketingPushOptIn;

      let hasAttempt = false;

      const inAppRecipientId = recipientId;
      const canSendInApp = Boolean(inAppEnabled && inAppRecipientId && allowMarketing && marketingGranted);
      if (canSendInApp && inAppRecipientId) {
        hasAttempt = true;
        try {
          await createNotification({
            userId: inAppRecipientId,
            dedupeKey: `crm-campaign:${campaign.id}:inapp:${inAppRecipientId}`,
            type: NotificationType.CRM_CAMPAIGN,
            title,
            body,
            ctaUrl,
            ctaLabel,
            priority: "NORMAL",
            senderVisibility: "PRIVATE",
            organizationId: options.organizationId,
            payload: { campaignId: campaign.id, channel: "IN_APP" },
          });
          await createDelivery({
            organizationId: options.organizationId,
            campaignId: campaign.id,
            contactId: contact.id,
            userId: inAppRecipientId,
            channel: CrmCampaignDeliveryChannel.IN_APP,
            status: CrmDeliveryStatus.SENT,
            sentAt,
          });
          sentCount += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await createDelivery({
            organizationId: options.organizationId,
            campaignId: campaign.id,
            contactId: contact.id,
            userId: inAppRecipientId,
            channel: CrmCampaignDeliveryChannel.IN_APP,
            status: CrmDeliveryStatus.FAILED,
            errorCode: "IN_APP_FAILED",
            errorMessage: message,
          });
          failedCount += 1;
          console.error("CRM campaign in-app delivery error:", err);
        }
      }

      const canSendEmail = Boolean(
        emailEnabled && contact.contactEmail && allowEmailPref && contact.marketingEmailOptIn,
      );
      if (canSendEmail) {
        hasAttempt = true;
        try {
          await sendCrmCampaignEmail({
            to: contact.contactEmail!,
            subject: emailSubject,
            organizationName,
            title,
            body,
            ctaUrl,
            ctaLabel,
            previewText,
            replyTo,
          });
          await createDelivery({
            organizationId: options.organizationId,
            campaignId: campaign.id,
            contactId: contact.id,
            userId: recipientId,
            channel: CrmCampaignDeliveryChannel.EMAIL,
            status: CrmDeliveryStatus.SENT,
            sentAt,
          });
          sentCount += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await createDelivery({
            organizationId: options.organizationId,
            campaignId: campaign.id,
            contactId: contact.id,
            userId: recipientId,
            channel: CrmCampaignDeliveryChannel.EMAIL,
            status: CrmDeliveryStatus.FAILED,
            errorCode: "EMAIL_FAILED",
            errorMessage: message,
          });
          failedCount += 1;
          console.error("CRM campaign email delivery error:", err);
        }
      }

      if (!hasAttempt) {
        suppressedByConsent += 1;
      }
    }

    await prisma.crmCampaign.update({
      where: { id: campaign.id },
      data: {
        status: CrmCampaignStatus.SENT,
        sentAt,
        sentCount,
        failedCount,
      },
    });

    return {
      ok: true,
      sentCount,
      failedCount,
      totalEligible: contacts.length,
      suppressedByCap,
      suppressedByConsent,
      suppressedByQuietHours: 0,
    };
  } catch (err) {
    if (locked && previousStatus) {
      try {
        await prisma.crmCampaign.updateMany({
          where: { id: options.campaignId, status: CrmCampaignStatus.SENDING },
          data: { status: previousStatus },
        });
      } catch (revertErr) {
        console.warn("[crm][campanha] falha ao reverter status", revertErr);
      }
    }
    console.error("[crm][campanha] erro ao enviar campanha", err);
    return buildError("Erro ao enviar campanha.", 500, "UNEXPECTED");
  }
}
