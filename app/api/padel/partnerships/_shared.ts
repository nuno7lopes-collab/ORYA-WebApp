import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";

const READ_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const WRITE_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

type EnsurePartnershipOrganizationParams = {
  req: NextRequest;
  required?: "VIEW" | "EDIT";
  body?: Record<string, unknown> | null;
};

type EnsurePartnershipOrganizationResult =
  | {
      ok: true;
      organization: { id: number };
      userId: string;
      role: OrganizationMemberRole;
      rolePack: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function ensurePartnershipOrganization(
  params: EnsurePartnershipOrganizationParams,
): Promise<EnsurePartnershipOrganizationResult> {
  const { req, required = "EDIT", body } = params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "UNAUTHENTICATED" };

  const orgResolution = resolveOrganizationIdStrict({
    req,
    body: body ?? undefined,
    allowFallback: false,
  });
  if (!orgResolution.ok && orgResolution.reason === "CONFLICT") {
    return { ok: false, status: 400, error: "ORGANIZATION_ID_CONFLICT" };
  }
  if (!orgResolution.ok && orgResolution.reason === "INVALID") {
    return { ok: false, status: 400, error: "INVALID_ORGANIZATION_ID" };
  }
  const explicitOrganizationId = orgResolution.ok ? orgResolution.organizationId : null;

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    roles: required === "VIEW" ? READ_ROLES : WRITE_ROLES,
    organizationId: explicitOrganizationId,
    allowFallback: !explicitOrganizationId,
  });
  if (!organization || !membership) {
    return { ok: false, status: 403, error: "NO_ORGANIZATION" };
  }

  const permission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required,
  });
  if (!permission.ok) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  return {
    ok: true,
    organization: { id: organization.id },
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack ?? null,
  };
}

export function parsePositiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : null;
}

export function parseOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}
