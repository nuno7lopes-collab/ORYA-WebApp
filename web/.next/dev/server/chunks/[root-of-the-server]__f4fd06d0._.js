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
"[project]/lib/phone.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Utils partilhados para normalizar/validar telefones de forma consistente
// Remove caracteres inválidos, permitindo apenas dígitos e um único "+" no início
__turbopack_context__.s([
    "isValidPhone",
    ()=>isValidPhone,
    "normalizePhone",
    ()=>normalizePhone,
    "sanitizePhone",
    ()=>sanitizePhone
]);
function sanitizePhone(input) {
    let cleaned = input.replace(/[^\d+]/g, "");
    if (cleaned.includes("+")) {
        const firstPlus = cleaned.indexOf("+");
        cleaned = "+" + cleaned.slice(firstPlus + 1).replace(/\+/g, "");
    }
    return cleaned;
}
function isValidPhone(input) {
    const value = sanitizePhone(input);
    if (!value) return false;
    return /^\+?\d{6,15}$/.test(value);
}
function normalizePhone(input) {
    return sanitizePhone(input);
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
"[project]/lib/organizationCategories.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_ORGANIZATION_CATEGORY",
    ()=>DEFAULT_ORGANIZATION_CATEGORY,
    "DEFAULT_ORGANIZATION_MODULES",
    ()=>DEFAULT_ORGANIZATION_MODULES,
    "ORGANIZATION_CATEGORIES",
    ()=>ORGANIZATION_CATEGORIES,
    "ORGANIZATION_MODULES",
    ()=>ORGANIZATION_MODULES,
    "parseOrganizationCategory",
    ()=>parseOrganizationCategory,
    "parseOrganizationModules",
    ()=>parseOrganizationModules
]);
const ORGANIZATION_CATEGORIES = [
    "EVENTOS",
    "PADEL",
    "VOLUNTARIADO"
];
const ORGANIZATION_MODULES = [
    "INSCRICOES",
    "LOJA",
    "GALERIA"
];
const DEFAULT_ORGANIZATION_CATEGORY = "EVENTOS";
const DEFAULT_ORGANIZATION_MODULES = [
    "INSCRICOES"
];
const organizationCategorySet = new Set(ORGANIZATION_CATEGORIES);
const organizationModuleSet = new Set(ORGANIZATION_MODULES);
function parseOrganizationCategory(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toUpperCase();
    if (!normalized) return null;
    return organizationCategorySet.has(normalized) ? normalized : null;
}
function parseOrganizationModules(value) {
    if (!Array.isArray(value)) return null;
    const normalized = [];
    for (const entry of value){
        if (typeof entry !== "string") return null;
        const candidate = entry.trim().toUpperCase();
        if (!candidate) return null;
        if (!organizationModuleSet.has(candidate)) return null;
        if (!normalized.includes(candidate)) {
            normalized.push(candidate);
        }
    }
    return normalized;
}
}),
"[project]/lib/validation/organization.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "becomeOrganizerSchema",
    ()=>becomeOrganizerSchema,
    "isValidIBAN",
    ()=>isValidIBAN,
    "isValidPortugueseNIF",
    ()=>isValidPortugueseNIF,
    "isValidWebsite",
    ()=>isValidWebsite
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-route] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizationCategories.ts [app-route] (ecmascript)");
;
;
function isValidPortugueseNIF(value) {
    const numeric = value.replace(/\D/g, "");
    if (numeric.length !== 9) return false;
    const firstDigit = Number(numeric[0]);
    if (![
        1,
        2,
        3,
        5,
        6,
        8,
        9
    ].includes(firstDigit)) return false;
    const digits = numeric.split("").map((d)=>Number(d));
    const sum = digits.slice(0, 8).reduce((acc, digit, idx)=>acc + digit * (9 - idx), 0);
    const modulo11 = sum % 11;
    const checkDigit = modulo11 < 2 ? 0 : 11 - modulo11;
    return checkDigit === digits[8];
}
function isValidIBAN(value) {
    const cleaned = value.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned)) return false;
    if (cleaned.length < 15 || cleaned.length > 34) return false;
    // Move os 4 primeiros caracteres para o fim
    const rearranged = `${cleaned.slice(4)}${cleaned.slice(0, 4)}`;
    // Substitui letras por números (A=10 ... Z=35)
    const numericRepresentation = rearranged.split("").map((char)=>/[A-Z]/.test(char) ? (char.charCodeAt(0) - 55).toString() : char).join("");
    // Calcula mod 97 com BigInt para evitar overflow
    let remainder = 0n;
    for(let i = 0; i < numericRepresentation.length; i += 1){
        const digit = BigInt(numericRepresentation[i] ?? "0");
        remainder = (remainder * 10n + digit) % 97n;
    }
    return remainder === 1n;
}
function isValidWebsite(value) {
    const trimmed = value.trim();
    if (!trimmed) return true;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const url = new URL(normalized);
        return Boolean(url.hostname);
    } catch  {
        return false;
    }
}
const optionalTrimmedString = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].union([
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].undefined(),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].null()
]).transform((v)=>(v ?? "").trim());
const moduleKeys = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ORGANIZATION_MODULES"];
const becomeOrganizerSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    organizationCategory: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().trim().min(1, "Escolhe a categoria principal.").refine((value)=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ORGANIZATION_CATEGORIES"].includes(value), {
        message: "Categoria inválida."
    }),
    modules: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum(moduleKeys)).default([]),
    entityType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().trim().min(1, "Escolhe o tipo de entidade."),
    businessName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().trim().min(1, "Indica o nome da tua organização."),
    city: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().trim().min(1, "Escolhe a cidade base."),
    username: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().trim().min(1, "O username é obrigatório.").max(30, "Máximo 30 caracteres."),
    website: optionalTrimmedString.refine((value)=>value === "" || isValidWebsite(value), {
        message: "Website inválido. Usa um URL válido (ex: https://orya.pt)."
    }),
    iban: optionalTrimmedString.refine((value)=>value === "" || isValidIBAN(value), {
        message: "IBAN inválido. Verifica os dados do teu banco."
    }),
    taxId: optionalTrimmedString.refine((value)=>value === "" || isValidPortugueseNIF(value), {
        message: "NIF inválido. Verifica se tem 9 dígitos e está correto."
    })
});
}),
"[project]/app/api/organizador/me/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "PATCH",
    ()=>PATCH
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/platformSettings.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$phone$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/phone.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerContext.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validation$2f$organization$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/validation/organization.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$resend$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/resend/dist/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizationCategories.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
;
;
;
;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resendClient = resendApiKey ? new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$resend$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Resend"](resendApiKey) : null;
async function GET(req) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!user || error) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "Não autenticado.",
                profile: null,
                organizer: null
            }, {
                status: 401
            });
        }
        const profile = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.findUnique({
            where: {
                id: user.id
            }
        });
        if (!profile) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "Perfil não encontrado.",
                profile: null,
                organizer: null
            }, {
                status: 404
            });
        }
        const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        const cookieOrgId = cookieStore.get("orya_org")?.value;
        const urlOrg = req.nextUrl.searchParams.get("org");
        const forcedOrgId = urlOrg ? Number(urlOrg) : cookieOrgId ? Number(cookieOrgId) : undefined;
        const { organizer, membership } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getActiveOrganizerForUser"])(profile.id, {
            organizerId: Number.isFinite(forcedOrgId) ? forcedOrgId : undefined
        });
        const [platformFees, orgTransferEnabled, organizerModules] = await Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getPlatformFees"])(),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$platformSettings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getOrgTransferEnabled"])(),
            organizer ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizationModuleEntry.findMany({
                where: {
                    organizerId: organizer.id,
                    enabled: true
                },
                select: {
                    moduleKey: true
                },
                orderBy: {
                    moduleKey: "asc"
                }
            }) : Promise.resolve([])
        ]);
        const profilePayload = {
            id: profile.id,
            username: profile.username,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            bio: profile.bio,
            city: profile.city,
            favouriteCategories: profile.favouriteCategories,
            onboardingDone: profile.onboardingDone,
            roles: profile.roles
        };
        const profileRoles = profile.roles || [];
        const isAdmin = profileRoles.some((r)=>r?.toLowerCase() === "admin");
        const organizerPayload = organizer ? {
            id: organizer.id,
            username: organizer.username,
            stripeAccountId: organizer.stripeAccountId,
            status: organizer.status,
            stripeChargesEnabled: organizer.stripeChargesEnabled,
            stripePayoutsEnabled: organizer.stripePayoutsEnabled,
            feeMode: organizer.feeMode,
            platformFeeBps: organizer.platformFeeBps,
            platformFeeFixedCents: organizer.platformFeeFixedCents,
            businessName: organizer.businessName,
            entityType: organizer.entityType,
            city: organizer.city,
            payoutIban: organizer.payoutIban,
            language: organizer.language ?? "pt",
            publicListingEnabled: organizer.publicListingEnabled ?? true,
            alertsEmail: organizer.alertsEmail ?? null,
            alertsSalesEnabled: organizer.alertsSalesEnabled ?? true,
            alertsPayoutEnabled: organizer.alertsPayoutEnabled ?? false,
            officialEmail: organizer.officialEmail ?? null,
            officialEmailVerifiedAt: organizer.officialEmailVerifiedAt ?? null,
            brandingAvatarUrl: organizer.brandingAvatarUrl ?? null,
            brandingCoverUrl: organizer.brandingCoverUrl ?? null,
            brandingPrimaryColor: organizer.brandingPrimaryColor ?? null,
            brandingSecondaryColor: organizer.brandingSecondaryColor ?? null,
            organizationKind: organizer.organizationKind ?? "PESSOA_SINGULAR",
            organizationCategory: organizer.organizationCategory ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_ORGANIZATION_CATEGORY"],
            modules: organizerModules.map((module)=>module.moduleKey),
            liveHubPremiumEnabled: organizer.liveHubPremiumEnabled,
            publicName: organizer.publicName,
            address: organizer.address ?? null,
            showAddressPublicly: organizer.showAddressPublicly ?? false,
            publicWebsite: organizer.publicWebsite ?? null,
            publicInstagram: organizer.publicInstagram ?? null,
            publicYoutube: organizer.publicYoutube ?? null,
            publicDescription: organizer.publicDescription ?? null,
            publicHours: organizer.publicHours ?? null,
            infoRules: organizer.infoRules ?? null,
            infoFaq: organizer.infoFaq ?? null,
            infoRequirements: organizer.infoRequirements ?? null,
            infoPolicies: organizer.infoPolicies ?? null,
            infoLocationNotes: organizer.infoLocationNotes ?? null,
            padelDefaults: {
                shortName: organizer.padelDefaultShortName ?? null,
                city: organizer.padelDefaultCity ?? null,
                address: organizer.padelDefaultAddress ?? null,
                courts: organizer.padelDefaultCourts ?? 0,
                hours: organizer.padelDefaultHours ?? null,
                ruleSetId: organizer.padelDefaultRuleSetId ?? null,
                favoriteCategories: organizer.padelFavoriteCategories ?? []
            }
        } : null;
        const profileStatus = organizer && organizer.businessName && organizer.entityType && organizer.city && user.email ? "OK" : "MISSING_CONTACT";
        const lowerName = (organizer?.publicName ?? organizer?.username ?? "").toLowerCase();
        const isPlatformAccount = isAdmin || organizer?.payoutMode === "PLATFORM" || organizer?.organizationKind === "EMPRESA_MARCA" || lowerName === "orya" || lowerName.startsWith("orya ");
        const paymentsStatus = organizer ? isPlatformAccount ? "READY" : organizer.stripeAccountId ? organizer.stripeChargesEnabled && organizer.stripePayoutsEnabled ? "READY" : "PENDING" : "NO_STRIPE" : "NO_STRIPE";
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            profile: profilePayload,
            organizer: organizerPayload,
            platformFees,
            orgTransferEnabled,
            contactEmail: user.email,
            profileStatus,
            paymentsStatus,
            paymentsMode: isPlatformAccount ? "PLATFORM" : "CONNECT",
            membershipRole: membership?.role ?? null
        }, {
            status: 200
        });
    } catch (err) {
        console.error("GET /api/organizador/me error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "Erro interno.",
            profile: null,
            organizer: null
        }, {
            status: 500
        });
    }
}
async function PATCH(req) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!user || error) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "Não autenticado."
            }, {
                status: 401
            });
        }
        const body = await req.json().catch(()=>null);
        if (!body) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "Payload inválido."
            }, {
                status: 400
            });
        }
        const { businessName, entityType, city, payoutIban, fullName, contactPhone, language, publicListingEnabled, alertsEmail, alertsSalesEnabled, alertsPayoutEnabled, brandingAvatarUrl, brandingCoverUrl, brandingPrimaryColor, brandingSecondaryColor, organizationKind, publicName, publicWebsite, publicInstagram, publicYoutube, publicDescription, publicHours, infoRules, infoFaq, infoRequirements, infoPolicies, infoLocationNotes, address, showAddressPublicly, padelDefaultShortName, padelDefaultCity, padelDefaultAddress, padelDefaultCourts, padelDefaultHours, padelDefaultRuleSetId, padelFavoriteCategories } = body;
        const organizationCategoryRaw = body.organizationCategory;
        const modulesRaw = body.modules;
        const organizationCategoryProvided = Object.prototype.hasOwnProperty.call(body, "organizationCategory");
        const modulesProvided = Object.prototype.hasOwnProperty.call(body, "modules");
        const premiumProvided = Object.prototype.hasOwnProperty.call(body, "liveHubPremiumEnabled");
        const organizationCategory = organizationCategoryProvided ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseOrganizationCategory"])(organizationCategoryRaw) : null;
        if (organizationCategoryProvided && !organizationCategory) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "organizationCategory inválido. Usa EVENTOS, PADEL ou VOLUNTARIADO."
            }, {
                status: 400
            });
        }
        const parsedModules = modulesProvided ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseOrganizationModules"])(modulesRaw) : null;
        if (modulesProvided && parsedModules === null) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "modules inválido. Usa uma lista de módulos válidos (ex.: INSCRICOES)."
            }, {
                status: 400
            });
        }
        if (premiumProvided) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "O premium é gerido automaticamente pela subscrição."
            }, {
                status: 400
            });
        }
        // Validação de telefone (opcional, mas consistente com checkout)
        if (typeof contactPhone === "string" && contactPhone.trim()) {
            const phoneRaw = contactPhone.trim();
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$phone$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isValidPhone"])(phoneRaw)) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: "Telefone inválido. Usa um número real (podes incluir indicativo, ex.: +351...)."
                }, {
                    status: 400
                });
            }
        }
        const { organizer, membership } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getActiveOrganizerForUser"])(user.id, {
            roles: [
                "OWNER",
                "CO_OWNER",
                "ADMIN"
            ]
        });
        if (!organizer) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "Ainda não és organizador."
            }, {
                status: 403
            });
        }
        if (!membership || membership.role !== "OWNER") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "Apenas o Owner pode alterar estas definições."
            }, {
                status: 403
            });
        }
        if (organizationCategoryProvided && organizationCategory) {
            const existingCategory = organizer.organizationCategory ?? null;
            if (existingCategory && existingCategory !== organizationCategory) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: "A categoria da organização é fixa e não pode ser alterada."
                }, {
                    status: 400
                });
            }
        }
        const profileUpdates = {};
        if (typeof fullName === "string") profileUpdates.fullName = fullName.trim() || null;
        if (typeof city === "string") profileUpdates.city = city.trim() || null;
        if (typeof contactPhone === "string") profileUpdates.contactPhone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$phone$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["normalizePhone"])(contactPhone.trim()) || null;
        if (typeof alertsEmail === "string" && alertsEmail.trim()) {
            const email = alertsEmail.trim();
            const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
            if (!emailRegex.test(email)) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: "Email de alertas inválido."
                }, {
                    status: 400
                });
            }
        }
        const organizerUpdates = {};
        const businessNameClean = typeof businessName === "string" ? businessName.trim() : undefined;
        const publicNameInput = typeof publicName === "string" ? publicName.trim() : undefined;
        const addressInput = typeof address === "string" ? address.trim() : undefined;
        const showAddressPubliclyInput = typeof showAddressPublicly === "boolean" ? showAddressPublicly : undefined;
        const normalizeSocialLink = (value, kind)=>{
            const trimmed = value.trim();
            if (!trimmed) return {
                value: null
            };
            let normalized = trimmed;
            if (trimmed.startsWith("@")) {
                normalized = kind === "instagram" ? `https://instagram.com/${trimmed.slice(1)}` : `https://youtube.com/@${trimmed.slice(1)}`;
            } else if (!/^https?:\/\//i.test(trimmed)) {
                normalized = `https://${trimmed}`;
            }
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validation$2f$organization$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isValidWebsite"])(normalized)) {
                return {
                    error: `${kind === "instagram" ? "Instagram" : "YouTube"} inválido. Usa um URL válido.`
                };
            }
            return {
                value: normalized
            };
        };
        if (businessNameClean !== undefined) organizerUpdates.businessName = businessNameClean || null;
        if (publicNameInput !== undefined) {
            const fallbackPublic = businessNameClean ?? organizer.businessName ?? organizer.publicName ?? null;
            organizerUpdates.publicName = publicNameInput || fallbackPublic || null;
        }
        if (addressInput !== undefined) organizerUpdates.address = addressInput || null;
        if (showAddressPubliclyInput !== undefined) organizerUpdates.showAddressPublicly = showAddressPubliclyInput;
        if (typeof publicWebsite === "string") {
            const trimmed = publicWebsite.trim();
            if (!trimmed) {
                organizerUpdates.publicWebsite = null;
            } else {
                const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
                if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validation$2f$organization$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isValidWebsite"])(normalized)) {
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        ok: false,
                        error: "Website inválido. Usa um URL válido (ex: https://orya.pt)."
                    }, {
                        status: 400
                    });
                }
                organizerUpdates.publicWebsite = normalized;
            }
        }
        if (typeof publicInstagram === "string") {
            const normalized = normalizeSocialLink(publicInstagram, "instagram");
            if (normalized.error) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: normalized.error
                }, {
                    status: 400
                });
            }
            organizerUpdates.publicInstagram = normalized.value;
        }
        if (typeof publicYoutube === "string") {
            const normalized = normalizeSocialLink(publicYoutube, "youtube");
            if (normalized.error) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: normalized.error
                }, {
                    status: 400
                });
            }
            organizerUpdates.publicYoutube = normalized.value;
        }
        if (typeof publicDescription === "string") {
            organizerUpdates.publicDescription = publicDescription.trim() || null;
        }
        if (typeof publicHours === "string") {
            organizerUpdates.publicHours = publicHours.trim() || null;
        }
        if (typeof infoRules === "string") {
            organizerUpdates.infoRules = infoRules.trim() || null;
        }
        if (typeof infoFaq === "string") {
            organizerUpdates.infoFaq = infoFaq.trim() || null;
        }
        if (typeof infoRequirements === "string") {
            organizerUpdates.infoRequirements = infoRequirements.trim() || null;
        }
        if (typeof infoPolicies === "string") {
            organizerUpdates.infoPolicies = infoPolicies.trim() || null;
        }
        if (typeof infoLocationNotes === "string") {
            organizerUpdates.infoLocationNotes = infoLocationNotes.trim() || null;
        }
        if (typeof entityType === "string") organizerUpdates.entityType = entityType.trim() || null;
        if (typeof city === "string") organizerUpdates.city = city.trim() || null;
        if (typeof payoutIban === "string") organizerUpdates.payoutIban = payoutIban.trim() || null;
        if (typeof language === "string") {
            const lang = language.toLowerCase();
            organizerUpdates.language = lang === "en" ? "en" : "pt";
        }
        if (typeof publicListingEnabled === "boolean") organizerUpdates.publicListingEnabled = publicListingEnabled;
        if (typeof alertsEmail === "string") organizerUpdates.alertsEmail = alertsEmail.trim() || null;
        if (typeof alertsSalesEnabled === "boolean") organizerUpdates.alertsSalesEnabled = alertsSalesEnabled;
        if (typeof alertsPayoutEnabled === "boolean") organizerUpdates.alertsPayoutEnabled = alertsPayoutEnabled;
        if (brandingAvatarUrl === null) organizerUpdates.brandingAvatarUrl = null;
        if (typeof brandingAvatarUrl === "string") organizerUpdates.brandingAvatarUrl = brandingAvatarUrl.trim() || null;
        if (brandingCoverUrl === null) organizerUpdates.brandingCoverUrl = null;
        if (typeof brandingCoverUrl === "string") organizerUpdates.brandingCoverUrl = brandingCoverUrl.trim() || null;
        if (typeof brandingPrimaryColor === "string") organizerUpdates.brandingPrimaryColor = brandingPrimaryColor.trim() || null;
        if (typeof brandingSecondaryColor === "string") organizerUpdates.brandingSecondaryColor = brandingSecondaryColor.trim() || null;
        if (organizationCategoryProvided && organizationCategory) {
            organizerUpdates.organizationCategory = organizationCategory;
        }
        if (typeof organizationKind === "string") {
            const kind = organizationKind.toUpperCase();
            const allowed = [
                "CLUBE_PADEL",
                "RESTAURANTE",
                "EMPRESA_EVENTOS",
                "ASSOCIACAO",
                "PESSOA_SINGULAR"
            ];
            if (!allowed.includes(kind)) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: "organizationKind inválido. Usa CLUBE_PADEL, RESTAURANTE, EMPRESA_EVENTOS, ASSOCIACAO ou PESSOA_SINGULAR."
                }, {
                    status: 400
                });
            }
            organizerUpdates.organizationKind = kind;
        }
        if (typeof padelDefaultShortName === "string") {
            organizerUpdates.padelDefaultShortName = padelDefaultShortName.trim() || null;
        }
        if (typeof padelDefaultCity === "string") {
            organizerUpdates.padelDefaultCity = padelDefaultCity.trim() || null;
        }
        if (typeof padelDefaultAddress === "string") {
            organizerUpdates.padelDefaultAddress = padelDefaultAddress.trim() || null;
        }
        if (typeof padelDefaultHours === "string") {
            organizerUpdates.padelDefaultHours = padelDefaultHours.trim() || null;
        }
        if (typeof padelDefaultCourts === "number") {
            organizerUpdates.padelDefaultCourts = Math.max(0, Math.floor(padelDefaultCourts));
        }
        if (typeof padelDefaultRuleSetId === "number" && Number.isFinite(padelDefaultRuleSetId)) {
            organizerUpdates.padelDefaultRuleSetId = padelDefaultRuleSetId;
        }
        if (Array.isArray(padelFavoriteCategories)) {
            const nums = padelFavoriteCategories.map((v)=>typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null).filter((v)=>v !== null);
            organizerUpdates.padelFavoriteCategories = nums;
        }
        if (Object.keys(profileUpdates).length > 0) {
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.update({
                where: {
                    id: user.id
                },
                data: profileUpdates
            });
        }
        if (Object.keys(organizerUpdates).length > 0) {
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizer.update({
                where: {
                    id: organizer.id
                },
                data: organizerUpdates
            });
        }
        if (modulesProvided) {
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizationModuleEntry.deleteMany({
                where: {
                    organizerId: organizer.id
                }
            });
            if (parsedModules && parsedModules.length > 0) {
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizationModuleEntry.createMany({
                    data: parsedModules.map((moduleKey)=>({
                            organizerId: organizer.id,
                            moduleKey,
                            enabled: true
                        }))
                });
            }
        }
        const nextModules = modulesProvided ? parsedModules ?? [] : (await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizationModuleEntry.findMany({
            where: {
                organizerId: organizer.id,
                enabled: true
            },
            select: {
                moduleKey: true
            },
            orderBy: {
                moduleKey: "asc"
            }
        })).map((module)=>module.moduleKey);
        const verifiedOfficialEmail = organizer && organizer?.officialEmailVerifiedAt ? organizer.officialEmail ?? null : null;
        const alertsTarget = verifiedOfficialEmail ?? (typeof alertsEmail === "string" && alertsEmail.trim().length > 0 ? alertsEmail.trim() : organizer.alertsEmail);
        const alertsSales = typeof alertsSalesEnabled === "boolean" ? alertsSalesEnabled : organizer.alertsSalesEnabled;
        if (alertsTarget && alertsSales && resendClient && resendFromEmail) {
            try {
                await resendClient.emails.send({
                    from: resendFromEmail,
                    to: alertsTarget,
                    subject: "Alertas de vendas ORYA ativados",
                    text: "Passaste a receber alertas de vendas nesta caixa de email. Se não foste tu, desativa nas definições do organizador."
                });
            } catch (emailErr) {
                console.warn("[alerts] falha ao enviar email de alerta", emailErr);
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            organizer: {
                organizationCategory: organizationCategory ?? organizer.organizationCategory ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_ORGANIZATION_CATEGORY"],
                modules: nextModules
            }
        }, {
            status: 200
        });
    } catch (err) {
        console.error("PATCH /api/organizador/me error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "Erro interno."
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__f4fd06d0._.js.map