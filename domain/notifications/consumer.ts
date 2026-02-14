import { prisma } from "@/lib/prisma";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { shouldNotify } from "@/domain/notifications/prefs";
import {
  resolveCampaignId,
  resolveNotificationContent,
  resolvePayloadKind,
  resolveRoleLabel,
  resolvePushPayload,
  validateNotificationInput,
} from "@/domain/notifications/registry";
import { deliverApnsPush } from "@/lib/push/apns";
import type { CreateNotificationInput } from "@/domain/notifications/types";
import { CrmDeliveryStatus, NotificationType, NotificationPriority, type Prisma } from "@prisma/client";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

type EventLogRecord = {
  eventId: string;
  eventType: string;
  organizationId: number | null;
  actorUserId: string | null;
  payload: Prisma.JsonValue | null;
  sourceId: string | null;
};

const EVENTLOG_ALLOWLIST = new Set<string>([
  "loyalty.earned",
  "loyalty.spent",
  "padel.registration.created",
  "padel.registration.expired",
  "organization.owner_transfer.requested",
  "organization.owner_transfer.confirmed",
  "organization.owner_transfer.cancelled",
  "organization.owner_transfer.expired",
]);

const NOTIFICATION_TYPES = new Set<string>(Object.values(NotificationType));

function sanitizeActor(
  actor: any,
  options: { isPrivate?: boolean; viewerId?: string | null },
) {
  if (!actor || typeof actor !== "object") return actor;
  const isSelf = options.viewerId && actor.id === options.viewerId;
  if (isSelf) return actor;
  if (!("email" in actor)) return actor;
  return { ...actor, email: null };
}

function sanitizePayload(
  payload: any,
  opts: { senderVisibility?: "PUBLIC" | "PRIVATE"; viewerId?: string | null },
) {
  if (!payload || typeof payload !== "object") return payload;
  const clone: Record<string, unknown> = { ...payload };
  if (clone.actor) {
    clone.actor = sanitizeActor(clone.actor, {
      isPrivate: opts.senderVisibility === "PRIVATE",
      viewerId: opts.viewerId,
    });
  }
  return clone;
}

export async function createNotificationRecord(input: CreateNotificationInput & { sourceEventId?: string | null }) {
  const {
    userId,
    type,
    title,
    body,
    payload,
    ctaUrl = null,
    ctaLabel = null,
    priority = "NORMAL",
    senderVisibility = "PUBLIC",
    fromUserId = null,
    organizationId = null,
    eventId = null,
    ticketId = null,
    inviteId = null,
    sourceEventId = null,
  } = input;

  const data = {
    userId,
    type,
    title: title ?? null,
    body: body ?? null,
    payload: payload ? sanitizePayload(payload, { senderVisibility, viewerId: userId }) : undefined,
    ctaUrl: ctaUrl || undefined,
    ctaLabel: ctaLabel || undefined,
    priority,
    fromUserId: fromUserId || undefined,
    organizationId: organizationId ?? undefined,
    eventId: eventId ?? undefined,
    ticketId: ticketId ?? undefined,
    inviteId: inviteId ?? undefined,
    sourceEventId: sourceEventId ?? undefined,
  };

  if (sourceEventId) {
    return prisma.notification.upsert({
      where: { sourceEventId },
      create: data,
      update: {},
    });
  }
  return prisma.notification.create({ data });
}

export async function markNotificationRead(params: { userId: string; notificationId: string }) {
  return prisma.notification.update({
    where: { id: params.notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(params: { userId: string; organizationId?: number | null }) {
  const orgId = Number.isFinite(params.organizationId ?? NaN) ? Number(params.organizationId) : null;
  const where = {
    userId: params.userId,
    isRead: false,
  } as {
    userId: string;
    isRead: boolean;
    AND?: Array<{ OR: Array<{ organizationId?: number; event?: { organizationId: number } }> }>;
  };
  if (orgId) {
    where.AND = [{ OR: [{ organizationId: orgId }, { event: { organizationId: orgId } }] }];
  }
  await prisma.notification.updateMany({
    where,
    data: { isRead: true, readAt: new Date() },
  });
  return { ok: true };
}

async function maybeSendPush(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; deepLink?: string | null },
  context?: { organizationId?: number | null; eventId?: number | null },
) {
  const tokens = await prisma.pushDeviceToken.findMany({
    where: { userId, revokedAt: null, platform: "ios" },
    select: { token: true },
  });
  if (!tokens.length) return;
  const should = await shouldNotify(userId, type).catch(() => true);
  if (!should) return;

  const muteOr: Array<{ organizationId?: number; eventId?: number }> = [];
  if (Number.isFinite(context?.organizationId ?? NaN)) {
    muteOr.push({ organizationId: Number(context?.organizationId) });
  }
  if (Number.isFinite(context?.eventId ?? NaN)) {
    muteOr.push({ eventId: Number(context?.eventId) });
  }
  if (muteOr.length) {
    const muted = await prisma.notificationMute.findFirst({
      where: { userId, OR: muteOr },
      select: { id: true },
    });
    if (muted) return;
  }

  await Promise.all(
    tokens.map(async (token) => {
      try {
        await deliverApnsPush({
          token: token.token,
          payload: {
            aps: { alert: { title: payload.title, body: payload.body } },
            deepLink: payload.deepLink ?? null,
          },
        });
      } catch (err) {
        console.warn("[notifications][push] falha", err);
      }
    }),
  );
}

async function linkCrmCampaignNotification(params: {
  campaignId: string | null;
  userId: string;
  notificationId: string;
}) {
  if (!params.campaignId) return;
  await prisma.crmCampaignDelivery.updateMany({
    where: {
      campaignId: params.campaignId,
      userId: params.userId,
      notificationId: null,
      status: { in: [CrmDeliveryStatus.SENT, CrmDeliveryStatus.OPENED, CrmDeliveryStatus.CLICKED] },
    },
    data: {
      notificationId: params.notificationId,
    },
  });
}

export async function deliverNotificationOutboxItem(item: {
  id: string;
  userId: string | null;
  notificationType: string;
  payload: unknown;
}) {
  if (!item.userId) throw new Error("OUTBOX_MISSING_USER");
  const payload = item.payload && typeof item.payload === "object" ? (item.payload as Record<string, unknown>) : {};
  const payloadJson = payload as Prisma.InputJsonValue;
  const sourceEventId =
    typeof payload.sourceEventId === "string" && payload.sourceEventId.trim()
      ? payload.sourceEventId
      : `notification-outbox:${item.id}`;
  const inviterUserId = typeof payload.inviterUserId === "string" ? payload.inviterUserId : null;
  const formatTime = (value: Date, timezone?: string | null) =>
    new Intl.DateTimeFormat("pt-PT", {
      timeZone: timezone || "Europe/Lisbon",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  const pairingLabel = (pairing?: { slots?: Array<{ playerProfile?: { displayName?: string | null; fullName?: string | null } | null }> | null }) => {
    const names =
      pairing?.slots
        ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
        .filter((name): name is string => Boolean(name)) || [];
    return names.length > 0 ? names.slice(0, 2).join(" / ") : "Dupla";
  };
  const formatScoreLabel = (match: { scoreSets?: unknown; score?: unknown }) => {
    const scoreSets = Array.isArray(match.scoreSets) ? (match.scoreSets as Array<{ teamA: number; teamB: number }>) : null;
    if (scoreSets?.length) {
      return scoreSets.map((set) => `${set.teamA}-${set.teamB}`).join(", ");
    }
    const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
    const resultType =
      score.resultType === "WALKOVER" || score.walkover === true
        ? "WALKOVER"
        : score.resultType === "RETIREMENT"
          ? "RETIREMENT"
          : score.resultType === "INJURY"
            ? "INJURY"
            : null;
    if (resultType === "WALKOVER") return "WO";
    if (resultType === "RETIREMENT") return "Desistência";
    if (resultType === "INJURY") return "Lesão";
    return "—";
  };
  const resolvePairingContext = async (pairingId: number | null, userId: string, token?: string | null) => {
    if (!Number.isFinite(pairingId ?? NaN)) {
      return {
        pairing: null,
        eventTitle: null,
        eventSlug: null,
        organizationId: null,
        eventId: null,
        ctaUrl: "/me/carteira",
      };
    }
    const pairing = await prisma.padelPairing.findUnique({
      where: { id: pairingId as number },
      select: {
        id: true,
        partnerInviteToken: true,
        event: { select: { id: true, title: true, slug: true, organizationId: true } },
      },
    });
    const eventTitle = pairing?.event?.title ?? null;
    const eventSlug = pairing?.event?.slug ?? null;
    let entitlementId: string | null = null;
    if (pairing?.event?.id) {
      const entitlement = await prisma.entitlement.findFirst({
        where: {
          eventId: pairing.event.id,
          ownerUserId: userId,
          type: "PADEL_ENTRY",
        },
        select: { id: true },
      });
      entitlementId = entitlement?.id ?? null;
    }
    const resolvedToken =
      typeof token === "string" && token.trim().length > 0 ? token.trim() : pairing?.partnerInviteToken ?? null;
    const ctaUrl = entitlementId
      ? `/me/bilhetes/${entitlementId}`
      : resolvedToken && eventSlug
        ? `/eventos/${eventSlug}?inviteToken=${encodeURIComponent(resolvedToken)}`
        : eventSlug
          ? `/eventos/${eventSlug}?pairingId=${pairingId}`
          : "/me/carteira";
    return {
      pairing,
      eventTitle,
      eventSlug,
      organizationId: pairing?.event?.organizationId ?? null,
      eventId: pairing?.event?.id ?? null,
      ctaUrl,
    };
  };

  if (item.notificationType === "LOYALTY_EARNED" || item.notificationType === "LOYALTY_SPENT") {
    const pointsRaw = typeof payload.points === "number" ? payload.points : Number(payload.points);
    const points = Number.isFinite(pointsRaw) ? Math.floor(pointsRaw) : null;
    const pointsName = typeof payload.pointsName === "string" ? payload.pointsName : "Pontos";
    const organizationName =
      typeof payload.organizationName === "string" && payload.organizationName.trim()
        ? payload.organizationName.trim()
        : null;
    const programName =
      typeof payload.programName === "string" && payload.programName.trim() ? payload.programName.trim() : null;
    const label = points !== null ? `${points} ${pointsName}` : pointsName;
    const title = item.notificationType === "LOYALTY_EARNED" ? `Ganhaste ${label}` : `Resgate de ${label}`;
    const body =
      item.notificationType === "LOYALTY_EARNED"
        ? organizationName
          ? `Ganhaste ${label} em ${organizationName}.`
          : `Ganhaste ${label}.`
        : programName
          ? `Resgate concluído no programa ${programName}.`
          : "Resgate concluído.";

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl: "/me/carteira",
      ctaLabel: "Ver carteira",
      priority: "NORMAL",
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: "/me/carteira" },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "PADREG_CREATED" || item.notificationType === "PADREG_EXPIRED") {
    const title = item.notificationType === "PADREG_CREATED" ? "Inscrição criada" : "Inscrição expirada";
    const body =
      item.notificationType === "PADREG_CREATED"
        ? "A tua inscrição foi registada."
        : "A inscrição expirou por falta de confirmação.";
    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl: "/me/inscricoes",
      ctaLabel: "Ver inscrições",
      priority: "NORMAL",
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: "/me/inscricoes" },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "OWNER_TRANSFER_REQUESTED" || item.notificationType === "OWNER_TRANSFER_CONFIRMED" || item.notificationType === "OWNER_TRANSFER_CANCELLED" || item.notificationType === "OWNER_TRANSFER_EXPIRED") {
    const title = item.notificationType === "OWNER_TRANSFER_REQUESTED" ? "Transferência de owner pendente" :
      item.notificationType === "OWNER_TRANSFER_CONFIRMED" ? "Transferência de owner confirmada" :
      item.notificationType === "OWNER_TRANSFER_CANCELLED" ? "Transferência de owner cancelada" :
      "Transferência de owner expirada";
    const body = "Consulta os detalhes no painel da organização.";
    const rawOrgId = typeof payload.organizationId === "number" ? payload.organizationId : Number(payload.organizationId);
    const resolvedOrgId = Number.isFinite(rawOrgId) ? rawOrgId : null;
    const orgHref = appendOrganizationIdToHref("/organizacao", resolvedOrgId);
    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl: orgHref,
      ctaLabel: "Abrir organização",
      priority: "NORMAL",
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: orgHref },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "PAIRING_INVITE") {
    const pairingId = typeof payload.pairingId === "number" ? payload.pairingId : Number(payload.pairingId);
    const pairing = Number.isFinite(pairingId)
      ? await prisma.padelPairing.findUnique({
          where: { id: pairingId },
          select: {
            id: true,
            partnerInviteToken: true,
            event: { select: { id: true, title: true, slug: true, organizationId: true } },
          },
        })
      : null;
    const eventSlug = pairing?.event?.slug ?? null;
    const token =
      typeof payload.token === "string" && payload.token.trim().length > 0
        ? payload.token.trim()
        : pairing?.partnerInviteToken ?? null;
    const viewerRole = payload.viewerRole === "CAPTAIN" ? "CAPTAIN" : "INVITED";
    let entitlementId: string | null = null;
    if (pairing?.event?.id) {
      const entitlement = await prisma.entitlement.findFirst({
        where: {
          eventId: pairing.event.id,
          ownerUserId: item.userId,
          type: "PADEL_ENTRY",
        },
        select: { id: true },
      });
      entitlementId = entitlement?.id ?? null;
    }
    const ctaUrl = entitlementId
      ? `/me/bilhetes/${entitlementId}`
      : token && eventSlug
        ? `/eventos/${eventSlug}?inviteToken=${encodeURIComponent(token)}`
        : "/me/carteira";
    const ctaLabel =
      viewerRole === "CAPTAIN"
        ? "Ver estado"
        : entitlementId
          ? "Ver inscrição"
          : "Aceitar convite";
    const eventTitle = pairing?.event?.title ?? null;

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.PAIRING_INVITE,
      title: viewerRole === "CAPTAIN" ? "Convite enviado" : "Convite para dupla",
      body:
        viewerRole === "CAPTAIN"
          ? eventTitle
            ? `Convite enviado para o torneio ${eventTitle}.`
            : "Convite enviado para a tua dupla."
          : eventTitle
            ? `Foste convidado para uma dupla no torneio ${eventTitle}.`
            : "Foste convidado para uma dupla de padel.",
      payload: payloadJson,
      ctaUrl,
      ctaLabel,
      priority: "HIGH",
      fromUserId: inviterUserId ?? undefined,
      organizationId: pairing?.event?.organizationId ?? undefined,
      eventId: pairing?.event?.id ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? "Convite para dupla", body: notification.body ?? "", deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "PAIRING_REMINDER" || item.notificationType === "PAIRING_WINDOW_OPEN") {
    const pairingId = typeof payload.pairingId === "number" ? payload.pairingId : Number(payload.pairingId);
    const stage = typeof payload.stage === "string" ? payload.stage : null;
    const deadlineAtRaw = typeof payload.deadlineAt === "string" ? payload.deadlineAt : null;
    const { eventTitle, ctaUrl, organizationId, eventId } = await resolvePairingContext(pairingId, item.userId, null);
    const isWindow = item.notificationType === "PAIRING_WINDOW_OPEN";
    const title = isWindow ? "Janela aberta para regularizar" : "Lembrete da dupla";
    const baseBody = eventTitle ? `Torneio ${eventTitle}.` : "Torneio Padel.";
    const stageLabel =
      stage === "T-48"
        ? "Faltam 48h."
        : stage === "T-36"
          ? "Faltam 36h."
          : stage === "T-24"
            ? "Últimas 24h."
            : stage === "T-23"
              ? "Prazo ultrapassado."
              : stage
                ? `Prazo ${stage}.`
                : "";
    const deadlineLabel = deadlineAtRaw ? `Prazo: ${formatTime(new Date(deadlineAtRaw))}.` : "";
    const windowLabel = isWindow ? "Tens 1h para regularizar o pagamento/convite." : "";
    const body = [baseBody, stageLabel, windowLabel, deadlineLabel].filter(Boolean).join(" ");

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver inscrição",
      priority: isWindow || stage === "T-24" ? "HIGH" : "NORMAL",
      organizationId: organizationId ?? undefined,
      eventId: eventId ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "PAIRING_CONFIRMED") {
    const pairingId = typeof payload.pairingId === "number" ? payload.pairingId : Number(payload.pairingId);
    const { eventTitle, ctaUrl, organizationId, eventId } = await resolvePairingContext(pairingId, item.userId, null);
    const title = "Dupla confirmada";
    const body = eventTitle ? `A tua dupla está confirmada no torneio ${eventTitle}.` : "A tua dupla está confirmada.";
    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver inscrição",
      priority: "HIGH",
      organizationId: organizationId ?? undefined,
      eventId: eventId ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "DEADLINE_EXPIRED") {
    const pairingId = typeof payload.pairingId === "number" ? payload.pairingId : Number(payload.pairingId);
    const { eventTitle, ctaUrl, organizationId, eventId } = await resolvePairingContext(pairingId, item.userId, null);
    const title = "Prazo expirado";
    const body = eventTitle
      ? `O prazo da dupla expirou no torneio ${eventTitle}.`
      : "O prazo da dupla expirou.";
    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver detalhes",
      priority: "HIGH",
      organizationId: organizationId ?? undefined,
      eventId: eventId ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "OFFSESSION_ACTION_REQUIRED") {
    const pairingId = typeof payload.pairingId === "number" ? payload.pairingId : Number(payload.pairingId);
    const { eventTitle, ctaUrl, organizationId, eventId } = await resolvePairingContext(pairingId, item.userId, null);
    const title = "Pagamento pendente";
    const body = eventTitle
      ? `Há um pagamento pendente para a dupla no torneio ${eventTitle}.`
      : "Há um pagamento pendente para a tua dupla.";
    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Regularizar",
      priority: "HIGH",
      organizationId: organizationId ?? undefined,
      eventId: eventId ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "PAIRING_REFUND") {
    const pairingId = typeof payload.pairingId === "number" ? payload.pairingId : Number(payload.pairingId);
    const refundCents = typeof payload.refundBaseCents === "number" ? payload.refundBaseCents : Number(payload.refundBaseCents);
    const currency = typeof payload.currency === "string" ? payload.currency : "EUR";
    const { eventTitle, ctaUrl, organizationId, eventId } = await resolvePairingContext(pairingId, item.userId, null);
    const refundLabel =
      Number.isFinite(refundCents) && refundCents >= 0
        ? (refundCents / 100).toLocaleString("pt-PT", { style: "currency", currency })
        : null;
    const title = "Reembolso processado";
    const body = eventTitle
      ? refundLabel
        ? `Reembolso ${refundLabel} no torneio ${eventTitle}.`
        : `Reembolso processado no torneio ${eventTitle}.`
      : refundLabel
        ? `Reembolso ${refundLabel} processado.`
        : "Reembolso processado.";
    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver estado",
      priority: "HIGH",
      organizationId: organizationId ?? undefined,
      eventId: eventId ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "WAITLIST_JOINED" || item.notificationType === "WAITLIST_PROMOTED") {
    const eventIdRaw = typeof payload.eventId === "number" ? payload.eventId : Number(payload.eventId);
    const event = Number.isFinite(eventIdRaw)
      ? await prisma.event.findUnique({
          where: { id: eventIdRaw },
          select: { id: true, title: true, slug: true, organizationId: true },
        })
      : null;
    const eventTitle = event?.title ?? "Torneio Padel";
    const ctaUrl = event?.slug ? `/eventos/${event.slug}` : "/eventos";
    const promoted = item.notificationType === "WAITLIST_PROMOTED";
    const title = promoted ? "Vaga confirmada" : "Lista de espera";
    const body = promoted
      ? `A tua inscrição saiu da lista de espera em ${eventTitle}. Conclui o pagamento para garantir a vaga.`
      : `Entraste na lista de espera para ${eventTitle}. Vais ser notificado quando existir vaga.`;
    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.SYSTEM_ANNOUNCE,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: promoted ? "Abrir torneio" : "Ver torneio",
      priority: promoted ? "HIGH" : "NORMAL",
      organizationId: event?.organizationId ?? undefined,
      eventId: event?.id ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "CHAT_AVAILABLE") {
    const eventId = typeof payload.eventId === "number" ? payload.eventId : Number(payload.eventId);
    if (!Number.isFinite(eventId)) throw new Error("CHAT_AVAILABLE_MISSING_EVENT");
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true, organizationId: true },
    });
    if (!event) throw new Error("CHAT_AVAILABLE_EVENT_NOT_FOUND");

    const title = "Chat disponível";
    const body = `O chat do evento ${event.title ?? "Evento"} está disponível.`;
    const ctaUrl = event.slug ? `/eventos/${event.slug}` : "/eventos";

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.CHAT_AVAILABLE,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Entrar no chat",
      priority: "NORMAL",
      organizationId: event.organizationId ?? undefined,
      eventId: event.id,
      sourceEventId,
    });

    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "CHAT_MESSAGE") {
    const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
    const threadId = typeof payload.threadId === "string" ? payload.threadId : null;
    const messageId = typeof payload.messageId === "string" ? payload.messageId : null;
    const senderId = typeof payload.senderId === "string" ? payload.senderId : null;
    const preview = typeof payload.preview === "string" ? payload.preview : "";
    const payloadOrgId =
      typeof payload.organizationId === "number" ? payload.organizationId : Number(payload.organizationId);
    const payloadContextType =
      typeof payload.contextType === "string" ? payload.contextType : null;
    const eventId = typeof payload.eventId === "number" ? payload.eventId : Number(payload.eventId);

    if ((!conversationId && !threadId) || !messageId) throw new Error("CHAT_MESSAGE_MISSING_CONTEXT");

    const conversation = conversationId
      ? await prisma.chatConversation.findUnique({
          where: { id: conversationId },
          select: { id: true, type: true, title: true, organizationId: true, contextType: true },
        })
      : null;

    const event =
      Number.isFinite(eventId) && eventId > 0
        ? await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, title: true, slug: true, organizationId: true },
          })
        : null;

    const sender = senderId
      ? await prisma.profile.findUnique({
          where: { id: senderId },
          select: { fullName: true, username: true },
        })
      : null;

    const senderLabel =
      sender?.fullName?.trim() || (sender?.username ? `@${sender.username}` : "Utilizador");
    const isEventThread = Boolean(threadId);
    const isB2C =
      isEventThread ||
      !conversation?.organizationId ||
      ["ORG_CONTACT", "BOOKING", "SERVICE", "USER_DM", "USER_GROUP"].includes(
        payloadContextType ?? conversation?.contextType ?? "",
      );

    const title = isEventThread
      ? `Nova mensagem em ${event?.title || "Evento"}`
      : isB2C
        ? conversation?.type === "GROUP" || conversation?.contextType === "USER_GROUP"
          ? `Nova mensagem em ${conversation?.title || "Grupo"}`
          : `Nova mensagem de ${senderLabel}`
        : conversation?.type === "GROUP"
          ? `Nova mensagem em ${conversation?.title || "Grupo"}`
          : `Nova mensagem de ${senderLabel}`;
    const body = preview || "Tens uma nova mensagem.";
    const orgId = Number.isFinite(payloadOrgId)
      ? payloadOrgId
      : conversation?.organizationId ?? event?.organizationId ?? undefined;
    const baseChatUrl = isEventThread
      ? event?.id
        ? `/messages/${encodeURIComponent(threadId ?? "")}?eventId=${event.id}`
        : `/messages/${encodeURIComponent(threadId ?? "")}`
      : isB2C
        ? `/messages/${encodeURIComponent(conversationId ?? "")}`
        : conversationId
          ? `/organizacao/chat?conversationId=${encodeURIComponent(conversationId)}`
          : "/organizacao/chat";
    const ctaUrl = isB2C ? baseChatUrl : appendOrganizationIdToHref(baseChatUrl, orgId ?? null);

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.CHAT_MESSAGE,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Abrir chat",
      priority: "NORMAL",
      fromUserId: senderId ?? undefined,
      organizationId: orgId,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "MATCH_CHANGED") {
    const matchId = typeof payload.matchId === "number" ? payload.matchId : Number(payload.matchId);
    if (!Number.isFinite(matchId)) throw new Error("MATCH_NOT_FOUND");
    const match = await prisma.eventMatchSlot.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        eventId: true,
        startTime: true,
        plannedStartAt: true,
        courtId: true,
        courtNumber: true,
        courtName: true,
        event: { select: { id: true, title: true, slug: true, organizationId: true, timezone: true } },
        court: { select: { name: true } },
        pairingA: {
          select: {
            slots: { select: { profileId: true, playerProfile: { select: { displayName: true, fullName: true } } } },
          },
        },
        pairingB: {
          select: {
            slots: { select: { profileId: true, playerProfile: { select: { displayName: true, fullName: true } } } },
          },
        },
      },
    });
    if (!match?.event) throw new Error("MATCH_NOT_FOUND");

    const startAt =
      typeof payload.startAt === "string"
        ? new Date(payload.startAt)
        : match.plannedStartAt ?? match.startTime ?? null;
    const validStartAt = startAt && !Number.isNaN(startAt.getTime()) ? startAt : null;
    const reason = typeof payload.reason === "string" ? payload.reason.trim() || null : null;
    const delayStatus = typeof payload.delayStatus === "string" ? payload.delayStatus.trim().toUpperCase() : null;
    const courtLabel = match.court?.name || match.courtName || match.courtNumber || match.courtId || "Quadra";
    const teamA = pairingLabel(match.pairingA as Parameters<typeof pairingLabel>[0]);
    const teamB = pairingLabel(match.pairingB as Parameters<typeof pairingLabel>[0]);
    const title = validStartAt
      ? delayStatus === "RESCHEDULED"
        ? "Jogo reagendado"
        : "Horário atualizado"
      : "Jogo adiado";
    const body = validStartAt
      ? `${teamA} vs ${teamB} · ${formatTime(validStartAt, match.event.timezone)} · ${courtLabel}${reason ? ` · Motivo: ${reason}` : ""}`
      : `${teamA} vs ${teamB} · Novo horário a definir.${reason ? ` Motivo: ${reason}.` : ""}`;
    const ctaUrl = match.event.slug ? `/eventos/${match.event.slug}` : "/eventos";

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.EVENT_REMINDER,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver torneio",
      organizationId: match.event.organizationId ?? undefined,
      eventId: match.event.id ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "MATCH_RESULT") {
    const matchId = typeof payload.matchId === "number" ? payload.matchId : Number(payload.matchId);
    if (!Number.isFinite(matchId)) throw new Error("MATCH_NOT_FOUND");
    const match = await prisma.eventMatchSlot.findUnique({
      where: { id: matchId },
      select: {
        score: true,
        scoreSets: true,
        event: { select: { id: true, title: true, slug: true, organizationId: true } },
        pairingA: {
          select: {
            slots: { select: { playerProfile: { select: { displayName: true, fullName: true } } } },
          },
        },
        pairingB: {
          select: {
            slots: { select: { playerProfile: { select: { displayName: true, fullName: true } } } },
          },
        },
      },
    });
    if (!match?.event) throw new Error("MATCH_NOT_FOUND");
    const scoreLabel = formatScoreLabel(match);
    const teamA = pairingLabel(match.pairingA as Parameters<typeof pairingLabel>[0]);
    const teamB = pairingLabel(match.pairingB as Parameters<typeof pairingLabel>[0]);
    const title = "Resultado final";
    const body = scoreLabel !== "—" ? `${teamA} vs ${teamB} · ${scoreLabel}` : `${teamA} vs ${teamB}`;
    const ctaUrl = match.event.slug ? `/eventos/${match.event.slug}` : "/eventos";

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.EVENT_REMINDER,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver torneio",
      organizationId: match.event.organizationId ?? undefined,
      eventId: match.event.id ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "NEXT_OPPONENT") {
    const matchId = typeof payload.matchId === "number" ? payload.matchId : Number(payload.matchId);
    if (!Number.isFinite(matchId)) throw new Error("MATCH_NOT_FOUND");
    const match = await prisma.eventMatchSlot.findUnique({
      where: { id: matchId },
      select: { event: { select: { id: true, title: true, slug: true, organizationId: true } } },
    });
    if (!match?.event) throw new Error("MATCH_NOT_FOUND");
    const ctaUrl = match.event.slug ? `/eventos/${match.event.slug}` : "/eventos";

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.EVENT_REMINDER,
      title: "Próximo adversário definido",
      body: match.event.title ? `No torneio ${match.event.title}.` : "Ver detalhes do torneio.",
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver torneio",
      organizationId: match.event.organizationId ?? undefined,
      eventId: match.event.id ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? "Próximo adversário definido", body: notification.body ?? "", deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "CHAMPION" || item.notificationType === "ELIMINATED") {
    const tournamentId =
      typeof payload.tournamentId === "number" ? payload.tournamentId : Number(payload.tournamentId);
    if (!Number.isFinite(tournamentId)) throw new Error("EVENT_NOT_FOUND");
    const event = await prisma.event.findUnique({
      where: { id: tournamentId },
      select: { id: true, title: true, slug: true, organizationId: true },
    });
    if (!event) throw new Error("EVENT_NOT_FOUND");
    const isChampion = item.notificationType === "CHAMPION";
    const title = isChampion ? "Campeão!" : "Eliminação";
    const body = event.title
      ? isChampion
        ? `És campeão do torneio ${event.title}.`
        : `Ficaste eliminado no torneio ${event.title}.`
      : isChampion
        ? "És campeão do torneio."
        : "Ficaste eliminado no torneio.";
    const ctaUrl = event.slug ? `/eventos/${event.slug}` : "/eventos";

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.EVENT_REMINDER,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver torneio",
      organizationId: event.organizationId ?? undefined,
      eventId: event.id ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "BRACKET_PUBLISHED") {
    const tournamentId =
      typeof payload.tournamentId === "number" ? payload.tournamentId : Number(payload.tournamentId);
    if (!Number.isFinite(tournamentId)) throw new Error("EVENT_NOT_FOUND");
    const event = await prisma.event.findUnique({
      where: { id: tournamentId },
      select: { id: true, title: true, slug: true, organizationId: true },
    });
    if (!event) throw new Error("EVENT_NOT_FOUND");
    const title = "Bracket publicado";
    const body = event.title
      ? `O bracket do torneio ${event.title} já está disponível.`
      : "O bracket do torneio já está disponível.";
    const ctaUrl = event.slug ? `/eventos/${event.slug}` : "/eventos";

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.EVENT_REMINDER,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver torneio",
      organizationId: event.organizationId ?? undefined,
      eventId: event.id ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (item.notificationType === "TOURNAMENT_EVE_REMINDER") {
    const tournamentId =
      typeof payload.tournamentId === "number" ? payload.tournamentId : Number(payload.tournamentId);
    if (!Number.isFinite(tournamentId)) throw new Error("EVENT_NOT_FOUND");
    const event = await prisma.event.findUnique({
      where: { id: tournamentId },
      select: { id: true, title: true, slug: true, startsAt: true, timezone: true, organizationId: true },
    });
    if (!event) throw new Error("EVENT_NOT_FOUND");
    const startLabel = event.startsAt ? formatTime(event.startsAt, event.timezone) : null;
    const title = "Torneio amanhã";
    const body = event.title
      ? startLabel
        ? `O torneio ${event.title} começa amanhã às ${startLabel}.`
        : `O torneio ${event.title} começa amanhã.`
      : startLabel
        ? `O torneio começa amanhã às ${startLabel}.`
        : "O torneio começa amanhã.";
    const ctaUrl = event.slug ? `/eventos/${event.slug}` : "/eventos";

    const notification = await createNotificationRecord({
      userId: item.userId,
      type: NotificationType.EVENT_REMINDER,
      title,
      body,
      payload: payloadJson,
      ctaUrl,
      ctaLabel: "Ver torneio",
      organizationId: event.organizationId ?? undefined,
      eventId: event.id ?? undefined,
      sourceEventId,
    });
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  if (NOTIFICATION_TYPES.has(item.notificationType)) {
    const data = payload as Record<string, unknown>;
    const readString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
    const readNumber = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
      return null;
    };

    const type = item.notificationType as NotificationType;
    const fromUserId = readString(data.fromUserId);
    const organizationId = readNumber(data.organizationId);
    const eventId = readNumber(data.eventId);
    const inviteId = readString(data.inviteId);
    const ticketId = readString(data.ticketId);
    const priority = (data.priority as NotificationPriority) ?? "NORMAL";
    const campaignId = type === NotificationType.CRM_CAMPAIGN ? resolveCampaignId(data) : null;

    const [actor, organization, event] = await Promise.all([
      fromUserId
        ? prisma.profile.findUnique({
            where: { id: fromUserId },
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          })
        : Promise.resolve(null),
      organizationId
        ? prisma.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, publicName: true, businessName: true, username: true, brandingAvatarUrl: true, brandingCoverUrl: true },
          })
        : Promise.resolve(null),
      eventId
        ? prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, title: true, slug: true, coverImageUrl: true, organizationId: true },
          })
        : Promise.resolve(null),
    ]);

    const actors = actor
      ? [
          {
            id: actor.id,
            name: actor.fullName || actor.username || "Utilizador",
            avatarUrl: actor.avatarUrl ?? null,
            username: actor.username ?? null,
          },
        ]
      : [];

    const registryInput = {
      type,
      title: readString(data.title),
      body: readString(data.body),
      ctaUrl: readString(data.ctaUrl),
      ctaLabel: readString(data.ctaLabel),
      priority,
      fromUserId,
      organizationId: organization?.id ?? organizationId ?? undefined,
      eventId: event?.id ?? eventId ?? undefined,
      ticketId: ticketId ?? undefined,
      inviteId,
      payload: data,
      payloadKind: resolvePayloadKind(data),
      roleLabel: resolveRoleLabel(data),
      actors,
      actorCount: actors.length,
      event: event ? { id: event.id, title: event.title, slug: event.slug, coverImageUrl: event.coverImageUrl, organizationId: event.organizationId } : undefined,
      organization: organization ? { id: organization.id, publicName: organization.publicName, businessName: organization.businessName, username: organization.username, brandingAvatarUrl: organization.brandingAvatarUrl, brandingCoverUrl: organization.brandingCoverUrl } : undefined,
    };

    const content = resolveNotificationContent(registryInput);
    const missing = validateNotificationInput(registryInput);
    if (missing.length) {
      console.warn("[notifications][registry] missing_fields", { type, missing, userId: item.userId });
    }

    const notification = await createNotificationRecord({
      userId: item.userId,
      type,
      title: content.title,
      body: content.body ?? null,
      payload: payloadJson,
      ctaUrl: content.ctaUrl ?? undefined,
      ctaLabel: content.ctaLabel ?? undefined,
      priority: content.priority ?? priority,
      fromUserId: fromUserId ?? undefined,
      organizationId: registryInput.organizationId ?? undefined,
      eventId: registryInput.eventId ?? undefined,
      ticketId: ticketId ?? undefined,
      inviteId: inviteId ?? undefined,
      sourceEventId,
    });
    if (type === NotificationType.CRM_CAMPAIGN) {
      await linkCrmCampaignNotification({
        campaignId,
        userId: item.userId,
        notificationId: notification.id,
      });
    }

    const pushPayload = resolvePushPayload(registryInput);
    await maybeSendPush(
      item.userId,
      notification.type,
      { title: pushPayload.title, body: pushPayload.body, deepLink: pushPayload.deepLink },
      { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
    );
    return notification;
  }

  const notification = await createNotificationRecord({
    userId: item.userId,
    type: NotificationType.SYSTEM_ANNOUNCE,
    title: "Atualização do sistema",
    body: "Tens uma atualização importante.",
    payload: payloadJson,
    ctaUrl: "/me",
    ctaLabel: "Ver detalhes",
    priority: "NORMAL",
    fromUserId: inviterUserId ?? undefined,
    sourceEventId,
  });
  await maybeSendPush(
    item.userId,
    notification.type,
    { title: notification.title ?? "Atualização do sistema", body: notification.body ?? "", deepLink: notification.ctaUrl ?? "/me" },
    { organizationId: notification.organizationId ?? null, eventId: notification.eventId ?? null },
  );
  return notification;
}

function parseEventPayload(payload: Prisma.JsonValue | null) {
  if (!payload || typeof payload !== "object") return {};
  return payload as Record<string, unknown>;
}

export async function consumeNotificationEventLog(eventId: string) {
  const event = await prisma.eventLog.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      eventType: true,
      organizationId: true,
      actorUserId: true,
      payload: true,
      sourceId: true,
    },
  });
  if (!event) return { ok: false, code: "EVENT_NOT_FOUND" } as const;
  if (!EVENTLOG_ALLOWLIST.has(event.eventType)) {
    return { ok: false, code: "EVENT_NOT_ALLOWED" } as const;
  }

  const payload = parseEventPayload(event.payload);
  if (event.eventType === "loyalty.earned" || event.eventType === "loyalty.spent") {
    const ledgerId = typeof payload.ledgerId === "string" ? payload.ledgerId : null;
    if (!ledgerId) return { ok: false, code: "LEDGER_MISSING" } as const;
    const notificationType = event.eventType === "loyalty.earned" ? "LOYALTY_EARNED" : "LOYALTY_SPENT";
    await enqueueNotification({
      dedupeKey: `loyalty:${ledgerId}:${notificationType}`,
      userId: event.actorUserId ?? undefined,
      notificationType,
      payload: { ledgerId, sourceEventId: event.id },
    });
    return { ok: true } as const;
  }

  if (event.eventType === "padel.registration.created" || event.eventType === "padel.registration.expired") {
    const registrationId = typeof payload.registrationId === "string" ? payload.registrationId : null;
    if (!registrationId) return { ok: false, code: "REGISTRATION_MISSING" } as const;
    const notificationType = event.eventType === "padel.registration.created" ? "PADREG_CREATED" : "PADREG_EXPIRED";
    await enqueueNotification({
      dedupeKey: `padelreg:${registrationId}:${notificationType}`,
      userId: event.actorUserId ?? undefined,
      notificationType,
      payload: { registrationId, eventId: payload.eventId ?? null, sourceEventId: event.id },
    });
    return { ok: true } as const;
  }

  if (event.eventType.startsWith("organization.owner_transfer.")) {
    const transferId = typeof payload.transferId === "string" ? payload.transferId : null;
    const toUserId = typeof payload.toUserId === "string" ? payload.toUserId : null;
    const fromUserId = typeof payload.fromUserId === "string" ? payload.fromUserId : null;
    const targetUserId =
      event.eventType.endsWith("requested") ? toUserId : fromUserId ?? toUserId;
    if (!transferId || !targetUserId) return { ok: false, code: "TRANSFER_MISSING" } as const;
    const suffix = event.eventType.split(".").pop() ?? "requested";
    const notificationType = `OWNER_TRANSFER_${suffix.toUpperCase()}`;
    await enqueueNotification({
      dedupeKey: `owner-transfer:${transferId}:${notificationType}:${targetUserId}`,
      userId: targetUserId,
      notificationType,
      payload: { transferId, organizationId: payload.organizationId ?? null, sourceEventId: event.id },
    });
    return { ok: true } as const;
  }

  return { ok: false, code: "EVENT_NOT_MAPPED" } as const;
}

export async function consumeNotificationEventLogBatch(limit = 100) {
  const events = await prisma.eventLog.findMany({
    where: { eventType: { in: Array.from(EVENTLOG_ALLOWLIST) } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let processed = 0;
  for (const event of events) {
    const res = await consumeNotificationEventLog(event.id);
    if (res.ok) processed += 1;
  }

  return { processed };
}
