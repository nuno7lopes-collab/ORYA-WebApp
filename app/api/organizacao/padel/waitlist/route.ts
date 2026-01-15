import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

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
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: evt.organizationId,
      userId,
      role: { in: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] },
    },
    select: { id: true },
  });
  return Boolean(member);
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  const categoryIdParam = req.nextUrl.searchParams.get("categoryId");
  const categoryId = categoryIdParam ? Number(categoryIdParam) : null;
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const authorized = await ensureOrganizationAccess(data.user.id, eventId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

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

  return NextResponse.json(
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
