import { createClient, type RedisClientType } from "redis";

type RedisRole = "commands" | "publisher" | "subscriber";

type RedisHandle = {
  client: RedisClientType | null;
  connecting: Promise<RedisClientType> | null;
};

const redisHandles: Record<RedisRole, RedisHandle> = {
  commands: { client: null, connecting: null },
  publisher: { client: null, connecting: null },
  subscriber: { client: null, connecting: null },
};

export class RedisConfigError extends Error {
  readonly code = "REDIS_URL_MISSING";

  constructor(message = "REDIS_URL is missing.") {
    super(message);
    this.name = "RedisConfigError";
  }
}

export function getRedisUrl() {
  const url = process.env.REDIS_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function isRedisConfigured() {
  return getRedisUrl() !== null;
}

function createRoleClient(role: RedisRole) {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    throw new RedisConfigError();
  }

  const client = createClient({ url: redisUrl });
  client.on("error", (err) => {
    console.warn(`[redis:${role}] error`, err);
  });
  return client;
}

async function getRoleClient(role: RedisRole) {
  const handle = redisHandles[role];
  if (!handle.client) {
    handle.client = createRoleClient(role);
  }

  const client = handle.client;
  if (client.isOpen) {
    return client;
  }

  if (!handle.connecting) {
    handle.connecting = client
      .connect()
      .then(() => client)
      .catch((err) => {
        if (handle.client === client) {
          handle.client = null;
        }
        throw err;
      })
      .finally(() => {
        handle.connecting = null;
      });
  }

  return handle.connecting;
}

export async function getRedisCommandClient() {
  return getRoleClient("commands");
}

export async function getRedisPublisherClient() {
  return getRoleClient("publisher");
}

export async function getRedisSubscriberClient() {
  return getRoleClient("subscriber");
}

async function closeHandle(handle: RedisHandle) {
  const client = handle.client;
  handle.client = null;
  handle.connecting = null;
  if (!client) return;
  try {
    if (client.isOpen) {
      await client.quit();
    }
  } catch {
    if (client.isOpen) {
      client.destroy();
    }
  }
}

export async function closeRedisClients() {
  await Promise.all([
    closeHandle(redisHandles.commands),
    closeHandle(redisHandles.publisher),
    closeHandle(redisHandles.subscriber),
  ]);
}
