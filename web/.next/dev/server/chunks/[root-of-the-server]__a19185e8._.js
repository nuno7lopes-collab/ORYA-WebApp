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
"[project]/lib/padel/validation.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isValidPointsTable",
    ()=>isValidPointsTable,
    "isValidScore",
    ()=>isValidScore,
    "isValidTieBreakRules",
    ()=>isValidTieBreakRules
]);
function isValidTieBreakRules(value) {
    if (!Array.isArray(value)) return false;
    return value.every((item)=>[
            "HEAD_TO_HEAD",
            "SET_DIFFERENCE",
            "GAME_DIFFERENCE",
            "POINTS",
            "COIN_TOSS"
        ].includes(String(item)));
}
function isValidPointsTable(value) {
    if (!value || typeof value !== "object") return false;
    return Object.values(value).every((v)=>typeof v === "number" && Number.isFinite(v));
}
function isValidScore(value) {
    if (!value || typeof value !== "object") return false;
    const obj = value;
    if (obj.sets) {
        if (!Array.isArray(obj.sets)) return false;
        const okSets = obj.sets.every((s)=>s && typeof s === "object" && Number.isFinite(s.teamA) && Number.isFinite(s.teamB));
        if (!okSets) return false;
    }
    if (obj.notes && typeof obj.notes !== "string") return false;
    return true;
}
}),
"[project]/domain/notifications/outbox.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "enqueueNotification",
    ()=>enqueueNotification,
    "markOutboxFailed",
    ()=>markOutboxFailed,
    "markOutboxSent",
    ()=>markOutboxSent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
async function enqueueNotification(params) {
    const { dedupeKey, userId, notificationType, templateVersion, payload = {}, force = false } = params;
    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notificationOutbox.findUnique({
        where: {
            dedupeKey
        }
    });
    if (existing && !force) {
        return existing;
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notificationOutbox.upsert({
        where: {
            dedupeKey
        },
        create: {
            dedupeKey,
            userId: userId ?? null,
            notificationType,
            templateVersion: templateVersion ?? null,
            payload,
            status: "PENDING"
        },
        update: {
            userId: userId ?? null,
            notificationType,
            templateVersion: templateVersion ?? null,
            payload,
            status: "PENDING",
            retries: 0,
            lastError: null,
            sentAt: null
        }
    });
}
async function markOutboxSent(id) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notificationOutbox.update({
        where: {
            id
        },
        data: {
            status: "SENT",
            sentAt: new Date(),
            lastError: null
        }
    });
}
async function markOutboxFailed(id, error) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notificationOutbox.update({
        where: {
            id
        },
        data: {
            status: "FAILED",
            lastError: error,
            retries: {
                increment: 1
            }
        }
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/domain/notifications/producer.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "notifyBracketPublished",
    ()=>notifyBracketPublished,
    "notifyBroadcast",
    ()=>notifyBroadcast,
    "notifyChampion",
    ()=>notifyChampion,
    "notifyDeadlineExpired",
    ()=>notifyDeadlineExpired,
    "notifyEliminated",
    ()=>notifyEliminated,
    "notifyMatchChanged",
    ()=>notifyMatchChanged,
    "notifyMatchResult",
    ()=>notifyMatchResult,
    "notifyNewFollower",
    ()=>notifyNewFollower,
    "notifyNextOpponent",
    ()=>notifyNextOpponent,
    "notifyOffsessionActionRequired",
    ()=>notifyOffsessionActionRequired,
    "notifyPairingInvite",
    ()=>notifyPairingInvite,
    "notifyPairingReminder",
    ()=>notifyPairingReminder,
    "notifyPairingRequestAccepted",
    ()=>notifyPairingRequestAccepted,
    "notifyPairingRequestReceived",
    ()=>notifyPairingRequestReceived,
    "notifyPartnerPaid",
    ()=>notifyPartnerPaid,
    "notifyTicketWaitingClaim",
    ()=>notifyTicketWaitingClaim,
    "notifyTournamentEve",
    ()=>notifyTournamentEve
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$outbox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/notifications/outbox.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$outbox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$outbox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
function buildDedupe(prefix, parts) {
    return [
        prefix,
        ...parts.map((p)=>p === null || p === undefined ? "null" : String(p))
    ].join(":");
}
async function queue(type, dedupeKey, args) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$outbox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["enqueueNotification"])({
        dedupeKey,
        notificationType: type,
        templateVersion: args.templateVersion ?? "v1",
        userId: args.userId,
        payload: args.payload ?? {},
        force: args.force ?? false
    });
}
async function notifyPairingInvite(params) {
    const dedupeKey = buildDedupe("PAIRING_INVITE", [
        params.pairingId,
        params.targetUserId
    ]);
    return queue("PAIRING_INVITE", dedupeKey, {
        userId: params.targetUserId,
        payload: {
            pairingId: params.pairingId,
            tournamentId: params.tournamentId,
            inviterUserId: params.inviterUserId,
            token: params.token
        }
    });
}
async function notifyPairingReminder(params) {
    const dedupeKey = buildDedupe("PAIRING_REMINDER", [
        params.pairingId,
        params.targetUserId
    ]);
    return queue("PAIRING_REMINDER", dedupeKey, {
        userId: params.targetUserId,
        payload: {
            pairingId: params.pairingId
        },
        templateVersion: "v1"
    });
}
async function notifyPartnerPaid(params) {
    const dedupeKey = buildDedupe("PARTNER_PAID", [
        params.pairingId,
        params.captainUserId
    ]);
    return queue("PARTNER_PAID", dedupeKey, {
        userId: params.captainUserId,
        payload: {
            pairingId: params.pairingId,
            partnerUserId: params.partnerUserId
        }
    });
}
async function notifyDeadlineExpired(params) {
    const dedupeKey = buildDedupe("DEADLINE_EXPIRED", [
        params.pairingId,
        params.userId
    ]);
    return queue("DEADLINE_EXPIRED", dedupeKey, {
        userId: params.userId,
        payload: {
            pairingId: params.pairingId
        }
    });
}
async function notifyOffsessionActionRequired(params) {
    const dedupeKey = buildDedupe("OFFSESSION_ACTION_REQUIRED", [
        params.pairingId,
        params.userId
    ]);
    return queue("OFFSESSION_ACTION_REQUIRED", dedupeKey, {
        userId: params.userId,
        payload: {
            pairingId: params.pairingId
        }
    });
}
async function notifyNewFollower(params) {
    const dedupeKey = buildDedupe("NEW_FOLLOWER", [
        params.targetUserId,
        params.followerUserId
    ]);
    return queue("NEW_FOLLOWER", dedupeKey, {
        userId: params.targetUserId,
        payload: {
            followerUserId: params.followerUserId
        }
    });
}
async function notifyPairingRequestReceived(params) {
    const dedupeKey = buildDedupe("PAIRING_REQUEST_RECEIVED", [
        params.pairingId,
        params.targetUserId
    ]);
    return queue("PAIRING_REQUEST_RECEIVED", dedupeKey, {
        userId: params.targetUserId,
        payload: {
            pairingId: params.pairingId
        }
    });
}
async function notifyPairingRequestAccepted(params) {
    const dedupeKey = buildDedupe("PAIRING_REQUEST_ACCEPTED", [
        params.pairingId,
        params.targetUserId
    ]);
    return queue("PAIRING_REQUEST_ACCEPTED", dedupeKey, {
        userId: params.targetUserId,
        payload: {
            pairingId: params.pairingId
        }
    });
}
async function notifyTicketWaitingClaim(params) {
    const dedupeKey = buildDedupe("TICKET_WAITING_CLAIM", [
        params.ticketId,
        params.userId
    ]);
    return queue("TICKET_WAITING_CLAIM", dedupeKey, {
        userId: params.userId,
        payload: {
            ticketId: params.ticketId
        }
    });
}
async function notifyBracketPublished(params) {
    const dedupeKey = buildDedupe("BRACKET_PUBLISHED", [
        params.tournamentId,
        params.userId
    ]);
    return queue("BRACKET_PUBLISHED", dedupeKey, {
        userId: params.userId,
        payload: {
            tournamentId: params.tournamentId
        }
    });
}
async function notifyTournamentEve(params) {
    const dedupeKey = buildDedupe("TOURNAMENT_EVE_REMINDER", [
        params.tournamentId,
        params.userId
    ]);
    return queue("TOURNAMENT_EVE_REMINDER", dedupeKey, {
        userId: params.userId,
        payload: {
            tournamentId: params.tournamentId
        }
    });
}
async function notifyMatchResult(params) {
    const dedupeKey = buildDedupe("MATCH_RESULT", [
        params.matchId,
        params.userId
    ]);
    return queue("MATCH_RESULT", dedupeKey, {
        userId: params.userId,
        payload: {
            matchId: params.matchId,
            tournamentId: params.tournamentId
        }
    });
}
async function notifyNextOpponent(params) {
    const dedupeKey = buildDedupe("NEXT_OPPONENT", [
        params.matchId,
        params.userId
    ]);
    return queue("NEXT_OPPONENT", dedupeKey, {
        userId: params.userId,
        payload: {
            matchId: params.matchId,
            tournamentId: params.tournamentId
        }
    });
}
async function notifyMatchChanged(params) {
    const dedupeKey = buildDedupe("MATCH_CHANGED", [
        params.matchId,
        params.startAt ? params.startAt.toISOString() : null,
        params.courtId ?? null
    ]);
    return queue("MATCH_CHANGED", dedupeKey, {
        userId: params.userId,
        payload: {
            matchId: params.matchId,
            startAt: params.startAt ?? null,
            courtId: params.courtId ?? null
        }
    });
}
async function notifyEliminated(params) {
    const dedupeKey = buildDedupe("ELIMINATED", [
        params.tournamentId,
        params.userId
    ]);
    return queue("ELIMINATED", dedupeKey, {
        userId: params.userId,
        payload: {
            tournamentId: params.tournamentId
        }
    });
}
async function notifyChampion(params) {
    const dedupeKey = buildDedupe("CHAMPION", [
        params.tournamentId,
        params.userId
    ]);
    return queue("CHAMPION", dedupeKey, {
        userId: params.userId,
        payload: {
            tournamentId: params.tournamentId
        }
    });
}
async function notifyBroadcast(params) {
    const dedupeKey = buildDedupe("BROADCAST", [
        params.tournamentId,
        params.audienceKey,
        params.userId
    ]);
    return queue("BROADCAST", dedupeKey, {
        userId: params.userId,
        payload: {
            tournamentId: params.tournamentId,
            broadcastId: params.broadcastId
        }
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[project]/domain/notifications/matchChangeDedupe.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeDedupeKey",
    ()=>computeDedupeKey
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
;
function computeDedupeKey(matchId, startAt, courtId) {
    const payload = `${matchId}|${startAt ? startAt.toISOString() : "null"}|${courtId ?? "null"}`;
    return __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createHash("sha256").update(payload).digest("hex");
}
}),
"[project]/domain/notifications/tournament.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "queueBracketPublished",
    ()=>queueBracketPublished,
    "queueBroadcast",
    ()=>queueBroadcast,
    "queueChampion",
    ()=>queueChampion,
    "queueEliminated",
    ()=>queueEliminated,
    "queueMatchChanged",
    ()=>queueMatchChanged,
    "queueMatchResult",
    ()=>queueMatchResult,
    "queueNextOpponent",
    ()=>queueNextOpponent,
    "queueTournamentEve",
    ()=>queueTournamentEve
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/notifications/producer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$matchChangeDedupe$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/notifications/matchChangeDedupe.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
async function queueBracketPublished(userIds, tournamentId) {
    await Promise.all(userIds.map((userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notifyBracketPublished"])({
            userId,
            tournamentId
        })));
}
async function queueTournamentEve(userIds, tournamentId) {
    await Promise.all(userIds.map((userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notifyTournamentEve"])({
            userId,
            tournamentId
        })));
}
async function queueMatchResult(userIds, matchId, tournamentId) {
    await Promise.all(userIds.map((userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notifyMatchResult"])({
            userId,
            matchId,
            tournamentId
        })));
}
async function queueNextOpponent(userIds, matchId, tournamentId) {
    await Promise.all(userIds.map((userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notifyNextOpponent"])({
            userId,
            matchId,
            tournamentId
        })));
}
async function queueMatchChanged(params) {
    const { userIds, matchId, startAt = null, courtId = null } = params;
    // Use the same dedupe hash as scheduling dedupe so we never send twice for identical change.
    const dedupeKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$matchChangeDedupe$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computeDedupeKey"])(matchId, startAt, courtId);
    await Promise.all(userIds.map((userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notifyMatchChanged"])({
            userId,
            matchId,
            startAt,
            courtId
        })));
    return dedupeKey;
}
async function queueEliminated(userIds, tournamentId) {
    await Promise.all(userIds.map((userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notifyEliminated"])({
            userId,
            tournamentId
        })));
}
async function queueChampion(userIds, tournamentId) {
    await Promise.all(userIds.map((userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notifyChampion"])({
            userId,
            tournamentId
        })));
}
async function queueBroadcast(params) {
    const { audienceUserIds, tournamentId, broadcastId, audienceKey } = params;
    await Promise.all(audienceUserIds.map((userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$producer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notifyBroadcast"])({
            userId,
            tournamentId,
            broadcastId,
            audienceKey
        })));
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/lib/padel/staff.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

/* __next_internal_action_entry_do_not_use__ [{"70e2d46d82c0bd5b7c267f1db2aac9b4c1729fe900":"isPadelStaff"},"",""] */ __turbopack_context__.s([
    "isPadelStaff",
    ()=>isPadelStaff
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
async function isPadelStaff(userId, organizerId, eventId) {
    if (!userId || !organizerId) return false;
    const scopeFilter = typeof eventId === "number" ? {
        OR: [
            {
                scope: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffScope"].GLOBAL
            },
            {
                scope: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffScope"].EVENT,
                eventId
            }
        ]
    } : {
        scope: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffScope"].GLOBAL
    };
    const assignment = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].staffAssignment.findFirst({
        where: {
            userId,
            organizerId,
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffStatus"].ACCEPTED,
            revokedAt: null,
            role: {
                in: [
                    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffRole"].OWNER,
                    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffRole"].ADMIN,
                    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffRole"].STAFF,
                    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffRole"].CHECKIN
                ]
            },
            ...scopeFilter
        },
        select: {
            id: true
        }
    });
    return Boolean(assignment);
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    isPadelStaff
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["registerServerReference"])(isPadelStaff, "70e2d46d82c0bd5b7c267f1db2aac9b4c1729fe900", null);
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/api/padel/matches/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerContext.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$validation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/padel/validation.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$tournament$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/notifications/tournament.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/padel/staff.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$tournament$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$tournament$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
const runtime = "nodejs";
;
;
;
;
;
;
;
const allowedRoles = [
    "OWNER",
    "CO_OWNER",
    "ADMIN"
];
function sortRoundsBySize(matches) {
    const counts = matches.reduce((acc, m)=>{
        const key = m.roundLabel || "?";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts).sort((a, b)=>b[1] - a[1]);
}
async function GET(req) {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "UNAUTHENTICATED"
    }, {
        status: 401
    });
    const eventId = Number(req.nextUrl.searchParams.get("eventId"));
    const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
    if (!Number.isFinite(eventId)) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "INVALID_EVENT"
    }, {
        status: 400
    });
    const matchCategoryFilter = Number.isFinite(categoryId) ? {
        categoryId
    } : {};
    const event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            id: eventId
        },
        select: {
            organizerId: true
        }
    });
    if (!event?.organizerId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "EVENT_NOT_FOUND"
    }, {
        status: 404
    });
    const { organizer } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getActiveOrganizerForUser"])(user.id, {
        organizerId: event.organizerId,
        roles: allowedRoles
    });
    const isStaff = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isPadelStaff"])(user.id, event.organizerId, eventId);
    if (!organizer && !isStaff) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "FORBIDDEN"
    }, {
        status: 403
    });
    const matches = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelMatch.findMany({
        where: {
            eventId,
            ...matchCategoryFilter
        },
        include: {
            pairingA: {
                include: {
                    slots: {
                        include: {
                            playerProfile: true
                        }
                    }
                }
            },
            pairingB: {
                include: {
                    slots: {
                        include: {
                            playerProfile: true
                        }
                    }
                }
            }
        },
        orderBy: [
            {
                roundType: "asc"
            },
            {
                groupLabel: "asc"
            },
            {
                startTime: "asc"
            },
            {
                id: "asc"
            }
        ]
    });
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: true,
        items: matches
    }, {
        status: 200
    });
}
async function POST(req) {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "UNAUTHENTICATED"
    }, {
        status: 401
    });
    const body = await req.json().catch(()=>null);
    if (!body) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "INVALID_BODY"
    }, {
        status: 400
    });
    const matchId = typeof body.id === "number" ? body.id : Number(body.id);
    const statusRaw = typeof body.status === "string" ? body.status : undefined;
    const scoreRaw = body.score;
    const startAtRaw = body.startAt ? new Date(String(body.startAt)) : undefined;
    const courtIdRaw = typeof body.courtId === "number" ? body.courtId : undefined;
    if (!Number.isFinite(matchId)) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "INVALID_ID"
    }, {
        status: 400
    });
    if (startAtRaw && Number.isNaN(startAtRaw.getTime())) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "INVALID_START_AT"
        }, {
            status: 400
        });
    }
    const match = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelMatch.findUnique({
        where: {
            id: matchId
        },
        include: {
            event: {
                select: {
                    organizerId: true
                }
            }
        }
    });
    if (!match || !match.event?.organizerId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "MATCH_NOT_FOUND"
    }, {
        status: 404
    });
    const { organizer, membership } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getActiveOrganizerForUser"])(user.id, {
        organizerId: match.event.organizerId,
        roles: allowedRoles
    });
    const isStaff = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isPadelStaff"])(user.id, match.event.organizerId, match.eventId);
    if (!organizer && !isStaff) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "NO_ORGANIZER"
    }, {
        status: 403
    });
    if (scoreRaw && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$validation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isValidScore"])(scoreRaw)) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "INVALID_SCORE"
        }, {
            status: 400
        });
    }
    let winnerPairingId = null;
    if (scoreRaw && typeof scoreRaw === "object" && "sets" in scoreRaw) {
        const rawSets = scoreRaw.sets;
        const sets = Array.isArray(rawSets) ? rawSets : [];
        let winsA = 0;
        let winsB = 0;
        sets.forEach((s)=>{
            const set = s;
            if (Number.isFinite(set.teamA) && Number.isFinite(set.teamB)) {
                const a = Number(set.teamA);
                const b = Number(set.teamB);
                if (a > b) winsA += 1;
                else if (b > a) winsB += 1;
            }
        });
        if (winsA > winsB && match.pairingAId) winnerPairingId = match.pairingAId;
        if (winsB > winsA && match.pairingBId) winnerPairingId = match.pairingBId;
    }
    const updated = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelMatch.update({
        where: {
            id: matchId
        },
        data: {
            status: statusRaw ?? match.status,
            score: scoreRaw ?? match.score,
            scoreSets: typeof scoreRaw === "object" && scoreRaw && "sets" in scoreRaw ? scoreRaw.sets : match.scoreSets,
            winnerPairingId: winnerPairingId ?? match.winnerPairingId,
            startTime: startAtRaw ?? match.startTime,
            courtNumber: courtIdRaw ?? match.courtNumber
        },
        include: {
            pairingA: {
                include: {
                    slots: {
                        include: {
                            playerProfile: true
                        }
                    }
                }
            },
            pairingB: {
                include: {
                    slots: {
                        include: {
                            playerProfile: true
                        }
                    }
                }
            }
        }
    });
    const involvedUserIds = [
        ...(updated.pairingA?.slots ?? []).map((s)=>s.profileId).filter(Boolean),
        ...(updated.pairingB?.slots ?? []).map((s)=>s.profileId).filter(Boolean)
    ];
    // Notificações: mudança de horário/court
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$tournament$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["queueMatchChanged"])({
        userIds: involvedUserIds,
        matchId: updated.id,
        startAt: updated.startTime ?? null,
        courtId: updated.courtNumber ?? null
    });
    // Notificações de resultado + próximo adversário
    if (winnerPairingId) {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$tournament$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["queueMatchResult"])(involvedUserIds, updated.id, updated.eventId);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$notifications$2f$tournament$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["queueNextOpponent"])(involvedUserIds, updated.id, updated.eventId);
        // Auto-avanço de vencedores no bracket (baseado em ordem dos jogos por ronda)
        if (updated.roundType === "KNOCKOUT") {
            const koMatches = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelMatch.findMany({
                where: {
                    eventId: updated.eventId,
                    roundType: "KNOCKOUT",
                    ...updated.categoryId ? {
                        categoryId: updated.categoryId
                    } : {}
                },
                select: {
                    id: true,
                    roundLabel: true,
                    pairingAId: true,
                    pairingBId: true,
                    winnerPairingId: true
                },
                orderBy: [
                    {
                        roundLabel: "asc"
                    },
                    {
                        id: "asc"
                    }
                ]
            });
            const roundOrder = sortRoundsBySize(koMatches).map(([label])=>label);
            const roundsMap = new Map();
            roundOrder.forEach((label)=>{
                roundsMap.set(label, koMatches.filter((m)=>(m.roundLabel || "?") === label));
            });
            const advance = async (fromMatchId, winner)=>{
                const fromMatch = koMatches.find((m)=>m.id === fromMatchId);
                if (!fromMatch) return;
                const currentRound = fromMatch.roundLabel || roundOrder[0] || null;
                const currentIdx = roundOrder.findIndex((l)=>l === currentRound);
                if (currentIdx === -1 || currentIdx >= roundOrder.length - 1) return;
                const currentMatches = roundsMap.get(currentRound) || [];
                const nextRoundLabel = roundOrder[currentIdx + 1];
                const nextMatches = roundsMap.get(nextRoundLabel) || [];
                const currentPos = currentMatches.findIndex((m)=>m.id === fromMatchId);
                if (currentPos === -1) return;
                const targetIdx = Math.floor(currentPos / 2);
                const target = nextMatches[targetIdx];
                if (!target) return;
                const updateTarget = {};
                if (currentPos % 2 === 0) {
                    if (!target.pairingAId) updateTarget.pairingAId = winner;
                    else if (!target.pairingBId) updateTarget.pairingBId = winner;
                } else {
                    if (!target.pairingBId) updateTarget.pairingBId = winner;
                    else if (!target.pairingAId) updateTarget.pairingAId = winner;
                }
                if (Object.keys(updateTarget).length > 0) {
                    const targetUpdated = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelMatch.update({
                        where: {
                            id: target.id
                        },
                        data: updateTarget
                    });
                    // atualizar caches locais
                    target.pairingAId = targetUpdated.pairingAId;
                    target.pairingBId = targetUpdated.pairingBId;
                    // BYE: auto-avançar
                    if (targetUpdated.pairingAId && !targetUpdated.pairingBId || !targetUpdated.pairingAId && targetUpdated.pairingBId) {
                        const autoWinner = targetUpdated.pairingAId ?? targetUpdated.pairingBId;
                        const autoDone = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelMatch.update({
                            where: {
                                id: targetUpdated.id
                            },
                            data: {
                                winnerPairingId: autoWinner,
                                status: "DONE"
                            }
                        });
                        target.winnerPairingId = autoDone.winnerPairingId;
                        target.pairingAId = autoDone.pairingAId;
                        target.pairingBId = autoDone.pairingBId;
                        await advance(target.id, autoWinner);
                    }
                }
            };
            await advance(updated.id, winnerPairingId);
        }
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: true,
        match: updated
    }, {
        status: 200
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a19185e8._.js.map