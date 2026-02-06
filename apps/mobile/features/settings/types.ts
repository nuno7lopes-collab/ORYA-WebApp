export type Visibility = "PUBLIC" | "PRIVATE" | "FOLLOWERS";

export type NotificationPrefs = {
  allowEmailNotifications: boolean;
  allowEventReminders: boolean;
  allowFollowRequests: boolean;
  allowMarketingCampaigns: boolean;
  allowSystemAnnouncements: boolean;
};

export type ConsentItem = {
  organization: {
    id: number;
    publicName?: string | null;
    businessName?: string | null;
    username?: string | null;
    brandingAvatarUrl?: string | null;
  };
  consents: {
    MARKETING: boolean;
    CONTACT_EMAIL: boolean;
    CONTACT_SMS: boolean;
  };
};
