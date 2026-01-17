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
"[project]/domain/tournaments/structureData.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "getTournamentStructure",
    ()=>getTournamentStructure
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
async function getTournamentStructure(tournamentId) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].tournament.findUnique({
        where: {
            id: tournamentId
        },
        include: {
            stages: {
                orderBy: {
                    order: "asc"
                },
                include: {
                    groups: {
                        orderBy: {
                            order: "asc"
                        },
                        include: {
                            matches: true
                        }
                    },
                    matches: true
                }
            },
            event: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    startsAt: true,
                    isFree: true
                }
            }
        }
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[project]/domain/tournaments/standings.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeGroupStandings",
    ()=>computeGroupStandings
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$seedrandom$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/seedrandom/index.js [app-route] (ecmascript)");
;
function computeGroupStandings(pairings, matches, rules, seed) {
    const rng = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$seedrandom$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(seed || `${Date.now()}`);
    const map = new Map();
    pairings.forEach((p)=>map.set(p, {
            pairingId: p,
            wins: 0,
            losses: 0,
            setDiff: 0,
            gameDiff: 0,
            headToHead: {}
        }));
    const finished = matches.filter((m)=>m.status === "DONE");
    for (const m of finished){
        const s1 = map.get(m.pairing1Id);
        const s2 = map.get(m.pairing2Id);
        if (!s1 || !s2) continue;
        const sets = m.score?.sets ?? [];
        let aSets = 0;
        let bSets = 0;
        let aGames = 0;
        let bGames = 0;
        for (const set of sets){
            aSets += set.a;
            bSets += set.b;
            aGames += set.a;
            bGames += set.b;
        }
        if (aSets > bSets) {
            s1.wins += 1;
            s2.losses += 1;
            s1.headToHead[m.pairing2Id] = (s1.headToHead[m.pairing2Id] ?? 0) + 1;
        } else if (bSets > aSets) {
            s2.wins += 1;
            s1.losses += 1;
            s2.headToHead[m.pairing1Id] = (s2.headToHead[m.pairing1Id] ?? 0) + 1;
        }
        s1.setDiff += aSets - bSets;
        s2.setDiff += bSets - aSets;
        s1.gameDiff += aGames - bGames;
        s2.gameDiff += bGames - aGames;
    }
    const standings = Array.from(map.values());
    const comparator = (a, b)=>{
        for (const rule of rules){
            if (rule === "WINS") {
                if (a.wins !== b.wins) return b.wins - a.wins;
            } else if (rule === "SET_DIFF") {
                if (a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
            } else if (rule === "GAME_DIFF") {
                if (a.gameDiff !== b.gameDiff) return b.gameDiff - a.gameDiff;
            } else if (rule === "HEAD_TO_HEAD") {
                const aHH = a.headToHead[b.pairingId] ?? 0;
                const bHH = b.headToHead[a.pairingId] ?? 0;
                if (aHH !== bHH) return bHH - aHH;
            } else if (rule === "RANDOM") {
                const r = rng() - 0.5;
                if (r !== 0) return r > 0 ? 1 : -1;
            }
        }
        return 0;
    };
    return standings.sort(comparator);
}
}),
"[project]/domain/tournaments/structure.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeStandingsForGroup",
    ()=>computeStandingsForGroup,
    "summarizeMatchStatus",
    ()=>summarizeMatchStatus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$standings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/standings.ts [app-route] (ecmascript)");
;
function summarizeMatchStatus(status) {
    if (status === "IN_PROGRESS") return "Em jogo";
    if (status === "DONE") return "Terminado";
    if (status === "DISPUTED") return "Em disputa";
    if (status === "SCHEDULED") return "Agendado";
    if (status === "CANCELLED") return "Cancelado";
    return "Pendente";
}
function computeStandingsForGroup(matches, rules, seed) {
    const pairings = Array.from(new Set(matches.flatMap((m)=>[
            m.pairing1Id,
            m.pairing2Id
        ]).filter((v)=>typeof v === "number")));
    if (pairings.length === 0) return [];
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$standings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computeGroupStandings"])(pairings, matches.filter((m)=>m.pairing1Id && m.pairing2Id).map((m)=>({
            pairing1Id: m.pairing1Id,
            pairing2Id: m.pairing2Id,
            status: m.status,
            score: m.score
        })), rules, seed);
}
}),
"[project]/domain/tournaments/matchRules.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "canEditMatch",
    ()=>canEditMatch,
    "getWinnerSideFromScore",
    ()=>getWinnerSideFromScore,
    "validateGoalScore",
    ()=>validateGoalScore,
    "validateScore",
    ()=>validateScore
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
;
const WIN_BY = 2;
const MAX_SETS = 3; // BO3
const MIN_GAMES_TO_WIN = 6;
const TIEBREAK_GAMES = 7;
function isValidSet(set) {
    const a = Number(set.a);
    const b = Number(set.b);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return false;
    const max = Math.max(a, b);
    const diff = Math.abs(a - b);
    // tiebreak 7-6 é aceite
    if (max === TIEBREAK_GAMES && diff === 1) return true;
    if (max >= MIN_GAMES_TO_WIN) return diff >= WIN_BY;
    return false;
}
function validateScore(score) {
    if (!score || !Array.isArray(score.sets) || score.sets.length === 0) {
        return {
            ok: false,
            code: "INVALID_SCORE",
            message: "Score vazio ou inválido."
        };
    }
    if (score.sets.length > MAX_SETS) {
        return {
            ok: false,
            code: "TOO_MANY_SETS",
            message: "Máximo de 3 sets (BO3)."
        };
    }
    let winsA = 0;
    let winsB = 0;
    for (const s of score.sets){
        if (!isValidSet(s)) return {
            ok: false,
            code: "INVALID_SET",
            message: "Set inválido."
        };
        if (s.a > s.b) winsA += 1;
        else winsB += 1;
    }
    if (winsA === winsB) return {
        ok: false,
        code: "NO_WINNER",
        message: "Empate não permitido no BO3."
    };
    if (winsA > MAX_SETS || winsB > MAX_SETS) {
        return {
            ok: false,
            code: "TOO_MANY_WINS",
            message: "Vitórias a mais para BO3."
        };
    }
    if (winsA > winsB && winsA > MAX_SETS - 1) {
        return {
            ok: true,
            winner: "A",
            normalized: score
        };
    }
    if (winsB > winsA && winsB > MAX_SETS - 1) {
        return {
            ok: true,
            winner: "B",
            normalized: score
        };
    }
    return {
        ok: false,
        code: "NO_WINNER",
        message: "Score não determina vencedor."
    };
}
function validateGoalScore(score) {
    const a = Number(score?.a);
    const b = Number(score?.b);
    const limit = Number(score?.limit);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
        return {
            ok: false,
            code: "INVALID_SCORE",
            message: "Score inválido."
        };
    }
    if (!Number.isFinite(limit) || limit <= 0) {
        return {
            ok: false,
            code: "INVALID_LIMIT",
            message: "Limite de golos inválido."
        };
    }
    if (a > limit || b > limit) {
        return {
            ok: false,
            code: "LIMIT_EXCEEDED",
            message: "Score ultrapassa o limite."
        };
    }
    if (a === limit && b === limit) {
        return {
            ok: false,
            code: "TIE_NOT_ALLOWED",
            message: "Empate não permitido."
        };
    }
    if (a === limit) {
        return {
            ok: true,
            winner: "A",
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].DONE,
            normalized: {
                a,
                b,
                limit
            }
        };
    }
    if (b === limit) {
        return {
            ok: true,
            winner: "B",
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].DONE,
            normalized: {
                a,
                b,
                limit
            }
        };
    }
    if (a > 0 || b > 0) {
        return {
            ok: true,
            winner: null,
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].IN_PROGRESS,
            normalized: {
                a,
                b,
                limit
            }
        };
    }
    return {
        ok: true,
        winner: null,
        status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].PENDING,
        normalized: {
            a,
            b,
            limit
        }
    };
}
function getWinnerSideFromScore(score) {
    if (!score) return null;
    if (score.goals) {
        const res = validateGoalScore(score.goals);
        return res.ok ? res.winner : null;
    }
    if (Array.isArray(score.sets) && score.sets.length > 0) {
        const res = validateScore({
            sets: score.sets
        });
        return res.ok ? res.winner : null;
    }
    return null;
}
function canEditMatch(status, force) {
    if (force) return true;
    // não permite editar DONE se não for force
    return status !== "DONE" && status !== "DISPUTED";
}
}),
"[project]/domain/tournaments/liveWarnings.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeLiveWarnings",
    ()=>computeLiveWarnings
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$matchRules$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/matchRules.ts [app-route] (ecmascript)");
;
function computeLiveWarnings(opts) {
    const { matches, pairings, startThresholdMinutes = 60 } = opts;
    const warnings = [];
    // guarantee REQUIRES_ACTION
    pairings.forEach((p)=>{
        if ((p.guaranteeStatus || "").toUpperCase() === "REQUIRES_ACTION") {
            warnings.push({
                type: "REQUIRES_ACTION",
                pairingId: p.id
            });
        }
    });
    // matches: missing court/start + score inválido
    const threshold = new Date(Date.now() + startThresholdMinutes * 60 * 1000);
    matches.forEach((m)=>{
        if (!m.courtId) warnings.push({
            type: "MISSING_COURT",
            matchId: m.id
        });
        if (!m.startAt || m.startAt < threshold) warnings.push({
            type: "MISSING_START",
            matchId: m.id
        });
        if ((m.status || "").toUpperCase() === "DONE") {
            const sets = Array.isArray(m.score?.sets) ? m.score.sets : [];
            if (sets.length === 0) return;
            const res = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$matchRules$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateScore"])({
                sets
            });
            if (!res.ok) warnings.push({
                type: "INVALID_SCORE",
                matchId: m.id
            });
        }
    });
    return warnings;
}
}),
"[project]/app/api/organizador/tournaments/[id]/live/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structureData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/structureData.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/structure.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$liveWarnings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/liveWarnings.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structureData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structureData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
async function ensureOrganizerAccess(userId, eventId) {
    const evt = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            id: eventId
        },
        select: {
            organizerId: true
        }
    });
    if (!evt?.organizerId) return false;
    const member = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findFirst({
        where: {
            organizerId: evt.organizerId,
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
async function GET(_req, { params }) {
    const resolved = await params;
    const id = Number(resolved?.id);
    if (!Number.isFinite(id)) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "INVALID_ID"
    }, {
        status: 400
    });
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "UNAUTHENTICATED"
    }, {
        status: 401
    });
    const tournament = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structureData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTournamentStructure"])(id);
    if (!tournament) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "NOT_FOUND"
    }, {
        status: 404
    });
    const authorized = await ensureOrganizerAccess(authData.user.id, tournament.event.id);
    if (!authorized) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "FORBIDDEN"
    }, {
        status: 403
    });
    const tieBreakRules = Array.isArray(tournament.tieBreakRules) ? tournament.tieBreakRules : [
        "WINS",
        "SET_DIFF",
        "GAME_DIFF",
        "HEAD_TO_HEAD",
        "RANDOM"
    ];
    // pairings para warnings REQUIRES_ACTION
    const pairings = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairing.findMany({
        where: {
            eventId: tournament.event.id
        },
        select: {
            id: true,
            guaranteeStatus: true
        }
    });
    const stages = tournament.stages.map((s)=>({
            id: s.id,
            name: s.name,
            stageType: s.stageType,
            groups: s.groups.map((g)=>({
                    id: g.id,
                    name: g.name,
                    standings: (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computeStandingsForGroup"])(g.matches, tieBreakRules, tournament.generationSeed || undefined),
                    matches: g.matches.map((m)=>({
                            id: m.id,
                            pairing1Id: m.pairing1Id,
                            pairing2Id: m.pairing2Id,
                            round: m.round,
                            roundLabel: m.roundLabel,
                            startAt: m.startAt,
                            courtId: m.courtId,
                            status: m.status,
                            statusLabel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["summarizeMatchStatus"])(m.status),
                            score: m.score,
                            nextMatchId: m.nextMatchId,
                            nextSlot: m.nextSlot
                        }))
                })),
            matches: s.matches.filter((m)=>!m.groupId).map((m)=>({
                    id: m.id,
                    pairing1Id: m.pairing1Id,
                    pairing2Id: m.pairing2Id,
                    round: m.round,
                    roundLabel: m.roundLabel,
                    startAt: m.startAt,
                    courtId: m.courtId,
                    status: m.status,
                    statusLabel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["summarizeMatchStatus"])(m.status),
                    score: m.score,
                    nextMatchId: m.nextMatchId,
                    nextSlot: m.nextSlot
                }))
        }));
    const flatMatches = stages.flatMap((s)=>[
            ...s.matches,
            ...s.groups.flatMap((g)=>g.matches)
        ]);
    const warnings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$liveWarnings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computeLiveWarnings"])({
        matches: flatMatches,
        pairings,
        startThresholdMinutes: 60
    });
    const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: true,
        tournament: {
            id: tournament.id,
            event: tournament.event,
            format: tournament.format,
            stages
        },
        warnings
    }, {
        status: 200
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a9b7d7cf._.js.map