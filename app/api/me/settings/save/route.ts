import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { clearUsernameForOwner } from "@/lib/globalUsernames";
import { getNotificationPrefs } from "@/lib/notifications";
import { INTEREST_MAX_SELECTION, normalizeInterestSelection } from "@/lib/interests";

type Body = {
  visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  favouriteCategories?: string[];
  allowEmailNotifications?: boolean;
  allowEventReminders?: boolean;
  allowFollowRequests?: boolean;
  allowSalesAlerts?: boolean;
  allowSystemAnnouncements?: boolean;
  allowMarketingCampaigns?: boolean;
  hardDelete?: boolean;
};

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
    }

    const visibility = body.visibility;
    const wantsHardDelete = body.hardDelete === true;
    const favouriteCategories = Array.isArray(body.favouriteCategories)
      ? normalizeInterestSelection(body.favouriteCategories, INTEREST_MAX_SELECTION)
      : undefined;
    if (visibility && visibility !== "PUBLIC" && visibility !== "PRIVATE" && visibility !== "FOLLOWERS") {
      return NextResponse.json({ ok: false, error: "Visibilidade inválida." }, { status: 400 });
    }

    const dataToUpdate: Record<string, unknown> = {};
    if (visibility) dataToUpdate.visibility = visibility;
    if (favouriteCategories !== undefined) dataToUpdate.favouriteCategories = favouriteCategories;

    if (wantsHardDelete) {
      // Libera username e marca soft-delete
      const existing = await prisma.profile.findUnique({ where: { id: user.id }, select: { username: true } });
      try {
        await clearUsernameForOwner({ ownerType: "user", ownerId: user.id });
      } catch (err) {
        console.warn("[settings/save] falha ao libertar username global", err);
      }
      if (existing?.username) {
        await prisma.profile.update({
          where: { id: user.id },
          data: {
            username: null,
            isDeleted: true,
            deletedAt: new Date(),
            fullName: "Conta apagada",
            bio: null,
            city: null,
            avatarUrl: null,
          },
        });
      } else {
        await prisma.profile.update({
          where: { id: user.id },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
            fullName: "Conta apagada",
            bio: null,
            city: null,
            avatarUrl: null,
          },
        });
      }
      return NextResponse.json({ ok: true, deleted: true });
    }

    const profile = await prisma.profile.upsert({
      where: { id: user.id },
      update: dataToUpdate,
      create: {
        id: user.id,
        roles: ["user"],
        favouriteCategories: favouriteCategories ?? [],
        onboardingDone: false,
        visibility:
          dataToUpdate.visibility === "PRIVATE"
            ? "PRIVATE"
            : dataToUpdate.visibility === "FOLLOWERS"
              ? "FOLLOWERS"
              : "PUBLIC",
      },
    });

    // Sincronizar prefs de notificação (notification_preferences)
    const notificationPrefsUpdate: Record<string, boolean> = {};
    const assign = (key: keyof Body, target: string) => {
      if (typeof body[key] === "boolean") notificationPrefsUpdate[target] = body[key] as boolean;
    };
    assign("allowEmailNotifications", "allowEmailNotifications");
    assign("allowEventReminders", "allowEventReminders");
    assign("allowFollowRequests", "allowFollowRequests");
    assign("allowSalesAlerts", "allowSalesAlerts");
    assign("allowSystemAnnouncements", "allowSystemAnnouncements");
    assign("allowMarketingCampaigns", "allowMarketingCampaigns");
    if (Object.keys(notificationPrefsUpdate).length > 0) {
      await prisma.notificationPreference.upsert({
        where: { userId: user.id },
        update: notificationPrefsUpdate,
        create: { userId: user.id, ...notificationPrefsUpdate },
      });
    }

    const notificationPrefs = await getNotificationPrefs(user.id).catch(() => null);

    return NextResponse.json({
      ok: true,
      profile: {
        visibility: profile.visibility,
        favouriteCategories: profile.favouriteCategories,
        allowEmailNotifications: notificationPrefs?.allowEmailNotifications ?? true,
        allowEventReminders: notificationPrefs?.allowEventReminders ?? true,
        allowFollowRequests: notificationPrefs?.allowFollowRequests ?? true,
        allowSalesAlerts: notificationPrefs?.allowSalesAlerts ?? true,
        allowSystemAnnouncements: notificationPrefs?.allowSystemAnnouncements ?? true,
        allowMarketingCampaigns: notificationPrefs?.allowMarketingCampaigns ?? true,
      },
    });
  } catch (err) {
    console.error("[settings/save] erro:", err);
    return NextResponse.json({ ok: false, error: "Erro a guardar definições." }, { status: 500 });
  }
}
