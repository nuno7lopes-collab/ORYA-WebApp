import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
async function ensureOrganizationAccess(userId: string, eventId: number, requestOrganizationId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true, templateType: true },
  });
  if (!evt?.organizationId || evt.templateType !== "PADEL") return false;
  if (evt.organizationId !== requestOrganizationId) return false;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return false;
  const access = await ensureGroupMemberModuleAccess({
    organizationId: evt.organizationId,
    userId,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return access.ok;
}

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  const categoryIdParam = req.nextUrl.searchParams.get("categoryId");
  const hasCategoryIdParam = categoryIdParam !== null;
  const categoryIdParsed = hasCategoryIdParam ? Number(categoryIdParam) : null;
  const categoryId =
    categoryIdParsed !== null && Number.isInteger(categoryIdParsed) && categoryIdParsed > 0 ? categoryIdParsed : null;
  const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
  if (!orgResolution.ok) {
    return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
  }
  const requestOrganizationId = orgResolution.organizationId;
  if (!Number.isInteger(eventId) || eventId <= 0) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  if (hasCategoryIdParam && categoryId === null) {
    return jsonWrap({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });
  }

  const authorized = await ensureOrganizationAccess(data.user.id, eventId, requestOrganizationId);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const items = await prisma.padelWaitlistEntry.findMany({
    where: {
      eventId,
      ...(categoryId !== null ? { categoryId } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      category: { select: { id: true, label: true } },
    },
  });

  return jsonWrap(
    {
      ok: true,
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        createdAt: item.createdAt,
        category: item.category ? { id: item.category.id, label: item.category.label } : null,
        user: item.user
          ? {
              id: item.user.id,
              username: item.user.username,
              fullName: item.user.fullName,
              avatarUrl: item.user.avatarUrl,
            }
          : null,
        paymentMode: item.paymentMode,
        pairingJoinMode: item.pairingJoinMode,
        invitedContact: item.invitedContact,
      })),
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);
