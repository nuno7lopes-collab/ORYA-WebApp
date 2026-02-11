import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { resolveSegmentContactIds } from "@/lib/crm/segmentQuery";
import { normalizeCampaignChannels } from "@/lib/crm/campaignChannels";
import { sendCrmCampaignEmail } from "@/lib/emailSender";
import { assertEmailReady } from "@/lib/emailClient";
import { getPlatformOfficialEmail } from "@/lib/platformSettings";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { CrmCampaignStatus, CrmDeliveryStatus, NotificationType } from "@prisma/client";

const MAX_RECIPIENTS = 1000;
const MAX_CAMPAIGNS_PER_DAY = 5;
const USER_COOLDOWN_HOURS = 24;

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
        name: true,
        segmentId: true,
        payload: true,
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

    const lockResult = await prisma.crmCampaign.updateMany({
      where: { id: campaign.id, status: { in: allowedStatuses } },
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
    const channels = normalizeCampaignChannels(campaignPayload.channels);
    const inAppEnabled = channels.inApp;
    let emailEnabled = channels.email;

    if (!inAppEnabled && !emailEnabled) {
      return await abort("Campanha sem canais definidos.", 400, "NO_CHANNELS");
    }

    if (emailEnabled) {
      try {
        assertEmailReady();
      } catch (err) {
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
      },
    });

    let eligibleContacts = contacts.filter((contact) => contact.marketingEmailOptIn);
    if (!eligibleContacts.length) {
      return await abort("Sem destinatarios elegiveis.", 400, "NO_ELIGIBLE");
    }

    const eligibleUserIds = eligibleContacts
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

    eligibleContacts = eligibleContacts.filter((contact) => {
      if (!contact.userId) {
        return emailEnabled && Boolean(contact.contactEmail);
      }
      const pref = prefsMap.get(contact.userId);
      const allowMarketing = pref?.allowMarketingCampaigns ?? true;
      const allowEmail = pref?.allowEmailNotifications ?? true;
      return (inAppEnabled && allowMarketing) || (emailEnabled && allowEmail);
    });

    if (!eligibleContacts.length) {
      return await abort("Sem destinatarios elegiveis.", 400, "NO_ELIGIBLE");
    }

    const cooldownStart = new Date(Date.now() - USER_COOLDOWN_HOURS * 60 * 60 * 1000);
    const recent = await prisma.crmCampaignDelivery.findMany({
      where: {
        organizationId: options.organizationId,
        contactId: { in: eligibleContacts.map((contact) => contact.id) },
        sentAt: { gte: cooldownStart },
      },
      select: { contactId: true },
      distinct: ["contactId"],
    });

    const recentSet = new Set(recent.map((item) => item.contactId));
    eligibleContacts = eligibleContacts.filter((contact) => !recentSet.has(contact.id));

    if (!eligibleContacts.length) {
      return await abort("Sem destinatarios elegiveis.", 400, "NO_ELIGIBLE");
    }

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

    for (const contact of eligibleContacts) {
      const recipientId = contact.userId ?? null;
      const pref = recipientId ? prefsMap.get(recipientId) : null;
      const allowMarketing = pref?.allowMarketingCampaigns ?? true;
      const allowEmail = pref?.allowEmailNotifications ?? true;
      let notificationId: string | null = null;
      let sentAny = false;
      const errors: string[] = [];

      if (inAppEnabled && allowMarketing && recipientId) {
        try {
          await createNotification({
            userId: recipientId,
            type: NotificationType.CRM_CAMPAIGN,
            title,
            body,
            ctaUrl,
            ctaLabel,
            priority: "NORMAL",
            senderVisibility: "PRIVATE",
            organizationId: options.organizationId,
            payload: { campaignId: campaign.id },
          });
          notificationId = null;
          sentAny = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`IN_APP_FAILED:${message}`);
          console.error("CRM campaign in-app delivery error:", err);
        }
      }

      if (emailEnabled && allowEmail) {
        const email = contact.contactEmail ?? null;
        if (!email) {
          errors.push("EMAIL_MISSING");
        } else {
          try {
            await sendCrmCampaignEmail({
              to: email,
              subject: emailSubject,
              organizationName,
              title,
              body,
              ctaUrl,
              ctaLabel,
              previewText,
              replyTo,
            });
            sentAny = true;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`EMAIL_FAILED:${message}`);
            console.error("CRM campaign email delivery error:", err);
          }
        }
      }

      if (sentAny) {
        try {
          await prisma.crmCampaignDelivery.create({
            data: {
              organizationId: options.organizationId,
              campaignId: campaign.id,
              contactId: contact.id,
              ...(recipientId ? { userId: recipientId } : {}),
              notificationId,
              status: CrmDeliveryStatus.SENT,
              sentAt,
            },
          });
        } catch (innerErr) {
          console.error("CRM campaign delivery error:", innerErr);
        }
        sentCount += 1;
      } else {
        failedCount += 1;
        const message = errors.join(" | ") || "DELIVERY_FAILED";
        try {
          await prisma.crmCampaignDelivery.create({
            data: {
              organizationId: options.organizationId,
              campaignId: campaign.id,
              contactId: contact.id,
              ...(recipientId ? { userId: recipientId } : {}),
              status: CrmDeliveryStatus.FAILED,
              errorCode: errors[0] ? errors[0].split(":")[0] : "DELIVERY_FAILED",
              errorMessage: message.slice(0, 200),
            },
          });
        } catch (innerErr) {
          console.error("CRM campaign delivery error:", innerErr);
        }
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

    return { ok: true, sentCount, failedCount, totalEligible: eligibleContacts.length };
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
