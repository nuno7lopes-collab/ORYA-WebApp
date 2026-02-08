import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getNotificationPrefs } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const prefs = await getNotificationPrefs(user.id);
  return jsonWrap({ ok: true, prefs });
}

async function _POST(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const updates: Record<string, boolean> = {};
  const allowed = [
    "allowEmailNotifications",
    "allowSocialNotifications",
    "allowEventNotifications",
    "allowSystemNotifications",
    "allowMarketingNotifications",
    "allowEventReminders",
    "allowFollowRequests",
    "allowSalesAlerts",
    "allowSystemAnnouncements",
    "allowMarketingCampaigns",
  ];
  allowed.forEach((key) => {
    if (typeof body?.[key] === "boolean") updates[key] = body[key];
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: updates,
    create: { userId: user.id, ...updates },
  });

  return jsonWrap({ ok: true });
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
