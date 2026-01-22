export type CampaignChannelConfig = {
  inApp: boolean;
  email: boolean;
};

const CHANNEL_KEYS = new Set(["IN_APP", "EMAIL", "IN-APP", "INAPP"]);

function normalizeChannelToken(token: string) {
  const normalized = token.trim().toUpperCase();
  if (normalized === "INAPP" || normalized === "IN-APP") return "IN_APP";
  if (CHANNEL_KEYS.has(normalized)) return normalized;
  return null;
}

export function normalizeCampaignChannels(value: unknown): CampaignChannelConfig {
  let inApp = false;
  let email = false;

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry !== "string") return;
      const token = normalizeChannelToken(entry);
      if (token === "IN_APP") inApp = true;
      if (token === "EMAIL") email = true;
    });
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const inAppValue = obj.inApp ?? obj.in_app ?? obj.IN_APP ?? obj.inAppEnabled;
    const emailValue = obj.email ?? obj.EMAIL ?? obj.emailEnabled;
    if (typeof inAppValue === "boolean") inApp = inAppValue;
    if (typeof emailValue === "boolean") email = emailValue;
  } else if (typeof value === "string") {
    const token = normalizeChannelToken(value);
    if (token === "IN_APP") inApp = true;
    if (token === "EMAIL") email = true;
  }

  if (!inApp && !email) {
    return { inApp: true, email: false };
  }

  return { inApp, email };
}

export function campaignChannelsToList(channels: CampaignChannelConfig): string[] {
  const list: string[] = [];
  if (channels.inApp) list.push("IN_APP");
  if (channels.email) list.push("EMAIL");
  return list;
}
