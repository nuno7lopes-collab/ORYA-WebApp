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
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

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
"[project]/lib/padel/eventSnapshot.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "buildPadelEventSnapshot",
    ()=>buildPadelEventSnapshot
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
function buildTimeline(params) {
    const { status, startsAt, endsAt } = params;
    const now = new Date();
    const started = startsAt ? startsAt.getTime() <= now.getTime() : false;
    const finished = status === "FINISHED" || (endsAt ? endsAt.getTime() < now.getTime() : false);
    const cancelled = status === "CANCELLED";
    return [
        {
            key: "signup",
            label: "Inscrições",
            state: status === "PUBLISHED" && !started ? "active" : status === "DRAFT" ? "pending" : "done",
            date: startsAt ? startsAt.toISOString() : null
        },
        {
            key: "games",
            label: "Jogos",
            state: cancelled ? "pending" : started ? finished ? "done" : "active" : "pending",
            date: startsAt ? startsAt.toISOString() : null
        },
        {
            key: "finish",
            label: cancelled ? "Cancelado" : "Terminado",
            state: finished || cancelled ? "done" : "pending",
            cancelled,
            date: endsAt ? endsAt.toISOString() : null
        }
    ];
}
async function buildPadelEventSnapshot(eventId) {
    if (!Number.isFinite(eventId)) return null;
    const event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            id: eventId,
            isDeleted: false
        },
        select: {
            id: true,
            title: true,
            status: true,
            startsAt: true,
            endsAt: true,
            templateType: true,
            locationCity: true,
            locationName: true,
            padelTournamentConfig: {
                select: {
                    numberOfCourts: true,
                    partnerClubIds: true,
                    advancedSettings: true,
                    club: {
                        select: {
                            id: true,
                            name: true,
                            city: true,
                            address: true
                        }
                    }
                }
            }
        }
    });
    if (!event || event.templateType !== "PADEL") return null;
    const config = event.padelTournamentConfig;
    const advanced = config?.advancedSettings || {};
    const partnerIds = config?.partnerClubIds ?? [];
    const partnerClubs = partnerIds.length > 0 ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelClub.findMany({
        where: {
            id: {
                in: partnerIds
            }
        },
        select: {
            id: true,
            name: true,
            city: true
        }
    }) : [];
    const courtsFromClubs = Array.isArray(advanced?.courtsFromClubs) ? (advanced.courtsFromClubs || []).map((c, idx)=>({
            name: c.name || `Court ${idx + 1}`,
            clubName: c.clubName || config?.club?.name || null,
            indoor: c.indoor ?? null
        })) : [];
    const courts = courtsFromClubs.length > 0 ? courtsFromClubs : Array.from({
        length: Math.max(1, config?.numberOfCourts || 1)
    }).map((_, idx)=>({
            name: `Court ${idx + 1}`,
            clubName: config?.club?.name || event.locationName || null,
            indoor: null
        }));
    return {
        eventId: event.id,
        title: event.title,
        status: event.status,
        startsAt: event.startsAt?.toISOString() ?? null,
        endsAt: event.endsAt?.toISOString() ?? null,
        clubName: config?.club?.name || event.locationName || null,
        clubCity: config?.club?.city || event.locationCity || null,
        partnerClubs,
        courts,
        timeline: buildTimeline({
            status: event.status,
            startsAt: event.startsAt,
            endsAt: event.endsAt ?? event.startsAt
        })
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/domain/padelEligibility.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "validateEligibility",
    ()=>validateEligibility
]);
function validateEligibility(eligibilityType, player1Gender, player2Gender) {
    if (eligibilityType === "OPEN") return {
        ok: true
    };
    const p1 = player1Gender ?? null;
    const p2 = player2Gender ?? null;
    if (!p1) return {
        ok: false,
        code: "GENDER_REQUIRED_FOR_TOURNAMENT"
    };
    if (eligibilityType === "MALE_ONLY") {
        return p1 === "MALE" && (!p2 || p2 === "MALE") ? {
            ok: true
        } : {
            ok: false,
            code: "INELIGIBLE_FOR_TOURNAMENT"
        };
    }
    if (eligibilityType === "FEMALE_ONLY") {
        return p1 === "FEMALE" && (!p2 || p2 === "FEMALE") ? {
            ok: true
        } : {
            ok: false,
            code: "INELIGIBLE_FOR_TOURNAMENT"
        };
    }
    // MIXED
    if (!p2) return {
        ok: true
    }; // pode criar/entrar “à procura”; valida no fecho
    const comboOk = p1 === "MALE" && p2 === "FEMALE" || p1 === "FEMALE" && p2 === "MALE";
    return comboOk ? {
        ok: true
    } : {
        ok: false,
        code: "INELIGIBLE_FOR_TOURNAMENT"
    };
}
}),
"[project]/domain/padelPairingHold.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cancelActiveHold",
    ()=>cancelActiveHold,
    "expireHolds",
    ()=>expireHolds,
    "upsertActiveHold",
    ()=>upsertActiveHold
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
;
const DEFAULT_HOLD_MINUTES = 30;
async function upsertActiveHold(tx, params) {
    const { pairingId, eventId, ttlMinutes } = params;
    const minutes = ttlMinutes && ttlMinutes > 0 ? ttlMinutes : DEFAULT_HOLD_MINUTES;
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    // Alguns ambientes perderam o unique constraint, por isso evitamos upsert/ON CONFLICT.
    const updated = await tx.padelPairingHold.updateMany({
        where: {
            pairingId,
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingHoldStatus"].ACTIVE
        },
        data: {
            expiresAt
        }
    });
    if (updated.count === 0) {
        await tx.padelPairingHold.create({
            data: {
                pairingId,
                eventId,
                holds: 2,
                status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingHoldStatus"].ACTIVE,
                expiresAt
            }
        });
    }
    return {
        expiresAt
    };
}
async function cancelActiveHold(tx, pairingId) {
    await tx.padelPairingHold.updateMany({
        where: {
            pairingId,
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingHoldStatus"].ACTIVE
        },
        data: {
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingHoldStatus"].CANCELLED
        }
    });
}
async function expireHolds(tx, now) {
    await tx.padelPairingHold.updateMany({
        where: {
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingHoldStatus"].ACTIVE,
            expiresAt: {
                lt: now
            }
        },
        data: {
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingHoldStatus"].EXPIRED
        }
    });
}
}),
"[project]/domain/padelDeadlines.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clampDeadlineHours",
    ()=>clampDeadlineHours,
    "clampLinkMinutes",
    ()=>clampLinkMinutes,
    "computeDeadlineAt",
    ()=>computeDeadlineAt,
    "computeGraceUntil",
    ()=>computeGraceUntil,
    "computePartnerLinkExpiresAt",
    ()=>computePartnerLinkExpiresAt
]);
const MIN_DEADLINE_HOURS = 48;
const MAX_DEADLINE_HOURS = 168;
const MIN_LINK_MINUTES = 15;
const MAX_LINK_MINUTES = 30;
const DEFAULT_LINK_MINUTES = 30;
const GRACE_HOURS = 24;
function clampDeadlineHours(raw) {
    const base = typeof raw === "number" && !Number.isNaN(raw) ? raw : MIN_DEADLINE_HOURS;
    return Math.min(Math.max(base, MIN_DEADLINE_HOURS), MAX_DEADLINE_HOURS);
}
function computeDeadlineAt(now, splitDeadlineHours) {
    const hours = clampDeadlineHours(splitDeadlineHours);
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
}
function clampLinkMinutes(raw) {
    const base = typeof raw === "number" && !Number.isNaN(raw) ? raw : DEFAULT_LINK_MINUTES;
    return Math.min(Math.max(base, MIN_LINK_MINUTES), MAX_LINK_MINUTES);
}
function computePartnerLinkExpiresAt(now, minutes) {
    const mins = clampLinkMinutes(minutes);
    return new Date(now.getTime() + mins * 60 * 1000);
}
function computeGraceUntil(now) {
    return new Date(now.getTime() + GRACE_HOURS * 60 * 60 * 1000);
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
"[project]/domain/padelCategoryLimit.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "checkPadelCategoryLimit",
    ()=>checkPadelCategoryLimit
]);
async function checkPadelCategoryLimit(params) {
    const { tx, eventId, userId, categoryId, excludePairingId } = params;
    if (!categoryId) return {
        ok: true
    };
    const slots = await tx.padelPairingSlot.findMany({
        where: {
            profileId: userId,
            slotStatus: "FILLED",
            paymentStatus: "PAID",
            pairing: {
                eventId,
                pairingStatus: {
                    not: "CANCELLED"
                },
                lifecycleStatus: {
                    not: "CANCELLED_INCOMPLETE"
                },
                ...excludePairingId ? {
                    id: {
                        not: excludePairingId
                    }
                } : {}
            }
        },
        select: {
            pairing: {
                select: {
                    categoryId: true
                }
            }
        }
    });
    const categories = new Set();
    for (const slot of slots){
        const slotCategory = slot.pairing?.categoryId ?? null;
        if (slotCategory) categories.add(slotCategory);
    }
    if (categories.has(categoryId)) {
        return {
            ok: false,
            code: "ALREADY_IN_CATEGORY"
        };
    }
    if (categories.size >= 2) {
        return {
            ok: false,
            code: "MAX_CATEGORIES"
        };
    }
    return {
        ok: true
    };
}
}),
"[project]/app/api/padel/pairings/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$eventSnapshot$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/padel/eventSnapshot.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelEligibility$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/padelEligibility.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelPairingHold$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/padelPairingHold.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelDeadlines$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/padelDeadlines.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerContext.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/padel/staff.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelCategoryLimit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/padelCategoryLimit.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$eventSnapshot$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$eventSnapshot$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
const runtime = "nodejs";
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
;
;
const allowedRoles = [
    "OWNER",
    "CO_OWNER",
    "ADMIN"
];
async function syncPlayersFromSlots({ organizerId, slots }) {
    const profileIds = Array.from(new Set(slots.map((s)=>s.profileId).filter(Boolean)));
    // 1) Jogadores ligados a perfis existentes
    if (profileIds.length > 0) {
        const profiles = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.findMany({
            where: {
                id: {
                    in: profileIds
                }
            },
            select: {
                id: true,
                fullName: true,
                contactPhone: true
            }
        });
        for (const profile of profiles){
            const exists = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPlayerProfile.findFirst({
                where: {
                    organizerId,
                    userId: profile.id
                },
                select: {
                    id: true
                }
            });
            if (exists) continue;
            const fullName = profile.fullName?.trim() || "Jogador ORYA";
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPlayerProfile.create({
                data: {
                    organizerId,
                    userId: profile.id,
                    fullName,
                    displayName: fullName,
                    phone: profile.contactPhone || undefined,
                    isActive: true
                }
            });
        }
    }
    // 2) Convites por contacto (email ou telefone)
    const invitedContacts = Array.from(new Set(slots.map((s)=>s.invitedContact?.trim()).filter(Boolean)));
    for (const contact of invitedContacts){
        const isEmail = contact.includes("@");
        const email = isEmail ? contact.toLowerCase() : null;
        const phone = !isEmail ? contact : null;
        if (email) {
            const exists = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPlayerProfile.findFirst({
                where: {
                    organizerId,
                    email
                },
                select: {
                    id: true
                }
            });
            if (exists) continue;
        }
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPlayerProfile.create({
            data: {
                organizerId,
                fullName: contact,
                displayName: contact,
                email: email || undefined,
                phone: phone || undefined,
                isActive: true
            }
        });
    }
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
    const eventId = body && typeof body.eventId === "number" ? body.eventId : Number(body?.eventId);
    const organizerIdRaw = body && typeof body.organizerId === "number" ? body.organizerId : Number(body?.organizerId);
    const categoryId = body && typeof body.categoryId === "number" ? body.categoryId : body?.categoryId === null ? null : Number(body?.categoryId);
    const paymentMode = typeof body?.paymentMode === "string" ? body?.paymentMode : null;
    const pairingJoinModeRaw = typeof body?.pairingJoinMode === "string" ? body?.pairingJoinMode : "INVITE_PARTNER";
    const createdByTicketId = typeof body?.createdByTicketId === "string" ? body?.createdByTicketId : null;
    const inviteToken = typeof body?.inviteToken === "string" ? body?.inviteToken : null;
    const inviteExpiresAt = body?.inviteExpiresAt ? new Date(String(body.inviteExpiresAt)) : null;
    const lockedUntil = body?.lockedUntil ? new Date(String(body.lockedUntil)) : null;
    const isPublicOpen = Boolean(body?.isPublicOpen);
    const invitedContactNormalized = typeof body?.invitedContact === "string" && body.invitedContact.trim().length > 0 ? body.invitedContact.trim() : null;
    if (!eventId || !paymentMode || ![
        "FULL",
        "SPLIT"
    ].includes(paymentMode)) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "INVALID_INPUT"
        }, {
            status: 400
        });
    }
    // Resolver organizer + flag padel v2
    const event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            id: eventId
        },
        select: {
            organizerId: true,
            padelTournamentConfig: {
                select: {
                    padelV2Enabled: true
                }
            }
        }
    });
    if (!event || !event.padelTournamentConfig?.padelV2Enabled) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "EVENT_NOT_PADDEL_V2"
        }, {
            status: 400
        });
    }
    const organizerId = Number.isFinite(organizerIdRaw) && organizerIdRaw ? organizerIdRaw : event.organizerId;
    if (!organizerId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "ORGANIZER_MISSING"
        }, {
            status: 400
        });
    }
    // Basic guard: only proceed if padel_v2_enabled is active on the tournament config.
    const config = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelTournamentConfig.findUnique({
        where: {
            eventId
        },
        select: {
            padelV2Enabled: true,
            organizerId: true,
            eligibilityType: true,
            splitDeadlineHours: true,
            defaultCategoryId: true
        }
    });
    if (!config?.padelV2Enabled || config.organizerId !== organizerId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "PADEL_V2_DISABLED"
        }, {
            status: 400
        });
    }
    const profile = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.findUnique({
        where: {
            id: user.id
        },
        select: {
            gender: true
        }
    });
    const eligibility = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelEligibility$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateEligibility"])(config.eligibilityType ?? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelEligibilityType"].OPEN, profile?.gender, null);
    if (!eligibility.ok) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: eligibility.code
        }, {
            status: eligibility.code === "GENDER_REQUIRED_FOR_TOURNAMENT" ? 403 : 409
        });
    }
    const categoryLinks = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelEventCategoryLink.findMany({
        where: {
            eventId,
            isEnabled: true
        },
        select: {
            id: true,
            padelCategoryId: true
        },
        orderBy: {
            id: "asc"
        }
    });
    let effectiveCategoryId = null;
    if (Number.isFinite(categoryId)) {
        const match = categoryLinks.find((l)=>l.padelCategoryId === categoryId);
        if (!match) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "CATEGORY_NOT_AVAILABLE"
            }, {
                status: 400
            });
        }
        effectiveCategoryId = match.padelCategoryId;
    } else if (categoryLinks.length > 1) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "CATEGORY_REQUIRED"
        }, {
            status: 400
        });
    } else if (categoryLinks.length > 0) {
        effectiveCategoryId = categoryLinks[0].padelCategoryId;
    } else if (config.defaultCategoryId) {
        effectiveCategoryId = config.defaultCategoryId;
    }
    if (!effectiveCategoryId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "CATEGORY_REQUIRED"
        }, {
            status: 400
        });
    }
    // Invariante: 1 pairing ativo por evento+categoria+user
    const existingActive = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairing.findFirst({
        where: {
            eventId,
            lifecycleStatus: {
                not: "CANCELLED_INCOMPLETE"
            },
            categoryId: effectiveCategoryId,
            OR: [
                {
                    player1UserId: user.id
                },
                {
                    player2UserId: user.id
                }
            ]
        },
        include: {
            slots: true
        }
    });
    if (existingActive) {
        const updates = {};
        const slotUpdates = {};
        const partnerSlot = existingActive.slots.find((s)=>s.slot_role === "PARTNER");
        const canUpdatePartner = partnerSlot && !partnerSlot.profileId;
        if (paymentMode && existingActive.payment_mode !== paymentMode) {
            updates.payment_mode = paymentMode;
        }
        if (canUpdatePartner) {
            const joinModeChanged = existingActive.pairingJoinMode !== pairingJoinModeRaw;
            if (joinModeChanged) {
                updates.pairingJoinMode = pairingJoinModeRaw;
            }
            if (pairingJoinModeRaw === "LOOKING_FOR_PARTNER") {
                updates.partnerInviteToken = null;
                updates.partnerLinkToken = null;
                updates.partnerLinkExpiresAt = null;
                updates.partnerInvitedAt = null;
                if (partnerSlot?.invitedContact) {
                    slotUpdates.invitedContact = null;
                }
            } else {
                const now = new Date();
                const inviteExpired = existingActive.partnerLinkExpiresAt && existingActive.partnerLinkExpiresAt.getTime() < now.getTime();
                const shouldResetInvite = !existingActive.partnerInviteToken || existingActive.pairingJoinMode !== "INVITE_PARTNER" || inviteExpired;
                const inviteTokenToUse = shouldResetInvite ? (0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["randomUUID"])() : existingActive.partnerInviteToken;
                if (shouldResetInvite) {
                    updates.partnerInviteToken = inviteTokenToUse;
                    updates.partnerLinkToken = inviteTokenToUse;
                    updates.partnerLinkExpiresAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelDeadlines$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computePartnerLinkExpiresAt"])(now, undefined);
                    updates.partnerInvitedAt = now;
                } else if (!existingActive.partnerLinkExpiresAt) {
                    updates.partnerLinkExpiresAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelDeadlines$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computePartnerLinkExpiresAt"])(now, undefined);
                }
                if (invitedContactNormalized && partnerSlot?.invitedContact !== invitedContactNormalized) {
                    slotUpdates.invitedContact = invitedContactNormalized;
                }
            }
        }
        const shouldUpdate = Object.keys(updates).length > 0 || Object.keys(slotUpdates).length > 0;
        const pairingReturn = shouldUpdate ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairing.update({
            where: {
                id: existingActive.id
            },
            data: {
                ...updates,
                ...Object.keys(slotUpdates).length > 0 && partnerSlot ? {
                    slots: {
                        update: {
                            where: {
                                id: partnerSlot.id
                            },
                            data: slotUpdates
                        }
                    }
                } : {}
            },
            include: {
                slots: true
            }
        }) : existingActive;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelPairingHold$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["upsertActiveHold"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"], {
            pairingId: pairingReturn.id,
            eventId,
            ttlMinutes: 30
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            pairing: pairingReturn
        }, {
            status: 200
        });
    }
    let validatedTicketId = null;
    if (createdByTicketId) {
        const ticket = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].ticket.findUnique({
            where: {
                id: createdByTicketId
            },
            select: {
                id: true,
                eventId: true,
                status: true,
                userId: true,
                ownerUserId: true,
                pairingId: true,
                ticketType: {
                    select: {
                        padelEventCategoryLinkId: true,
                        padelEventCategoryLink: {
                            select: {
                                padelCategoryId: true
                            }
                        }
                    }
                }
            }
        });
        if (!ticket || ticket.eventId !== eventId || ticket.status !== "ACTIVE") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "INVALID_TICKET"
            }, {
                status: 400
            });
        }
        if (ticket.userId !== user.id && ticket.ownerUserId !== user.id) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "FORBIDDEN_TICKET"
            }, {
                status: 403
            });
        }
        if (ticket.pairingId) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "TICKET_ALREADY_USED"
            }, {
                status: 409
            });
        }
        const slotUsingTicket = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairingSlot.findUnique({
            where: {
                ticketId: createdByTicketId
            },
            select: {
                id: true
            }
        });
        if (slotUsingTicket) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "TICKET_ALREADY_USED"
            }, {
                status: 409
            });
        }
        const ticketCategoryId = ticket.ticketType?.padelEventCategoryLink?.padelCategoryId ?? null;
        if (ticketCategoryId && ticketCategoryId !== effectiveCategoryId) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "TICKET_CATEGORY_MISMATCH"
            }, {
                status: 409
            });
        }
        validatedTicketId = ticket.id;
    }
    const normalizeSlot = (slot)=>{
        if (typeof slot !== "object" || slot === null) return null;
        const s = slot;
        const roleRaw = typeof s.slotRole === "string" ? s.slotRole : typeof s.slot_role === "string" ? s.slot_role : "PARTNER";
        const statusRaw = typeof s.slotStatus === "string" ? s.slotStatus : "PENDING";
        const payRaw = typeof s.paymentStatus === "string" ? s.paymentStatus : "UNPAID";
        return {
            ticketId: typeof s.ticketId === "string" ? s.ticketId : null,
            profileId: typeof s.profileId === "string" ? s.profileId : null,
            invitedContact: typeof s.invitedContact === "string" ? s.invitedContact : null,
            isPublicOpen: Boolean(s.isPublicOpen),
            slot_role: roleRaw === "CAPTAIN" ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotRole"].CAPTAIN : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotRole"].PARTNER,
            slotStatus: statusRaw === "FILLED" ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotStatus"].FILLED : statusRaw === "CANCELLED" ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotStatus"].CANCELLED : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotStatus"].PENDING,
            paymentStatus: payRaw === "PAID" ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingPaymentStatus"].PAID : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingPaymentStatus"].UNPAID
        };
    };
    const incomingSlots = Array.isArray(body?.slots) ? body.slots : [];
    const captainPaid = Boolean(validatedTicketId);
    if (captainPaid) {
        const limitCheck = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].$transaction((tx)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelCategoryLimit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["checkPadelCategoryLimit"])({
                tx,
                eventId,
                userId: user.id,
                categoryId: effectiveCategoryId
            }));
        if (!limitCheck.ok) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: limitCheck.code === "ALREADY_IN_CATEGORY" ? "ALREADY_IN_CATEGORY" : "MAX_CATEGORIES"
            }, {
                status: 409
            });
        }
    }
    const slotsToCreate = incomingSlots.length > 0 ? incomingSlots.map((slot)=>normalizeSlot(slot)).filter(Boolean) : [
        {
            ticketId: validatedTicketId,
            profileId: user.id,
            invitedContact: null,
            isPublicOpen,
            slot_role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotRole"].CAPTAIN,
            slotStatus: captainPaid ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotStatus"].FILLED : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotStatus"].PENDING,
            paymentStatus: captainPaid ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingPaymentStatus"].PAID : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingPaymentStatus"].UNPAID
        },
        {
            ticketId: null,
            profileId: null,
            invitedContact: pairingJoinModeRaw === "INVITE_PARTNER" && invitedContactNormalized ? invitedContactNormalized : null,
            isPublicOpen,
            slot_role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotRole"].PARTNER,
            slotStatus: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingSlotStatus"].PENDING,
            paymentStatus: paymentMode === "FULL" && captainPaid ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingPaymentStatus"].PAID : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingPaymentStatus"].UNPAID
        }
    ];
    try {
        const now = new Date();
        const clampedDeadlineHours = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelDeadlines$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["clampDeadlineHours"])(config.splitDeadlineHours ?? undefined);
        const deadlineAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelDeadlines$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computeDeadlineAt"])(now, clampedDeadlineHours);
        const partnerLinkExpiresAtNormalized = inviteExpiresAt && !Number.isNaN(inviteExpiresAt.getTime()) ? inviteExpiresAt : (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelDeadlines$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computePartnerLinkExpiresAt"])(now, undefined);
        const partnerInviteToken = pairingJoinModeRaw === "INVITE_PARTNER" ? inviteToken || (0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["randomUUID"])() : null;
        const initialLifecycleStatus = captainPaid ? paymentMode === "FULL" ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingLifecycleStatus"].CONFIRMED_CAPTAIN_FULL : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingLifecycleStatus"].PENDING_PARTNER_PAYMENT : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingLifecycleStatus"].PENDING_ONE_PAID;
        const pairing = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].$transaction(async (tx)=>{
            const created = await tx.padelPairing.create({
                data: {
                    eventId,
                    organizerId,
                    categoryId: effectiveCategoryId,
                    payment_mode: paymentMode,
                    createdByUserId: user.id,
                    player1UserId: user.id,
                    createdByTicketId: validatedTicketId,
                    partnerInviteToken,
                    partnerLinkToken: partnerInviteToken,
                    partnerLinkExpiresAt: partnerInviteToken ? partnerLinkExpiresAtNormalized : null,
                    partnerInvitedAt: partnerInviteToken ? now : null,
                    partnerSwapAllowedUntilAt: deadlineAt,
                    deadlineAt,
                    guaranteeStatus: paymentMode === "SPLIT" ? "ARMED" : "NONE",
                    lockedUntil,
                    isPublicOpen,
                    pairingJoinMode: pairingJoinModeRaw ?? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["PadelPairingJoinMode"].INVITE_PARTNER,
                    lifecycleStatus: initialLifecycleStatus,
                    slots: {
                        create: slotsToCreate
                    }
                },
                include: {
                    slots: true
                }
            });
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$padelPairingHold$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["upsertActiveHold"])(tx, {
                pairingId: created.id,
                eventId,
                ttlMinutes: 30
            });
            return created;
        });
        // Auto-criar perfis de jogador para o organizador (roster)
        await syncPlayersFromSlots({
            organizerId,
            slots: pairing.slots.map((s)=>({
                    profileId: s.profileId ?? null,
                    invitedContact: s.invitedContact ?? null
                }))
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            pairing
        }, {
            status: 200
        });
    } catch (err) {
        console.error("[padel/pairings][POST]", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "INTERNAL_ERROR"
        }, {
            status: 500
        });
    }
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
    const pairingId = Number(req.nextUrl.searchParams.get("id"));
    const eventId = Number(req.nextUrl.searchParams.get("eventId"));
    if (Number.isFinite(pairingId)) {
        const pairing = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairing.findUnique({
            where: {
                id: pairingId
            },
            include: {
                slots: {
                    include: {
                        playerProfile: true
                    }
                },
                event: {
                    select: {
                        organizerId: true
                    }
                }
            }
        });
        if (!pairing) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "NOT_FOUND"
        }, {
            status: 404
        });
        const isParticipant = pairing.player1UserId === user.id || pairing.player2UserId === user.id || pairing.slots.some((s)=>s.profileId === user.id);
        if (!isParticipant) {
            const { organizer } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getActiveOrganizerForUser"])(user.id, {
                organizerId: pairing.organizerId,
                roles: allowedRoles
            });
            const isStaff = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isPadelStaff"])(user.id, pairing.organizerId, pairing.eventId);
            if (!organizer && !isStaff) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: "FORBIDDEN"
                }, {
                    status: 403
                });
            }
        }
        const ticketTypes = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].ticketType.findMany({
            where: {
                eventId: pairing.eventId,
                status: "ON_SALE",
                ...pairing.categoryId ? {
                    padelEventCategoryLink: {
                        padelCategoryId: pairing.categoryId
                    }
                } : {}
            },
            select: {
                id: true,
                name: true,
                price: true,
                currency: true
            },
            orderBy: {
                price: "asc"
            }
        });
        const padelEvent = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$eventSnapshot$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildPadelEventSnapshot"])(pairing.eventId);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            pairing,
            ticketTypes,
            padelEvent
        }, {
            status: 200
        });
    }
    if (!Number.isFinite(eventId)) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "INVALID_ID"
        }, {
            status: 400
        });
    }
    const event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            id: eventId
        },
        select: {
            organizerId: true
        }
    });
    if (!event?.organizerId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "EVENT_NOT_FOUND"
        }, {
            status: 404
        });
    }
    const { organizer } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getActiveOrganizerForUser"])(user.id, {
        organizerId: event.organizerId,
        roles: allowedRoles
    });
    const isStaff = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$staff$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isPadelStaff"])(user.id, event.organizerId, eventId);
    if (!organizer && !isStaff) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "FORBIDDEN"
        }, {
            status: 403
        });
    }
    const pairings = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairing.findMany({
        where: {
            eventId
        },
        include: {
            slots: {
                include: {
                    playerProfile: true
                }
            }
        },
        orderBy: [
            {
                createdAt: "asc"
            }
        ]
    });
    const mapped = pairings.map(({ payment_mode, partnerInviteToken, slots, ...rest })=>({
            ...rest,
            paymentMode: payment_mode,
            inviteToken: partnerInviteToken,
            slots: slots.map(({ slot_role, ...slotRest })=>({
                    ...slotRest,
                    slotRole: slot_role
                }))
        }));
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: true,
        pairings: mapped
    }, {
        status: 200
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__87e1cbf2._.js.map