import { prisma } from "@/lib/prisma";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { getNotificationPrefs, shouldNotify } from "@/domain/notifications/prefs";
import { deliverApnsPush } from "@/lib/push/apns";
import type { CreateNotificationInput } from "@/domain/notifications/types";
import { NotificationType, NotificationPriority, type Prisma } from "@prisma/client";
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

async function maybeSendPush(userId: string, payload: { title: string; body: string; deepLink?: string | null }) {
  const tokens = await prisma.pushDeviceToken.findMany({
    where: { userId, revokedAt: null, platform: "ios" },
    select: { token: true },
  });
  if (!tokens.length) return;

  const pref = await getNotificationPrefs(userId).catch(() => null);
  if (pref && !pref.allowSystemAnnouncements) return;

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
    if (Number.isFinite(pairingId)) {
      const ticket = await prisma.ticket.findFirst({
        where: {
          pairingId: pairingId as number,
          OR: [{ userId }, { ownerUserId: userId }],
        },
        select: {
          purchaseId: true,
          saleSummary: { select: { purchaseId: true, paymentIntentId: true } },
        },
      });
      const purchaseId =
        ticket?.purchaseId ?? ticket?.saleSummary?.purchaseId ?? ticket?.saleSummary?.paymentIntentId ?? null;
      if (purchaseId) {
        const entitlement = await prisma.entitlement.findFirst({
          where: {
            purchaseId,
            ownerUserId: userId,
            type: "PADEL_ENTRY",
          },
          select: { id: true },
        });
        entitlementId = entitlement?.id ?? null;
      }
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: "/me/carteira" });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: "/me/inscricoes" });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: orgHref });
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
    if (Number.isFinite(pairingId)) {
      const ticket = await prisma.ticket.findFirst({
        where: {
          pairingId,
          OR: [{ userId: item.userId }, { ownerUserId: item.userId }],
        },
        select: {
          purchaseId: true,
          saleSummary: { select: { purchaseId: true, paymentIntentId: true } },
        },
      });
      const purchaseId =
        ticket?.purchaseId ?? ticket?.saleSummary?.purchaseId ?? ticket?.saleSummary?.paymentIntentId ?? null;
      if (purchaseId) {
        const entitlement = await prisma.entitlement.findFirst({
          where: {
            purchaseId,
            ownerUserId: item.userId,
            type: "PADEL_ENTRY",
          },
          select: { id: true },
        });
        entitlementId = entitlement?.id ?? null;
      }
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
    await maybeSendPush(item.userId, { title: notification.title ?? "Convite para dupla", body: notification.body ?? "", deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
    return notification;
  }

  if (item.notificationType === "CHAT_MESSAGE") {
    const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
    const messageId = typeof payload.messageId === "string" ? payload.messageId : null;
    const senderId = typeof payload.senderId === "string" ? payload.senderId : null;
    const preview = typeof payload.preview === "string" ? payload.preview : "";
    const payloadOrgId =
      typeof payload.organizationId === "number" ? payload.organizationId : Number(payload.organizationId);

    if (!conversationId || !messageId) throw new Error("CHAT_MESSAGE_MISSING_CONTEXT");

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, type: true, title: true, organizationId: true },
    });

    const sender = senderId
      ? await prisma.profile.findUnique({
          where: { id: senderId },
          select: { fullName: true, username: true },
        })
      : null;

    const senderLabel =
      sender?.fullName?.trim() || (sender?.username ? `@${sender.username}` : "Utilizador");
    const title =
      conversation?.type === "GROUP"
        ? `Nova mensagem em ${conversation?.title || "Grupo"}`
        : `Nova mensagem de ${senderLabel}`;
    const body = preview || "Tens uma nova mensagem.";
    const orgId = Number.isFinite(payloadOrgId)
      ? payloadOrgId
      : conversation?.organizationId ?? undefined;
    const baseChatUrl = conversationId
      ? `/organizacao/chat?conversationId=${encodeURIComponent(conversationId)}`
      : "/organizacao/chat";
    const ctaUrl = appendOrganizationIdToHref(baseChatUrl, orgId ?? null);

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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    const courtLabel = match.court?.name || match.courtName || match.courtNumber || match.courtId || "Quadra";
    const teamA = pairingLabel(match.pairingA as Parameters<typeof pairingLabel>[0]);
    const teamB = pairingLabel(match.pairingB as Parameters<typeof pairingLabel>[0]);
    const title = validStartAt ? "Horário atualizado" : "Jogo adiado";
    const body = validStartAt
      ? `${teamA} vs ${teamB} · ${formatTime(validStartAt, match.event.timezone)} · ${courtLabel}`
      : `${teamA} vs ${teamB} · Novo horário a definir.`;
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? "Próximo adversário definido", body: notification.body ?? "", deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
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
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: ctaUrl });
    return notification;
  }

  if (NOTIFICATION_TYPES.has(item.notificationType)) {
    const data = payload as Record<string, unknown>;
    const title = typeof data.title === "string" ? data.title : "Notificação";
    const body = typeof data.body === "string" ? data.body : "Tens uma nova notificação.";
    const notification = await createNotificationRecord({
      userId: item.userId,
      type: item.notificationType as NotificationType,
      title,
      body,
      payload: payloadJson,
      ctaUrl: typeof data.ctaUrl === "string" ? data.ctaUrl : "/social?tab=notifications",
      ctaLabel: typeof data.ctaLabel === "string" ? data.ctaLabel : "Ver",
      priority: (data.priority as NotificationPriority) ?? "NORMAL",
      fromUserId: typeof data.fromUserId === "string" ? data.fromUserId : undefined,
      organizationId: typeof data.organizationId === "number" ? data.organizationId : undefined,
      eventId: typeof data.eventId === "number" ? data.eventId : undefined,
      ticketId: typeof data.ticketId === "string" ? data.ticketId : undefined,
      inviteId: typeof data.inviteId === "string" ? data.inviteId : undefined,
      sourceEventId,
    });
    await maybeSendPush(item.userId, { title: notification.title ?? title, body: notification.body ?? body, deepLink: notification.ctaUrl ?? null });
    return notification;
  }

  const notification = await createNotificationRecord({
    userId: item.userId,
    type: NotificationType.SYSTEM_ANNOUNCE,
    title: "Notificação",
    body: "Tens uma nova notificação.",
    payload: payloadJson,
    ctaUrl: "/social?tab=notifications",
    ctaLabel: "Ver",
    priority: "NORMAL",
    fromUserId: inviterUserId ?? undefined,
    sourceEventId,
  });
  await maybeSendPush(item.userId, { title: notification.title ?? "Notificação", body: notification.body ?? "", deepLink: "/social?tab=notifications" });
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
