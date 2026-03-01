function parseFeatureFlag(raw: string | undefined, defaultValue: boolean) {
  if (typeof raw !== "string") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (normalized === "1" || normalized === "true" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "off") return false;
  return defaultValue;
}

export function isSocialFriendsOnlyEnabled() {
  return parseFeatureFlag(process.env.FEATURE_SOCIAL_FRIENDS_ONLY, true);
}
