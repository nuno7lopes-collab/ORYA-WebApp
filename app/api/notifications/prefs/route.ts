import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getNotificationPrefs } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const prefs = await getNotificationPrefs(user.id);
  return NextResponse.json({ ok: true, prefs });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const updates: Record<string, boolean> = {};
  const allowed = [
    "allowEmailNotifications",
    "allowEventReminders",
    "allowFriendRequests",
    "allowSalesAlerts",
    "allowSystemAnnouncements",
  ];
  allowed.forEach((key) => {
    if (typeof body?.[key] === "boolean") updates[key] = body[key];
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: updates,
    create: { userId: user.id, ...updates },
  });

  return NextResponse.json({ ok: true });
}
