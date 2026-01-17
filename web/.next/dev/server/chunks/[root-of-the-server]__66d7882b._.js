module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/env.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Central helper for server-side environment variables (server-only).
// ⚠️ Não importar este módulo em componentes com "use client".
__turbopack_context__.s([
    "env",
    ()=>env
]);
const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE",
    "DATABASE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "QR_SECRET_KEY",
    "RESEND_API_KEY"
];
function getEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing env var: ${key}`);
    }
    return value;
}
function getOptionalUrlEnv(...keys) {
    for (const key of keys){
        const value = process.env[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim().replace(/\/+$/, ""); // remove trailing slash para URLs previsíveis
        }
    }
    return "";
}
function parseBoolean(raw, fallback) {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "string") {
        const normalized = raw.trim().toLowerCase();
        if ([
            "1",
            "true",
            "yes",
            "on"
        ].includes(normalized)) return true;
        if ([
            "0",
            "false",
            "no",
            "off"
        ].includes(normalized)) return false;
    }
    return fallback;
}
function parseNumber(raw, fallback) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}
function parseList(raw) {
    if (typeof raw !== "string") return [];
    return raw.split(/[,\s]+/g).map((item)=>item.trim()).filter(Boolean);
}
const env = {
    supabaseUrl: getEnv("SUPABASE_URL"),
    supabaseAnonKey: getEnv("SUPABASE_ANON_KEY"),
    serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE"),
    dbUrl: getEnv("DATABASE_URL"),
    stripeSecretKey: getEnv("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET"),
    qrSecretKey: getEnv("QR_SECRET_KEY"),
    resendApiKey: getEnv("RESEND_API_KEY"),
    resendFrom: process.env.RESEND_FROM ?? process.env.RESEND_FROM_EMAIL ?? "no-reply@orya.pt",
    appBaseUrl: getOptionalUrlEnv("APP_BASE_URL", "NEXT_PUBLIC_BASE_URL", "NEXT_PUBLIC_SITE_URL", "VERCEL_URL"),
    uploadsBucket: process.env.SUPABASE_STORAGE_BUCKET_UPLOADS ?? process.env.SUPABASE_STORAGE_BUCKET ?? "uploads",
    avatarsBucket: process.env.SUPABASE_STORAGE_BUCKET_AVATARS ?? "",
    eventCoversBucket: process.env.SUPABASE_STORAGE_BUCKET_EVENT_COVERS ?? "",
    storageSignedUrls: parseBoolean(process.env.SUPABASE_STORAGE_SIGNED_URLS, false),
    storageSignedTtlSeconds: parseNumber(process.env.SUPABASE_STORAGE_SIGNED_TTL_SECONDS, 60 * 60 * 24 * 30),
    stripePremiumPriceIds: parseList(process.env.STRIPE_PREMIUM_PRICE_IDS),
    stripePremiumProductIds: parseList(process.env.STRIPE_PREMIUM_PRODUCT_IDS)
};
}),
"[project]/lib/supabaseServer.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSupabaseServer",
    ()=>createSupabaseServer,
    "getCurrentUser",
    ()=>getCurrentUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env.ts [app-route] (ecmascript)");
;
;
;
;
function decodeBase64Cookie(raw) {
    const BASE64_PREFIX = "base64-";
    if (!raw.startsWith(BASE64_PREFIX)) return raw;
    const base = raw.slice(BASE64_PREFIX.length);
    const encodings = [
        "base64url",
        "base64"
    ];
    for (const enc of encodings){
        try {
            return Buffer.from(base, enc).toString("utf-8");
        } catch  {
        /* try next */ }
    }
    // Se não conseguirmos decodificar, tratamos como cookie ausente para evitar JSON.parse de strings inválidas
    return undefined;
}
async function createSupabaseServer() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createServerClient"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["env"].supabaseUrl, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["env"].supabaseAnonKey, {
        cookies: {
            get (name) {
                try {
                    // Só devolvemos cookies do Supabase (sb-*) e ignoramos o resto
                    if (!name.startsWith("sb-")) return undefined;
                    const raw = cookieStore.get(name)?.value;
                    if (!raw) return undefined;
                    // Se for um chunk (sb-*.0, sb-*.1, ...), deixamos intacto para o combinador do Supabase tratar
                    const isChunk = /\.\d+$/.test(name);
                    return isChunk ? raw : decodeBase64Cookie(raw);
                } catch  {
                    return undefined;
                }
            },
            set (name, value, options) {
                try {
                    cookieStore.set({
                        name,
                        value,
                        ...options
                    });
                } catch  {
                /* ignore errors for RSC */ }
            },
            remove (name, options) {
                try {
                    cookieStore.set({
                        name,
                        value: "",
                        ...options,
                        maxAge: 0
                    });
                } catch  {
                /* ignore */ }
            }
        }
    });
    return supabase;
}
async function getCurrentUser() {
    const supabase = await createSupabaseServer();
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
            return {
                user: null,
                error
            };
        }
        return {
            user: data.user,
            error: null
        };
    } catch (err) {
        return {
            user: null,
            error: err
        };
    }
}
}),
"[externals]/@prisma/client [external] (@prisma/client, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("@prisma/client", () => require("@prisma/client"));

module.exports = mod;
}),
"[externals]/@prisma/adapter-pg [external] (@prisma/adapter-pg, esm_import)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

const mod = await __turbopack_context__.y("@prisma/adapter-pg");

__turbopack_context__.n(mod);
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, true);}),
"[externals]/pg [external] (pg, esm_import)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

const mod = await __turbopack_context__.y("pg");

__turbopack_context__.n(mod);
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, true);}),
"[project]/lib/prisma.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

// lib/prisma.ts
__turbopack_context__.s([
    "prisma",
    ()=>prisma
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$adapter$2d$pg__$5b$external$5d$__$2840$prisma$2f$adapter$2d$pg$2c$__esm_import$29$__ = __turbopack_context__.i("[externals]/@prisma/adapter-pg [external] (@prisma/adapter-pg, esm_import)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__ = __turbopack_context__.i("[externals]/pg [external] (pg, esm_import)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$adapter$2d$pg__$5b$external$5d$__$2840$prisma$2f$adapter$2d$pg$2c$__esm_import$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$adapter$2d$pg__$5b$external$5d$__$2840$prisma$2f$adapter$2d$pg$2c$__esm_import$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
// Toggle de logs verbose (queries) via env: PRISMA_LOG_QUERIES=true
const enableQueryLog = process.env.PRISMA_LOG_QUERIES === "true";
const logLevels = ("TURBOPACK compile-time truthy", 1) ? enableQueryLog ? [
    "query",
    "error",
    "warn"
] : [
    "error",
    "warn"
] : "TURBOPACK unreachable";
// Evitar múltiplas instâncias em dev (hot reload)
const globalForPrisma = globalThis;
// Pool e adapter para usar o client engine ("library") com Postgres
const pool = new __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__["Pool"]({
    connectionString: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["env"].dbUrl,
    ssl: ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : {
        rejectUnauthorized: false
    }
});
const adapter = new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$adapter$2d$pg__$5b$external$5d$__$2840$prisma$2f$adapter$2d$pg$2c$__esm_import$29$__["PrismaPg"](pool);
const prisma = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PrismaClient"]({
    adapter,
    log: logLevels
});
if ("TURBOPACK compile-time truthy", 1) {
    globalForPrisma.prisma = prisma;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/lib/notifications.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "createNotification",
    ()=>createNotification,
    "getNotificationPrefs",
    ()=>getNotificationPrefs,
    "shouldNotify",
    ()=>shouldNotify
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
async function shouldNotify(userId, type) {
    const prefs = await getNotificationPrefs(userId);
    switch(type){
        case "EVENT_SALE":
            return prefs.allowSalesAlerts;
        case "FRIEND_REQUEST":
        case "FRIEND_ACCEPT":
            return prefs.allowFriendRequests;
        case "FOLLOWED_YOU":
            return prefs.allowFriendRequests;
        case "SYSTEM_ANNOUNCE":
        case "STRIPE_STATUS":
            return prefs.allowSystemAnnouncements;
        case "EVENT_REMINDER":
        case "NEW_EVENT_FROM_FOLLOWED_ORGANIZER":
            return prefs.allowEventReminders;
        default:
            return true;
    }
}
function sanitizeActor(actor, options) {
    if (!actor || typeof actor !== "object") return actor;
    const isSelf = options.viewerId && actor.id === options.viewerId;
    if (!options.isPrivate || isSelf) return actor;
    return {
        id: actor.id ?? null,
        username: actor.username ?? null,
        avatarUrl: actor.avatarUrl ?? null,
        fullName: null,
        email: null
    };
}
function sanitizePayload(payload, opts) {
    if (!payload || typeof payload !== "object") return payload;
    const clone = {
        ...payload
    };
    if (clone.actor) {
        clone.actor = sanitizeActor(clone.actor, {
            isPrivate: opts.senderVisibility === "PRIVATE",
            viewerId: opts.viewerId
        });
    }
    return clone;
}
async function createNotification(input) {
    const { userId, type, title, body, payload, ctaUrl = null, ctaLabel = null, priority = "NORMAL", senderVisibility = "PUBLIC", fromUserId = null, organizerId = null, eventId = null, ticketId = null, inviteId = null } = input;
    const data = {
        userId,
        type,
        title: title ?? null,
        body: body ?? null,
        payload: payload ? sanitizePayload(payload, {
            senderVisibility,
            viewerId: userId
        }) : undefined,
        ctaUrl: ctaUrl || undefined,
        ctaLabel: ctaLabel || undefined,
        priority,
        fromUserId: fromUserId || undefined,
        organizerId: organizerId ?? undefined,
        eventId: eventId ?? undefined,
        ticketId: ticketId ?? undefined,
        inviteId: inviteId ?? undefined
    };
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notification.create({
        data
    });
}
async function getNotificationPrefs(userId) {
    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notificationPreference.findUnique({
        where: {
            userId
        }
    });
    if (existing) return existing;
    const profile = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.findUnique({
        where: {
            id: userId
        },
        select: {
            allowEmailNotifications: true,
            allowEventReminders: true,
            allowFriendRequests: true
        }
    });
    const defaults = {
        userId,
        allowEmailNotifications: profile?.allowEmailNotifications ?? true,
        allowEventReminders: profile?.allowEventReminders ?? true,
        allowFriendRequests: profile?.allowFriendRequests ?? true,
        allowSalesAlerts: true,
        allowSystemAnnouncements: true
    };
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notificationPreference.upsert({
        where: {
            userId
        },
        update: defaults,
        create: defaults
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/lib/username.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "USERNAME_RULES_HINT",
    ()=>USERNAME_RULES_HINT,
    "sanitizeUsername",
    ()=>sanitizeUsername,
    "validateUsername",
    ()=>validateUsername
]);
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;
function sanitizeUsername(input) {
    const base = (input ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); // remove diacríticos
    const cleaned = base.replace(/[^A-Za-z0-9._]/g, "");
    const trimmed = cleaned.replace(/^\.+/, "").replace(/\.+$/, "");
    const collapsedDots = trimmed.replace(/\.{2,}/g, ".");
    return collapsedDots.toLowerCase().slice(0, 30);
}
function validateUsername(raw) {
    const normalized = sanitizeUsername(raw);
    if (!normalized || normalized.length < 3 || normalized.length > 30) {
        return {
            valid: false,
            error: "Escolhe um username entre 3 e 30 caracteres (letras, números, _ ou .)."
        };
    }
    if (!USERNAME_REGEX.test(normalized)) {
        return {
            valid: false,
            error: "O username só pode ter letras, números, _ e . (sem espaços ou acentos)."
        };
    }
    if (normalized.includes("..")) {
        return {
            valid: false,
            error: "O username não pode ter '..' seguido."
        };
    }
    return {
        valid: true,
        normalized
    };
}
const USERNAME_RULES_HINT = "3-30 caracteres, letras ou números, opcionalmente _ ou ., sem espaços ou acentos.";
}),
"[project]/lib/globalUsernames.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "UsernameTakenError",
    ()=>UsernameTakenError,
    "checkUsernameAvailability",
    ()=>checkUsernameAvailability,
    "clearUsernameForOwner",
    ()=>clearUsernameForOwner,
    "normalizeAndValidateUsername",
    ()=>normalizeAndValidateUsername,
    "setUsernameForOwner",
    ()=>setUsernameForOwner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/username.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
class UsernameTakenError extends Error {
    code = "USERNAME_TAKEN";
    constructor(username){
        super(`Username ${username} já está a ser usado`);
    }
}
function normalizeAndValidateUsername(raw) {
    const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateUsername"])(raw);
    if (!result.valid) {
        return {
            ok: false,
            error: result.error
        };
    }
    return {
        ok: true,
        username: result.normalized
    };
}
async function checkUsernameAvailability(username, tx = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"]) {
    const normalizedResult = normalizeAndValidateUsername(username);
    if (!normalizedResult.ok) return normalizedResult;
    const normalized = normalizedResult.username;
    const checkLocalAvailability = async (client)=>{
        const [profile, organizer] = await Promise.all([
            client.profile.findFirst({
                where: {
                    username: {
                        equals: normalized,
                        mode: "insensitive"
                    }
                },
                select: {
                    id: true
                }
            }),
            client.organizer.findFirst({
                where: {
                    username: {
                        equals: normalized,
                        mode: "insensitive"
                    }
                },
                select: {
                    id: true
                }
            })
        ]);
        return !profile && !organizer;
    };
    try {
        const existing = await tx.globalUsername.findUnique({
            where: {
                username: normalized
            },
            select: {
                ownerType: true,
                ownerId: true
            }
        });
        if (existing) {
            return {
                ok: true,
                available: false,
                username: normalized
            };
        }
        const available = await checkLocalAvailability(tx);
        return {
            ok: true,
            available,
            username: normalized
        };
    } catch (err) {
        const code = err?.code;
        const msg = err instanceof Error ? err.message : "";
        const missingTable = code === "P2021" || code === "P2022" || msg.toLowerCase().includes("does not exist");
        if (missingTable) {
            console.warn("[globalUsernames] table/column missing while checking availability");
            const available = await checkLocalAvailability(tx);
            return {
                ok: true,
                available,
                username: normalized
            };
        }
        throw err;
    }
}
async function setUsernameForOwner(options) {
    const { username: rawUsername, ownerType, ownerId } = options;
    const providedTx = options.tx;
    const validated = normalizeAndValidateUsername(rawUsername);
    if (!validated.ok) {
        return {
            ok: false,
            error: validated.error
        };
    }
    const username = validated.username;
    const ownerIdStr = String(ownerId);
    const ownerIdNumber = ownerType === "organizer" ? Number(ownerId) : null;
    const run = async (trx)=>{
        const [profile, organizer] = await Promise.all([
            trx.profile.findFirst({
                where: {
                    username: {
                        equals: username,
                        mode: "insensitive"
                    },
                    ...ownerType === "user" ? {
                        NOT: {
                            id: ownerIdStr
                        }
                    } : {}
                },
                select: {
                    id: true
                }
            }),
            trx.organizer.findFirst({
                where: {
                    username: {
                        equals: username,
                        mode: "insensitive"
                    },
                    ...ownerType === "organizer" && ownerIdNumber && Number.isFinite(ownerIdNumber) ? {
                        NOT: {
                            id: ownerIdNumber
                        }
                    } : {}
                },
                select: {
                    id: true
                }
            })
        ]);
        if (profile || organizer) {
            throw new UsernameTakenError(username);
        }
        const existing = await trx.globalUsername.findUnique({
            where: {
                username
            },
            select: {
                ownerType: true,
                ownerId: true
            }
        });
        if (existing && (existing.ownerType !== ownerType || existing.ownerId !== ownerIdStr)) {
            throw new UsernameTakenError(username);
        }
        await trx.globalUsername.deleteMany({
            where: {
                ownerType,
                ownerId: ownerIdStr,
                username: {
                    not: username
                }
            }
        });
        await trx.globalUsername.upsert({
            where: {
                username
            },
            update: {
                ownerType,
                ownerId: ownerIdStr,
                updatedAt: new Date()
            },
            create: {
                username,
                ownerType,
                ownerId: ownerIdStr
            }
        });
        return {
            ok: true,
            username
        };
    };
    if (providedTx) {
        try {
            return await run(providedTx);
        } catch (err) {
            const code = err?.code;
            const msg = err instanceof Error ? err.message : "";
            const missingTable = code === "P2021" || code === "P2022" || msg.toLowerCase().includes("relation") || msg.toLowerCase().includes("does not exist");
            if (missingTable) {
                console.warn("[globalUsernames] table/column missing, skipping username reservation");
                return {
                    ok: false,
                    error: "USERNAME_TABLE_MISSING"
                };
            }
            throw err;
        }
    }
    try {
        return await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].$transaction(run);
    } catch (err) {
        const code = err?.code;
        const msg = err instanceof Error ? err.message : "";
        const missingTable = code === "P2021" || code === "P2022" || msg.toLowerCase().includes("relation") || msg.toLowerCase().includes("does not exist");
        if (missingTable) {
            console.warn("[globalUsernames] table/column missing, skipping username reservation");
            return {
                ok: false,
                error: "USERNAME_TABLE_MISSING"
            };
        }
        throw err;
    }
}
async function clearUsernameForOwner(options) {
    const { ownerType, ownerId } = options;
    const client = options.tx ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"];
    await client.globalUsername.deleteMany({
        where: {
            ownerType,
            ownerId: String(ownerId)
        }
    });
    return {
        ok: true
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/api/auth/me/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

// app/api/auth/me/route.ts
__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notifications$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/notifications.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$globalUsernames$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/globalUsernames.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notifications$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$globalUsernames$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notifications$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$globalUsernames$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
async function GET() {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            // Sessão ausente ou inválida → 401 limpo (evita spam de logs)
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                user: null,
                profile: null
            }, {
                status: 401
            });
        }
        const supaUser = user;
        const emailConfirmed = Boolean(supaUser.email_confirmed_at) || Boolean(supaUser?.confirmed_at) || false;
        const userMetadata = user.user_metadata ?? {};
        const userId = user.id;
        // Garantir Profile 1-1 com auth.users e prefs
        const [profileFromDb, notificationPrefs] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.findUnique({
                where: {
                    id: userId
                }
            }),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notifications$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getNotificationPrefs"])(userId).catch(()=>null)
        ]);
        let profile = profileFromDb ?? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.create({
            data: {
                id: userId,
                username: null,
                fullName: userMetadata.full_name ?? userMetadata.name ?? null,
                avatarUrl: userMetadata.avatar_url ?? null,
                roles: [
                    "user"
                ],
                visibility: "PUBLIC",
                allowEmailNotifications: true,
                allowEventReminders: true,
                allowFriendRequests: true
            }
        });
        const pendingUsername = typeof userMetadata.pending_username === "string" ? userMetadata.pending_username : null;
        // Atribuir username pendente se ainda não existir
        if (!profile.username && pendingUsername) {
            try {
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].$transaction(async (tx)=>{
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$globalUsernames$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setUsernameForOwner"])({
                        username: pendingUsername,
                        ownerType: "user",
                        ownerId: userId,
                        tx
                    });
                    await tx.profile.update({
                        where: {
                            id: userId
                        },
                        data: {
                            username: pendingUsername
                        }
                    });
                });
                profile = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.findUnique({
                    where: {
                        id: userId
                    }
                });
            } catch (err) {
                if (err instanceof __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$globalUsernames$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UsernameTakenError"]) {
                    // outro utilizador já registou o @ entretanto; deixa username nulo
                    console.warn("[auth/me] pending_username já ocupado");
                } else {
                    console.error("[auth/me] erro ao aplicar pending_username:", err);
                }
            }
        }
        if (!profile) {
            throw new Error("PROFILE_MISSING");
        }
        const profileVisibility = profile.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
        const safeProfile = {
            id: profile.id,
            username: profile.username,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            coverUrl: profile.coverUrl,
            bio: profile.bio,
            city: profile.city,
            contactPhone: profile.contactPhone,
            favouriteCategories: profile.favouriteCategories,
            onboardingDone: profile.onboardingDone,
            roles: profile.roles,
            visibility: profile.visibility,
            allowEmailNotifications: profile.allowEmailNotifications,
            allowEventReminders: profile.allowEventReminders,
            allowFriendRequests: profile.allowFriendRequests,
            allowSalesAlerts: notificationPrefs?.allowSalesAlerts ?? true,
            allowSystemAnnouncements: notificationPrefs?.allowSystemAnnouncements ?? true,
            profileVisibility
        };
        // Se email não está confirmado, força o frontend a continuar em modo "verify"
        if (!emailConfirmed) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                user: {
                    id: user.id,
                    email: user.email ?? null,
                    emailConfirmed
                },
                profile: null,
                needsEmailConfirmation: true
            }, {
                status: 401
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            user: {
                id: user.id,
                email: user.email ?? null,
                emailConfirmed
            },
            profile: safeProfile
        }, {
            status: 200
        });
    } catch (err) {
        console.error("GET /api/auth/me error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            user: null,
            profile: null
        }, {
            status: 200
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__66d7882b._.js.map