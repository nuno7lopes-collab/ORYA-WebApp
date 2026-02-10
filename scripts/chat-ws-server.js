// WS Gateway para chat interno (first-party)
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { Redis } = require("@upstash/redis");

const CHAT_EVENTS_CHANNEL = "chat:events";
const PRESENCE_KEY_PREFIX = "chat:presence:";
const TYPING_KEY_PREFIX = "chat:typing:";
const LAST_SEEN_DEBOUNCE_PREFIX = "chat:last_seen_debounce:";

const PRESENCE_TTL_SECONDS = Number(process.env.CHAT_PRESENCE_TTL_SECONDS || 60);
const TYPING_TTL_SECONDS = Number(process.env.CHAT_TYPING_TTL_SECONDS || 5);
const LAST_SEEN_DEBOUNCE_SECONDS = Number(process.env.CHAT_LAST_SEEN_DEBOUNCE_SECONDS || 300);
const AUTH_RECHECK_MS = Number(process.env.CHAT_WS_AUTH_RECHECK_MS || 10 * 60 * 1000);

const ALLOWED_ROLES = new Set(["OWNER", "CO_OWNER", "ADMIN", "STAFF", "TRAINER"]);
const B2C_CONTEXT_TYPES = new Set(["USER_DM", "USER_GROUP", "ORG_CONTACT", "BOOKING", "SERVICE"]);

function loadEnv() {
  if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const eq = line.indexOf("=");
      if (eq === -1) return;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    });
}

loadEnv();

function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  return !["0", "false", "no"].includes(String(value).toLowerCase());
}

const pollingOnly = parseBool(
  process.env.CHAT_POLLING_ONLY ?? process.env.NEXT_PUBLIC_CHAT_POLLING_ONLY,
  false,
);
if (pollingOnly) {
  console.log("[chat-ws] CHAT_POLLING_ONLY ativo; a ignorar WS server.");
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[chat-ws] SUPABASE_URL ou SUPABASE_ANON_KEY em falta.");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("[chat-ws] DATABASE_URL em falta.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === "production"
      ? undefined
      : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return Redis.fromEnv();
}

const redis = getRedis();

const connections = new Map();
const conversationConnections = new Map();
const organizationConnections = new Map();
const userConnections = new Map();

function addToMap(map, key, ws) {
  const set = map.get(key) || new Set();
  set.add(ws);
  map.set(key, set);
}

function removeFromMap(map, key, ws) {
  const set = map.get(key);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) map.delete(key);
}

function broadcast(set, payload) {
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState !== 1) continue;
    try {
      ws.send(data);
    } catch (err) {
      // ignore send errors
    }
  }
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    const value = rest.join("=");
    acc[rawKey] = decodeURIComponent(value || "");
    return acc;
  }, {});
}

async function validateToken(token) {
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function resolveOrganizationId(userId, orgIdFromQuery, cookieHeader) {
  if (orgIdFromQuery) return orgIdFromQuery;
  const cookies = parseCookies(cookieHeader);
  const cookieOrgId = Number(cookies.orya_organization || "");
  if (cookieOrgId) return cookieOrgId;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId, role: { in: Array.from(ALLOWED_ROLES) } },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
}

async function ensureOrgAccess(userId, organizationId) {
  if (!organizationId) return null;
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId, role: { in: Array.from(ALLOWED_ROLES) } },
    select: { organizationId: true },
  });
  if (!membership) return null;

  const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
    where: { organizationId, moduleKey: "MENSAGENS", enabled: true },
    select: { moduleKey: true },
  });
  if (!moduleEnabled) return null;

  return membership;
}

async function getConversationIds(userId, organizationId, scope) {
  const conversationWhere =
    scope === "b2c"
      ? { contextType: { in: Array.from(B2C_CONTEXT_TYPES) } }
      : { organizationId };
  const rows = await prisma.chatConversationMember.findMany({
    where: { userId, conversation: conversationWhere },
    select: { conversationId: true },
  });
  return rows.map((row) => row.conversationId);
}

async function setPresenceOnline(userId) {
  if (!redis) return;
  await redis.set(`${PRESENCE_KEY_PREFIX}${userId}`, "1", { ex: PRESENCE_TTL_SECONDS });
}

async function setPresenceOffline(userId) {
  if (!redis) return;
  await redis.del(`${PRESENCE_KEY_PREFIX}${userId}`);
}

async function updateLastSeen(userId) {
  if (!redis) return;
  const debounceKey = `${LAST_SEEN_DEBOUNCE_PREFIX}${userId}`;
  const already = await redis.exists(debounceKey);
  if (already) return;
  await redis.set(debounceKey, "1", { ex: LAST_SEEN_DEBOUNCE_SECONDS });
  await prisma.chatUserPresence.upsert({
    where: { userId },
    create: { userId, lastSeenAt: new Date() },
    update: { lastSeenAt: new Date() },
  });
}

async function publishEvent(event) {
  if (!redis) {
    handleIncomingEvent(event);
    return;
  }
  try {
    await redis.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event));
  } catch (err) {
    console.warn("[chat-ws] falha ao publicar evento", err);
  }
}

function handleIncomingEvent(event) {
  if (!event || typeof event !== "object") return;
  const type = event.type;
  if (!type) return;

  if (
    type === "message:new" ||
    type === "message:update" ||
    type === "message:delete" ||
    type === "reaction:update" ||
    type === "pin:update" ||
    type === "message:read" ||
    type === "typing:start" ||
    type === "typing:stop"
  ) {
    const conversationId = event.conversationId;
    if (!conversationId) return;
    broadcast(conversationConnections.get(conversationId), event);
    return;
  }

  if (type === "conversation:update") {
    const orgId = event.organizationId;
    if (orgId) {
      broadcast(organizationConnections.get(orgId), event);
      return;
    }
    if (event.conversationId) {
      broadcast(conversationConnections.get(event.conversationId), event);
    }
    return;
  }

  if (type === "presence:update") {
    const orgId = event.organizationId;
    if (!orgId) return;
    broadcast(organizationConnections.get(orgId), event);
  }
}

async function syncMembership(ws, state) {
  const conversationIds = await getConversationIds(state.userId, state.organizationId, state.scope);
  const nextSet = new Set(conversationIds);

  for (const convoId of state.conversations) {
    if (!nextSet.has(convoId)) {
      removeFromMap(conversationConnections, convoId, ws);
    }
  }

  for (const convoId of nextSet) {
    if (!state.conversations.has(convoId)) {
      addToMap(conversationConnections, convoId, ws);
    }
  }

  state.conversations = nextSet;
}

if (redis) {
  const subscriber = redis.subscribe(CHAT_EVENTS_CHANNEL);
  subscriber.on("message", ({ message }) => {
    if (!message) return;
    if (typeof message === "string") {
      try {
        handleIncomingEvent(JSON.parse(message));
      } catch {
        return;
      }
    } else {
      handleIncomingEvent(message);
    }
  });
}

const port = Number(process.env.CHAT_WS_PORT || 4001);
const host = process.env.CHAT_WS_HOST || "127.0.0.1";
const wss = new WebSocketServer({ port, host });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const token = url.searchParams.get("token") || url.searchParams.get("access_token");
  const orgIdParam = Number(url.searchParams.get("organizationId") || "");
  const scopeParam = url.searchParams.get("scope");
  const forceB2C = scopeParam === "b2c";

  const user = await validateToken(token);
  if (!user) {
    ws.close(4001, "UNAUTHENTICATED");
    return;
  }

  const organizationId = forceB2C ? null : await resolveOrganizationId(user.id, orgIdParam || null, req.headers.cookie);
  const scope = organizationId ? "org" : "b2c";

  if (scope === "org") {
    const membership = await ensureOrgAccess(user.id, organizationId);
    if (!membership) {
      ws.close(4003, "FORBIDDEN");
      return;
    }
  }

  const conversationIds = await getConversationIds(user.id, organizationId, scope);
  const state = {
    userId: user.id,
    organizationId,
    conversations: new Set(conversationIds),
    token,
    authTimer: null,
    scope,
  };

  connections.set(ws, state);
  if (organizationId) {
    addToMap(organizationConnections, organizationId, ws);
  }
  addToMap(userConnections, user.id, ws);
  for (const convoId of conversationIds) {
    addToMap(conversationConnections, convoId, ws);
  }

  await setPresenceOnline(user.id);
  if (organizationId) {
    await publishEvent({
      type: "presence:update",
      organizationId,
      userId: user.id,
      status: "online",
    });
  }

  state.authTimer = setInterval(async () => {
    const valid = await validateToken(state.token);
    if (!valid) {
      ws.close(4001, "AUTH_EXPIRED");
    }
  }, AUTH_RECHECK_MS);

  ws.on("message", async (data) => {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!payload || typeof payload !== "object") return;

    if (payload.type === "ping") {
      await setPresenceOnline(state.userId);
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }

    if (payload.type === "conversation:sync") {
      await syncMembership(ws, state);
      return;
    }

    if (payload.type === "typing:start" || payload.type === "typing:stop") {
      const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
      if (!conversationId || !state.conversations.has(conversationId)) return;

      if (redis) {
        if (payload.type === "typing:start") {
          await redis.set(`${TYPING_KEY_PREFIX}${conversationId}:${state.userId}`, "1", {
            ex: TYPING_TTL_SECONDS,
          });
        } else {
          await redis.del(`${TYPING_KEY_PREFIX}${conversationId}:${state.userId}`);
        }
      }

      await publishEvent({
        type: payload.type,
        organizationId: state.organizationId,
        conversationId,
        userId: state.userId,
      });
      return;
    }
  });

  ws.on("close", async () => {
    connections.delete(ws);
    if (state.organizationId) {
      removeFromMap(organizationConnections, state.organizationId, ws);
    }
    removeFromMap(userConnections, state.userId, ws);
    for (const convoId of state.conversations) {
      removeFromMap(conversationConnections, convoId, ws);
    }

    if (state.authTimer) clearInterval(state.authTimer);

    const remaining = userConnections.get(state.userId);
    if (!remaining || remaining.size === 0) {
      await setPresenceOffline(state.userId);
      await updateLastSeen(state.userId);
      if (state.organizationId) {
        await publishEvent({
          type: "presence:update",
          organizationId: state.organizationId,
          userId: state.userId,
          status: "offline",
          lastSeenAt: new Date().toISOString(),
        });
      }
    }
  });
});

console.log(`[chat-ws] WebSocket gateway a correr na porta ${port}`);
