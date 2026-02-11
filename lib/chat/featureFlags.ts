function parseBoolean(raw: unknown, fallback: boolean) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

const chatV2Enabled = parseBoolean(
  process.env.CHAT_V2_ENABLED ?? process.env.NEXT_PUBLIC_CHAT_V2_ENABLED,
  true,
);

export function isChatV2Enabled() {
  return chatV2Enabled;
}
