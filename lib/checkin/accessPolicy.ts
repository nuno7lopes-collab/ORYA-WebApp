import { prisma } from "@/lib/prisma";
import {
  CheckinMethod,
  EntitlementType,
  EventAccessMode,
  InviteIdentityMatch,
  PaymentStatus,
  SourceType,
} from "@prisma/client";

type PolicyClient = {
  eventAccessPolicy: {
    findFirst: typeof prisma.eventAccessPolicy.findFirst;
    findUnique?: typeof prisma.eventAccessPolicy.findUnique;
    create?: typeof prisma.eventAccessPolicy.create;
  };
};

type PolicyLockClient = PolicyClient & {
  entitlement: {
    count: typeof prisma.entitlement.count;
  };
  payment: {
    findFirst: typeof prisma.payment.findFirst;
  };
  ticketOrder: {
    findMany: typeof prisma.ticketOrder.findMany;
  };
  padelRegistration: {
    findMany: typeof prisma.padelRegistration.findMany;
  };
};

export type EventAccessPolicyInput = {
  mode: EventAccessMode;
  guestCheckoutAllowed: boolean;
  inviteTokenAllowed: boolean;
  inviteIdentityMatch: InviteIdentityMatch;
  inviteTokenTtlSeconds?: number | null;
  requiresEntitlementForEntry: boolean;
  checkinMethods?: CheckinMethod[] | null;
  scannerRequired?: boolean | null;
  allowReentry?: boolean | null;
  reentryWindowMinutes?: number | null;
  maxEntries?: number | null;
  undoWindowMinutes?: number | null;
};

export function resolveCheckinMethodForEntitlement(type: EntitlementType): CheckinMethod | null {
  switch (type) {
    case EntitlementType.EVENT_TICKET:
      return CheckinMethod.QR_TICKET;
    case EntitlementType.PADEL_ENTRY:
      return CheckinMethod.QR_REGISTRATION;
    case EntitlementType.SERVICE_BOOKING:
      return CheckinMethod.QR_BOOKING;
    default:
      return null;
  }
}

export async function getLatestPolicyForEvent(
  eventId: number,
  client: PolicyClient = prisma,
) {
  return client.eventAccessPolicy.findFirst({
    where: { eventId },
    orderBy: { policyVersion: "desc" },
  });
}

export async function getLatestPolicyVersionForEvent(
  eventId: number,
  client: PolicyClient = prisma,
) {
  const policy = await getLatestPolicyForEvent(eventId, client);
  return policy?.policyVersion ?? null;
}

export async function requireLatestPolicyVersionForEvent(
  eventId: number,
  client: PolicyClient = prisma,
) {
  const policyVersion = await getLatestPolicyVersionForEvent(eventId, client);
  if (!policyVersion || policyVersion <= 0) {
    throw new Error("POLICY_VERSION_REQUIRED");
  }
  return policyVersion;
}

export async function getPolicyByVersion(
  eventId: number,
  policyVersion: number,
  client: PolicyClient = prisma,
) {
  if (client.eventAccessPolicy.findUnique) {
    return client.eventAccessPolicy.findUnique({
      where: { eventId_policyVersion: { eventId, policyVersion } },
    });
  }
  return client.eventAccessPolicy.findFirst({
    where: { eventId, policyVersion },
  });
}

export async function resolvePolicyForCheckin(
  eventId: number,
  policyVersionApplied: number | null | undefined,
  client: PolicyClient = prisma,
) {
  const latest = await getLatestPolicyForEvent(eventId, client);
  if (!latest) {
    return { ok: true as const, policy: null };
  }
  if (policyVersionApplied == null || policyVersionApplied <= 0) {
    return { ok: false as const, reason: "POLICY_VERSION_REQUIRED", policy: latest };
  }
  const policy = await getPolicyByVersion(eventId, policyVersionApplied, client);
  if (!policy) {
    return { ok: false as const, reason: "POLICY_VERSION_NOT_FOUND", policy: latest };
  }
  return { ok: true as const, policy };
}

function normalizePolicyInput(
  input: EventAccessPolicyInput,
  fallback?: {
    checkinMethods?: CheckinMethod[];
    scannerRequired?: boolean;
    allowReentry?: boolean;
    reentryWindowMinutes?: number;
    maxEntries?: number;
    undoWindowMinutes?: number;
  },
) {
  return {
    mode: input.mode,
    guestCheckoutAllowed: input.guestCheckoutAllowed,
    inviteTokenAllowed: input.inviteTokenAllowed,
    inviteIdentityMatch: input.inviteIdentityMatch,
    inviteTokenTtlSeconds: input.inviteTokenTtlSeconds ?? null,
    requiresEntitlementForEntry: input.requiresEntitlementForEntry,
    checkinMethods: (input.checkinMethods ?? fallback?.checkinMethods ?? []).slice().sort(),
    scannerRequired: input.scannerRequired ?? fallback?.scannerRequired ?? false,
    allowReentry: input.allowReentry ?? fallback?.allowReentry ?? false,
    reentryWindowMinutes: input.reentryWindowMinutes ?? fallback?.reentryWindowMinutes ?? 15,
    maxEntries: input.maxEntries ?? fallback?.maxEntries ?? 1,
    undoWindowMinutes: input.undoWindowMinutes ?? fallback?.undoWindowMinutes ?? 10,
  };
}

function isMoreRestrictiveMode(prev: EventAccessMode, next: EventAccessMode) {
  const rank: Record<EventAccessMode, number> = {
    PUBLIC: 0,
    UNLISTED: 1,
    INVITE_ONLY: 2,
  };
  return rank[next] > rank[prev];
}

function isMoreRestrictiveInviteMatch(prev: InviteIdentityMatch, next: InviteIdentityMatch) {
  const rank: Record<InviteIdentityMatch, number> = {
    BOTH: 0,
    EMAIL: 1,
    USERNAME: 1,
  };
  return rank[next] > rank[prev];
}

function getPolicyLockViolation(
  previous: ReturnType<typeof normalizePolicyInput>,
  next: ReturnType<typeof normalizePolicyInput>,
) {
  if (previous.mode !== next.mode && isMoreRestrictiveMode(previous.mode, next.mode)) {
    return "MODE_MORE_RESTRICTIVE";
  }
  if (previous.guestCheckoutAllowed && !next.guestCheckoutAllowed) {
    return "GUEST_CHECKOUT_MORE_RESTRICTIVE";
  }
  if (previous.inviteTokenAllowed && !next.inviteTokenAllowed) {
    return "INVITE_TOKEN_MORE_RESTRICTIVE";
  }
  if (
    previous.inviteIdentityMatch !== next.inviteIdentityMatch &&
    isMoreRestrictiveInviteMatch(previous.inviteIdentityMatch, next.inviteIdentityMatch)
  ) {
    return "INVITE_IDENTITY_MORE_RESTRICTIVE";
  }
  if (!previous.requiresEntitlementForEntry && next.requiresEntitlementForEntry) {
    return "REQUIRES_ENTITLEMENT_MORE_RESTRICTIVE";
  }
  const prevMethods = new Set(previous.checkinMethods);
  for (const method of prevMethods) {
    if (!next.checkinMethods.includes(method)) {
      return "CHECKIN_METHOD_REMOVED";
    }
  }
  if (previous.allowReentry && !next.allowReentry) {
    return "ALLOW_REENTRY_MORE_RESTRICTIVE";
  }
  if (next.reentryWindowMinutes < previous.reentryWindowMinutes) {
    return "REENTRY_WINDOW_MORE_RESTRICTIVE";
  }
  if (next.maxEntries < previous.maxEntries) {
    return "MAX_ENTRIES_MORE_RESTRICTIVE";
  }
  if (next.undoWindowMinutes < previous.undoWindowMinutes) {
    return "UNDO_WINDOW_MORE_RESTRICTIVE";
  }
  return null;
}

export async function isEventAccessPolicyLocked(
  eventId: number,
  client: PolicyLockClient = prisma,
) {
  const entitlements = await client.entitlement.count({ where: { eventId } });
  if (entitlements > 0) return true;

  const ticketOrderIds = await client.ticketOrder.findMany({
    where: { eventId },
    select: { id: true },
  });
  if (ticketOrderIds.length > 0) {
    const payment = await client.payment.findFirst({
      where: {
        status: PaymentStatus.SUCCEEDED,
        sourceType: SourceType.TICKET_ORDER,
        sourceId: { in: ticketOrderIds.map((row) => row.id) },
      },
      select: { id: true },
    });
    if (payment) return true;
  }

  const registrationIds = await client.padelRegistration.findMany({
    where: { eventId },
    select: { id: true },
  });
  if (registrationIds.length > 0) {
    const payment = await client.payment.findFirst({
      where: {
        status: PaymentStatus.SUCCEEDED,
        sourceType: SourceType.PADEL_REGISTRATION,
        sourceId: { in: registrationIds.map((row) => row.id) },
      },
      select: { id: true },
    });
    if (payment) return true;
  }

  return false;
}

export async function createEventAccessPolicyVersion(
  eventId: number,
  input: EventAccessPolicyInput,
  client: PolicyLockClient = prisma,
) {
  if (input.inviteTokenAllowed && input.inviteTokenTtlSeconds == null) {
    throw new Error("INVITE_TOKEN_TTL_REQUIRED");
  }
  const previous = await getLatestPolicyForEvent(eventId, client);
  const normalizedNext = normalizePolicyInput(input, previous ?? undefined);
  const locked = previous ? await isEventAccessPolicyLocked(eventId, client) : false;
  if (previous && locked) {
    const normalizedPrev = normalizePolicyInput(
      {
        mode: previous.mode,
        guestCheckoutAllowed: previous.guestCheckoutAllowed,
        inviteTokenAllowed: previous.inviteTokenAllowed,
        inviteIdentityMatch: previous.inviteIdentityMatch,
        inviteTokenTtlSeconds: previous.inviteTokenTtlSeconds,
        requiresEntitlementForEntry: previous.requiresEntitlementForEntry,
        checkinMethods: previous.checkinMethods,
        scannerRequired: previous.scannerRequired,
        allowReentry: previous.allowReentry,
        reentryWindowMinutes: previous.reentryWindowMinutes,
        maxEntries: previous.maxEntries,
        undoWindowMinutes: previous.undoWindowMinutes,
      },
      previous,
    );
    const violation = getPolicyLockViolation(normalizedPrev, normalizedNext);
    if (violation) {
      throw new Error(`ACCESS_POLICY_LOCKED:${violation}`);
    }
  }
  const nextVersion = (previous?.policyVersion ?? 0) + 1;
  if (!client.eventAccessPolicy.create) {
    throw new Error("ACCESS_POLICY_CREATE_UNAVAILABLE");
  }
  return client.eventAccessPolicy.create({
    data: {
      eventId,
      policyVersion: nextVersion,
      mode: normalizedNext.mode,
      guestCheckoutAllowed: normalizedNext.guestCheckoutAllowed,
      inviteTokenAllowed: normalizedNext.inviteTokenAllowed,
      inviteIdentityMatch: normalizedNext.inviteIdentityMatch,
      inviteTokenTtlSeconds: normalizedNext.inviteTokenTtlSeconds,
      requiresEntitlementForEntry: normalizedNext.requiresEntitlementForEntry,
      checkinMethods: normalizedNext.checkinMethods,
      scannerRequired: normalizedNext.scannerRequired,
      allowReentry: normalizedNext.allowReentry,
      reentryWindowMinutes: normalizedNext.reentryWindowMinutes,
      maxEntries: normalizedNext.maxEntries,
      undoWindowMinutes: normalizedNext.undoWindowMinutes,
    },
  });
}
