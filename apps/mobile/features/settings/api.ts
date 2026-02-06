import { api, unwrapApiResponse } from "../../lib/api";
import { ConsentItem, NotificationPrefs, Visibility } from "./types";

export const fetchNotificationPrefs = async (
  accessToken?: string | null,
): Promise<NotificationPrefs> => {
  const response = await api.requestWithAccessToken<unknown>("/api/notifications/prefs", accessToken);
  const payload = unwrapApiResponse<{ prefs?: Partial<NotificationPrefs> }>(response);
  const prefs = payload?.prefs ?? (payload as Partial<NotificationPrefs>) ?? {};
  return {
    allowEmailNotifications: Boolean(prefs.allowEmailNotifications ?? true),
    allowEventReminders: Boolean(prefs.allowEventReminders ?? true),
    allowFollowRequests: Boolean(prefs.allowFollowRequests ?? true),
    allowMarketingCampaigns: Boolean(prefs.allowMarketingCampaigns ?? true),
    allowSystemAnnouncements: Boolean(prefs.allowSystemAnnouncements ?? true),
  };
};

export const updateSettings = async (
  payload: Partial<{
    visibility: Visibility;
    favouriteCategories: string[];
    allowEmailNotifications: boolean;
    allowEventReminders: boolean;
    allowFollowRequests: boolean;
    allowMarketingCampaigns: boolean;
    allowSystemAnnouncements: boolean;
  }>,
  accessToken?: string | null,
): Promise<void> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me/settings/save", accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  unwrapApiResponse(response);
};

export const updateEmail = async (email: string, accessToken?: string | null): Promise<string> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me/settings/email", accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = unwrapApiResponse<{ user?: { email?: string | null }; message?: string }>(response);
  return payload?.user?.email ?? email;
};

export const updateContactPhone = async (
  contactPhone: string,
  accessToken?: string | null,
): Promise<string> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me/contact-phone", accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactPhone }),
  });
  const payload = unwrapApiResponse<{ contactPhone?: string }>(response);
  return payload?.contactPhone ?? contactPhone;
};

export const fetchConsents = async (accessToken?: string | null): Promise<ConsentItem[]> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me/consents", accessToken);
  const payload = unwrapApiResponse<{ items?: ConsentItem[] }>(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const updateConsent = async (
  organizationId: number,
  type: "MARKETING" | "CONTACT_EMAIL" | "CONTACT_SMS",
  granted: boolean,
  accessToken?: string | null,
): Promise<void> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me/consents", accessToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, type, granted }),
  });
  unwrapApiResponse(response);
};
