import {
  CheckinMethod,
  EventAccessMode,
  EventTemplateType,
  InviteIdentityMatch,
} from "@prisma/client";
import type { EventAccessPolicyInput } from "@/lib/checkin/accessPolicy";

export const DEFAULT_INVITE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

type ExplicitAccessPolicyInput = Partial<EventAccessPolicyInput> & {
  mode?: EventAccessMode | string | null;
  inviteIdentityMatch?: InviteIdentityMatch | string | null;
  checkinMethods?: CheckinMethod[] | string[] | null;
};

type ResolvePolicyParams = {
  accessPolicy?: ExplicitAccessPolicyInput | null;
  templateType?: string | null;
  defaultMode?: EventAccessMode;
};

type PolicyResolution = {
  policyInput: EventAccessPolicyInput;
  mode: EventAccessMode;
  source: "explicit" | "default";
};

const ACCESS_MODE_VALUES = new Set(Object.values(EventAccessMode));
const INVITE_MATCH_VALUES = new Set(Object.values(InviteIdentityMatch));
const CHECKIN_METHOD_VALUES = new Set(Object.values(CheckinMethod));

function normalizeMode(value: unknown, fallback: EventAccessMode) {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (ACCESS_MODE_VALUES.has(normalized as EventAccessMode)) {
      return normalized as EventAccessMode;
    }
  }
  if (ACCESS_MODE_VALUES.has(value as EventAccessMode)) {
    return value as EventAccessMode;
  }
  return fallback;
}

function normalizeInviteIdentityMatch(value: unknown, fallback: InviteIdentityMatch) {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (INVITE_MATCH_VALUES.has(normalized as InviteIdentityMatch)) {
      return normalized as InviteIdentityMatch;
    }
  }
  if (INVITE_MATCH_VALUES.has(value as InviteIdentityMatch)) {
    return value as InviteIdentityMatch;
  }
  return fallback;
}

function resolveDefaultCheckinMethods(templateType?: string | null): CheckinMethod[] {
  const normalized = typeof templateType === "string" ? templateType.trim().toUpperCase() : "";
  if (normalized === EventTemplateType.PADEL) {
    return [CheckinMethod.QR_REGISTRATION];
  }
  return [CheckinMethod.QR_TICKET];
}

function normalizeCheckinMethods(
  value: ExplicitAccessPolicyInput["checkinMethods"],
  fallback: CheckinMethod[],
) {
  if (Array.isArray(value) && value.length > 0) {
    const normalized = value
      .map((method) => (typeof method === "string" ? method.trim().toUpperCase() : method))
      .filter((method): method is CheckinMethod =>
        CHECKIN_METHOD_VALUES.has(method as CheckinMethod),
      );
    if (normalized.length > 0) {
      return Array.from(new Set(normalized));
    }
  }
  return fallback;
}

export function resolveEventAccessPolicyInput(params: ResolvePolicyParams): PolicyResolution {
  const defaultMode = params.defaultMode ?? EventAccessMode.UNLISTED;
  const fallbackCheckin = resolveDefaultCheckinMethods(params.templateType);
  const isPadelTemplate =
    typeof params.templateType === "string" &&
    params.templateType.trim().toUpperCase() === EventTemplateType.PADEL;
  const explicit = params.accessPolicy ?? null;

  if (explicit) {
    const mode = normalizeMode(explicit.mode, defaultMode);
    const inviteTokenAllowed =
      typeof explicit.inviteTokenAllowed === "boolean"
        ? explicit.inviteTokenAllowed
        : mode === EventAccessMode.INVITE_ONLY;
    const inviteTokenTtlSeconds =
      inviteTokenAllowed
        ? Math.max(
            60,
            Number(
              typeof explicit.inviteTokenTtlSeconds === "number"
                ? explicit.inviteTokenTtlSeconds
                : DEFAULT_INVITE_TOKEN_TTL_SECONDS,
            ),
          )
        : null;
    const guestCheckoutAllowed = explicit.guestCheckoutAllowed === true;
    const requiresEntitlementForEntry = isPadelTemplate
      ? true
      : explicit.requiresEntitlementForEntry === true;

    return {
      policyInput: {
        mode,
        guestCheckoutAllowed,
        inviteTokenAllowed,
        inviteIdentityMatch: normalizeInviteIdentityMatch(
          explicit.inviteIdentityMatch,
          InviteIdentityMatch.BOTH,
        ),
        inviteTokenTtlSeconds,
        requiresEntitlementForEntry,
        checkinMethods: normalizeCheckinMethods(explicit.checkinMethods, fallbackCheckin),
        scannerRequired: explicit.scannerRequired ?? null,
        allowReentry: explicit.allowReentry ?? null,
        reentryWindowMinutes: explicit.reentryWindowMinutes ?? null,
        maxEntries: explicit.maxEntries ?? null,
        undoWindowMinutes: explicit.undoWindowMinutes ?? null,
      },
      mode,
      source: "explicit",
    };
  }

  return {
    policyInput: {
      mode: defaultMode,
      guestCheckoutAllowed: false,
      inviteTokenAllowed: defaultMode === EventAccessMode.INVITE_ONLY,
      inviteIdentityMatch: InviteIdentityMatch.BOTH,
      inviteTokenTtlSeconds:
        defaultMode === EventAccessMode.INVITE_ONLY ? DEFAULT_INVITE_TOKEN_TTL_SECONDS : null,
      requiresEntitlementForEntry: isPadelTemplate,
      checkinMethods: fallbackCheckin,
      scannerRequired: null,
      allowReentry: null,
      reentryWindowMinutes: null,
      maxEntries: null,
      undoWindowMinutes: null,
    },
    mode: defaultMode,
    source: "default",
  };
}

export function resolveEventAccessMode(
  policy: { mode: EventAccessMode } | null | undefined,
  fallback: EventAccessMode = EventAccessMode.INVITE_ONLY,
) {
  return policy?.mode ?? fallback;
}

export function isPublicAccessMode(mode: EventAccessMode) {
  return mode === EventAccessMode.PUBLIC || mode === EventAccessMode.UNLISTED;
}
