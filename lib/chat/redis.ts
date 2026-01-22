import { Redis } from "@upstash/redis";
import { CHAT_EVENTS_CHANNEL, CHAT_PRESENCE_KEY_PREFIX } from "@/lib/chat/constants";
import { isChatPollingOnly } from "@/lib/chat/featureFlags";

export type ChatEvent = {
  type: string;
  [key: string]: unknown;
};

let redisClient: Redis | null | undefined;

function getChatRedis(): Redis | null {
  if (isChatPollingOnly()) {
    redisClient = null;
    return null;
  }
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = Redis.fromEnv();
  return redisClient;
}

export async function publishChatEvent(event: ChatEvent) {
  const redis = getChatRedis();
  if (!redis) return;
  try {
    await redis.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event));
  } catch (err) {
    console.warn("[chat] falha ao publicar evento", err);
  }
}

export function isChatRedisAvailable() {
  return Boolean(getChatRedis());
}

export async function isChatUserOnline(userId: string) {
  const redis = getChatRedis();
  if (!redis) return false;
  try {
    const exists = await redis.exists(`${CHAT_PRESENCE_KEY_PREFIX}${userId}`);
    return Number(exists) > 0;
  } catch (err) {
    console.warn("[chat] falha ao consultar presença", err);
    return false;
  }
}
