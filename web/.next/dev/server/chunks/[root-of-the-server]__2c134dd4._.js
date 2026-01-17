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
"[project]/lib/organizerRoles.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "ensureUserIsOrganizer",
    ()=>ensureUserIsOrganizer,
    "setSoleOwner",
    ()=>setSoleOwner,
    "setSoleOwnerSafe",
    ()=>setSoleOwnerSafe
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
async function setSoleOwner(client, organizerId, userId, invitedByUserId) {
    await client.organizerMember.upsert({
        where: {
            organizerId_userId: {
                organizerId,
                userId
            }
        },
        update: {
            role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER
        },
        create: {
            organizerId,
            userId,
            role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER,
            invitedByUserId: invitedByUserId ?? undefined
        }
    });
    await client.organizerMember.updateMany({
        where: {
            organizerId,
            role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER,
            userId: {
                not: userId
            }
        },
        data: {
            role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER
        }
    });
}
async function ensureUserIsOrganizer(client, userId) {
    const targetProfile = await client.profile.findUnique({
        where: {
            id: userId
        },
        select: {
            roles: true
        }
    });
    if (!targetProfile) return;
    const roles = Array.isArray(targetProfile.roles) ? targetProfile.roles : [];
    if (!roles.includes("organizer")) {
        await client.profile.update({
            where: {
                id: userId
            },
            data: {
                roles: [
                    ...roles,
                    "organizer"
                ]
            }
        });
    }
}
async function setSoleOwnerSafe(organizerId, userId, invitedByUserId) {
    return setSoleOwner(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"], organizerId, userId, invitedByUserId);
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/lib/organizerId.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ORGANIZER_COOKIE_NAME",
    ()=>ORGANIZER_COOKIE_NAME,
    "parseOrganizerId",
    ()=>parseOrganizerId,
    "resolveOrganizerIdFromCookies",
    ()=>resolveOrganizerIdFromCookies,
    "resolveOrganizerIdFromRequest",
    ()=>resolveOrganizerIdFromRequest
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
;
const ORGANIZER_COOKIE_NAME = "orya_org";
function parseOrganizerId(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? value : null;
    }
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
async function resolveOrganizerIdFromCookies() {
    try {
        const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        return parseOrganizerId(cookieStore.get(ORGANIZER_COOKIE_NAME)?.value);
    } catch  {
        return null;
    }
}
function resolveOrganizerIdFromRequest(req) {
    const params = req.nextUrl.searchParams;
    const paramValue = params.get("organizerId") ?? params.get("org");
    return parseOrganizerId(paramValue) ?? parseOrganizerId(req.cookies.get(ORGANIZER_COOKIE_NAME)?.value);
}
}),
"[project]/lib/organizerContext.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "ensureLegacyOrganizerMemberships",
    ()=>ensureLegacyOrganizerMemberships,
    "getActiveOrganizerForUser",
    ()=>getActiveOrganizerForUser
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerRoles$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerRoles.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerId$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerId.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerRoles$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerRoles$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
async function ensureLegacyOrganizerMemberships(userId, organizerId) {
    if (!userId) return 0;
    const legacyOrganizers = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizer.findMany({
        where: {
            userId,
            ...Number.isFinite(organizerId) ? {
                id: organizerId
            } : {}
        },
        select: {
            id: true
        }
    });
    if (legacyOrganizers.length === 0) return 0;
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].$transaction(async (tx)=>{
            for (const organizer of legacyOrganizers){
                await tx.organizerMember.upsert({
                    where: {
                        organizerId_userId: {
                            organizerId: organizer.id,
                            userId
                        }
                    },
                    update: {
                        role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER
                    },
                    create: {
                        organizerId: organizer.id,
                        userId,
                        role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER
                    }
                });
            }
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerRoles$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ensureUserIsOrganizer"])(tx, userId);
        });
    } catch (err) {
        const msg = typeof err === "object" && err && "message" in err ? String(err.message) : "";
        if (msg.includes("does not exist") || msg.includes("organizer_members")) {
            return 0;
        }
        throw err;
    }
    return legacyOrganizers.length;
}
async function getActiveOrganizerForUser(userId, opts = {}) {
    const { roles } = opts;
    const directOrganizerId = typeof opts.organizerId === "number" && Number.isFinite(opts.organizerId) ? opts.organizerId : null;
    const cookieOrganizerId = directOrganizerId ? null : await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerId$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveOrganizerIdFromCookies"])();
    const organizerId = directOrganizerId ?? cookieOrganizerId;
    // 1) Se organizerId foi especificado, tenta buscar diretamente essa membership primeiro
    if (organizerId) {
        const direct = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findFirst({
            where: {
                userId,
                organizerId,
                ...roles ? {
                    role: {
                        in: roles
                    }
                } : {},
                organizer: {
                    status: "ACTIVE"
                }
            },
            include: {
                organizer: true
            }
        });
        if (direct?.organizer) {
            return {
                organizer: direct.organizer,
                membership: direct
            };
        }
        const legacyFixed = await ensureLegacyOrganizerMemberships(userId, organizerId);
        if (legacyFixed > 0) {
            const retry = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findFirst({
                where: {
                    userId,
                    organizerId,
                    ...roles ? {
                        role: {
                            in: roles
                        }
                    } : {},
                    organizer: {
                        status: "ACTIVE"
                    }
                },
                include: {
                    organizer: true
                }
            });
            if (retry?.organizer) {
                return {
                    organizer: retry.organizer,
                    membership: retry
                };
            }
        }
        // Se o organizerId foi pedido explicitamente e não existe membership, não faz fallback.
        return {
            organizer: null,
            membership: null
        };
    }
    let memberships = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findMany({
        where: {
            userId,
            ...roles ? {
                role: {
                    in: roles
                }
            } : {},
            organizer: {
                status: "ACTIVE"
            }
        },
        include: {
            organizer: true
        },
        orderBy: [
            {
                lastUsedAt: "desc"
            },
            {
                createdAt: "asc"
            }
        ]
    });
    if (memberships.length === 0) {
        const legacyFixed = await ensureLegacyOrganizerMemberships(userId);
        if (legacyFixed > 0) {
            memberships = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findMany({
                where: {
                    userId,
                    ...roles ? {
                        role: {
                            in: roles
                        }
                    } : {},
                    organizer: {
                        status: "ACTIVE"
                    }
                },
                include: {
                    organizer: true
                },
                orderBy: [
                    {
                        lastUsedAt: "desc"
                    },
                    {
                        createdAt: "asc"
                    }
                ]
            });
        }
    }
    if (memberships && memberships.length > 0) {
        if (memberships.length > 1) {
            return {
                organizer: null,
                membership: null
            };
        }
        const selected = memberships[0];
        if (selected?.organizer) {
            return {
                organizer: selected.organizer,
                membership: selected
            };
        }
    }
    return {
        organizer: null,
        membership: null
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/lib/organizerPermissions.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "canManageBilling",
    ()=>canManageBilling,
    "canManageEvents",
    ()=>canManageEvents,
    "canManageMembers",
    ()=>canManageMembers,
    "isOrgAdminOrAbove",
    ()=>isOrgAdminOrAbove,
    "isOrgCoOwnerOrAbove",
    ()=>isOrgCoOwnerOrAbove,
    "isOrgOwner",
    ()=>isOrgOwner
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
;
const ROLE_WEIGHT = {
    [__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].VIEWER]: 0,
    [__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].STAFF]: 1,
    [__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].ADMIN]: 2,
    [__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER]: 3,
    [__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER]: 4
};
const ADMIN_MANAGEABLE = new Set([
    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].STAFF,
    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].VIEWER
]);
const CO_OWNER_MANAGEABLE = new Set([
    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].ADMIN,
    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].STAFF,
    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].VIEWER
]);
function isOrgOwner(role) {
    return role === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER;
}
function isOrgCoOwnerOrAbove(role) {
    return role ? ROLE_WEIGHT[role] >= ROLE_WEIGHT[__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER] : false;
}
function isOrgAdminOrAbove(role) {
    return role ? ROLE_WEIGHT[role] >= ROLE_WEIGHT[__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].ADMIN] : false;
}
function canManageEvents(role) {
    return isOrgAdminOrAbove(role);
}
function canManageBilling(role) {
    return role === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER;
}
function canManageMembers(actorRole, targetCurrentRole, desiredRole) {
    if (!actorRole) return false;
    if (actorRole === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER) return true;
    if (actorRole === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER) {
        if (targetCurrentRole === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER || targetCurrentRole === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER || desiredRole === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER || desiredRole === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER) {
            return false;
        }
        const target = targetCurrentRole ?? desiredRole;
        return target ? CO_OWNER_MANAGEABLE.has(target) : true;
    }
    if (actorRole === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].ADMIN) {
        const target = targetCurrentRole ?? desiredRole;
        if (target && !ADMIN_MANAGEABLE.has(target)) return false;
        return desiredRole ? ADMIN_MANAGEABLE.has(desiredRole) : true;
    }
    return false;
}
}),
"[project]/lib/platformSettings.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "getOrgTransferEnabled",
    ()=>getOrgTransferEnabled,
    "getPlatformAndStripeFees",
    ()=>getPlatformAndStripeFees,
    "getPlatformFees",
    ()=>getPlatformFees,
    "getStripeBaseFees",
    ()=>getStripeBaseFees,
    "setPlatformFees",
    ()=>setPlatformFees,
    "setStripeBaseFees",
    ()=>setStripeBaseFees
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
const envPlatformFeeBps = process.env.PLATFORM_FEE_BPS ?? process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS;
const envPlatformFeePercent = process.env.PLATFORM_FEE_PERCENT ?? process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT;
const envPlatformFeeFixedCents = process.env.PLATFORM_FEE_FIXED_CENTS ?? process.env.NEXT_PUBLIC_PLATFORM_FEE_FIXED_CENTS;
const envPlatformFeeFixedEur = process.env.PLATFORM_FEE_FIXED_EUR ?? process.env.NEXT_PUBLIC_PLATFORM_FEE_FIXED_EUR;
const DEFAULT_PLATFORM_FEE_BPS = Number.isFinite(Number(envPlatformFeeBps)) ? Number(envPlatformFeeBps) : Math.round(Number(envPlatformFeePercent ?? 0.08) * 10_000) || 800; // 8%
const DEFAULT_PLATFORM_FEE_FIXED_CENTS = Number.isFinite(Number(envPlatformFeeFixedCents)) ? Number(envPlatformFeeFixedCents) : Math.round(Number(envPlatformFeeFixedEur ?? 0.3) * 100) || 30; // €0.30
const DEFAULT_STRIPE_FEE_BPS_EU = Number.isFinite(Number(process.env.STRIPE_FEE_BPS_EU)) ? Number(process.env.STRIPE_FEE_BPS_EU) : Math.round(Number(process.env.STRIPE_FEE_PERCENT_EU ?? 0.014) * 10_000) || 140; // 1.4%
const DEFAULT_STRIPE_FEE_FIXED_CENTS_EU = Number.isFinite(Number(process.env.STRIPE_FEE_FIXED_CENTS_EU)) ? Number(process.env.STRIPE_FEE_FIXED_CENTS_EU) : Math.round(Number(process.env.STRIPE_FEE_FIXED_EUR_EU ?? 0.25) * 100) || 25; // €0.25
function parseNumber(raw, fallback) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
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
async function getSettingsMap(keys) {
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].platformSetting.findMany({
        where: {
            key: {
                in: keys
            }
        }
    });
    return rows.reduce((acc, row)=>{
        acc[row.key] = row.value;
        return acc;
    }, {});
}
async function upsertSettings(values) {
    const tasks = values.map(({ key, value })=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].platformSetting.upsert({
            where: {
                key
            },
            create: {
                key,
                value
            },
            update: {
                value
            }
        }));
    await Promise.all(tasks);
}
async function getPlatformFees() {
    const map = await getSettingsMap([
        "platform_fee_bps",
        "platform_fee_fixed_cents"
    ]);
    return {
        feeBps: parseNumber(map["platform_fee_bps"], DEFAULT_PLATFORM_FEE_BPS),
        feeFixedCents: parseNumber(map["platform_fee_fixed_cents"], DEFAULT_PLATFORM_FEE_FIXED_CENTS)
    };
}
async function setPlatformFees(config) {
    const updates = [];
    if (config.feeBps !== undefined) {
        updates.push({
            key: "platform_fee_bps",
            value: String(Math.max(0, Math.round(config.feeBps)))
        });
    }
    if (config.feeFixedCents !== undefined) {
        updates.push({
            key: "platform_fee_fixed_cents",
            value: String(Math.max(0, Math.round(config.feeFixedCents)))
        });
    }
    if (updates.length > 0) {
        await upsertSettings(updates);
    }
    return getPlatformFees();
}
async function getStripeBaseFees() {
    const map = await getSettingsMap([
        "stripe_fee_bps_eu",
        "stripe_fee_fixed_cents_eu"
    ]);
    return {
        feeBps: parseNumber(map["stripe_fee_bps_eu"], DEFAULT_STRIPE_FEE_BPS_EU),
        feeFixedCents: parseNumber(map["stripe_fee_fixed_cents_eu"], DEFAULT_STRIPE_FEE_FIXED_CENTS_EU),
        region: "UE"
    };
}
async function setStripeBaseFees(config) {
    const updates = [];
    if (config.feeBps !== undefined) {
        updates.push({
            key: "stripe_fee_bps_eu",
            value: String(Math.max(0, Math.round(config.feeBps)))
        });
    }
    if (config.feeFixedCents !== undefined) {
        updates.push({
            key: "stripe_fee_fixed_cents_eu",
            value: String(Math.max(0, Math.round(config.feeFixedCents)))
        });
    }
    if (updates.length > 0) {
        await upsertSettings(updates);
    }
    return getStripeBaseFees();
}
async function getPlatformAndStripeFees() {
    const [orya, stripe] = await Promise.all([
        getPlatformFees(),
        getStripeBaseFees()
    ]);
    return {
        orya,
        stripe
    };
}
async function getOrgTransferEnabled() {
    const map = await getSettingsMap([
        "org_transfer_enabled"
    ]);
    return parseBoolean(map["org_transfer_enabled"], false);
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/api/organizador/finance/overview/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerContext.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerId$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerId.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPermissions$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerPermissions.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/platformSettings.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
;
async function GET(req) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "UNAUTHENTICATED"
            }, {
                status: 401
            });
        }
        const organizerId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerId$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveOrganizerIdFromRequest"])(req);
        const { organizer, membership } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getActiveOrganizerForUser"])(user.id, {
            organizerId: organizerId ?? undefined
        });
        if (!organizer || !membership || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPermissions$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isOrgAdminOrAbove"])(membership.role)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "FORBIDDEN"
            }, {
                status: 403
            });
        }
        const events = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findMany({
            where: {
                organizerId: organizer.id
            },
            select: {
                id: true,
                title: true,
                slug: true,
                startsAt: true,
                status: true,
                payoutMode: true
            },
            orderBy: {
                startsAt: "asc"
            }
        });
        const eventIds = events.map((e)=>e.id);
        if (!eventIds.length) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: true,
                totals: {
                    grossCents: 0,
                    netCents: 0,
                    feesCents: 0,
                    tickets: 0,
                    eventsWithSales: 0
                },
                rolling: {
                    last7: {
                        grossCents: 0,
                        netCents: 0,
                        feesCents: 0,
                        tickets: 0
                    },
                    last30: {
                        grossCents: 0,
                        netCents: 0,
                        feesCents: 0,
                        tickets: 0
                    }
                },
                upcomingPayoutCents: 0,
                events: []
            }, {
                status: 200
            });
        }
        const now = new Date();
        const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const stripeBaseFees = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStripeBaseFees"])();
        const estimateStripeFee = (amountCents)=>Math.max(0, Math.round(amountCents * (stripeBaseFees.feeBps ?? 0) / 10_000) + (stripeBaseFees.feeFixedCents ?? 0));
        // Fonte preferencial: SaleSummary/SaleLine
        const summaries = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].saleSummary.findMany({
            where: {
                eventId: {
                    in: eventIds
                }
            },
            select: {
                id: true,
                eventId: true,
                createdAt: true,
                subtotalCents: true,
                discountCents: true,
                platformFeeCents: true,
                stripeFeeCents: true,
                netCents: true,
                totalCents: true,
                lines: {
                    select: {
                        quantity: true
                    }
                }
            }
        });
        const totals = {
            grossCents: 0,
            netCents: 0,
            feesCents: 0,
            tickets: 0
        };
        const agg7 = {
            grossCents: 0,
            netCents: 0,
            feesCents: 0,
            tickets: 0
        };
        const agg30 = {
            grossCents: 0,
            netCents: 0,
            feesCents: 0,
            tickets: 0
        };
        const eventStats = new Map();
        const addTo = (target, gross, fees1, net, qty)=>{
            target.grossCents += gross;
            target.feesCents += fees1;
            target.netCents += net;
            target.tickets += qty;
        };
        for (const s of summaries){
            const qty = s.lines.reduce((q, l)=>q + (l.quantity ?? 0), 0);
            const gross = s.subtotalCents ?? 0;
            const platformFee = s.platformFeeCents ?? 0;
            const totalCents = s.totalCents ?? gross;
            const stripeFee = s.stripeFeeCents != null && s.stripeFeeCents > 0 ? s.stripeFeeCents : estimateStripeFee(totalCents);
            const totalFees = platformFee + stripeFee;
            const net = s.netCents != null && s.netCents >= 0 ? s.netCents : Math.max(0, totalCents - totalFees);
            addTo(totals, gross, totalFees, net, qty);
            if (s.createdAt >= last30) addTo(agg30, gross, totalFees, net, qty);
            if (s.createdAt >= last7) addTo(agg7, gross, totalFees, net, qty);
            const current = eventStats.get(s.eventId) ?? {
                grossCents: 0,
                netCents: 0,
                feesCents: 0,
                tickets: 0,
                status: events.find((e)=>e.id === s.eventId)?.status,
                startsAt: events.find((e)=>e.id === s.eventId)?.startsAt ?? null
            };
            addTo(current, gross, fees, net, qty);
            eventStats.set(s.eventId, current);
        }
        const eventsWithSales = Array.from(eventStats.keys()).length;
        const upcomingPayoutCents = agg7.netCents;
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            totals: {
                ...totals,
                eventsWithSales
            },
            rolling: {
                last7: agg7,
                last30: agg30
            },
            upcomingPayoutCents,
            events: events.map((ev)=>{
                const stats = eventStats.get(ev.id) ?? {
                    grossCents: 0,
                    netCents: 0,
                    feesCents: 0,
                    tickets: 0
                };
                return {
                    ...ev,
                    grossCents: stats.grossCents,
                    netCents: stats.netCents,
                    feesCents: stats.feesCents,
                    ticketsSold: stats.tickets
                };
            })
        }, {
            status: 200
        });
    } catch (err) {
        console.error("[organizador/finance/overview]", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "INTERNAL_ERROR"
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__2c134dd4._.js.map