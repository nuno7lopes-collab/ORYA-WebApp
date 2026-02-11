import { CHAT_EVENTS_CHANNEL, CHAT_PRESENCE_KEY_PREFIX } from "@/lib/chat/constants";
import { isChatPollingOnly } from "@/lib/chat/featureFlags";
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

function shouldFailFast() {
  return process.env.NODE_ENV === "production" && !isChatPollingOnly();
}

function requireChatRedisConfig() {
  if (isChatPollingOnly()) return false;
  if (isRedisConfigured()) return true;
  if (shouldFailFast()) {
    throw new ChatRedisUnavailableError("CHAT_REDIS_CONFIG_MISSING");
  }
  return false;
}

export async function publishChatEvent(event: ChatEvent) {
  if (!requireChatRedisConfig()) return;
  try {
    const redis = await getRedisPublisherClient();
    await redis.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event));
  } catch (err) {
    if (shouldFailFast()) {
      throw new ChatRedisUnavailableError("CHAT_REDIS_PUBLISH_FAILED");
    }
    console.warn("[chat] falha ao publicar evento", err);
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
    if (shouldFailFast()) {
      throw new ChatRedisUnavailableError("CHAT_REDIS_PRESENCE_FAILED");
    }
    console.warn("[chat] falha ao consultar presença", err);
    return false;
  }
}
