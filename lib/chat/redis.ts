import { CHAT_EVENTS_CHANNEL, CHAT_PRESENCE_KEY_PREFIX } from "@/lib/chat/constants";
import { getRedisCommandClient, getRedisPublisherClient, isRedisConfigured } from "@/lib/redis/client";

export type ChatEvent = {
  type: string;
  [key: string]: unknown;
};

export class ChatRedisUnavailableError extends Error {
  readonly code = "CHAT_REDIS_UNAVAILABLE";

  constructor(message = "Chat Redis backend unavailable.") {
    super(message);
    this.name = "ChatRedisUnavailableError";
  }
}

export function isChatRedisUnavailableError(err: unknown): err is ChatRedisUnavailableError {
  return err instanceof ChatRedisUnavailableError;
}

let missingConfigWarned = false;
let publishWarned = false;
let presenceWarned = false;

function warnOnce(kind: "missing" | "publish" | "presence", message: string, err?: unknown) {
  if (kind === "missing" && missingConfigWarned) return;
  if (kind === "publish" && publishWarned) return;
  if (kind === "presence" && presenceWarned) return;

  if (kind === "missing") missingConfigWarned = true;
  if (kind === "publish") publishWarned = true;
  if (kind === "presence") presenceWarned = true;

  if (err) {
    console.warn(message, err);
    return;
  }
  console.warn(message);
}

function requireChatRedisConfig() {
  if (isRedisConfigured()) return true;
  warnOnce("missing", "[chat] redis não configurado; realtime em modo degradado.");
  return false;
}

export async function publishChatEvent(event: ChatEvent): Promise<boolean> {
  if (!requireChatRedisConfig()) return false;
  try {
    const redis = await getRedisPublisherClient();
    await redis.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event));
    return true;
  } catch (err) {
    warnOnce("publish", "[chat] falha ao publicar evento realtime; modo degradado.", err);
    return false;
  }
}

export function isChatRedisAvailable() {
  return requireChatRedisConfig();
}

export async function isChatUserOnline(userId: string) {
  if (!requireChatRedisConfig()) return false;
  try {
    const redis = await getRedisCommandClient();
    const exists = await redis.exists(`${CHAT_PRESENCE_KEY_PREFIX}${userId}`);
    return Number(exists) > 0;
  } catch (err) {
    warnOnce("presence", "[chat] falha ao consultar presença no redis; modo degradado.", err);
    return false;
  }
}
