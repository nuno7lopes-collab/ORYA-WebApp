import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { normalizeEmail } from "@/lib/utils/email";
import { getLatestPolicyForEvent } from "@/lib/checkin/accessPolicy";

const DEFAULT_INVITE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export type InviteTokenIssueInput = {
  eventId: number;
  email: string;
  ticketTypeId: number;
};

export type InviteTokenConsumeInput = {
  eventId: number;
  token: string;
  emailNormalized: string | null;
  ticketTypeIds: number[];
  usedByIdentityId: string | null;
  now?: Date;
};

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueInviteToken(
  input: InviteTokenIssueInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const emailNormalized = normalizeEmail(input.email);
  if (!emailNormalized) {
    throw new Error("INVITE_EMAIL_INVALID");
  }
  const ticketTypeId = Number(input.ticketTypeId);
  if (!Number.isFinite(ticketTypeId) || ticketTypeId <= 0) {
    throw new Error("INVITE_TICKET_TYPE_REQUIRED");
  }
  const policy = await getLatestPolicyForEvent(input.eventId, client);

  const token = crypto.randomUUID();
  const tokenHash = hashInviteToken(token);
  const ttlSeconds = Math.max(
    60,
    Number(policy?.inviteTokenTtlSeconds ?? DEFAULT_INVITE_TOKEN_TTL_SECONDS),
  );
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const created = await client.inviteToken.create({
    data: {
      tokenHash,
      eventId: input.eventId,
      ticketTypeId,
      emailNormalized,
      expiresAt,
      usedAt: null,
      usedByIdentityId: null,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  return { token, expiresAt: created.expiresAt, inviteTokenId: created.id };
}

export function assertInviteTokenValid(params: {
  tokenRow:
    | {
        id: string;
        eventId: number;
        ticketTypeId: number | null;
        emailNormalized: string;
        expiresAt: Date;
        usedAt: Date | null;
      }
    | null;
  eventId: number;
  emailNormalized: string | null;
  ticketTypeIds: number[];
  now: Date;
}) {
  const { tokenRow, eventId, emailNormalized, ticketTypeIds, now } = params;
  if (!tokenRow) return false;
  if (tokenRow.eventId !== eventId) return false;
  if (tokenRow.usedAt) return false;
  if (tokenRow.expiresAt <= now) return false;
  if (!emailNormalized) return false;
  if (tokenRow.emailNormalized.toLowerCase() !== emailNormalized.toLowerCase()) return false;
  if (tokenRow.ticketTypeId == null) return false;
  if (!ticketTypeIds.length) return false;
  if (!ticketTypeIds.every((id) => id === tokenRow.ticketTypeId)) return false;
  return true;
}

export type InviteTokenGrant = {
  tokenId: string;
  emailNormalized: string;
  ticketTypeId: number | null;
  expiresAt: Date;
};

export async function resolveInviteTokenGrant(
  input: {
    eventId: number;
    token: string;
    emailNormalized?: string | null;
    ticketTypeId?: number | null;
    now?: Date;
  },
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ ok: true; grant: InviteTokenGrant } | { ok: false; reason: string }> {
  const tokenRaw = typeof input.token === "string" ? input.token.trim() : "";
  if (!tokenRaw) return { ok: false, reason: "INVITE_TOKEN_REQUIRED" };

  const tokenHash = hashInviteToken(tokenRaw);
  const tokenRow = await client.inviteToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      eventId: true,
      ticketTypeId: true,
      emailNormalized: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (!tokenRow) return { ok: false, reason: "INVITE_TOKEN_NOT_FOUND" };
  if (tokenRow.ticketTypeId == null) return { ok: false, reason: "INVITE_TICKET_TYPE_REQUIRED" };

  const emailNormalized = input.emailNormalized ?? tokenRow.emailNormalized;
  if (!emailNormalized) return { ok: false, reason: "INVITE_EMAIL_REQUIRED" };

  const resolvedTicketTypeId =
    typeof input.ticketTypeId === "number" && Number.isFinite(input.ticketTypeId)
      ? input.ticketTypeId
      : tokenRow.ticketTypeId;
  if (!Number.isFinite(resolvedTicketTypeId) || resolvedTicketTypeId <= 0) {
    return { ok: false, reason: "INVITE_TICKET_TYPE_REQUIRED" };
  }
  const ticketTypeIds = [resolvedTicketTypeId];

  const ok = assertInviteTokenValid({
    tokenRow,
    eventId: input.eventId,
    emailNormalized,
    ticketTypeIds,
    now: input.now ?? new Date(),
  });
  if (!ok) return { ok: false, reason: "INVITE_TOKEN_INVALID" };

  return {
    ok: true,
    grant: {
      tokenId: tokenRow.id,
      emailNormalized,
      ticketTypeId: resolvedTicketTypeId,
      expiresAt: tokenRow.expiresAt,
    },
  };
}

export async function consumeInviteToken(
  input: InviteTokenConsumeInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const now = input.now ?? new Date();
  const tokenHash = hashInviteToken(input.token);
  const tokenRow = await client.inviteToken.findUnique({ where: { tokenHash } });
  if (!tokenRow) {
    throw new Error("INVITE_TOKEN_INVALID");
  }

  const ok = assertInviteTokenValid({
    tokenRow,
    eventId: input.eventId,
    emailNormalized: input.emailNormalized,
    ticketTypeIds: input.ticketTypeIds,
    now,
  });
  if (!ok) {
    throw new Error("INVITE_TOKEN_INVALID");
  }

  const updated = await client.inviteToken.updateMany({
    where: { id: tokenRow.id, usedAt: null },
    data: {
      usedAt: now,
      usedByIdentityId: input.usedByIdentityId,
    },
  });
  if (updated.count === 0) {
    throw new Error("INVITE_TOKEN_INVALID");
  }

  return { expiresAt: tokenRow.expiresAt };
}
