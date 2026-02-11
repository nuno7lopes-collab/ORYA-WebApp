import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";
import { OrganizationStatus } from "@prisma/client";
import { setActiveOrganizationForUser } from "@/lib/organizationContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const COOKIE_NAME = "orya_organization";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { organizationId } = body as {
      organizationId?: number | string;
    };
    const resolvedId = parseOrganizationId(organizationId);
    if (!resolvedId) {
      return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: resolvedId },
      select: { id: true, status: true },
    });
    const allowedStatuses = new Set<OrganizationStatus>([
      OrganizationStatus.ACTIVE,
      OrganizationStatus.SUSPENDED,
    ]);
    if (!organization || !allowedStatuses.has(organization.status)) {
      return jsonWrap({ ok: false, error: "NOT_MEMBER" }, { status: 403 });
    }

    const result = await setActiveOrganizationForUser({
      userId: user.id,
      organizationId: resolvedId,
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });
    if (!result.ok) {
      return jsonWrap({ ok: false, error: "NOT_MEMBER" }, { status: 403 });
    }

    const res = jsonWrap({
      ok: true,
      organizationId: resolvedId,
      role: result.membership.role,
    }) as NextResponse;
    res.cookies.set(COOKIE_NAME, String(resolvedId), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  } catch (err: unknown) {
    console.error("[organização/organizations/switch][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
