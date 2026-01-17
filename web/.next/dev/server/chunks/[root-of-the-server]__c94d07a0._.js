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
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

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
"[project]/domain/tournaments/generation.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "generateAndPersistTournamentStructure",
    ()=>generateAndPersistTournamentStructure,
    "generateDrawAB",
    ()=>generateDrawAB,
    "generateRoundRobin",
    ()=>generateRoundRobin,
    "generateSingleElimination",
    ()=>generateSingleElimination,
    "getConfirmedPairings",
    ()=>getConfirmedPairings
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$seedrandom$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/seedrandom/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
function generateRoundRobin(pairings, seed) {
    const rng = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$seedrandom$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(seed || `${Date.now()}`);
    const players = [
        ...pairings
    ];
    if (players.length % 2 !== 0) players.push(-1); // bye = -1
    const n = players.length;
    const rounds = [];
    const arr = [
        ...players
    ];
    for(let round = 0; round < n - 1; round += 1){
        const matches = [];
        for(let i = 0; i < n / 2; i += 1){
            const home = arr[i];
            const away = arr[n - 1 - i];
            if (home !== -1 && away !== -1) {
                // shuffle home/away to vary
                const swap = rng() > 0.5;
                matches.push({
                    a: swap ? away : home,
                    b: swap ? home : away
                });
            }
        }
        rounds.push(matches);
        // rotate array except first element
        const fixed = arr[0];
        const rest = arr.slice(1);
        rest.unshift(rest.pop());
        arr.splice(0, arr.length, fixed, ...rest);
    }
    return rounds;
}
function nextPowerOfTwo(value) {
    let size = 1;
    while(size < value)size *= 2;
    return size;
}
function resolveBracketSize(total, targetSize) {
    if (targetSize === null || typeof targetSize === "undefined") {
        return nextPowerOfTwo(Math.max(1, total));
    }
    const size = Math.trunc(targetSize);
    if (!Number.isFinite(size) || size <= 0) {
        throw new Error("INVALID_BRACKET_SIZE");
    }
    if ((size & size - 1) !== 0) {
        throw new Error("INVALID_BRACKET_SIZE");
    }
    if (total > size) {
        throw new Error("BRACKET_TOO_SMALL");
    }
    return size;
}
function generateSingleElimination(pairings, seed, targetSize, preserveOrder) {
    const rng = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$seedrandom$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(seed || `${Date.now()}`);
    const ordered = preserveOrder ? [
        ...pairings
    ] : [
        ...pairings
    ].sort(()=>rng() > 0.5 ? 1 : -1);
    const size = resolveBracketSize(ordered.length || 1, targetSize);
    while(ordered.length < size)ordered.push(undefined);
    const rounds = [];
    let current = ordered;
    while(current.length > 1){
        const matches = [];
        for(let i = 0; i < current.length; i += 2){
            const a = current[i];
            const b = current[i + 1];
            matches.push({
                a,
                b
            });
        }
        rounds.push(matches);
        current = matches.map((_m, idx)=>idx); // placeholders for next round seeds
    }
    return rounds;
}
function generateDrawAB(pairings, seed, targetSize, preserveOrder) {
    // main bracket normal; consolation fed by losers (handled by engine later)
    const main = generateSingleElimination(pairings, seed, targetSize, preserveOrder);
    const consolation = [];
    return {
        main,
        consolation
    };
}
const CONFIRMED_PAIRING_STATUSES = [
    "CONFIRMED_BOTH_PAID",
    "CONFIRMED_CAPTAIN_FULL"
];
async function getConfirmedPairings(eventId) {
    const pairings = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairing.findMany({
        where: {
            eventId,
            lifecycleStatus: {
                in: CONFIRMED_PAIRING_STATUSES
            }
        },
        select: {
            id: true
        },
        orderBy: {
            id: "asc"
        }
    });
    return pairings.map((p)=>p.id);
}
async function generateAndPersistTournamentStructure(opts) {
    const { tournamentId, format, pairings, seed, inscriptionDeadlineAt, forceGenerate, userId, targetSize, preserveOrder } = opts;
    const rngSeed = seed || `${Date.now()}`;
    const participantCount = pairings.filter((id)=>typeof id === "number").length;
    const hasParticipants = participantCount > 0;
    const confirmed = preserveOrder ? pairings : pairings.filter((id)=>typeof id === "number");
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].$transaction(async (tx)=>{
        // Deadline: se ainda não passou e não foi forçado, bloqueia
        if (inscriptionDeadlineAt && new Date() < new Date(inscriptionDeadlineAt) && !forceGenerate) {
            throw new Error("INSCRIPTION_NOT_CLOSED");
        }
        const started = await tx.tournamentMatch.count({
            where: {
                stage: {
                    tournamentId
                },
                status: {
                    in: [
                        "IN_PROGRESS",
                        "DONE",
                        "SCHEDULED"
                    ]
                }
            }
        });
        if (started > 0 && !forceGenerate) throw new Error("TOURNAMENT_ALREADY_STARTED");
        await tx.tournamentMatch.deleteMany({
            where: {
                stage: {
                    tournamentId
                }
            }
        });
        await tx.tournamentGroup.deleteMany({
            where: {
                stage: {
                    tournamentId
                }
            }
        });
        await tx.tournamentStage.deleteMany({
            where: {
                tournamentId
            }
        });
        if (!hasParticipants) return {
            stagesCreated: 0,
            matchesCreated: 0,
            seed: rngSeed
        };
        let stagesCreated = 0;
        let matchesCreated = 0;
        const createRoundRobin = async (stageName, groupName, order)=>{
            const stage = await tx.tournamentStage.create({
                data: {
                    tournamentId,
                    name: stageName,
                    stageType: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentStageType"].GROUPS,
                    order
                }
            });
            stagesCreated += 1;
            const group = await tx.tournamentGroup.create({
                data: {
                    stageId: stage.id,
                    name: groupName,
                    order: 1
                }
            });
            const rr = generateRoundRobin(confirmed, rngSeed);
            for(let r = 0; r < rr.length; r += 1){
                for (const m of rr[r]){
                    await tx.tournamentMatch.create({
                        data: {
                            stageId: stage.id,
                            groupId: group.id,
                            pairing1Id: m.a,
                            pairing2Id: m.b,
                            round: r + 1,
                            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].PENDING
                        }
                    });
                    matchesCreated += 1;
                }
            }
        };
        const createBracket = async (stageName, bracket, order)=>{
            const stage = await tx.tournamentStage.create({
                data: {
                    tournamentId,
                    name: stageName,
                    stageType: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentStageType"].PLAYOFF,
                    order
                }
            });
            stagesCreated += 1;
            const roundMatchIds = [];
            for(let r = 0; r < bracket.length; r += 1){
                const roundIds = [];
                for (const m of bracket[r]){
                    const created = await tx.tournamentMatch.create({
                        data: {
                            stageId: stage.id,
                            pairing1Id: m.a,
                            pairing2Id: m.b,
                            round: r + 1,
                            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].PENDING
                        }
                    });
                    roundIds.push(created.id);
                    matchesCreated += 1;
                }
                roundMatchIds.push(roundIds);
            }
            for(let r = 0; r < roundMatchIds.length - 1; r += 1){
                const currentRound = roundMatchIds[r];
                const nextRound = roundMatchIds[r + 1];
                for(let i = 0; i < currentRound.length; i += 1){
                    const nextMatchId = nextRound[Math.floor(i / 2)];
                    const nextSlot = i % 2 === 0 ? 1 : 2;
                    await tx.tournamentMatch.update({
                        where: {
                            id: currentRound[i]
                        },
                        data: {
                            nextMatchId,
                            nextSlot
                        }
                    });
                }
            }
            return stage.id;
        };
        const createClassificationFromBracket = async (sourceBracket, order)=>{
            const stage = await tx.tournamentStage.create({
                data: {
                    tournamentId,
                    name: "Classificação",
                    stageType: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentStageType"].CONSOLATION,
                    order
                }
            });
            stagesCreated += 1;
            // Cria jogos de classificação por round (exceto final), placeholders a preencher após resultados
            for(let r = 0; r < sourceBracket.length; r += 1){
                const matchesInRound = sourceBracket[r];
                if (matchesInRound.length < 2) continue;
                const classificationCount = Math.floor(matchesInRound.length / 2);
                for(let i = 0; i < classificationCount; i += 1){
                    await tx.tournamentMatch.create({
                        data: {
                            stageId: stage.id,
                            round: r + 1,
                            roundLabel: `Classificação R${r + 1}`,
                            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].PENDING
                        }
                    });
                    matchesCreated += 1;
                }
            }
        };
        // Consolation placeholder: cria stage e matches entre perdedores de primeira ronda
        const createConsolationFromBracket = async (sourceStageId, order)=>{
            const stage = await tx.tournamentStage.create({
                data: {
                    tournamentId,
                    name: "Consolação",
                    stageType: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentStageType"].CONSOLATION,
                    order
                }
            });
            stagesCreated += 1;
            // Busca jogos da primeira ronda do stage fonte
            const firstRound = await tx.tournamentMatch.findMany({
                where: {
                    stageId: sourceStageId,
                    round: 1
                },
                orderBy: {
                    id: "asc"
                }
            });
            // Pares de derrotados (placeholder: pairing1/2 losers → um jogo)
            let roundNum = 1;
            for(let i = 0; i < firstRound.length; i += 2){
                const m1 = firstRound[i];
                const m2 = firstRound[i + 1];
                if (!m1 || !m2) continue;
                await tx.tournamentMatch.create({
                    data: {
                        stageId: stage.id,
                        pairing1Id: m1.pairing1Id ?? m1.pairing2Id ?? null,
                        pairing2Id: m2.pairing1Id ?? m2.pairing2Id ?? null,
                        round: roundNum,
                        status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].PENDING
                    }
                });
                matchesCreated += 1;
                roundNum += 1;
            }
        };
        if (format === "GROUPS_PLUS_PLAYOFF" || format === "CHAMPIONSHIP_ROUND_ROBIN" || format === "NONSTOP_ROUND_ROBIN") {
            await createRoundRobin("Fase de Grupos", "Grupo Único", 1);
            if (format === "GROUPS_PLUS_PLAYOFF" && participantCount > 2) {
                const bracket = generateSingleElimination(confirmed, rngSeed, targetSize, preserveOrder);
                const playoffStageId = await createBracket("Playoff", bracket, 2);
                // Consolação automática dos derrotados da ronda 1
                await createConsolationFromBracket(playoffStageId, 3);
            }
        } else if (format === "DRAW_A_B") {
            const bracket = generateSingleElimination(confirmed, rngSeed, targetSize, preserveOrder);
            const mainStageId = await createBracket("Quadro Principal", bracket, 1);
            // Consolação (Quadro B) a partir dos derrotados da ronda 1
            await createConsolationFromBracket(mainStageId, 2);
        } else if (format === "GROUPS_PLUS_FINALS_ALL_PLACES") {
            await createRoundRobin("Fase de Grupos", "Grupo Único", 1);
            const finalsBracket = generateSingleElimination(confirmed, rngSeed, targetSize, preserveOrder);
            await createBracket("Finais por posições", finalsBracket, 2);
            await createClassificationFromBracket(finalsBracket, 3);
        } else if (format === "MANUAL") {
            await tx.tournamentStage.create({
                data: {
                    tournamentId,
                    name: "Manual",
                    stageType: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentStageType"].PLAYOFF,
                    order: 1
                }
            });
            stagesCreated += 1;
        }
        await tx.tournament.update({
            where: {
                id: tournamentId
            },
            data: {
                generationSeed: rngSeed,
                updatedAt: new Date(),
                generatedAt: new Date(),
                generatedByUserId: userId || null
            }
        });
        // Audit log da geração
        if (userId) {
            await tx.tournamentAuditLog.create({
                data: {
                    tournamentId,
                    userId,
                    action: "GENERATE_BRACKET",
                    payloadBefore: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["Prisma"].DbNull,
                    payloadAfter: {
                        format,
                        seed: rngSeed,
                        pairings: confirmed
                    }
                }
            });
        }
        return {
            stagesCreated,
            matchesCreated,
            seed: rngSeed
        };
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/api/organizador/tournaments/[id]/generate/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$generation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/generation.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$generation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$generation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
async function isOrganizerUser(userId, organizerId) {
    const member = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findFirst({
        where: {
            organizerId,
            userId,
            role: {
                in: [
                    "OWNER",
                    "CO_OWNER",
                    "ADMIN"
                ]
            }
        },
        select: {
            id: true
        }
    });
    return Boolean(member);
}
async function POST(req, { params }) {
    const resolved = await params;
    const id = Number(resolved?.id);
    if (!Number.isFinite(id)) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "INVALID_ID"
    }, {
        status: 400
    });
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "UNAUTHENTICATED"
    }, {
        status: 401
    });
    const tournament = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].tournament.findUnique({
        where: {
            id
        },
        include: {
            event: {
                select: {
                    organizerId: true
                }
            }
        }
    });
    if (!tournament) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "NOT_FOUND"
    }, {
        status: 404
    });
    if (!tournament.event.organizerId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "NO_ORGANIZER"
        }, {
            status: 400
        });
    }
    const authorized = await isOrganizerUser(data.user.id, tournament.event.organizerId);
    if (!authorized) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "FORBIDDEN"
    }, {
        status: 403
    });
    const body = await req.json().catch(()=>({}));
    const format = body?.format ?? tournament.format;
    const seed = typeof body?.seed === "string" ? body.seed : null;
    const forceGenerate = body?.forceGenerate === true;
    const source = typeof body?.source === "string" ? body.source : null;
    const bracketSize = Number.isFinite(body?.bracketSize) ? Number(body.bracketSize) : null;
    const config = tournament.config ?? {};
    const manualParticipants = Array.isArray(config.manualParticipants) ? config.manualParticipants : [];
    const manualEntries = manualParticipants.map((p)=>{
        const id = Number.isFinite(p.id) ? Number(p.id) : null;
        const seed = Number.isFinite(p.seed) ? Number(p.seed) : null;
        return {
            id,
            seed
        };
    }).filter((p)=>typeof p.id === "number" && p.id >= -2147483648 && p.id <= 2147483647);
    const manualIds = manualEntries.map((p)=>p.id);
    const configBracketSize = Number.isFinite(config.bracketSize) ? Number(config.bracketSize) : null;
    let pairingIds = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$generation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getConfirmedPairings"])(tournament.eventId);
    const hasManual = manualIds.length > 0;
    let preserveOrder = false;
    if (source === "manual" || hasManual && pairingIds.length === 0) {
        preserveOrder = true;
        const targetSize = bracketSize ?? configBracketSize ?? null;
        if (targetSize && manualIds.length > targetSize) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "BRACKET_TOO_SMALL"
            }, {
                status: 400
            });
        }
        if (targetSize) {
            const slots = Array.from({
                length: targetSize
            }, ()=>null);
            const unseeded = [];
            manualEntries.forEach((entry)=>{
                if (typeof entry.seed === "number" && entry.seed >= 1 && entry.seed <= targetSize) {
                    const idx = entry.seed - 1;
                    if (slots[idx] === null) {
                        slots[idx] = entry.id;
                        return;
                    }
                }
                unseeded.push(entry.id);
            });
            let cursor = 0;
            unseeded.forEach((id)=>{
                while(cursor < slots.length && slots[cursor] !== null)cursor += 1;
                if (cursor < slots.length) {
                    slots[cursor] = id;
                    cursor += 1;
                }
            });
            pairingIds = slots;
        } else {
            pairingIds = manualIds;
        }
    }
    if (source === "manual" && manualIds.length === 0) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "NO_PARTICIPANTS"
        }, {
            status: 400
        });
    }
    try {
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$generation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateAndPersistTournamentStructure"])({
            tournamentId: tournament.id,
            format,
            pairings: pairingIds,
            seed,
            inscriptionDeadlineAt: tournament.inscriptionDeadlineAt,
            forceGenerate,
            userId: data.user.id,
            targetSize: bracketSize ?? configBracketSize ?? null,
            preserveOrder
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            stagesCreated: result.stagesCreated,
            matchesCreated: result.matchesCreated,
            seed: result.seed
        }, {
            status: 200
        });
    } catch (err) {
        if (err instanceof Error && err.message === "TOURNAMENT_ALREADY_STARTED") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "TOURNAMENT_ALREADY_STARTED"
            }, {
                status: 409
            });
        }
        if (err instanceof Error && err.message === "INSCRIPTION_NOT_CLOSED") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "INSCRIPTION_NOT_CLOSED"
            }, {
                status: 409
            });
        }
        if (err instanceof Error && err.message === "INVALID_BRACKET_SIZE") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "INVALID_BRACKET_SIZE"
            }, {
                status: 400
            });
        }
        if (err instanceof Error && err.message === "BRACKET_TOO_SMALL") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: "BRACKET_TOO_SMALL"
            }, {
                status: 400
            });
        }
        console.error("[tournament_generate] erro", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "GENERATION_FAILED"
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__c94d07a0._.js.map