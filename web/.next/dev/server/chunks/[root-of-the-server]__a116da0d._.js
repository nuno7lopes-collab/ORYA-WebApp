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
"[project]/lib/liveHubConfig.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveLiveHubModules",
    ()=>resolveLiveHubModules
]);
const DEFAULT_MODULES = {
    PADEL: [
        "HERO",
        "VIDEO",
        "NEXT_MATCHES",
        "RESULTS",
        "BRACKET"
    ],
    EVENTOS: [
        "HERO",
        "VIDEO",
        "NOW_PLAYING",
        "NEXT_MATCHES",
        "RESULTS",
        "BRACKET",
        "SPONSORS"
    ],
    VOLUNTARIADO: [
        "HERO",
        "SUMMARY",
        "CTA"
    ]
};
const PREMIUM_MODULES = {};
function resolveLiveHubModules(params) {
    const { category, mode, premiumActive } = params;
    const usePremium = mode === "PREMIUM" && premiumActive;
    if (usePremium) {
        return PREMIUM_MODULES[category] ?? DEFAULT_MODULES[category];
    }
    return DEFAULT_MODULES[category];
}
}),
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
"[project]/lib/organizerAccess.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "canManageEventsDb",
    ()=>canManageEventsDb,
    "canManageMembersDb",
    ()=>canManageMembersDb,
    "canScanTickets",
    ()=>canScanTickets,
    "getOrganizerRole",
    ()=>getOrganizerRole
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
async function getOrganizerRole(userId, organizerId) {
    if (!userId || !organizerId) return null;
    const membership = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findUnique({
        where: {
            organizerId_userId: {
                organizerId,
                userId
            }
        },
        select: {
            role: true
        }
    });
    return membership?.role ?? null;
}
async function canManageMembersDb(userId, organizerId) {
    const role = await getOrganizerRole(userId, organizerId);
    return role === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER || role === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER || role === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].ADMIN;
}
async function canManageEventsDb(userId, organizerId) {
    const role = await getOrganizerRole(userId, organizerId);
    return role === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER || role === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER || role === __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].ADMIN;
}
async function canScanTickets(userId, eventId) {
    const event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            id: eventId
        },
        select: {
            organizerId: true
        }
    });
    if (!event || !event.organizerId) {
        return {
            allowed: false,
            reason: "EVENT_NOT_FOUND",
            membershipRole: null
        };
    }
    const membership = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findUnique({
        where: {
            organizerId_userId: {
                organizerId: event.organizerId,
                userId
            }
        },
        select: {
            role: true
        }
    });
    const managerRoles = [
        __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER,
        __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].CO_OWNER,
        __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].ADMIN
    ];
    if (membership && managerRoles.includes(membership.role)) {
        return {
            allowed: true,
            membershipRole: membership.role,
            staffAssignmentId: null
        };
    }
    const staffAssignment = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].staffAssignment.findFirst({
        where: {
            userId,
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffStatus"].ACCEPTED,
            revokedAt: null,
            role: {
                in: [
                    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffRole"].OWNER,
                    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffRole"].ADMIN,
                    __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffRole"].CHECKIN
                ]
            },
            OR: [
                {
                    scope: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffScope"].EVENT,
                    eventId
                },
                {
                    scope: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["StaffScope"].GLOBAL,
                    organizerId: event.organizerId
                }
            ]
        },
        select: {
            id: true,
            role: true
        }
    });
    if (staffAssignment) {
        return {
            allowed: true,
            membershipRole: membership?.role ?? null,
            staffAssignmentId: staffAssignment.id
        };
    }
    return {
        allowed: false,
        membershipRole: membership?.role ?? null,
        staffAssignmentId: null,
        reason: "NO_PERMISSION"
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/lib/utils/email.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "normalizeEmail",
    ()=>normalizeEmail
]);
function normalizeEmail(email) {
    if (!email) return null;
    const trimmed = email.trim().toLowerCase();
    return trimmed || null;
}
}),
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
"[project]/lib/organizerPremium.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCustomLiveHubMatchOrder",
    ()=>getCustomLiveHubMatchOrder,
    "getCustomLiveHubModules",
    ()=>getCustomLiveHubModules,
    "getCustomPremiumConfig",
    ()=>getCustomPremiumConfig,
    "getCustomPremiumKey",
    ()=>getCustomPremiumKey,
    "getCustomPremiumProfileModules",
    ()=>getCustomPremiumProfileModules,
    "isCustomPremiumActive",
    ()=>isCustomPremiumActive,
    "isCustomPremiumOrganizer",
    ()=>isCustomPremiumOrganizer
]);
const CUSTOM_PREMIUM_CONFIGS = [
    {
        key: "ONEVONE",
        organizerId: 23,
        username: "onevone",
        liveHubModules: [
            "HERO",
            "VIDEO",
            "NOW_PLAYING",
            "NEXT_MATCHES",
            "RESULTS",
            "BRACKET",
            "SPONSORS"
        ],
        profileModules: {
            inscricoes: true,
            loja: true,
            galeria: true
        },
        liveHubMatchOrder: "ONEVONE"
    }
];
const normalizeUsername = (value)=>typeof value === "string" ? value.trim().toLowerCase() : "";
function getCustomPremiumConfig(organizer) {
    if (!organizer) return null;
    const normalizedUsername = normalizeUsername(organizer.username);
    return CUSTOM_PREMIUM_CONFIGS.find((config)=>config.organizerId && organizer.id === config.organizerId || normalizedUsername && config.username === normalizedUsername) ?? null;
}
function isCustomPremiumOrganizer(organizer) {
    return Boolean(getCustomPremiumConfig(organizer));
}
function isCustomPremiumActive(organizer, premiumEnabled) {
    const config = getCustomPremiumConfig(organizer);
    if (!config) return false;
    const enabled = premiumEnabled ?? organizer?.liveHubPremiumEnabled ?? false;
    return Boolean(enabled);
}
function getCustomPremiumKey(organizer) {
    return getCustomPremiumConfig(organizer)?.key ?? null;
}
function getCustomLiveHubModules(organizer) {
    return getCustomPremiumConfig(organizer)?.liveHubModules ?? null;
}
function getCustomPremiumProfileModules(organizer) {
    return getCustomPremiumConfig(organizer)?.profileModules ?? null;
}
function getCustomLiveHubMatchOrder(organizer) {
    return getCustomPremiumConfig(organizer)?.liveHubMatchOrder ?? null;
}
}),
"[project]/app/api/livehub/[slug]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizationCategories.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$liveHubConfig$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/liveHubConfig.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/structure.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structureData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/structureData.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$matchRules$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/matchRules.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerAccess$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerAccess.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils/email.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/username.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerPremium.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structureData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerAccess$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structureData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerAccess$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
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
;
function slugify(input) {
    return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function pickDisplayName(profile) {
    return profile?.fullName || (profile?.username ? `@${profile.username}` : null);
}
async function GET(_req, { params }) {
    const resolved = await params;
    const slug = resolved?.slug;
    if (!slug) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: "INVALID_SLUG"
    }, {
        status: 400
    });
    try {
        let event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
            where: {
                slug
            },
            select: {
                id: true,
                slug: true,
                title: true,
                description: true,
                templateType: true,
                startsAt: true,
                endsAt: true,
                status: true,
                locationName: true,
                locationCity: true,
                coverImageUrl: true,
                organizerId: true,
                liveHubVisibility: true,
                liveStreamUrl: true,
                timezone: true,
                inviteOnly: true,
                publicAccessMode: true,
                participantAccessMode: true,
                publicTicketTypeIds: true,
                participantTicketTypeIds: true,
                organizer: {
                    select: {
                        id: true,
                        publicName: true,
                        username: true,
                        organizationCategory: true,
                        brandingAvatarUrl: true,
                        liveHubPremiumEnabled: true
                    }
                },
                tournament: {
                    select: {
                        id: true,
                        format: true,
                        generationSeed: true,
                        tieBreakRules: true
                    }
                }
            }
        });
        if (!event) {
            const normalized = slugify(slug);
            if (normalized && normalized !== slug) {
                event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
                    where: {
                        slug: normalized
                    },
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        description: true,
                        templateType: true,
                        startsAt: true,
                        endsAt: true,
                        status: true,
                        locationName: true,
                        locationCity: true,
                        coverImageUrl: true,
                        organizerId: true,
                        liveHubVisibility: true,
                        liveStreamUrl: true,
                        timezone: true,
                        inviteOnly: true,
                        publicAccessMode: true,
                        participantAccessMode: true,
                        publicTicketTypeIds: true,
                        participantTicketTypeIds: true,
                        organizer: {
                            select: {
                                id: true,
                                publicName: true,
                                username: true,
                                organizationCategory: true,
                                brandingAvatarUrl: true,
                                liveHubPremiumEnabled: true
                            }
                        },
                        tournament: {
                            select: {
                                id: true,
                                format: true,
                                generationSeed: true,
                                tieBreakRules: true
                            }
                        }
                    }
                });
            }
        }
        if (!event) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: "NOT_FOUND"
        }, {
            status: 404
        });
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;
        const tickets = userId ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].ticket.findMany({
            where: {
                eventId: event.id,
                status: "ACTIVE",
                OR: [
                    {
                        userId
                    },
                    {
                        ownerUserId: userId
                    }
                ]
            },
            select: {
                id: true,
                ticketTypeId: true,
                tournamentEntryId: true
            }
        }) : [];
        let isOrganizer = false;
        let organizerRole = null;
        let canEditMatches = false;
        if (userId && event.organizerId) {
            const access = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerAccess$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["canScanTickets"])(userId, event.id);
            organizerRole = access.membershipRole ?? null;
            const hasMembership = Boolean(organizerRole);
            isOrganizer = access.allowed || hasMembership;
            canEditMatches = organizerRole ? organizerRole !== __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].VIEWER : false;
        }
        const profile = userId ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.findUnique({
            where: {
                id: userId
            },
            select: {
                username: true
            }
        }) : null;
        const userEmailNormalized = authData?.user?.email ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["normalizeEmail"])(authData.user.email) : null;
        const usernameNormalized = profile?.username ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sanitizeUsername"])(profile.username) : null;
        const inviteIdentifiers = [
            userEmailNormalized,
            usernameNormalized
        ].filter(Boolean);
        const inviteWhere = {
            eventId: event.id,
            OR: [
                userId ? {
                    targetUserId: userId
                } : undefined,
                inviteIdentifiers.length > 0 ? {
                    targetIdentifier: {
                        in: inviteIdentifiers
                    }
                } : undefined
            ].filter(Boolean)
        };
        const [publicInviteMatch, participantInviteMatch] = userId || inviteIdentifiers.length > 0 ? await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].eventInvite.findFirst({
                where: {
                    ...inviteWhere,
                    scope: "PUBLIC"
                },
                select: {
                    id: true
                }
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].eventInvite.findFirst({
                where: {
                    ...inviteWhere,
                    scope: "PARTICIPANT"
                },
                select: {
                    id: true
                }
            })
        ]) : [
            null,
            null
        ];
        const isParticipantInvited = Boolean(participantInviteMatch);
        const publicAccessMode = event.publicAccessMode ?? (event.inviteOnly ? "INVITE" : "OPEN");
        const participantAccessMode = event.participantAccessMode ?? "NONE";
        const publicTicketTypeIds = event.publicTicketTypeIds ?? [];
        const participantTicketTypeIds = event.participantTicketTypeIds ?? [];
        const hasAnyTicket = tickets.length > 0;
        const ticketMatches = (ids)=>ids.length === 0 ? hasAnyTicket : tickets.some((t)=>ids.includes(t.ticketTypeId));
        const hasInscription = Boolean(userId && await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].tournamentEntry.findFirst({
            where: {
                eventId: event.id,
                userId
            },
            select: {
                id: true
            }
        })) || tickets.some((t)=>Boolean(t.tournamentEntryId));
        const isParticipant = participantAccessMode === "NONE" ? false : participantAccessMode === "TICKET" ? ticketMatches(participantTicketTypeIds) : participantAccessMode === "INSCRIPTION" ? hasInscription : participantAccessMode === "INVITE" ? isParticipantInvited : false;
        const viewerRole = isOrganizer ? "ORGANIZER" : isParticipant ? "PARTICIPANT" : "PUBLIC";
        const liveHubVisibility = event.liveHubVisibility ?? "PUBLIC";
        const liveHubAllowed = liveHubVisibility === "PUBLIC" ? true : liveHubVisibility === "PRIVATE" ? isOrganizer || isParticipant : false;
        const category = event.organizer?.organizationCategory ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizationCategories$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_ORGANIZATION_CATEGORY"];
        const premiumActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isCustomPremiumActive"])(event.organizer);
        const liveHubMode = premiumActive ? "PREMIUM" : "DEFAULT";
        const modules = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$liveHubConfig$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveLiveHubModules"])({
            category,
            mode: liveHubMode,
            premiumActive
        });
        const customModules = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCustomLiveHubModules"])(event.organizer);
        const liveHubModules = premiumActive && customModules?.length ? customModules : modules;
        let tournamentPayload = null;
        let pairings = {};
        if (event.tournament) {
            const structure = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structureData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTournamentStructure"])(event.tournament.id);
            const configRes = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].tournament.findUnique({
                where: {
                    id: event.tournament.id
                },
                select: {
                    config: true
                }
            });
            const config = configRes?.config ?? {};
            const manualParticipants = Array.isArray(config.manualParticipants) ? config.manualParticipants : [];
            const liveSponsors = config.liveSponsors ?? null;
            const featuredMatchId = typeof config.featuredMatchId === "number" ? config.featuredMatchId : null;
            if (structure) {
                const tieBreakRules = Array.isArray(structure.tieBreakRules) ? structure.tieBreakRules : [
                    "WINS",
                    "SET_DIFF",
                    "GAME_DIFF",
                    "HEAD_TO_HEAD",
                    "RANDOM"
                ];
                const buildMatch = (m)=>({
                        id: m.id,
                        stageId: m.stageId,
                        groupId: m.groupId,
                        pairing1Id: m.pairing1Id,
                        pairing2Id: m.pairing2Id,
                        courtId: m.courtId,
                        round: m.round,
                        roundLabel: m.roundLabel,
                        startAt: m.startAt,
                        status: m.status,
                        statusLabel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["summarizeMatchStatus"])(m.status),
                        score: m.score,
                        updatedAt: m.updatedAt
                    });
                const stages = structure.stages.map((s)=>({
                        id: s.id,
                        name: s.name,
                        stageType: s.stageType,
                        order: s.order,
                        groups: s.groups.map((g)=>({
                                id: g.id,
                                name: g.name,
                                standings: (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["computeStandingsForGroup"])(g.matches, tieBreakRules, structure.generationSeed || undefined),
                                matches: g.matches.map(buildMatch)
                            })),
                        matches: s.matches.filter((m)=>!m.groupId).map(buildMatch)
                    }));
                const flatMatches = stages.flatMap((s)=>[
                        ...s.matches,
                        ...s.groups.flatMap((g)=>g.matches)
                    ]);
                let userPairingId = null;
                if (userId) {
                    const pairing = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairing.findFirst({
                        where: {
                            eventId: event.id,
                            OR: [
                                {
                                    player1UserId: userId
                                },
                                {
                                    player2UserId: userId
                                }
                            ]
                        },
                        select: {
                            id: true
                        }
                    });
                    if (pairing?.id) {
                        userPairingId = pairing.id;
                    } else {
                        const ticketEntryId = tickets.find((t)=>Boolean(t.tournamentEntryId))?.tournamentEntryId ?? null;
                        if (ticketEntryId) {
                            userPairingId = ticketEntryId;
                        } else {
                            const entry = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].tournamentEntry.findFirst({
                                where: {
                                    eventId: event.id,
                                    userId
                                },
                                select: {
                                    id: true
                                }
                            });
                            userPairingId = entry?.id ?? null;
                        }
                    }
                }
                const nextMatch = userPairingId !== null ? flatMatches.filter((m)=>(m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status !== "DONE").sort((a, b)=>a.startAt && b.startAt ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime() : 0)[0] ?? null : null;
                const lastMatch = userPairingId !== null ? flatMatches.filter((m)=>(m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status === "DONE").sort((a, b)=>a.startAt && b.startAt ? new Date(b.startAt).getTime() - new Date(a.startAt).getTime() : 0)[0] ?? null : null;
                const pairingIds = new Set();
                for (const match of flatMatches){
                    if (typeof match.pairing1Id === "number") pairingIds.add(match.pairing1Id);
                    if (typeof match.pairing2Id === "number") pairingIds.add(match.pairing2Id);
                }
                const pairingIdsList = Array.from(pairingIds);
                if (pairingIdsList.length > 0) {
                    const padelPairings = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].padelPairing.findMany({
                        where: {
                            id: {
                                in: pairingIdsList
                            }
                        },
                        select: {
                            id: true,
                            player1: {
                                select: {
                                    fullName: true,
                                    username: true,
                                    avatarUrl: true
                                }
                            },
                            player2: {
                                select: {
                                    fullName: true,
                                    username: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    });
                    for (const pairing of padelPairings){
                        const p1 = pickDisplayName(pairing.player1);
                        const p2 = pickDisplayName(pairing.player2);
                        const label = p1 && p2 ? `${p1} & ${p2}` : `Dupla #${pairing.id}`;
                        const subLabel = p1 && p2 ? "Dupla" : null;
                        pairings[pairing.id] = {
                            id: pairing.id,
                            label,
                            subLabel,
                            avatarUrl: pairing.player1?.avatarUrl || pairing.player2?.avatarUrl || null
                        };
                    }
                    const tournamentEntries = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].tournamentEntry.findMany({
                        where: {
                            id: {
                                in: pairingIdsList
                            }
                        },
                        select: {
                            id: true,
                            user: {
                                select: {
                                    fullName: true,
                                    username: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    });
                    for (const entry of tournamentEntries){
                        if (pairings[entry.id]) continue;
                        const label = pickDisplayName(entry.user) || `Jogador #${entry.id}`;
                        const normalizedUsername = entry.user?.username ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sanitizeUsername"])(entry.user.username) : null;
                        const subLabel = normalizedUsername ? `@${normalizedUsername}` : null;
                        pairings[entry.id] = {
                            id: entry.id,
                            label,
                            subLabel,
                            avatarUrl: entry.user?.avatarUrl || null,
                            profileUsername: normalizedUsername,
                            href: normalizedUsername ? `/${normalizedUsername}` : null
                        };
                    }
                    for (const raw of manualParticipants){
                        const id = Number.isFinite(raw.id) ? Number(raw.id) : null;
                        if (!id || pairings[id] || !pairingIdsList.includes(id)) continue;
                        const name = typeof raw.name === "string" ? raw.name.trim() : "";
                        if (!name) continue;
                        const username = typeof raw.username === "string" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sanitizeUsername"])(raw.username) : null;
                        const subLabel = username ? `@${username}` : null;
                        const avatarUrl = typeof raw.avatarUrl === "string" ? raw.avatarUrl : null;
                        pairings[id] = {
                            id,
                            label: name,
                            subLabel,
                            avatarUrl,
                            profileUsername: username,
                            href: username ? `/${username}` : null
                        };
                    }
                }
                let championPairingId = null;
                const playoffStages = stages.filter((s)=>s.stageType === "PLAYOFF");
                const playoffMatches = playoffStages.flatMap((s)=>s.matches);
                if (playoffMatches.length > 0) {
                    const maxRound = Math.max(...playoffMatches.map((m)=>m.round ?? 0));
                    const finalMatch = playoffMatches.filter((m)=>(m.round ?? 0) === maxRound).sort((a, b)=>b.id - a.id)[0];
                    if (finalMatch?.status === "DONE") {
                        const winner = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$matchRules$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWinnerSideFromScore"])(finalMatch.score);
                        if (winner) {
                            championPairingId = winner === "A" ? finalMatch.pairing1Id ?? null : finalMatch.pairing2Id ?? null;
                        }
                    }
                }
                tournamentPayload = {
                    id: structure.id,
                    format: structure.format,
                    stages,
                    userPairingId,
                    nextMatch,
                    lastMatch,
                    championPairingId,
                    featuredMatchId,
                    sponsors: liveSponsors,
                    goalLimits: config.goalLimits ?? null
                };
            }
        }
        let organizerFollowed = false;
        if (userId && event.organizer?.id) {
            const follow = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizer_follows.findUnique({
                where: {
                    follower_id_organizer_id: {
                        follower_id: userId,
                        organizer_id: event.organizer.id
                    }
                },
                select: {
                    organizer_id: true
                }
            });
            organizerFollowed = Boolean(follow);
        }
        const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            event: {
                id: event.id,
                slug: event.slug,
                title: event.title,
                description: event.description,
                templateType: event.templateType,
                startsAt: event.startsAt,
                endsAt: event.endsAt,
                status: event.status,
                locationName: event.locationName,
                locationCity: event.locationCity,
                coverImageUrl: event.coverImageUrl,
                liveStreamUrl: event.liveStreamUrl,
                timezone: event.timezone,
                liveHubVisibility,
                publicAccessMode,
                participantAccessMode,
                publicTicketTypeIds,
                participantTicketTypeIds
            },
            organizer: event.organizer ? {
                id: event.organizer.id,
                publicName: event.organizer.publicName,
                username: event.organizer.username,
                organizationCategory: event.organizer.organizationCategory,
                brandingAvatarUrl: event.organizer.brandingAvatarUrl,
                liveHubPremiumEnabled: event.organizer.liveHubPremiumEnabled,
                isFollowed: organizerFollowed
            } : null,
            viewerRole,
            organizerRole,
            canEditMatches,
            access: {
                publicAccessMode,
                participantAccessMode,
                liveHubVisibility,
                liveHubAllowed,
                isParticipant
            },
            liveHub: {
                mode: liveHubMode,
                category,
                modules: liveHubModules
            },
            tournament: tournamentPayload,
            pairings
        }, {
            status: 200
        });
        res.headers.set("Cache-Control", "public, max-age=8");
        return res;
    } catch (err) {
        console.error("[livehub] error", err);
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

//# sourceMappingURL=%5Broot-of-the-server%5D__a116da0d._.js.map