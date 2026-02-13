import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";
import { prisma } from "@/lib/prisma";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import {
  appendOrganizationIdToHref,
  buildOrgHref,
  buildOrgHubHref,
  parseOrganizationId,
} from "@/lib/organizationIdUtils";
import { OrganizationStatus } from "@prisma/client";

type OrganizationWriteContext = {
  id?: number;
  status?: OrganizationStatus | string | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: Date | string | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  orgType?: string | null;
};

export type OfficialEmailGateErrorCode = "OFFICIAL_EMAIL_REQUIRED" | "OFFICIAL_EMAIL_NOT_VERIFIED";

export type OfficialEmailGateResult =
  | { ok: true }
  | {
      ok: false;
      errorCode: OfficialEmailGateErrorCode;
      message: string;
      email: string | null;
      verifyUrl: string;
      nextStepUrl: string;
      reasonCode?: string;
      requestId: string;
      correlationId: string;
    };

export type KillSwitchGateResult =
  | { ok: true }
  | {
      ok: false;
      errorCode: "KILL_SWITCH_ACTIVE";
      message: string;
      requestId: string;
      correlationId: string;
    };

export type StripeGateResult =
  | { ok: true }
  | {
      ok: false;
      errorCode: "STRIPE_REQUIRED";
      message: string;
    };

export type AccessResult = OfficialEmailGateResult | StripeGateResult | KillSwitchGateResult;

const OFFICIAL_EMAIL_VERIFY_PATH = "/settings";

function generateId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveGateContext(input?: { requestId?: string; correlationId?: string }) {
  const requestId = input?.requestId ?? generateId();
  const correlationId = input?.correlationId ?? requestId;
  return { requestId, correlationId };
}

export function isOfficialEmailVerified(org: OrganizationWriteContext) {
  const normalized = normalizeOfficialEmail(org.officialEmail ?? null);
  return Boolean(normalized && org.officialEmailVerifiedAt);
}

export function ensureOrganizationEmailVerified(
  org: OrganizationWriteContext,
  opts?: {
    reasonCode?: string;
    requestId?: string;
    correlationId?: string;
    nextStepUrl?: string;
    organizationId?: number | null;
  },
): OfficialEmailGateResult {
  const { requestId, correlationId } = resolveGateContext(opts);
  const resolvedOrgId = parseOrganizationId(opts?.organizationId ?? org.id ?? null);
  const verifyUrl = resolvedOrgId
    ? buildOrgHref(resolvedOrgId, OFFICIAL_EMAIL_VERIFY_PATH, { tab: "official-email" })
    : buildOrgHubHref("/organizations");
  const nextStepUrl = opts?.nextStepUrl
    ? appendOrganizationIdToHref(opts.nextStepUrl, resolvedOrgId)
    : verifyUrl;
  const email = normalizeOfficialEmail(org.officialEmail ?? null);
  if (!email) {
    return {
      ok: false,
      errorCode: "OFFICIAL_EMAIL_REQUIRED",
      message: "Email oficial obrigatório para esta ação.",
      email: null,
      verifyUrl,
      nextStepUrl,
      reasonCode: opts?.reasonCode,
      requestId,
      correlationId,
    };
  }
  if (!org.officialEmailVerifiedAt) {
    return {
      ok: false,
      errorCode: "OFFICIAL_EMAIL_NOT_VERIFIED",
      message: "Email oficial por verificar para esta ação.",
      email,
      verifyUrl,
      nextStepUrl,
      reasonCode: opts?.reasonCode,
      requestId,
      correlationId,
    };
  }
  return { ok: true };
}

export async function requireOfficialEmailVerified(params: {
  organizationId: number;
  organization?: OrganizationWriteContext | null;
  reasonCode?: string;
  actorUserId?: string | null;
  requestId?: string;
  correlationId?: string;
}): Promise<OfficialEmailGateResult | { ok: false; errorCode: "ORGANIZATION_NOT_FOUND"; message: string }> {
  const { organizationId, organization, reasonCode, requestId, correlationId } = params;
  const org =
    organization ??
    (await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    }));
  if (!org) {
    return { ok: false, errorCode: "ORGANIZATION_NOT_FOUND", message: "Organização não encontrada." };
  }
  return ensureOrganizationEmailVerified(org, {
    reasonCode,
    requestId,
    correlationId,
    organizationId,
  });
}

export function isStripeReady(org: OrganizationWriteContext, requireStripe = true) {
  if (!requireStripe) return true;
  return (
    resolveConnectStatus(
      org.stripeAccountId ?? null,
      org.stripeChargesEnabled ?? false,
      org.stripePayoutsEnabled ?? false,
    ) === "READY"
  );
}

export function ensureStripeReadyForServices(org: OrganizationWriteContext): AccessResult {
  const requireStripe = org.orgType !== "PLATFORM";
  if (isStripeReady(org, requireStripe)) {
    return { ok: true };
  }
  return { ok: false, errorCode: "STRIPE_REQUIRED", message: "Stripe obrigatório para criar serviços." };
}

export function ensureOrganizationWriteAccess(
  org: OrganizationWriteContext,
  opts?: {
    requireStripeForServices?: boolean;
    reasonCode?: string;
    skipEmailGate?: boolean;
    skipKillSwitch?: boolean;
    requestId?: string;
    correlationId?: string;
  },
): AccessResult {
  if (!opts?.skipKillSwitch) {
    const status = typeof org.status === "string" ? org.status.toUpperCase() : org.status;
    if (status === OrganizationStatus.SUSPENDED || status === "SUSPENDED") {
      const { requestId, correlationId } = resolveGateContext(opts);
      return {
        ok: false,
        errorCode: "KILL_SWITCH_ACTIVE",
        message: "A organização está em modo restrito.",
        requestId,
        correlationId,
      };
    }
  }
  if (!opts?.skipEmailGate) {
    const emailGate = ensureOrganizationEmailVerified(org, {
      reasonCode: opts?.reasonCode,
      requestId: opts?.requestId,
      correlationId: opts?.correlationId,
    });
    if (!emailGate.ok) return emailGate;
  }
  if (opts?.requireStripeForServices) {
    return ensureStripeReadyForServices(org);
  }
  return { ok: true };
}
