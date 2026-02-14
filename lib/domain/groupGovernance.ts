import { createHash, randomInt, randomUUID } from "crypto";
import {
  AddressSourceProvider,
  GroupMembershipRequestStatus,
  GroupMembershipRequestType,
  GroupOwnerTransferStatus,
  OrganizationMemberRole,
  OrganizationStatus,
  Prisma,
  PrismaClient,
  type GroupMembershipRequest,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import { setSoleOwner } from "@/lib/organizationRoles";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { sendEmail } from "@/lib/emailClient";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { recordOutboxEvent } from "@/domain/outbox/producer";

type TxLike = Prisma.TransactionClient | PrismaClient;

type RequestMetadata = {
  codeGeneratedAt?: Partial<Record<CodeParticipant, string>>;
  emailResendWindowStartAt?: string;
  emailResendWindowCount?: number;
};

type CodeParticipant = "groupOwner" | "orgOwner" | "targetOwner";

type CodePayload = {
  groupOwnerCode?: string;
  orgOwnerCode?: string;
  targetOwnerCode?: string;
};

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_WINDOW_MS = 5 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const CODE_LOCKOUT_MS = 30 * 60 * 1000;
const EMAIL_TOKEN_TTL_MS = 30 * 60 * 1000;
const REQUEST_EXPIRY_MS = 24 * 60 * 60 * 1000;
const EMAIL_RESEND_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RESEND_MAX_PER_WINDOW = 3;
const EMAIL_RESEND_MAX_TOTAL = 6;
const OWNER_TRANSFER_TTL_MS = 30 * 60 * 1000;

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function now() {
  return new Date();
}

function isExpired(date: Date | null | undefined) {
  return Boolean(date && date.getTime() <= Date.now());
}

function asMetadata(raw: Prisma.JsonValue | null | undefined): RequestMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const meta = raw as Record<string, unknown>;
  const codeGeneratedAtRaw =
    meta.codeGeneratedAt && typeof meta.codeGeneratedAt === "object" && !Array.isArray(meta.codeGeneratedAt)
      ? (meta.codeGeneratedAt as Record<string, unknown>)
      : null;

  return {
    codeGeneratedAt: codeGeneratedAtRaw
      ? {
          ...(typeof codeGeneratedAtRaw.groupOwner === "string"
            ? { groupOwner: codeGeneratedAtRaw.groupOwner }
            : {}),
          ...(typeof codeGeneratedAtRaw.orgOwner === "string" ? { orgOwner: codeGeneratedAtRaw.orgOwner } : {}),
          ...(typeof codeGeneratedAtRaw.targetOwner === "string"
            ? { targetOwner: codeGeneratedAtRaw.targetOwner }
            : {}),
        }
      : undefined,
    ...(typeof meta.emailResendWindowStartAt === "string"
      ? { emailResendWindowStartAt: meta.emailResendWindowStartAt }
      : {}),
    ...(typeof meta.emailResendWindowCount === "number" ? { emailResendWindowCount: meta.emailResendWindowCount } : {}),
  };
}

function buildCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function normalizeParticipantHint(value: unknown): CodeParticipant | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "GROUP_OWNER") return "groupOwner";
  if (normalized === "ORG_OWNER") return "orgOwner";
  if (normalized === "TARGET_OWNER") return "targetOwner";
  return null;
}

function requestCodeParticipants(request: Pick<GroupMembershipRequest, "type">): CodeParticipant[] {
  if (request.type === GroupMembershipRequestType.JOIN) {
    return ["groupOwner", "orgOwner"];
  }
  if (request.type === GroupMembershipRequestType.EXIT_TRANSFER_OWNER) {
    return ["orgOwner", "targetOwner"];
  }
  return [];
}

function requestEmailParticipants(request: Pick<GroupMembershipRequest, "type">): CodeParticipant[] {
  if (request.type === GroupMembershipRequestType.JOIN) {
    return ["groupOwner", "orgOwner"];
  }
  if (request.type === GroupMembershipRequestType.EXIT_KEEP_OWNER) {
    return ["groupOwner"];
  }
  return ["orgOwner", "targetOwner"];
}

function participantField(participant: CodeParticipant) {
  if (participant === "groupOwner") {
    return {
      codeHash: "groupOwnerCodeHash" as const,
      codeVerifiedAt: "groupOwnerCodeVerifiedAt" as const,
      emailTokenHash: "groupOwnerEmailTokenHash" as const,
      emailConfirmedAt: "groupOwnerEmailConfirmedAt" as const,
    };
  }
  if (participant === "orgOwner") {
    return {
      codeHash: "orgOwnerCodeHash" as const,
      codeVerifiedAt: "orgOwnerCodeVerifiedAt" as const,
      emailTokenHash: "orgOwnerEmailTokenHash" as const,
      emailConfirmedAt: "orgOwnerEmailConfirmedAt" as const,
    };
  }
  return {
    codeHash: "targetOwnerCodeHash" as const,
    codeVerifiedAt: "targetOwnerCodeVerifiedAt" as const,
    emailTokenHash: "targetOwnerEmailTokenHash" as const,
    emailConfirmedAt: "targetOwnerEmailConfirmedAt" as const,
  };
}

async function resolveOrganizationPrimaryOwner(params: {
  tx: TxLike;
  organizationId: number;
}): Promise<string> {
  const { tx, organizationId } = params;
  const owners = await listEffectiveOrganizationMembers({
    organizationId,
    client: tx as Prisma.TransactionClient,
    roles: [OrganizationMemberRole.OWNER],
  });
  if (owners.length === 0) {
    throw new Error("ORGANIZATION_OWNER_MISSING");
  }
  const selectedOwner = owners[0].userId;
  if (owners.length > 1) {
    await setSoleOwner(tx, organizationId, selectedOwner, selectedOwner);
  }
  return selectedOwner;
}

async function getUserEmail(userId: string) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = user?.email?.trim().toLowerCase() ?? null;
  return email && email.includes("@") ? email : null;
}

function requestActors(request: {
  group: { ownerUserId: string };
  currentOrgOwnerUserId: string;
  targetOwnerUserId: string | null;
}) {
  return {
    groupOwner: request.group.ownerUserId,
    orgOwner: request.currentOrgOwnerUserId,
    targetOwner: request.targetOwnerUserId,
  };
}

function matchParticipantForUser(params: {
  request: {
    type: GroupMembershipRequestType;
    group: { ownerUserId: string };
    currentOrgOwnerUserId: string;
    targetOwnerUserId: string | null;
  };
  userId: string;
  hint: CodeParticipant | null;
}): CodeParticipant {
  const { request, userId, hint } = params;
  const required = requestCodeParticipants(request);
  if (required.length === 0) {
    throw new Error("CODES_NOT_REQUIRED");
  }

  const actorByParticipant = requestActors(request);
  const validParticipants = required.filter((participant) => {
    if (participant === "targetOwner") {
      return actorByParticipant.targetOwner === userId;
    }
    return actorByParticipant[participant] === userId;
  });

  if (validParticipants.length === 0) {
    throw new Error("FORBIDDEN");
  }

  if (hint && validParticipants.includes(hint)) {
    return hint;
  }
  if (validParticipants.length === 1) {
    return validParticipants[0];
  }
  throw new Error("PARTICIPANT_HINT_REQUIRED");
}

async function enforceGroupOwnerInvariant(tx: TxLike, groupId: number, ownerUserId: string) {
  const organizations = await tx.organization.findMany({
    where: { groupId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  for (const organization of organizations) {
    await setSoleOwner(tx, organization.id, ownerUserId, ownerUserId);
  }
}

async function commitMembershipRequest(tx: TxLike, requestId: string) {
  const request = await tx.groupMembershipRequest.findUnique({
    where: { id: requestId },
    include: { group: true, organization: true },
  });
  if (!request) {
    throw new Error("REQUEST_NOT_FOUND");
  }

  if (request.status === GroupMembershipRequestStatus.COMPLETED) {
    return request;
  }

  const completedAt = now();

  if (request.type === GroupMembershipRequestType.JOIN) {
    const group = request.group;
    const organization = request.organization;

    if (organization.groupId !== group.id) {
      if (request.currentOrgOwnerUserId !== group.ownerUserId) {
        await setSoleOwner(tx, organization.id, group.ownerUserId, request.currentOrgOwnerUserId);
      }
      await tx.organization.update({
        where: { id: organization.id },
        data: { groupId: group.id },
      });
    }

    await enforceGroupOwnerInvariant(tx, group.id, group.ownerUserId);
  } else {
    const nextOwnerUserId =
      request.type === GroupMembershipRequestType.EXIT_TRANSFER_OWNER
        ? request.targetOwnerUserId
        : request.currentOrgOwnerUserId;
    if (!nextOwnerUserId) {
      throw new Error("TARGET_OWNER_REQUIRED");
    }

    const newGroup = await tx.organizationGroup.create({
      data: {
        ownerUserId: nextOwnerUserId,
      },
      select: { id: true },
    });

    await tx.organization.update({
      where: { id: request.organizationId },
      data: { groupId: newGroup.id },
    });

    await setSoleOwner(tx, request.organizationId, nextOwnerUserId, request.currentOrgOwnerUserId);
    await enforceGroupOwnerInvariant(tx, newGroup.id, nextOwnerUserId);
  }

  const updated = await tx.groupMembershipRequest.update({
    where: { id: request.id },
    data: {
      status: GroupMembershipRequestStatus.COMPLETED,
      completedAt,
      groupOwnerCodeHash: null,
      orgOwnerCodeHash: null,
      targetOwnerCodeHash: null,
      groupOwnerEmailTokenHash: null,
      orgOwnerEmailTokenHash: null,
      targetOwnerEmailTokenHash: null,
    },
  });

  await recordOutboxEvent(
    {
      eventType: "organization.group_membership.completed",
      dedupeKey: `group_membership.completed:${request.id}`,
      payload: {
        requestId: request.id,
        groupId: request.groupId,
        organizationId: request.organizationId,
        type: request.type,
      },
      correlationId: request.correlationId ?? request.id,
    },
    tx,
  );

  return updated;
}

async function ensureRequestOperational(request: GroupMembershipRequest) {
  if (request.status === GroupMembershipRequestStatus.COMPLETED) {
    throw new Error("REQUEST_ALREADY_COMPLETED");
  }
  if (request.status === GroupMembershipRequestStatus.CANCELLED) {
    throw new Error("REQUEST_CANCELLED");
  }
  if (request.status === GroupMembershipRequestStatus.EXPIRED) {
    throw new Error("REQUEST_EXPIRED");
  }
  if (isExpired(request.expiresAt)) {
    await prisma.groupMembershipRequest.update({
      where: { id: request.id },
      data: { status: GroupMembershipRequestStatus.EXPIRED },
    });
    throw new Error("REQUEST_EXPIRED");
  }
}

async function issueRequestEmailTokens(params: {
  requestId: string;
  requestedByUserId: string;
}) {
  const { requestId, requestedByUserId } = params;
  const request = await prisma.groupMembershipRequest.findUnique({
    where: { id: requestId },
    include: { group: true, organization: true },
  });
  if (!request) {
    throw new Error("REQUEST_NOT_FOUND");
  }

  await ensureRequestOperational(request);

  const nowDate = now();
  if (request.resendCount >= EMAIL_RESEND_MAX_TOTAL) {
    throw new Error("EMAIL_RESEND_LIMIT_TOTAL");
  }

  const metadata = asMetadata(request.metadata);
  const windowStart = metadata.emailResendWindowStartAt ? new Date(metadata.emailResendWindowStartAt) : null;
  let windowCount = metadata.emailResendWindowCount ?? 0;
  let nextWindowStart: Date = windowStart ?? nowDate;

  if (!windowStart || nowDate.getTime() - windowStart.getTime() >= EMAIL_RESEND_WINDOW_MS) {
    nextWindowStart = nowDate;
    windowCount = 0;
  }

  if (windowCount >= EMAIL_RESEND_MAX_PER_WINDOW) {
    throw new Error("EMAIL_RESEND_LIMIT_WINDOW");
  }

  const participants = requestEmailParticipants(request);
  const actors = requestActors({
    group: request.group,
    currentOrgOwnerUserId: request.currentOrgOwnerUserId,
    targetOwnerUserId: request.targetOwnerUserId,
  });

  const payload: Record<string, unknown> = {
    metadata: {
      ...metadata,
      emailResendWindowStartAt: nextWindowStart.toISOString(),
      emailResendWindowCount: windowCount + 1,
    } satisfies RequestMetadata,
    resendCount: request.resendCount + 1,
    emailTokenExpiresAt: new Date(nowDate.getTime() + EMAIL_TOKEN_TTL_MS),
    status: GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS,
  };

  const deliveries: Array<{ participant: CodeParticipant; token: string; email: string }> = [];

  for (const participant of participants) {
    const userId = participant === "targetOwner" ? actors.targetOwner : actors[participant];
    if (!userId) continue;
    const email = await getUserEmail(userId);
    if (!email) {
      throw new Error(`EMAIL_MISSING_${participant.toUpperCase()}`);
    }
    const token = randomUUID();
    const { emailTokenHash } = participantField(participant);
    payload[emailTokenHash] = hashSecret(token);
    deliveries.push({ participant, token, email });
  }

  const updated = await prisma.groupMembershipRequest.update({
    where: { id: request.id },
    data: payload,
  });

  const baseUrl = getAppBaseUrl();
  await Promise.all(
    deliveries.map(async (delivery) => {
      const link = `${baseUrl}/api/org-hub/groups/${request.type === GroupMembershipRequestType.JOIN ? "join-requests" : "exit-requests"}/${request.id}/email/confirm?token=${encodeURIComponent(delivery.token)}`;
      const subject = `[ORYA] Confirmacao de operacao de grupo (${request.type})`;
      await sendEmail({
        to: delivery.email,
        subject,
        text: `Confirma esta operacao: ${link}`,
        html: `<p>Confirma esta operação de grupo:</p><p><a href=\"${link}\">Confirmar</a></p>`,
      });
    }),
  );

  await recordOutboxEvent({
    eventType: "organization.group_membership.email_tokens_issued",
    dedupeKey: `group_membership.email_tokens_issued:${updated.id}:${updated.resendCount}`,
    payload: {
      requestId: updated.id,
      type: updated.type,
      groupId: updated.groupId,
      organizationId: updated.organizationId,
      requestedByUserId,
      participants,
    },
    correlationId: updated.correlationId ?? updated.id,
  });

  return {
    request: updated,
    sentTo: deliveries.map((delivery) => ({ participant: delivery.participant, email: delivery.email })),
  };
}

export async function createOrganizationAtomic(input: {
  businessName: string;
  publicName?: string | null;
  entityType?: string | null;
  addressId?: string | null;
  username: string;
  primaryModule: string;
  modules: string[];
  publicWebsite?: string | null;
}) {
  const user = await requireUser();
  const emailVerified = Boolean((user as { email_confirmed_at?: string | null }).email_confirmed_at);
  if (!emailVerified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }
  const creatorEmail = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!creatorEmail || !creatorEmail.includes("@")) {
    throw new Error("OFFICIAL_EMAIL_REQUIRED");
  }

  const { normalizeAndValidateUsername, setUsernameForOwner } = await import("@/lib/globalUsernames");
  const {
    DEFAULT_PRIMARY_MODULE,
    parsePrimaryModule,
    parseOrganizationModules,
    getDefaultOrganizationModules,
  } = await import("@/lib/organizationCategories");
  const { isValidWebsite } = await import("@/lib/validation/organization");
  const { ensureGroupMemberForOrg } = await import("@/lib/organizationGroupAccess");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, fullName: true, username: true, roles: true },
  });
  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const normalizedUsername = normalizeAndValidateUsername(input.username);
  if (!normalizedUsername.ok) {
    throw new Error(normalizedUsername.error);
  }

  const parsedPrimaryModule = parsePrimaryModule(input.primaryModule) ?? DEFAULT_PRIMARY_MODULE;
  const parsedModules = parseOrganizationModules(input.modules) ?? getDefaultOrganizationModules(parsedPrimaryModule);

  const businessName = input.businessName?.trim();
  if (!businessName) {
    throw new Error("BUSINESS_NAME_REQUIRED");
  }

  const publicName =
    typeof input.publicName === "string" && input.publicName.trim().length > 0
      ? input.publicName.trim()
      : businessName;

  const website = typeof input.publicWebsite === "string" ? input.publicWebsite.trim() : "";
  const normalizedWebsite = website
    ? /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`
    : null;
  if (normalizedWebsite && !isValidWebsite(normalizedWebsite)) {
    throw new Error("INVALID_WEBSITE");
  }

  const addressId = typeof input.addressId === "string" && input.addressId.trim() ? input.addressId.trim() : null;
  if (addressId) {
    const address = await prisma.address.findUnique({
      where: { id: addressId },
      select: { sourceProvider: true },
    });
    if (!address || address.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
      throw new Error("INVALID_ADDRESS");
    }
  }

  return prisma.$transaction(async (tx) => {
    const group = await tx.organizationGroup.create({
      data: {
        ownerUserId: user.id,
      },
    });

    const confirmedAtRaw = typeof user.email_confirmed_at === "string" ? new Date(user.email_confirmed_at) : now();
    const officialEmailVerifiedAt = Number.isFinite(confirmedAtRaw.getTime()) ? confirmedAtRaw : now();

    const organization = await tx.organization.create({
      data: {
        groupId: group.id,
        publicName,
        businessName,
        entityType: input.entityType?.trim() || null,
        ...(addressId ? { addressId } : {}),
        username: normalizedUsername.username,
        status: OrganizationStatus.ACTIVE,
        primaryModule: parsedPrimaryModule,
        publicWebsite: normalizedWebsite,
        officialEmail: creatorEmail,
        officialEmailVerifiedAt,
      },
    });

    await setUsernameForOwner({
      username: normalizedUsername.username,
      ownerType: "organization",
      ownerId: organization.id,
      tx,
    });

    if (parsedModules.length > 0) {
      await tx.organizationModuleEntry.createMany({
        data: parsedModules.map((moduleKey) => ({
          organizationId: organization.id,
          moduleKey,
          enabled: true,
        })),
      });
    }

    await ensureGroupMemberForOrg({
      organizationId: organization.id,
      userId: user.id,
      role: OrganizationMemberRole.OWNER,
      client: tx,
    });

    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    if (!roles.includes("organization")) {
      await tx.profile.update({
        where: { id: user.id },
        data: { roles: [...roles, "organization"] },
      });
    }

    await recordOutboxEvent(
      {
        eventType: "organization.created",
        dedupeKey: `organization.created:${organization.id}`,
        payload: {
          organizationId: organization.id,
          groupId: group.id,
          ownerUserId: user.id,
        },
        correlationId: String(organization.id),
      },
      tx,
    );

    return organization;
  });
}

export async function startJoinRequest(input: { groupId: number; organizationId: number; userId: string }) {
  const { groupId, organizationId, userId } = input;
  const group = await prisma.organizationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, ownerUserId: true },
  });
  if (!group) {
    throw new Error("GROUP_NOT_FOUND");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, groupId: true },
  });
  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }
  if (organization.groupId === group.id) {
    throw new Error("ORGANIZATION_ALREADY_IN_GROUP");
  }

  const currentOwner = await resolveOrganizationPrimaryOwner({ tx: prisma, organizationId });
  if (userId !== group.ownerUserId && userId !== currentOwner) {
    throw new Error("FORBIDDEN");
  }

  await prisma.groupMembershipRequest.updateMany({
    where: {
      groupId,
      organizationId,
      type: GroupMembershipRequestType.JOIN,
      status: {
        in: [
          GroupMembershipRequestStatus.PENDING_CODES,
          GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS,
          GroupMembershipRequestStatus.LOCKED,
        ],
      },
    },
    data: { status: GroupMembershipRequestStatus.CANCELLED, cancelledAt: now() },
  });

  const immediateEmail = group.ownerUserId === currentOwner;
  const request = await prisma.groupMembershipRequest.create({
    data: {
      type: GroupMembershipRequestType.JOIN,
      status: immediateEmail
        ? GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS
        : GroupMembershipRequestStatus.PENDING_CODES,
      groupId,
      organizationId,
      initiatorUserId: userId,
      currentOrgOwnerUserId: currentOwner,
      expiresAt: new Date(Date.now() + REQUEST_EXPIRY_MS),
      correlationId: randomUUID(),
    },
  });

  await recordOutboxEvent({
    eventType: "organization.group_membership.join_started",
    dedupeKey: `group_membership.join_started:${request.id}`,
    payload: {
      requestId: request.id,
      groupId,
      organizationId,
      initiatorUserId: userId,
    },
    correlationId: request.correlationId ?? request.id,
  });

  return request;
}

export async function startExitRequest(input: {
  groupId: number;
  organizationId: number;
  mode: "KEEP_OWNER" | "TRANSFER_OWNER";
  targetOwnerIdentifier?: string | null;
  userId: string;
}) {
  const { groupId, organizationId, mode, targetOwnerIdentifier, userId } = input;
  const group = await prisma.organizationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, ownerUserId: true },
  });
  if (!group) {
    throw new Error("GROUP_NOT_FOUND");
  }
  if (group.ownerUserId !== userId) {
    throw new Error("ONLY_GROUP_OWNER");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, groupId: true },
  });
  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }
  if (organization.groupId !== groupId) {
    throw new Error("ORGANIZATION_NOT_IN_GROUP");
  }

  const currentOwner = await resolveOrganizationPrimaryOwner({ tx: prisma, organizationId });

  let targetOwnerUserId: string | null = null;
  let type: GroupMembershipRequestType = GroupMembershipRequestType.EXIT_KEEP_OWNER;
  let status: GroupMembershipRequestStatus = GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS;

  if (mode === "TRANSFER_OWNER") {
    type = GroupMembershipRequestType.EXIT_TRANSFER_OWNER;
    status = GroupMembershipRequestStatus.PENDING_CODES;
    if (!targetOwnerIdentifier || !targetOwnerIdentifier.trim()) {
      throw new Error("TARGET_OWNER_REQUIRED");
    }
    const resolved = await resolveUserIdentifier(targetOwnerIdentifier);
    targetOwnerUserId = resolved?.userId ?? null;
    if (!targetOwnerUserId) {
      throw new Error("TARGET_OWNER_NOT_FOUND");
    }
    if (targetOwnerUserId === currentOwner) {
      throw new Error("TARGET_OWNER_EQUALS_CURRENT");
    }
  }

  await prisma.groupMembershipRequest.updateMany({
    where: {
      groupId,
      organizationId,
      type,
      status: {
        in: [
          GroupMembershipRequestStatus.PENDING_CODES,
          GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS,
          GroupMembershipRequestStatus.LOCKED,
        ],
      },
    },
    data: { status: GroupMembershipRequestStatus.CANCELLED, cancelledAt: now() },
  });

  const request = await prisma.groupMembershipRequest.create({
    data: {
      type,
      status,
      groupId,
      organizationId,
      initiatorUserId: userId,
      currentOrgOwnerUserId: currentOwner,
      targetOwnerUserId,
      expiresAt: new Date(Date.now() + REQUEST_EXPIRY_MS),
      correlationId: randomUUID(),
    },
  });

  await recordOutboxEvent({
    eventType: "organization.group_membership.exit_started",
    dedupeKey: `group_membership.exit_started:${request.id}`,
    payload: {
      requestId: request.id,
      groupId,
      organizationId,
      initiatorUserId: userId,
      mode,
      targetOwnerUserId,
    },
    correlationId: request.correlationId ?? request.id,
  });

  return request;
}

export async function generateMembershipRequestCode(input: {
  requestId: string;
  userId: string;
  participantHint?: unknown;
  kind: "JOIN" | "EXIT";
}) {
  const { requestId, userId, participantHint, kind } = input;
  const request = await prisma.groupMembershipRequest.findUnique({
    where: { id: requestId },
    include: { group: true },
  });
  if (!request) {
    throw new Error("REQUEST_NOT_FOUND");
  }
  await ensureRequestOperational(request);

  if (kind === "JOIN" && request.type !== GroupMembershipRequestType.JOIN) {
    throw new Error("REQUEST_TYPE_MISMATCH");
  }
  if (
    kind === "EXIT" &&
    request.type !== GroupMembershipRequestType.EXIT_KEEP_OWNER &&
    request.type !== GroupMembershipRequestType.EXIT_TRANSFER_OWNER
  ) {
    throw new Error("REQUEST_TYPE_MISMATCH");
  }

  const hint = normalizeParticipantHint(participantHint);
  const participant = matchParticipantForUser({
    request,
    userId,
    hint,
  });

  if (request.status === GroupMembershipRequestStatus.LOCKED) {
    if (request.lockoutUntil && request.lockoutUntil.getTime() > Date.now()) {
      throw new Error("REQUEST_LOCKED");
    }
  }

  const code = buildCode();
  const codeHash = hashSecret(code);
  const { codeHash: codeHashField, codeVerifiedAt } = participantField(participant);
  const metadata = asMetadata(request.metadata);
  const generated = { ...(metadata.codeGeneratedAt ?? {}), [participant]: now().toISOString() };

  const updated = await prisma.groupMembershipRequest.update({
    where: { id: request.id },
    data: {
      status: GroupMembershipRequestStatus.PENDING_CODES,
      [codeHashField]: codeHash,
      [codeVerifiedAt]: null,
      metadata: {
        ...metadata,
        codeGeneratedAt: generated,
      },
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      lockoutUntil: null,
      ...(request.status === GroupMembershipRequestStatus.LOCKED ? { attemptCount: 0 } : {}),
    },
  });

  return {
    requestId: updated.id,
    status: updated.status,
    participant,
    code,
    expiresAt: updated.codeExpiresAt,
  };
}

export async function verifyMembershipRequestCodes(input: {
  requestId: string;
  kind: "JOIN" | "EXIT";
  codes: CodePayload;
}) {
  const { requestId, kind, codes } = input;
  const request = await prisma.groupMembershipRequest.findUnique({
    where: { id: requestId },
    include: { group: true },
  });
  if (!request) {
    throw new Error("REQUEST_NOT_FOUND");
  }
  await ensureRequestOperational(request);

  if (kind === "JOIN" && request.type !== GroupMembershipRequestType.JOIN) {
    throw new Error("REQUEST_TYPE_MISMATCH");
  }
  if (
    kind === "EXIT" &&
    request.type !== GroupMembershipRequestType.EXIT_TRANSFER_OWNER &&
    request.type !== GroupMembershipRequestType.EXIT_KEEP_OWNER
  ) {
    throw new Error("REQUEST_TYPE_MISMATCH");
  }

  if (request.type === GroupMembershipRequestType.EXIT_KEEP_OWNER) {
    throw new Error("CODES_NOT_REQUIRED");
  }

  if (request.status === GroupMembershipRequestStatus.LOCKED) {
    if (request.lockoutUntil && request.lockoutUntil.getTime() > Date.now()) {
      throw new Error("REQUEST_LOCKED");
    }
    await prisma.groupMembershipRequest.update({
      where: { id: request.id },
      data: { status: GroupMembershipRequestStatus.PENDING_CODES, lockoutUntil: null, attemptCount: 0 },
    });
  }

  if (request.status !== GroupMembershipRequestStatus.PENDING_CODES) {
    throw new Error("REQUEST_NOT_PENDING_CODES");
  }
  if (!request.codeExpiresAt || request.codeExpiresAt.getTime() < Date.now()) {
    throw new Error("CODES_EXPIRED");
  }

  const required = requestCodeParticipants(request);
  const metadata = asMetadata(request.metadata);
  const generatedTimestamps = required
    .map((participant) => metadata.codeGeneratedAt?.[participant])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (generatedTimestamps.length !== required.length) {
    throw new Error("CODES_WINDOW_INVALID");
  }
  const minTs = Math.min(...generatedTimestamps);
  const maxTs = Math.max(...generatedTimestamps);
  if (maxTs - minTs > CODE_WINDOW_MS) {
    throw new Error("CODES_WINDOW_EXPIRED");
  }

  const compare: Array<{ participant: CodeParticipant; provided: string | undefined; stored: string | null }> = required.map(
    (participant) => {
      const field = participantField(participant);
      const stored = request[field.codeHash] as string | null;
      const provided =
        participant === "groupOwner"
          ? codes.groupOwnerCode
          : participant === "orgOwner"
            ? codes.orgOwnerCode
            : codes.targetOwnerCode;
      return { participant, provided, stored };
    },
  );

  const allValid = compare.every((entry) => {
    if (!entry.provided || !entry.stored) return false;
    return hashSecret(entry.provided) === entry.stored;
  });

  if (!allValid) {
    const attempts = request.attemptCount + 1;
    const shouldLock = attempts >= CODE_MAX_ATTEMPTS;
    await prisma.groupMembershipRequest.update({
      where: { id: request.id },
      data: {
        attemptCount: attempts,
        ...(shouldLock
          ? {
              status: GroupMembershipRequestStatus.LOCKED,
              lockoutUntil: new Date(Date.now() + CODE_LOCKOUT_MS),
            }
          : {}),
      },
    });
    throw new Error(shouldLock ? "REQUEST_LOCKED" : "INVALID_CODES");
  }

  const verifiedAt = now();
  const updateData: Record<string, unknown> = {
    status: GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS,
    attemptCount: 0,
    lockoutUntil: null,
  };
  for (const participant of required) {
    const field = participantField(participant);
    updateData[field.codeHash] = null;
    updateData[field.codeVerifiedAt] = verifiedAt;
  }

  const updated = await prisma.groupMembershipRequest.update({
    where: { id: request.id },
    data: updateData,
  });

  await recordOutboxEvent({
    eventType: "organization.group_membership.codes_verified",
    dedupeKey: `group_membership.codes_verified:${updated.id}:${verifiedAt.getTime()}`,
    payload: {
      requestId: updated.id,
      type: updated.type,
      groupId: updated.groupId,
      organizationId: updated.organizationId,
    },
    correlationId: updated.correlationId ?? updated.id,
  });

  return updated;
}

export async function resendMembershipRequestEmails(input: {
  requestId: string;
  kind: "JOIN" | "EXIT";
  userId: string;
}) {
  const request = await prisma.groupMembershipRequest.findUnique({
    where: { id: input.requestId },
    include: { group: true },
  });
  if (!request) {
    throw new Error("REQUEST_NOT_FOUND");
  }

  const allowedUsers = new Set<string>([
    request.group.ownerUserId,
    request.currentOrgOwnerUserId,
    ...(request.targetOwnerUserId ? [request.targetOwnerUserId] : []),
  ]);
  if (!allowedUsers.has(input.userId)) {
    throw new Error("FORBIDDEN");
  }

  if (input.kind === "JOIN" && request.type !== GroupMembershipRequestType.JOIN) {
    throw new Error("REQUEST_TYPE_MISMATCH");
  }
  if (input.kind === "EXIT" && request.type === GroupMembershipRequestType.JOIN) {
    throw new Error("REQUEST_TYPE_MISMATCH");
  }

  if (
    request.type !== GroupMembershipRequestType.EXIT_KEEP_OWNER &&
    request.status !== GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS
  ) {
    throw new Error("REQUEST_NOT_READY_FOR_EMAIL");
  }

  return issueRequestEmailTokens({ requestId: request.id, requestedByUserId: input.userId });
}

export async function confirmMembershipRequestEmailToken(input: {
  requestId: string;
  kind: "JOIN" | "EXIT";
  token: string;
  userId: string;
}) {
  const tokenHash = hashSecret(input.token.trim());
  const request = await prisma.groupMembershipRequest.findFirst({
    where: {
      id: input.requestId,
      OR: [
        { groupOwnerEmailTokenHash: tokenHash },
        { orgOwnerEmailTokenHash: tokenHash },
        { targetOwnerEmailTokenHash: tokenHash },
      ],
    },
    include: { group: true },
  });
  if (!request) {
    throw new Error("TOKEN_INVALID");
  }

  await ensureRequestOperational(request);

  if (input.kind === "JOIN" && request.type !== GroupMembershipRequestType.JOIN) {
    throw new Error("REQUEST_TYPE_MISMATCH");
  }
  if (input.kind === "EXIT" && request.type === GroupMembershipRequestType.JOIN) {
    throw new Error("REQUEST_TYPE_MISMATCH");
  }

  if (!request.emailTokenExpiresAt || request.emailTokenExpiresAt.getTime() < Date.now()) {
    throw new Error("TOKEN_EXPIRED");
  }

  let participant: CodeParticipant | null = null;
  if (request.groupOwnerEmailTokenHash === tokenHash) participant = "groupOwner";
  if (request.orgOwnerEmailTokenHash === tokenHash) participant = "orgOwner";
  if (request.targetOwnerEmailTokenHash === tokenHash) participant = "targetOwner";
  if (!participant) {
    throw new Error("TOKEN_INVALID");
  }

  if (participant === "groupOwner" && input.userId !== request.group.ownerUserId) {
    throw new Error("TOKEN_USER_MISMATCH");
  }
  if (participant === "orgOwner" && input.userId !== request.currentOrgOwnerUserId) {
    throw new Error("TOKEN_USER_MISMATCH");
  }
  if (participant === "targetOwner" && input.userId !== request.targetOwnerUserId) {
    throw new Error("TOKEN_USER_MISMATCH");
  }

  const field = participantField(participant);
  const confirmedAt = now();

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.groupMembershipRequest.update({
      where: { id: request.id },
      data: {
        [field.emailTokenHash]: null,
        [field.emailConfirmedAt]: confirmedAt,
      },
    });

    const required = requestEmailParticipants(request);
    const allConfirmed = required.every((requiredParticipant) => {
      const requiredField = participantField(requiredParticipant);
      return Boolean(updated[requiredField.emailConfirmedAt]);
    });

    if (!allConfirmed) {
      return {
        status: updated.status,
        completed: false,
      };
    }

    const completed = await commitMembershipRequest(tx, updated.id);
    return {
      status: completed.status,
      completed: true,
    };
  });

  return result;
}

export async function startGroupOwnerTransfer(input: {
  groupId: number;
  actorUserId: string;
  targetUserIdentifier: string;
}) {
  const { groupId, actorUserId, targetUserIdentifier } = input;
  const group = await prisma.organizationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, ownerUserId: true },
  });
  if (!group) {
    throw new Error("GROUP_NOT_FOUND");
  }
  if (group.ownerUserId !== actorUserId) {
    throw new Error("ONLY_GROUP_OWNER");
  }

  const resolved = await resolveUserIdentifier(targetUserIdentifier);
  const targetUserId = resolved?.userId ?? null;
  if (!targetUserId) {
    throw new Error("TARGET_USER_NOT_FOUND");
  }
  if (targetUserId === actorUserId) {
    throw new Error("CANNOT_TRANSFER_TO_SELF");
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + OWNER_TRANSFER_TTL_MS);

  const transfer = await prisma.$transaction(async (tx) => {
    await tx.organizationGroupOwnerTransfer.updateMany({
      where: {
        groupId,
        status: GroupOwnerTransferStatus.PENDING,
      },
      data: {
        status: GroupOwnerTransferStatus.CANCELLED,
        cancelledAt: now(),
      },
    });

    return tx.organizationGroupOwnerTransfer.create({
      data: {
        groupId,
        fromUserId: actorUserId,
        toUserId: targetUserId,
        status: GroupOwnerTransferStatus.PENDING,
        token,
        expiresAt,
      },
    });
  });

  const targetEmail = await getUserEmail(targetUserId);
  if (targetEmail) {
    const baseUrl = getAppBaseUrl();
    const link = `${baseUrl}/api/org-hub/groups/${groupId}/owner/transfer/confirm?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: targetEmail,
      subject: "[ORYA] Confirmação de transferência de owner do Group",
      text: `Confirma a transferência de owner do Group: ${link}`,
      html: `<p>Confirma a transferência de owner do Group:</p><p><a href=\"${link}\">Confirmar transferência</a></p>`,
    });
  }

  await recordOutboxEvent({
    eventType: "organization.group_owner_transfer.started",
    dedupeKey: `group_owner_transfer.started:${transfer.id}`,
    payload: {
      transferId: transfer.id,
      groupId,
      fromUserId: actorUserId,
      toUserId: targetUserId,
      expiresAt,
    },
    correlationId: transfer.id,
  });

  return transfer;
}

export async function confirmGroupOwnerTransfer(input: {
  groupId: number;
  actorUserId: string;
  token: string;
}) {
  const token = input.token.trim();
  if (!token) {
    throw new Error("TOKEN_REQUIRED");
  }

  const transfer = await prisma.organizationGroupOwnerTransfer.findUnique({
    where: { token },
    include: { group: true },
  });
  if (!transfer || transfer.groupId !== input.groupId) {
    throw new Error("TRANSFER_NOT_FOUND");
  }
  if (transfer.status === GroupOwnerTransferStatus.CONFIRMED) {
    return transfer;
  }
  if (transfer.status !== GroupOwnerTransferStatus.PENDING) {
    throw new Error("TRANSFER_NOT_PENDING");
  }
  if (transfer.toUserId !== input.actorUserId) {
    throw new Error("TOKEN_USER_MISMATCH");
  }
  if (transfer.expiresAt.getTime() < Date.now()) {
    await prisma.organizationGroupOwnerTransfer.update({
      where: { id: transfer.id },
      data: { status: GroupOwnerTransferStatus.EXPIRED },
    });
    throw new Error("TRANSFER_EXPIRED");
  }

  const confirmedAt = now();

  const updated = await prisma.$transaction(async (tx) => {
    const confirmed = await tx.organizationGroupOwnerTransfer.update({
      where: { id: transfer.id },
      data: {
        status: GroupOwnerTransferStatus.CONFIRMED,
        confirmedAt,
      },
    });

    await tx.organizationGroup.update({
      where: { id: transfer.groupId },
      data: { ownerUserId: transfer.toUserId },
    });

    await enforceGroupOwnerInvariant(tx, transfer.groupId, transfer.toUserId);

    return confirmed;
  });

  await recordOutboxEvent({
    eventType: "organization.group_owner_transfer.confirmed",
    dedupeKey: `group_owner_transfer.confirmed:${updated.id}`,
    payload: {
      transferId: updated.id,
      groupId: updated.groupId,
      fromUserId: updated.fromUserId,
      toUserId: updated.toUserId,
    },
    correlationId: updated.id,
  });

  return updated;
}

export async function cancelGroupOwnerTransfer(input: {
  groupId: number;
  actorUserId: string;
  transferId: string;
}) {
  const transfer = await prisma.organizationGroupOwnerTransfer.findUnique({
    where: { id: input.transferId },
    include: { group: true },
  });
  if (!transfer || transfer.groupId !== input.groupId) {
    throw new Error("TRANSFER_NOT_FOUND");
  }
  if (transfer.group.ownerUserId !== input.actorUserId) {
    throw new Error("ONLY_GROUP_OWNER");
  }
  if (transfer.status !== GroupOwnerTransferStatus.PENDING) {
    throw new Error("TRANSFER_NOT_PENDING");
  }

  const cancelled = await prisma.organizationGroupOwnerTransfer.update({
    where: { id: transfer.id },
    data: {
      status: GroupOwnerTransferStatus.CANCELLED,
      cancelledAt: now(),
    },
  });

  await recordOutboxEvent({
    eventType: "organization.group_owner_transfer.cancelled",
    dedupeKey: `group_owner_transfer.cancelled:${cancelled.id}`,
    payload: {
      transferId: cancelled.id,
      groupId: cancelled.groupId,
      actorUserId: input.actorUserId,
    },
    correlationId: cancelled.id,
  });

  return cancelled;
}
