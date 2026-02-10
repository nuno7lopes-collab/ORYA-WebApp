import { NotificationPriority, NotificationType } from "@prisma/client";

export type NotificationCategory = "network" | "events" | "system" | "marketing" | "chat";

export type NotificationActor = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  username?: string | null;
};

export type NotificationAction = {
  type: string;
  label: string;
  style?: "primary" | "secondary" | string;
  payload?: Record<string, unknown>;
};

export type NotificationRegistryInput = {
  type: NotificationType;
  title?: string | null;
  body?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  priority?: NotificationPriority | null;
  fromUserId?: string | null;
  organizationId?: number | null;
  eventId?: number | null;
  ticketId?: string | null;
  ticketEntitlementId?: string | null;
  inviteId?: string | null;
  payload?: Record<string, unknown> | null;
  payloadKind?: string | null;
  roleLabel?: string | null;
  campaignId?: string | null;
  actors?: NotificationActor[];
  actorCount?: number;
  followRequestId?: number | null;
  isMutual?: boolean;
  event?: { id?: number | null; title?: string | null; slug?: string | null; coverImageUrl?: string | null; organizationId?: number | null };
  organization?: { id?: number | null; publicName?: string | null; businessName?: string | null; username?: string | null; brandingAvatarUrl?: string | null; brandingCoverUrl?: string | null };
};

type RegistryOutput = {
  title: string;
  body?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  actions?: NotificationAction[];
  category: NotificationCategory;
  priority: NotificationPriority;
};

type RegistryEntry = {
  category: NotificationCategory;
  priority?: NotificationPriority;
  required?: Array<"eventId" | "organizationId" | "fromUserId" | "inviteId">;
  preferStored?: boolean;
  build: (ctx: ResolvedContext) => Omit<RegistryOutput, "category" | "priority">;
};

type ResolvedContext = {
  type: NotificationType;
  title?: string | null;
  body?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  priority?: NotificationPriority | null;
  fromUserId?: string | null;
  organizationId?: number | null;
  eventId?: number | null;
  ticketId?: string | null;
  ticketEntitlementId?: string | null;
  inviteId?: string | null;
  payload?: Record<string, unknown> | null;
  payloadKind?: string | null;
  roleLabel?: string | null;
  campaignId?: string | null;
  actors: NotificationActor[];
  actorCount: number;
  actorLabel: string;
  eventTitle: string | null;
  organizationName: string | null;
  eventSlug: string | null;
  followRequestId?: number | null;
};

const GENERIC_TITLES = new Set(["Notificação", "Atualização", "Atualizacao"]);
const GENERIC_BODIES = new Set(["Tens uma nova notificação.", "Tens uma nova atualização.", "Tens uma nova atualizacao."]);

const ROLE_LABELS: Record<string, string> = {
  OWNER: "owner",
  CO_OWNER: "co-owner",
  ADMIN: "admin",
  STAFF: "staff",
  TRAINER: "treinador",
  PROMOTER: "promotor",
  VIEWER: "membro",
};

export const NOTIFICATION_CATEGORY_BY_TYPE: Record<NotificationType, NotificationCategory> = {
  ORGANIZATION_INVITE: "network",
  ORGANIZATION_TRANSFER: "network",
  PAIRING_INVITE: "events",
  EVENT_SALE: "system",
  EVENT_PAYOUT_STATUS: "system",
  STRIPE_STATUS: "system",
  BOOKING_CHANGE_REQUEST: "events",
  BOOKING_CHANGE_RESPONSE: "events",
  FOLLOW_REQUEST: "network",
  FOLLOW_ACCEPT: "network",
  EVENT_REMINDER: "events",
  EVENT_INVITE: "events",
  FRIEND_GOING_TO_EVENT: "network",
  CHECKIN_READY: "events",
  TICKET_SHARED: "events",
  MARKETING_PROMO_ALERT: "marketing",
  CRM_CAMPAIGN: "marketing",
  SYSTEM_ANNOUNCE: "system",
  FOLLOWED_YOU: "network",
  TICKET_TRANSFER_RECEIVED: "events",
  TICKET_TRANSFER_ACCEPTED: "events",
  TICKET_TRANSFER_DECLINED: "events",
  CLUB_INVITE: "network",
  NEW_EVENT_FROM_FOLLOWED_ORGANIZATION: "network",
  CHAT_AVAILABLE: "chat",
  CHAT_OPEN: "chat",
  CHAT_ANNOUNCEMENT: "chat",
  CHAT_MESSAGE: "chat",
};

export const NOTIFICATION_TYPES_BY_CATEGORY = {
  network: Object.keys(NOTIFICATION_CATEGORY_BY_TYPE).filter((type) => NOTIFICATION_CATEGORY_BY_TYPE[type as NotificationType] === "network") as NotificationType[],
  events: Object.keys(NOTIFICATION_CATEGORY_BY_TYPE).filter((type) => NOTIFICATION_CATEGORY_BY_TYPE[type as NotificationType] === "events") as NotificationType[],
  system: Object.keys(NOTIFICATION_CATEGORY_BY_TYPE).filter((type) => NOTIFICATION_CATEGORY_BY_TYPE[type as NotificationType] === "system") as NotificationType[],
  marketing: Object.keys(NOTIFICATION_CATEGORY_BY_TYPE).filter((type) => NOTIFICATION_CATEGORY_BY_TYPE[type as NotificationType] === "marketing") as NotificationType[],
  chat: Object.keys(NOTIFICATION_CATEGORY_BY_TYPE).filter((type) => NOTIFICATION_CATEGORY_BY_TYPE[type as NotificationType] === "chat") as NotificationType[],
} as const;

export const isChatNotificationType = (type: NotificationType) => NOTIFICATION_CATEGORY_BY_TYPE[type] === "chat";

export const safeCtaUrl = (value?: string | null) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\/+$/, "");
  if (normalized === "/notifications" || normalized.endsWith("/notifications")) return null;
  if (normalized.includes("tab=notifications")) return null;
  return trimmed;
};

export const resolvePayloadKind = (payload: Record<string, unknown> | null | undefined) => {
  if (!payload) return null;
  const nested = payload.payload && typeof payload.payload === "object" ? (payload.payload as Record<string, unknown>) : null;
  const direct = typeof payload.kind === "string" ? payload.kind : null;
  const nestedKind = nested && typeof nested.kind === "string" ? nested.kind : null;
  return nestedKind ?? direct;
};

export const resolveRoleLabel = (payload: Record<string, unknown> | null | undefined) => {
  if (!payload) return null;
  const nested = payload.payload && typeof payload.payload === "object" ? (payload.payload as Record<string, unknown>) : null;
  const raw = typeof payload.role === "string" ? payload.role : nested && typeof nested.role === "string" ? nested.role : null;
  if (!raw) return null;
  return ROLE_LABELS[raw] ?? raw.toLowerCase();
};

export const resolveCampaignId = (payload: Record<string, unknown> | null | undefined) => {
  if (!payload) return null;
  if (typeof payload.campaignId === "string") return payload.campaignId;
  const nested = payload.payload && typeof payload.payload === "object" ? (payload.payload as Record<string, unknown>) : null;
  if (nested && typeof nested.campaignId === "string") return nested.campaignId;
  return null;
};

const normalizeText = (value?: string | null) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isGenericCopy = (title?: string | null, body?: string | null) => {
  const normalizedTitle = normalizeText(title);
  const normalizedBody = normalizeText(body);
  const titleGeneric = normalizedTitle ? GENERIC_TITLES.has(normalizedTitle) : false;
  const bodyGeneric = normalizedBody ? GENERIC_BODIES.has(normalizedBody) : false;
  return titleGeneric || bodyGeneric;
};

const resolveActorLabel = (actors: NotificationActor[], count: number) => {
  if (!count) return "";
  const primary = actors[0]?.name ?? "Alguém";
  if (count <= 1) return primary;
  return `${primary} e mais ${count - 1}`;
};

const resolveOrganizationName = (input: NotificationRegistryInput) =>
  input.organization?.publicName ||
  input.organization?.businessName ||
  (typeof input.payload?.organizationName === "string" ? input.payload?.organizationName : null) ||
  null;

const resolveEventTitle = (input: NotificationRegistryInput) =>
  input.event?.title ||
  (typeof input.payload?.eventTitle === "string" ? input.payload?.eventTitle : null) ||
  null;

const resolveEventSlug = (input: NotificationRegistryInput) =>
  input.event?.slug ||
  (typeof input.payload?.eventSlug === "string" ? input.payload?.eventSlug : null) ||
  null;

const buildEventCta = (ctx: ResolvedContext, label = "Ver evento") => {
  if (ctx.ctaUrl) {
    return { ctaUrl: ctx.ctaUrl, ctaLabel: ctx.ctaLabel ?? label };
  }
  if (ctx.eventSlug) {
    return { ctaUrl: `/eventos/${ctx.eventSlug}`, ctaLabel: label };
  }
  return { ctaUrl: "/eventos", ctaLabel: label };
};

const buildProfileCta = (ctx: ResolvedContext) => {
  const actor = ctx.actors[0];
  if (ctx.actorCount === 1 && actor?.username) {
    return { ctaUrl: `/${actor.username}`, ctaLabel: "Ver perfil" };
  }
  return { ctaUrl: "/network", ctaLabel: "Ver rede" };
};

const buildTicketCta = (ctx: ResolvedContext, label = "Ver bilhete") => {
  if (ctx.ticketEntitlementId) {
    return { ctaUrl: `/me/bilhetes/${ctx.ticketEntitlementId}`, ctaLabel: label };
  }
  if (ctx.ctaUrl) {
    return { ctaUrl: ctx.ctaUrl, ctaLabel: ctx.ctaLabel ?? label };
  }
  return { ctaUrl: "/me/bilhetes", ctaLabel: label };
};

const resolvePairingId = (payload: Record<string, unknown> | null | undefined) => {
  if (!payload) return null;
  const raw = payload.pairingId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return null;
};

const resolveViewerRole = (payload: Record<string, unknown> | null | undefined) => {
  if (!payload) return "INVITED";
  const raw = payload.viewerRole;
  if (raw === "CAPTAIN") return "CAPTAIN";
  return "INVITED";
};

const registry: Record<NotificationType, RegistryEntry> = {
  FOLLOW_REQUEST: {
    category: "network",
    required: ["fromUserId"],
    build: (ctx) => ({
      title: ctx.actorLabel || "Pedido para seguir",
      body: ctx.actorCount > 1 ? "pediram para seguir-te." : "pediu para seguir-te.",
      ...buildProfileCta(ctx),
      actions: ctx.followRequestId
        ? [
            { type: "accept_follow", label: "Aceitar", style: "primary", payload: { requestId: ctx.followRequestId } },
            { type: "decline_follow", label: "Recusar", style: "secondary", payload: { requestId: ctx.followRequestId } },
          ]
        : undefined,
    }),
  },
  FOLLOWED_YOU: {
    category: "network",
    required: ["fromUserId"],
    build: (ctx) => ({
      title: ctx.actorLabel || "Novo seguidor",
      body: ctx.actorCount > 1 ? "começaram a seguir-te." : "começou a seguir-te.",
      ...buildProfileCta(ctx),
      actions: ctx.actorCount === 1 && ctx.actors[0]?.id
        ? [{ type: "follow_back", label: "Seguir também", style: "primary", payload: { userId: ctx.actors[0].id } }]
        : undefined,
    }),
  },
  FOLLOW_ACCEPT: {
    category: "network",
    required: ["fromUserId"],
    build: (ctx) => ({
      title: ctx.actorLabel || "Pedido aceite",
      body: ctx.actorCount > 1 ? "aceitaram o teu pedido." : "aceitou o teu pedido.",
      ...buildProfileCta(ctx),
    }),
  },
  FRIEND_GOING_TO_EVENT: {
    category: "network",
    required: ["fromUserId", "eventId"],
    build: (ctx) => ({
      title: ctx.actorLabel || "Amigo",
      body: ctx.eventTitle ? `vai ao evento ${ctx.eventTitle}.` : "vai a um evento.",
      ...buildEventCta(ctx),
    }),
  },
  ORGANIZATION_INVITE: {
    category: "network",
    required: ["organizationId", "inviteId"],
    build: (ctx) => ({
      title: ctx.organizationName ?? "Organização",
      body: ctx.roleLabel ? `convidou-te para seres ${ctx.roleLabel}.` : "convidou-te para a equipa.",
      ctaUrl: "/convites/organizacoes",
      ctaLabel: "Gerir convites",
      actions: ctx.inviteId
        ? [
            { type: "accept_org_invite", label: "Aceitar", style: "primary", payload: { inviteId: ctx.inviteId } },
            { type: "decline_org_invite", label: "Recusar", style: "secondary", payload: { inviteId: ctx.inviteId } },
          ]
        : undefined,
    }),
  },
  ORGANIZATION_TRANSFER: {
    category: "network",
    required: ["organizationId"],
    build: (ctx) => ({
      title: ctx.organizationName ?? "Organização",
      body: "iniciou uma transferência de owner.",
      ctaUrl: "/convites/organizacoes",
      ctaLabel: "Gerir convites",
    }),
  },
  CLUB_INVITE: {
    category: "network",
    required: ["organizationId", "inviteId"],
    build: (ctx) => ({
      title: ctx.organizationName ?? "Organização",
      body: "convidou-te para o clube.",
      ctaUrl: "/convites/organizacoes",
      ctaLabel: "Gerir convites",
      actions: ctx.inviteId
        ? [
            { type: "accept_org_invite", label: "Aceitar", style: "primary", payload: { inviteId: ctx.inviteId } },
            { type: "decline_org_invite", label: "Recusar", style: "secondary", payload: { inviteId: ctx.inviteId } },
          ]
        : undefined,
    }),
  },
  NEW_EVENT_FROM_FOLLOWED_ORGANIZATION: {
    category: "network",
    required: ["organizationId", "eventId"],
    build: (ctx) => ({
      title: ctx.organizationName ?? "Organização",
      body: ctx.eventTitle ? `publicou um novo evento ${ctx.eventTitle}.` : "publicou um novo evento.",
      ...buildEventCta(ctx),
    }),
  },
  PAIRING_INVITE: {
    category: "events",
    required: ["eventId"],
    build: (ctx) => ({
      title: ctx.actorLabel || "Convite para dupla",
      body: ctx.eventTitle ? `convidou-te para a dupla no torneio ${ctx.eventTitle}.` : "convidou-te para uma dupla.",
      ...buildEventCta(ctx, "Ver torneio"),
      actions:
        resolveViewerRole(ctx.payload) === "INVITED" && resolvePairingId(ctx.payload)
          ? [
              {
                type: "accept_pairing_invite",
                label: "Aceitar",
                style: "primary",
                payload: { pairingId: resolvePairingId(ctx.payload) as number },
              },
              {
                type: "decline_pairing_invite",
                label: "Recusar",
                style: "secondary",
                payload: { pairingId: resolvePairingId(ctx.payload) as number },
              },
            ]
          : undefined,
    }),
  },
  EVENT_INVITE: {
    category: "events",
    required: ["eventId"],
    build: (ctx) => ({
      title: ctx.actorLabel || ctx.organizationName || "Convite para evento",
      body: ctx.eventTitle ? `convidou-te para o evento ${ctx.eventTitle}.` : "convidou-te para um evento.",
      ...buildEventCta(ctx),
    }),
  },
  BOOKING_CHANGE_REQUEST: {
    category: "events",
    build: (ctx) => ({
      title: "Pedido de alteração de reserva",
      body: "Existe um pedido para alterar uma reserva.",
      ctaUrl: ctx.ctaUrl ?? "/me/reservas",
      ctaLabel: ctx.ctaLabel ?? "Ver reserva",
    }),
  },
  BOOKING_CHANGE_RESPONSE: {
    category: "events",
    build: (ctx) => ({
      title: "Resposta à alteração de reserva",
      body: "O teu pedido de alteração teve uma resposta.",
      ctaUrl: ctx.ctaUrl ?? "/me/reservas",
      ctaLabel: ctx.ctaLabel ?? "Ver reserva",
    }),
  },
  EVENT_REMINDER: {
    category: "events",
    required: ["eventId"],
    build: (ctx) => ({
      title: ctx.eventTitle ?? "Lembrete do evento",
      body: ctx.eventTitle ? "Lembrete do evento." : "Lembrete do evento.",
      ...buildEventCta(ctx),
      actions: ctx.eventSlug ? [{ type: "open", label: "Ver evento", style: "secondary", payload: { url: `/eventos/${ctx.eventSlug}` } }] : undefined,
    }),
  },
  CHECKIN_READY: {
    category: "events",
    required: ["eventId"],
    build: (ctx) => ({
      title: ctx.eventTitle ?? "Check-in disponível",
      body: ctx.eventTitle ? "Check-in disponível para o evento." : "Check-in disponível.",
      ...buildEventCta(ctx),
      actions: ctx.eventSlug ? [{ type: "open", label: "Ver evento", style: "secondary", payload: { url: `/eventos/${ctx.eventSlug}` } }] : undefined,
    }),
  },
  TICKET_SHARED: {
    category: "events",
    required: ["eventId"],
    build: (ctx) => ({
      title: ctx.eventTitle ?? "Bilhete recebido",
      body: ctx.eventTitle ? "Recebeste um bilhete para o evento." : "Recebeste um bilhete.",
      ...buildTicketCta(ctx),
      actions: [
        {
          type: "open",
          label: "Ver bilhete",
          style: "secondary",
          payload: { url: buildTicketCta(ctx).ctaUrl ?? "/me/bilhetes" },
        },
      ],
    }),
  },
  TICKET_TRANSFER_RECEIVED: {
    category: "events",
    required: ["eventId"],
    build: (ctx) => ({
      title: ctx.eventTitle ?? "Transferência de bilhete",
      body: ctx.eventTitle ? "Recebeste uma transferência de bilhete." : "Recebeste uma transferência de bilhete.",
      ...buildTicketCta(ctx),
      actions: [
        {
          type: "open",
          label: "Ver bilhete",
          style: "secondary",
          payload: { url: buildTicketCta(ctx).ctaUrl ?? "/me/bilhetes" },
        },
      ],
    }),
  },
  TICKET_TRANSFER_ACCEPTED: {
    category: "events",
    build: (ctx) => ({
      title: ctx.eventTitle ?? "Transferência aceite",
      body: ctx.eventTitle ? "A tua transferência de bilhete foi aceite." : "A tua transferência de bilhete foi aceite.",
      ...buildTicketCta(ctx),
      actions: [
        {
          type: "open",
          label: "Ver bilhete",
          style: "secondary",
          payload: { url: buildTicketCta(ctx).ctaUrl ?? "/me/bilhetes" },
        },
      ],
    }),
  },
  TICKET_TRANSFER_DECLINED: {
    category: "events",
    build: (ctx) => ({
      title: ctx.eventTitle ?? "Transferência recusada",
      body: ctx.eventTitle ? "A tua transferência de bilhete foi recusada." : "A tua transferência de bilhete foi recusada.",
      ...buildTicketCta(ctx),
      actions: [
        {
          type: "open",
          label: "Ver bilhete",
          style: "secondary",
          payload: { url: buildTicketCta(ctx).ctaUrl ?? "/me/bilhetes" },
        },
      ],
    }),
  },
  EVENT_SALE: {
    category: "system",
    preferStored: true,
    build: (ctx) => ({
      title: ctx.eventTitle ? "Nova venda" : "Compra confirmada",
      body: ctx.eventTitle ? `Atualização de vendas para ${ctx.eventTitle}.` : "Atualização de venda.",
      ctaUrl: ctx.ctaUrl ?? "/me/carteira",
      ctaLabel: ctx.ctaLabel ?? "Ver vendas",
    }),
  },
  EVENT_PAYOUT_STATUS: {
    category: "system",
    preferStored: true,
    build: (ctx) => ({
      title: "Pagamento do evento",
      body: ctx.eventTitle ? `Pagamento do evento ${ctx.eventTitle} atualizado.` : "Pagamento do evento atualizado.",
      ctaUrl: ctx.ctaUrl ?? "/me/carteira",
      ctaLabel: ctx.ctaLabel ?? "Ver pagamentos",
    }),
  },
  STRIPE_STATUS: {
    category: "system",
    preferStored: true,
    build: () => ({
      title: "Atualização da conta Stripe",
      body: "A tua conta Stripe foi atualizada.",
      ctaUrl: "/me/carteira",
      ctaLabel: "Ver pagamentos",
    }),
  },
  SYSTEM_ANNOUNCE: {
    category: "system",
    preferStored: true,
    build: () => ({
      title: "Atualização do sistema",
      body: "Tens uma atualização importante.",
      ctaUrl: "/me",
      ctaLabel: "Ver detalhes",
    }),
  },
  MARKETING_PROMO_ALERT: {
    category: "marketing",
    preferStored: true,
    build: () => ({
      title: "Promoção ORYA",
      body: "Há novidades para ti.",
      ctaUrl: "/eventos",
      ctaLabel: "Ver promoções",
    }),
  },
  CRM_CAMPAIGN: {
    category: "marketing",
    preferStored: true,
    build: () => ({
      title: "Campanha ORYA",
      body: "Descobre as novidades.",
      ctaUrl: "/eventos",
      ctaLabel: "Ver campanha",
    }),
  },
  CHAT_OPEN: {
    category: "chat",
    preferStored: true,
    build: () => ({
      title: "Chat",
      body: "Há novidades no chat.",
      ctaUrl: "/organizacao/chat",
      ctaLabel: "Abrir chat",
    }),
  },
  CHAT_AVAILABLE: {
    category: "chat",
    preferStored: true,
    required: ["eventId"],
    build: () => ({
      title: "Chat disponível",
      body: "O chat ficou disponível.",
      ctaUrl: "/messages",
      ctaLabel: "Entrar no chat",
    }),
  },
  CHAT_ANNOUNCEMENT: {
    category: "chat",
    preferStored: true,
    build: () => ({
      title: "Chat",
      body: "Tens um novo anúncio no chat.",
      ctaUrl: "/organizacao/chat",
      ctaLabel: "Abrir chat",
    }),
  },
  CHAT_MESSAGE: {
    category: "chat",
    preferStored: true,
    build: () => ({
      title: "Nova mensagem",
      body: "Tens uma nova mensagem.",
      ctaUrl: "/organizacao/chat",
      ctaLabel: "Abrir chat",
    }),
  },
};

const resolveContext = (input: NotificationRegistryInput): ResolvedContext => {
  const actors = input.actors ?? [];
  const actorCount = Number.isFinite(input.actorCount ?? NaN) && (input.actorCount ?? 0) > 0 ? (input.actorCount as number) : actors.length;
  const actorLabel = resolveActorLabel(actors, actorCount);
  const eventTitle = resolveEventTitle(input);
  const organizationName = resolveOrganizationName(input);
  const eventSlug = resolveEventSlug(input);

  return {
    type: input.type,
    title: input.title ?? null,
    body: input.body ?? null,
    ctaUrl: input.ctaUrl ?? null,
    ctaLabel: input.ctaLabel ?? null,
    priority: input.priority ?? null,
    fromUserId: input.fromUserId ?? null,
    organizationId: input.organizationId ?? null,
    eventId: input.eventId ?? null,
    ticketId: input.ticketId ?? null,
    ticketEntitlementId: input.ticketEntitlementId ?? null,
    inviteId: input.inviteId ?? null,
    payload: input.payload ?? null,
    payloadKind: input.payloadKind ?? resolvePayloadKind(input.payload ?? null),
    roleLabel: input.roleLabel ?? resolveRoleLabel(input.payload ?? null),
    campaignId: input.campaignId ?? resolveCampaignId(input.payload ?? null),
    actors,
    actorCount,
    actorLabel,
    eventTitle,
    organizationName,
    eventSlug,
    followRequestId: input.followRequestId ?? null,
  };
};

export const resolveNotificationCategory = (type: NotificationType): NotificationCategory =>
  NOTIFICATION_CATEGORY_BY_TYPE[type] ?? "system";

export const resolveRequiredFields = (type: NotificationType) => registry[type]?.required ?? [];

export const resolveNotificationContent = (input: NotificationRegistryInput): RegistryOutput => {
  const ctx = resolveContext(input);
  const entry = registry[input.type];
  const category = resolveNotificationCategory(input.type);
  const priority = entry?.priority ?? input.priority ?? "NORMAL";
  const computed = entry?.build(ctx) ?? { title: "Atualização", body: "Tens uma nova atualização." };

  const storedTitle = normalizeText(input.title);
  const storedBody = normalizeText(input.body);
  const hasStored = Boolean(storedTitle || storedBody);
  const genericStored = hasStored ? isGenericCopy(storedTitle, storedBody) : false;
  const preferStored = entry?.preferStored && hasStored && !genericStored;

  const title = preferStored
    ? storedTitle || computed.title
    : computed.title || storedTitle || "Atualização";
  const body = preferStored
    ? storedBody ?? computed.body
    : computed.body ?? storedBody ?? null;

  const rawCtaUrl = computed.ctaUrl ?? input.ctaUrl ?? null;
  const ctaUrl = safeCtaUrl(rawCtaUrl);
  const ctaLabel = ctaUrl ? (computed.ctaLabel ?? input.ctaLabel ?? "Ver") : null;
  const actions = computed.actions && computed.actions.length > 0 ? computed.actions : undefined;

  return {
    title,
    body,
    ctaUrl: ctaUrl ?? null,
    ctaLabel,
    actions,
    category,
    priority,
  };
};

export const resolvePushPayload = (input: NotificationRegistryInput) => {
  const content = resolveNotificationContent(input);
  const title = content.title;
  const body = content.body ?? "";
  return {
    title,
    body,
    deepLink: content.ctaUrl ?? null,
  };
};

export const validateNotificationInput = (input: NotificationRegistryInput) => {
  const required = resolveRequiredFields(input.type);
  const missing = required.filter((field) => {
    if (field === "eventId") return !Number.isFinite(input.eventId ?? NaN);
    if (field === "organizationId") return !Number.isFinite(input.organizationId ?? NaN);
    if (field === "fromUserId") return !input.fromUserId;
    if (field === "inviteId") return !input.inviteId;
    return false;
  });
  return missing;
};
