// WS Gateway para chat interno (first-party)
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
const { createClient: createRedisClient } = require("redis");

const CHAT_EVENTS_CHANNEL = "chat:events";
const PRESENCE_KEY_PREFIX = "chat:presence:";
const TYPING_KEY_PREFIX = "chat:typing:";
const LAST_SEEN_DEBOUNCE_PREFIX = "chat:last_seen_debounce:";
const WS_PROTOCOL_BASE = "orya-chat.v1";
const HANDSHAKE_TIMEOUT_MS = Number(process.env.CHAT_WS_HANDSHAKE_TIMEOUT_MS || 5000);
const HANDSHAKE_RATE_LIMIT_WINDOW_MS = Number(process.env.CHAT_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS || 60_000);
const HANDSHAKE_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.CHAT_WS_HANDSHAKE_RATE_LIMIT_MAX_ATTEMPTS || 30);

const PRESENCE_TTL_SECONDS = Number(process.env.CHAT_PRESENCE_TTL_SECONDS || 60);
const TYPING_TTL_SECONDS = Number(process.env.CHAT_TYPING_TTL_SECONDS || 5);
const LAST_SEEN_DEBOUNCE_SECONDS = Number(process.env.CHAT_LAST_SEEN_DEBOUNCE_SECONDS || 300);
const AUTH_RECHECK_MS = Number(process.env.CHAT_WS_AUTH_RECHECK_MS || 10 * 60 * 1000);

const ALLOWED_ROLES = new Set(["OWNER", "CO_OWNER", "ADMIN", "STAFF", "TRAINER"]);
const B2C_CONTEXT_TYPES = new Set(["EVENT", "USER_DM", "USER_GROUP", "ORG_CONTACT", "BOOKING", "SERVICE"]);

function emitWsMetric(metricName, payload = {}) {
  try {
    console.info(
      JSON.stringify({
        type: "ws.metric",
        metric: metricName,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    );
  } catch {
    // ignore logging failures
  }
}

function emitWsLog(eventName, payload = {}) {
  try {
    console.info(
      JSON.stringify({
        type: "ws.log",
        event: eventName,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    );
  } catch {
    // ignore logging failures
  }
}

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

const redisUrl = process.env.REDIS_URL ? String(process.env.REDIS_URL).trim() : "";
const redisConfigured = redisUrl.length > 0;
if (process.env.NODE_ENV === "production" && !redisConfigured) {
  console.error("[chat-ws] REDIS_URL em falta em produção.");
  process.exit(1);
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

const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
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

let redisPublisher = null;
let redisSubscriber = null;
let redisConnectPromise = null;

async function closeRedisClients() {
  const clients = [redisSubscriber, redisPublisher].filter(Boolean);
  redisSubscriber = null;
  redisPublisher = null;
  await Promise.all(
    clients.map(async (client) => {
      try {
        if (client.isOpen) await client.quit();
      } catch {
        if (client.isOpen) client.destroy();
      }
    }),
  );
}

async function ensureRedisClients() {
  if (!redisConfigured) return false;
  if (redisPublisher && redisSubscriber && redisPublisher.isOpen && redisSubscriber.isOpen) {
    return true;
  }
  if (!redisConnectPromise) {
    redisConnectPromise = (async () => {
      const publisher = createRedisClient({ url: redisUrl });
      const subscriber = createRedisClient({ url: redisUrl });
      publisher.on("error", (err) => console.warn("[chat-ws][redis:publisher] error", err));
      subscriber.on("error", (err) => console.warn("[chat-ws][redis:subscriber] error", err));
      await publisher.connect();
      await subscriber.connect();
      await subscriber.subscribe(CHAT_EVENTS_CHANNEL, (message) => {
        if (!message) return;
        try {
          handleIncomingEvent(JSON.parse(message));
        } catch {
          // ignore malformed payloads
        }
      });
      redisPublisher = publisher;
      redisSubscriber = subscriber;
      return true;
    })()
      .catch(async (err) => {
        await closeRedisClients();
        console.warn("[chat-ws] falha a inicializar redis", err);
        return false;
      })
      .finally(() => {
        redisConnectPromise = null;
      });
  }
  return redisConnectPromise;
}

const connections = new Map();
const conversationConnections = new Map();
const organizationConnections = new Map();
const userConnections = new Map();
const handshakeAttemptsByClient = new Map();

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

function parseProtocolHeader(headerValue) {
  if (!headerValue) return [];
  const raw = Array.isArray(headerValue) ? headerValue.join(",") : String(headerValue);
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof forwardedValue === "string" && forwardedValue.trim()) {
    const first = forwardedValue.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers["x-real-ip"];
  const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof realIpValue === "string" && realIpValue.trim()) {
    return realIpValue.trim();
  }
  const remoteAddress = req.socket?.remoteAddress;
  return typeof remoteAddress === "string" && remoteAddress.trim() ? remoteAddress.trim() : "unknown";
}

function consumeHandshakeRateLimit(clientKey) {
  const key = clientKey || "unknown";
  const now = Date.now();
  const existing = handshakeAttemptsByClient.get(key);
  if (!existing || now - existing.windowStart >= HANDSHAKE_RATE_LIMIT_WINDOW_MS) {
    handshakeAttemptsByClient.set(key, { windowStart: now, attempts: 1 });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.attempts >= HANDSHAKE_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterMs = Math.max(0, HANDSHAKE_RATE_LIMIT_WINDOW_MS - (now - existing.windowStart));
    return { allowed: false, retryAfterMs };
  }

  existing.attempts += 1;
  handshakeAttemptsByClient.set(key, existing);
  return { allowed: true, retryAfterMs: 0 };
}

function extractBearerToken(rawAuth) {
  if (typeof rawAuth !== "string") return null;
  const trimmed = rawAuth.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;
  if (parts[0].toLowerCase() !== "bearer") return null;
  const token = parts.slice(1).join(" ").trim();
  return token || null;
}

function isValidSemver(value) {
  if (typeof value !== "string") return false;
  return /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(value.trim());
}

function parseSemver(value) {
  if (typeof value !== "string") return null;
  const match = value
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(a, b) {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return null;
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

function normalizeRuntimePlatform(rawValue) {
  if (typeof rawValue !== "string") return "unknown";
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "ios" || normalized === "android") return normalized;
  return "unknown";
}

function resolveMobileMinVersion(platform) {
  if (platform === "ios") {
    return process.env.MIN_SUPPORTED_MOBILE_VERSION_IOS?.trim() || process.env.MIN_SUPPORTED_MOBILE_VERSION?.trim() || null;
  }
  if (platform === "android") {
    return process.env.MIN_SUPPORTED_MOBILE_VERSION_ANDROID?.trim() || process.env.MIN_SUPPORTED_MOBILE_VERSION?.trim() || null;
  }
  return process.env.MIN_SUPPORTED_MOBILE_VERSION?.trim() || null;
}

function shouldFailClosedForMobileVersionConfig() {
  return process.env.NODE_ENV === "production";
}

function isPlatformKillSwitchEnabled(platform, appVersion) {
  if (process.env.MOBILE_KILL_SWITCH_ALL?.trim() === "1") return true;
  if (!platform || platform === "unknown") return false;
  const rawSwitch = platform === "ios"
    ? process.env.MOBILE_KILL_SWITCH_IOS?.trim()
    : process.env.MOBILE_KILL_SWITCH_ANDROID?.trim();
  if (!rawSwitch) return false;
  if (rawSwitch === "1" || rawSwitch === "*") return true;
  return rawSwitch
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(appVersion.trim());
}

function getClientPlatform(url, headers) {
  const fromQuery = url.searchParams.get("platform");
  if (typeof fromQuery === "string" && fromQuery.trim()) {
    return fromQuery.trim().toLowerCase();
  }

  const fromHeaders =
    headers["x-client-platform"] ||
    headers["x-app-platform"] ||
    headers["x-platform"] ||
    null;
  if (typeof fromHeaders === "string" && fromHeaders.trim()) {
    return fromHeaders.trim().toLowerCase();
  }
  if (Array.isArray(fromHeaders) && fromHeaders.length > 0) {
    return String(fromHeaders[0] || "").trim().toLowerCase();
  }
  return "";
}

function getRuntimePlatform(payload, url, headers) {
  const payloadPlatform =
    typeof payload?.runtime_platform === "string"
      ? payload.runtime_platform
      : typeof payload?.device_platform === "string"
        ? payload.device_platform
        : typeof payload?.mobile_platform === "string"
          ? payload.mobile_platform
          : "";
  if (payloadPlatform) return normalizeRuntimePlatform(payloadPlatform);

  const queryPlatform = url.searchParams.get("os");
  if (queryPlatform) return normalizeRuntimePlatform(queryPlatform);

  const headerPlatform =
    headers["x-app-os"] ||
    headers["x-mobile-os"] ||
    headers["x-device-platform"] ||
    null;
  if (typeof headerPlatform === "string") return normalizeRuntimePlatform(headerPlatform);
  if (Array.isArray(headerPlatform) && headerPlatform.length > 0) {
    return normalizeRuntimePlatform(String(headerPlatform[0] || ""));
  }
  return "unknown";
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

async function listEffectiveOrgMemberships(userId) {
  if (!userId) return [];

  const groupMembers = await prisma.organizationGroupMember.findMany({
    where: { userId },
    select: {
      id: true,
      role: true,
      scopeAllOrgs: true,
      scopeOrgIds: true,
      createdAt: true,
      group: {
        select: {
          organizations: {
            select: { id: true },
            orderBy: { id: "asc" },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!groupMembers.length) return [];

  const overrides = await prisma.organizationGroupMemberOrganizationOverride.findMany({
    where: { groupMemberId: { in: groupMembers.map((member) => member.id) } },
    select: {
      groupMemberId: true,
      organizationId: true,
      roleOverride: true,
      revokedAt: true,
    },
  });
  const overrideByMemberOrg = new Map(
    overrides.map((entry) => [`${entry.groupMemberId}:${entry.organizationId}`, entry]),
  );

  const memberships = [];
  for (const member of groupMembers) {
    const scopeOrgIds = member.scopeOrgIds || [];
    for (const organization of member.group.organizations) {
      const scopeOk = member.scopeAllOrgs || scopeOrgIds.includes(organization.id);
      if (!scopeOk) continue;
      const override = overrideByMemberOrg.get(`${member.id}:${organization.id}`);
      if (override && override.revokedAt) continue;
      memberships.push({
        organizationId: organization.id,
        role: (override && override.roleOverride) || member.role,
      });
    }
  }

  return memberships;
}

async function ensureOrgAccess(userId, organizationId) {
  if (!organizationId) return null;
  const memberships = await listEffectiveOrgMemberships(userId);
  const membership =
    memberships.find(
      (entry) => entry.organizationId === organizationId && ALLOWED_ROLES.has(entry.role),
    ) ?? null;
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
    where: {
      userId,
      leftAt: null,
      accessRevokedAt: null,
      bannedAt: null,
      conversation: conversationWhere,
    },
    select: { conversationId: true },
  });
  return rows.map((row) => row.conversationId);
}

async function setPresenceOnline(userId) {
  if (!(await ensureRedisClients()) || !redisPublisher) return;
  await redisPublisher.set(`${PRESENCE_KEY_PREFIX}${userId}`, "1", { EX: PRESENCE_TTL_SECONDS });
}

async function setPresenceOffline(userId) {
  if (!(await ensureRedisClients()) || !redisPublisher) return;
  await redisPublisher.del(`${PRESENCE_KEY_PREFIX}${userId}`);
}

async function updateLastSeen(userId) {
  if (!(await ensureRedisClients()) || !redisPublisher) return;
  const debounceKey = `${LAST_SEEN_DEBOUNCE_PREFIX}${userId}`;
  const already = await redisPublisher.exists(debounceKey);
  if (already) return;
  await redisPublisher.set(debounceKey, "1", { EX: LAST_SEEN_DEBOUNCE_SECONDS });
  await prisma.chatUserPresence.upsert({
    where: { userId },
    create: { userId, lastSeenAt: new Date() },
    update: { lastSeenAt: new Date() },
  });
}

async function publishEvent(event) {
  if (!redisConfigured) {
    handleIncomingEvent(event);
    return;
  }
  try {
    if (!(await ensureRedisClients()) || !redisPublisher) {
      handleIncomingEvent(event);
      return;
    }
    await redisPublisher.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event));
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

if (redisConfigured) {
  ensureRedisClients().then((ok) => {
    if (ok) return;
    if (process.env.NODE_ENV === "production") {
      console.error("[chat-ws] Redis indisponível em produção.");
      process.exit(1);
    }
  });
}

const port = Number(process.env.CHAT_WS_PORT || 4001);
const host = process.env.CHAT_WS_HOST || "127.0.0.1";
const wss = new WebSocketServer({
  port,
  host,
  handleProtocols: (protocols) => {
    if (!protocols || protocols.size === 0) return false;
    if (protocols.has(WS_PROTOCOL_BASE)) return WS_PROTOCOL_BASE;
    return false;
  },
});

wss.on("connection", (ws, req) => {
  (async () => {
    const handshakeStartedAt = Date.now();
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const fallbackPlatform = getClientPlatform(url, req.headers);
    const clientIp = resolveClientIp(req);
    const correlationId = crypto.randomUUID();
    let state = null;
    let handshakeComplete = false;

    const rejectHandshake = (params) => {
      const {
        reason,
        code,
        detail = null,
        userId = null,
        organizationId = null,
        platform = null,
        runtimePlatform = null,
      } = params;
      emitWsMetric("ws.handshake.failure_count", {
        reason,
        detail,
        code,
        userId,
        organizationId,
        platform,
        runtimePlatform,
        clientIp,
        correlationId,
        handshakeLatencyMs: Date.now() - handshakeStartedAt,
      });
      if (reason === "ORG_CONTEXT_REQUIRED") {
        emitWsMetric("ws.handshake.rejected.missing_context_count", {
          userId,
          correlationId,
        });
      }
      if (reason === "UPGRADE_REQUIRED" || reason === "MOBILE_APP_REQUIRED") {
        emitWsMetric("ws.handshake.rejected.version_gate_count", {
          reason,
          detail,
          userId,
          correlationId,
        });
      }
      emitWsLog("ws.handshake.rejected", {
        reason,
        detail,
        code,
        userId,
        organizationId,
        platform,
        runtimePlatform,
        clientIp,
        correlationId,
      });
      try {
        ws.send(
          JSON.stringify({
            type: "handshake:error",
            errorCode: reason,
            reason: detail || null,
          }),
        );
      } catch {
        // ignore send failures
      }
      try {
        ws.close(code, reason);
      } catch {
        // ignore close failures
      }
    };

    const handshakeTimeout = setTimeout(() => {
      if (handshakeComplete) return;
      rejectHandshake({
        reason: "ORG_CONTEXT_REQUIRED",
        code: 4003,
        platform: fallbackPlatform || null,
      });
    }, HANDSHAKE_TIMEOUT_MS);

    const parseOrganizationId = (rawId) => {
      if (typeof rawId === "number" && Number.isFinite(rawId)) {
        const normalized = Math.floor(rawId);
        return normalized > 0 ? normalized : null;
      }
      if (typeof rawId !== "string") return null;
      const value = rawId.trim();
      if (!value) return null;
      if (/^\d+$/.test(value)) return Number(value);
      const prefixed = /^org_(\d+)$/i.exec(value);
      if (prefixed?.[1]) return Number(prefixed[1]);
      return null;
    };

    ws.on("message", (data) => {
      (async () => {
        let payload;
        try {
          payload = JSON.parse(data.toString());
        } catch {
          if (!handshakeComplete) {
            rejectHandshake({
              reason: "ORG_CONTEXT_REQUIRED",
              code: 4003,
              platform: fallbackPlatform || null,
            });
          }
          return;
        }
        if (!payload || typeof payload !== "object") return;

        if (!handshakeComplete) {
          const rateLimit = consumeHandshakeRateLimit(clientIp);
          if (!rateLimit.allowed) {
            rejectHandshake({
              reason: "RATE_LIMITED",
              code: 4008,
              platform: fallbackPlatform || null,
            });
            return;
          }

          const authHeader = typeof payload.auth === "string" ? payload.auth : "";
          const token = extractBearerToken(authHeader);
          const appVersion = typeof payload.app_version === "string" ? payload.app_version.trim() : "";
          const context = payload.context && typeof payload.context === "object" ? payload.context : null;
          const contextType =
            context && typeof context.type === "string" ? context.type.trim().toLowerCase() : "";
          const contextIdRaw = context ? context.id : null;
          const clientPlatform =
            (typeof payload.client_platform === "string" && payload.client_platform.trim().toLowerCase()) ||
            fallbackPlatform ||
            "";
          const runtimePlatform = getRuntimePlatform(payload, url, req.headers);

          if (!token) {
            rejectHandshake({
              reason: "UNAUTHORIZED",
              code: 4001,
              platform: clientPlatform || null,
              runtimePlatform,
            });
            return;
          }
          if (!isValidSemver(appVersion)) {
            rejectHandshake({
              reason: "UPGRADE_REQUIRED",
              code: 4003,
              detail: "APP_VERSION_INVALID",
              platform: clientPlatform || null,
              runtimePlatform,
            });
            return;
          }
          if (!contextType) {
            rejectHandshake({
              reason: "ORG_CONTEXT_REQUIRED",
              code: 4003,
              platform: clientPlatform || null,
              runtimePlatform,
            });
            return;
          }

          const user = await validateToken(token);
          if (!user) {
            rejectHandshake({
              reason: "UNAUTHORIZED",
              code: 4001,
              platform: clientPlatform || null,
              runtimePlatform,
            });
            return;
          }

          let scope = "org";
          let organizationId = null;

          if (contextType === "org") {
            organizationId = parseOrganizationId(contextIdRaw);
            if (!organizationId) {
              rejectHandshake({
                reason: "ORG_CONTEXT_REQUIRED",
                code: 4003,
                userId: user.id,
                platform: clientPlatform || null,
                runtimePlatform,
              });
              return;
            }
            const membership = await ensureOrgAccess(user.id, organizationId);
            if (!membership) {
              rejectHandshake({
                reason: "FORBIDDEN",
                code: 4003,
                userId: user.id,
                organizationId,
                platform: clientPlatform || null,
                runtimePlatform,
              });
              return;
            }
          } else if (contextType === "dm" || contextType === "b2c") {
            if (clientPlatform !== "mobile") {
              rejectHandshake({
                reason: "MOBILE_APP_REQUIRED",
                code: 4003,
                userId: user.id,
                platform: clientPlatform || null,
                runtimePlatform,
              });
              return;
            }
            const minSupportedVersion = resolveMobileMinVersion(runtimePlatform);
            const hasValidMinVersion = Boolean(minSupportedVersion && isValidSemver(minSupportedVersion));
            if (!hasValidMinVersion) {
              if (shouldFailClosedForMobileVersionConfig()) {
                rejectHandshake({
                  reason: "UPGRADE_REQUIRED",
                  code: 4003,
                  detail: !minSupportedVersion
                    ? "MIN_SUPPORTED_MOBILE_VERSION_NOT_CONFIGURED"
                    : "MIN_SUPPORTED_MOBILE_VERSION_INVALID",
                  userId: user.id,
                  platform: clientPlatform || null,
                  runtimePlatform,
                });
                return;
              }
            } else {
              if (isPlatformKillSwitchEnabled(runtimePlatform, appVersion)) {
                rejectHandshake({
                  reason: "UPGRADE_REQUIRED",
                  code: 4003,
                  detail: "PLATFORM_KILL_SWITCH",
                  userId: user.id,
                  platform: clientPlatform || null,
                  runtimePlatform,
                });
                return;
              }
              if ((compareSemver(appVersion, minSupportedVersion) ?? -1) < 0) {
                rejectHandshake({
                  reason: "UPGRADE_REQUIRED",
                  code: 4003,
                  detail: "APP_VERSION_UNSUPPORTED",
                  userId: user.id,
                  platform: clientPlatform || null,
                  runtimePlatform,
                });
                return;
              }
            }
            scope = "b2c";
          } else {
            rejectHandshake({
              reason: "ORG_CONTEXT_REQUIRED",
              code: 4003,
              userId: user.id,
              platform: clientPlatform || null,
              runtimePlatform,
            });
            return;
          }

          const conversationIds = await getConversationIds(user.id, organizationId, scope);
          state = {
            userId: user.id,
            organizationId,
            conversations: new Set(conversationIds),
            token,
            authTimer: null,
            scope,
          };
          handshakeComplete = true;
          clearTimeout(handshakeTimeout);

          emitWsMetric("ws.handshake.success_count", {
            userId: user.id,
            organizationId,
            scope,
            platform: clientPlatform || null,
            runtimePlatform,
            correlationId,
            handshakeLatencyMs: Date.now() - handshakeStartedAt,
          });
          emitWsMetric("ws.handshake.latency_ms", {
            userId: user.id,
            organizationId,
            scope,
            runtimePlatform,
            correlationId,
            value: Date.now() - handshakeStartedAt,
          });
          emitWsLog("ws.handshake.accepted", {
            userId: user.id,
            organizationId,
            scope,
            platform: clientPlatform || null,
            runtimePlatform,
            correlationId,
          });

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
              emitWsMetric("ws.socket.closed.revoked_token_count", {
                userId: state.userId,
                organizationId: state.organizationId,
                scope: state.scope,
                correlationId,
              });
              emitWsLog("ws.socket.revoked_token", {
                userId: state.userId,
                organizationId: state.organizationId,
                scope: state.scope,
                correlationId,
              });
              ws.close(4001, "UNAUTHORIZED");
            }
          }, AUTH_RECHECK_MS);

          ws.send(JSON.stringify({ type: "handshake:ok" }));
          return;
        }

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

          if (await ensureRedisClients()) {
            if (payload.type === "typing:start") {
              await redisPublisher.set(`${TYPING_KEY_PREFIX}${conversationId}:${state.userId}`, "1", {
                EX: TYPING_TTL_SECONDS,
              });
            } else {
              await redisPublisher.del(`${TYPING_KEY_PREFIX}${conversationId}:${state.userId}`);
            }
          }

          await publishEvent({
            type: payload.type,
            organizationId: state.organizationId,
            conversationId,
            userId: state.userId,
          });
        }
      })().catch((err) => {
        console.warn("[chat-ws] erro a processar mensagem", err);
      });
    });

    ws.on("close", () => {
      (async () => {
        clearTimeout(handshakeTimeout);
        if (!state) return;

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
      })().catch((err) => {
        console.warn("[chat-ws] erro a fechar conexão", err);
      });
    });
  })().catch((err) => {
    console.error("[chat-ws] erro na conexão", err);
    try {
      ws.close(1011, "INTERNAL_ERROR");
    } catch {
      // ignore close failures
    }
  });
});

console.log(`[chat-ws] WebSocket gateway a correr na porta ${port}`);

const shutdownSignals = ["SIGINT", "SIGTERM"];
for (const signal of shutdownSignals) {
  process.on(signal, () => {
    closeRedisClients()
      .catch(() => {})
      .finally(() => process.exit(0));
  });
}
