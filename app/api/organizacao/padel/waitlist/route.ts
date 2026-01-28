import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureGroupMemberRole } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!evt?.organizationId) return false;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return false;
  const access = await ensureGroupMemberRole({
    organizationId: evt.organizationId,
    userId,
    ROLE_ALLOWLIST: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  return access.ok;
}

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  const categoryIdParam = req.nextUrl.searchParams.get("categoryId");
  const categoryId = categoryIdParam ? Number(categoryIdParam) : null;
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const authorized = await ensureOrganizationAccess(data.user.id, eventId);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const items = await prisma.padelWaitlistEntry.findMany({
    where: {
      eventId,
      ...(Number.isFinite(categoryId as number) ? { categoryId: categoryId as number } : {}),
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