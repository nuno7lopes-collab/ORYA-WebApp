import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import { runAcademyTrainerHardCutHygiene } from "@/lib/academy/trainerHardCutHygiene";

const EDIT_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
];

function isTruthy(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

async function _POST(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req, { roles: [...EDIT_ROLES] });
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  const dryRun =
    (typeof body === "object" &&
      body != null &&
      "dryRun" in body &&
      (typeof (body as { dryRun?: unknown }).dryRun === "boolean"
        ? Boolean((body as { dryRun?: unknown }).dryRun)
        : false)) ||
    isTruthy(req.nextUrl.searchParams.get("dryRun"));

  const summary = await runAcademyTrainerHardCutHygiene(access.organization.id, { dryRun });
  return respondOk(access.ctx, { summary });
}

export const POST = withApiEnvelope(_POST);
