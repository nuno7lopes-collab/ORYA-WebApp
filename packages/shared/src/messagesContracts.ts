import { z } from "zod";

export const ChatConversationContextTypeSchema = z.enum([
  "ORG_CHANNEL",
  "ORG_CONTACT",
  "EVENT",
  "BOOKING",
  "SERVICE",
  "USER_DM",
  "USER_GROUP",
]);

export const ChatAccessGrantKindSchema = z.enum([
  "EVENT_INVITE",
  "USER_DM_REQUEST",
  "ORG_CONTACT_REQUEST",
  "SERVICE_REQUEST",
  "CHANNEL_CREATE_REQUEST",
]);

export const ChatAccessGrantStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
  "EXPIRED",
  "REVOKED",
  "AUTO_ACCEPTED",
]);

export const ChatConversationMessageKindSchema = z.enum([
  "TEXT",
  "SYSTEM",
  "ANNOUNCEMENT",
]);

export const MessagesScopeSchema = z.enum(["org", "b2c"]);

export const MessagesConversationListQuerySchema = z.object({
  scope: MessagesScopeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  updatedAfter: z.string().datetime().optional(),
});

export const MessagesResolveConversationSchema = z.object({
  contextType: ChatConversationContextTypeSchema,
  contextId: z.string().optional(),
  eventId: z.number().int().positive().optional(),
  bookingId: z.number().int().positive().optional(),
  serviceId: z.number().int().positive().optional(),
  targetUserId: z.string().uuid().optional(),
  targetOrganizationId: z.number().int().positive().optional(),
  title: z.string().min(2).max(120).optional(),
  memberIds: z.array(z.string().uuid()).max(50).optional(),
});

export const MessagesSendSchema = z.object({
  body: z.string().trim().min(1).max(4000).optional(),
  clientMessageId: z.string().trim().min(1).max(128),
  kind: ChatConversationMessageKindSchema.optional(),
  replyToId: z.string().uuid().optional(),
  attachments: z
    .array(
      z.object({
        type: z.enum(["IMAGE", "VIDEO", "FILE"]),
        url: z.string().url(),
        mime: z.string().min(1).max(255),
        size: z.number().int().positive(),
        metadata: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .max(8)
    .optional(),
});

export const MessagesGrantListQuerySchema = z.object({
  scope: MessagesScopeSchema.optional(),
  kind: z.string().optional(),
  status: z.string().optional(),
  eventId: z.coerce.number().int().positive().optional(),
});

export type ChatConversationContextType = z.infer<typeof ChatConversationContextTypeSchema>;
export type ChatAccessGrantKind = z.infer<typeof ChatAccessGrantKindSchema>;
export type ChatAccessGrantStatus = z.infer<typeof ChatAccessGrantStatusSchema>;
export type ChatConversationMessageKind = z.infer<typeof ChatConversationMessageKindSchema>;
