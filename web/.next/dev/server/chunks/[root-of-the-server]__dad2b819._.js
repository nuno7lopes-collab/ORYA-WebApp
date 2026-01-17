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
    storageSignedTtlSeconds: parseNumber(process.env.SUPABASE_STORAGE_SIGNED_TTL_SECONDS, 60 * 60 * 24 * 30)
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
"[project]/app/api/explorar/list/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
const DEFAULT_PAGE_SIZE = 12;
function resolveStatus(event) {
    if (event.status === "CANCELLED") return "CANCELLED";
    if (event.status === "DRAFT") return "DRAFT";
    const now = Date.now();
    const endDate = event.endsAt instanceof Date ? event.endsAt.getTime() : event.endsAt ? new Date(event.endsAt).getTime() : null;
    if (endDate && endDate < now) return "PAST";
    return "ACTIVE";
}
function clampTake(value) {
    if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
    return Math.min(Math.max(value, 1), 50);
}
async function GET(req) {
    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get("type"); // event | all
    const categoriesParam = searchParams.get("categories"); // comma separated
    const cityParam = searchParams.get("city");
    const searchParam = searchParams.get("q");
    const cursorParam = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const priceMinParam = searchParams.get("priceMin");
    const priceMaxParam = searchParams.get("priceMax");
    const dateParam = searchParams.get("date"); // today | upcoming | all | day | weekend
    const dayParam = searchParams.get("day"); // YYYY-MM-DD opcional
    const take = clampTake(limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE);
    const cursorId = cursorParam ? Number(cursorParam) : null;
    const priceMin = priceMinParam ? Math.max(0, parseFloat(priceMinParam)) : 0;
    const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
    const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;
    const priceMinCents = Math.round(priceMin * 100);
    const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;
    const categoryFilters = (categoriesParam || "").split(",").map((c)=>c.trim().toUpperCase()).filter(Boolean);
    const where = {
        status: {
            in: [
                "PUBLISHED",
                "DATE_CHANGED"
            ]
        },
        isTest: {
            not: true
        },
        isDeleted: false
    };
    const listingFilter = {
        organizerId: {
            not: null
        },
        organizer: {
            status: "ACTIVE",
            publicListingEnabled: {
                not: false
            }
        }
    };
    where.AND = Array.isArray(where.AND) ? [
        ...where.AND,
        listingFilter
    ] : [
        listingFilter
    ];
    if (typeParam === "event") {
    // Sem filtro extra: todos os eventos publicados entram.
    }
    const normalizedCity = cityParam?.trim();
    const applyCityFilter = normalizedCity && normalizedCity.toLowerCase() !== "portugal";
    if (applyCityFilter) {
        where.locationCity = {
            contains: normalizedCity,
            mode: "insensitive"
        };
    }
    if (searchParam) {
        const q = searchParam.trim();
        where.OR = [
            {
                title: {
                    contains: q,
                    mode: "insensitive"
                }
            },
            {
                description: {
                    contains: q,
                    mode: "insensitive"
                }
            },
            {
                locationName: {
                    contains: q,
                    mode: "insensitive"
                }
            },
            {
                locationCity: {
                    contains: q,
                    mode: "insensitive"
                }
            }
        ];
    }
    // Categorias principais: Padel vs Eventos gerais (tudo o resto)
    if (categoryFilters.length > 0) {
        const hasPadel = categoryFilters.includes("PADEL");
        const hasGeneral = categoryFilters.includes("GERAL");
        const andFilters = [];
        if (hasPadel && !hasGeneral) {
            andFilters.push({
                templateType: "PADEL"
            });
        } else if (!hasPadel && hasGeneral) {
            andFilters.push({
                OR: [
                    {
                        templateType: {
                            not: "PADEL"
                        }
                    },
                    {
                        templateType: null
                    }
                ]
            });
        } else if (!hasPadel && !hasGeneral) {
            const mapToTemplate = {
                OUTRO: "OTHER",
                FESTA: "PARTY",
                CONCERTO: "OTHER",
                PALESTRA: "TALK",
                ARTE: "OTHER",
                COMIDA: "OTHER",
                DRINKS: "OTHER",
                VOLUNTARIADO: "VOLUNTEERING"
            };
            const templateTypes = categoryFilters.map((c)=>mapToTemplate[c]).filter((v)=>Boolean(v));
            if (templateTypes.length > 0) {
                andFilters.push({
                    templateType: {
                        in: templateTypes
                    }
                });
            }
        }
        if (andFilters.length > 0) {
            where.AND = Array.isArray(where.AND) ? [
                ...where.AND,
                ...andFilters
            ] : andFilters;
        }
    }
    if (dateParam === "today") {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        where.startsAt = {
            gte: startOfDay,
            lte: endOfDay
        };
    } else if (dateParam === "upcoming") {
        const now = new Date();
        where.startsAt = {
            gte: now
        };
    } else if (dateParam === "weekend") {
        const now = new Date();
        const day = now.getDay(); // 0 domingo ... 6 sábado
        let start = new Date(now);
        let end = new Date(now);
        if (day === 0) {
            // domingo: só hoje a partir de agora
            start = now;
            end.setHours(23, 59, 59, 999);
        } else {
            const daysToSaturday = (6 - day + 7) % 7;
            start.setDate(now.getDate() + daysToSaturday);
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(start.getDate() + 1); // domingo
            end.setHours(23, 59, 59, 999);
        }
        where.startsAt = {
            gte: start,
            lte: end
        };
    } else if (dateParam === "day" && dayParam) {
        const day = new Date(dayParam);
        if (!Number.isNaN(day.getTime())) {
            const startOfDay = new Date(day);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(day);
            endOfDay.setHours(23, 59, 59, 999);
            where.startsAt = {
                gte: startOfDay,
                lte: endOfDay
            };
        }
    }
    // Filtro de preço (priceMax === null significa sem limite superior)
    const priceFilters = [];
    if (priceMinCents > 0 && priceMaxCents !== null) {
        priceFilters.push({
            isFree: false,
            ticketTypes: {
                some: {
                    price: {
                        gte: priceMinCents,
                        lte: priceMaxCents
                    }
                }
            }
        });
    } else if (priceMinCents > 0) {
        priceFilters.push({
            isFree: false,
            ticketTypes: {
                some: {
                    price: {
                        gte: priceMinCents
                    }
                }
            }
        });
    } else if (priceMaxCents !== null) {
        priceFilters.push({
            OR: [
                {
                    isFree: true
                },
                {
                    ticketTypes: {
                        some: {
                            price: {
                                lte: priceMaxCents
                            }
                        }
                    }
                }
            ]
        });
    }
    if (priceFilters.length > 0) {
        where.AND = Array.isArray(where.AND) ? [
            ...where.AND,
            ...priceFilters
        ] : priceFilters;
    }
    const query = {
        where,
        orderBy: [
            {
                startsAt: "asc"
            },
            {
                id: "asc"
            }
        ],
        take: take + 1,
        include: {
            ticketTypes: {
                select: {
                    price: true,
                    status: true
                }
            },
            organizer: {
                select: {
                    publicName: true
                }
            }
        }
    };
    if (cursorId) {
        query.skip = 1;
        query.cursor = {
            id: cursorId
        };
    }
    try {
        const events = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].event.findMany(query);
        let viewerId = null;
        try {
            const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
            const { data: { user } } = await supabase.auth.getUser();
            viewerId = user?.id ?? null;
        } catch  {
            viewerId = null;
        }
        let nextCursor = null;
        if (events.length > take) {
            const nextItem = events.pop();
            nextCursor = nextItem?.id ?? null;
        }
        const ownerIds = Array.from(new Set(events.map((e)=>e.ownerUserId).filter((v)=>typeof v === "string" && v.length > 0)));
        const owners = ownerIds.length > 0 ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].profile.findMany({
            where: {
                id: {
                    in: ownerIds
                }
            },
            select: {
                id: true,
                username: true,
                fullName: true
            }
        }) : [];
        const ownerMap = new Map(owners.map((o)=>[
                o.id,
                o
            ]));
        let orderedEvents = events;
        if (viewerId && events.length > 0 && searchParam && searchParam.trim().length >= 1) {
            const organizerIds = Array.from(new Set(events.map((event)=>event.organizerId).filter((id)=>typeof id === "number")));
            if (organizerIds.length > 0) {
                const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].organizer_follows.findMany({
                    where: {
                        follower_id: viewerId,
                        organizer_id: {
                            in: organizerIds
                        }
                    },
                    select: {
                        organizer_id: true
                    }
                });
                if (rows.length > 0) {
                    const followedIds = new Set(rows.map((row)=>row.organizer_id));
                    const followed = [];
                    const rest = [];
                    events.forEach((event)=>{
                        if (event.organizerId && followedIds.has(event.organizerId)) {
                            followed.push(event);
                        } else {
                            rest.push(event);
                        }
                    });
                    orderedEvents = [
                        ...followed,
                        ...rest
                    ];
                }
            }
        }
        const items = orderedEvents.map((event)=>{
            const mappedType = "EVENT";
            const status = resolveStatus({
                status: event.status,
                endsAt: event.endsAt,
                isDeleted: false
            });
            const ticketPrices = Array.isArray(event.ticketTypes) ? event.ticketTypes.map((t)=>typeof t.price === "number" ? t.price : null).filter((p)=>p !== null) : [];
            let priceFrom = null;
            if (event.isFree) {
                priceFrom = 0;
            } else if (ticketPrices.length > 0) {
                priceFrom = Math.min(...ticketPrices) / 100;
            }
            const ownerProfile = event.ownerUserId ? ownerMap.get(event.ownerUserId) : null;
            const hostName = event.organizer?.publicName ?? ownerProfile?.fullName ?? null;
            const hostUsername = ownerProfile?.username ?? null;
            const templateToCategory = {
                PARTY: "FESTA",
                PADEL: "PADEL",
                TALK: "PALESTRA",
                VOLUNTEERING: "VOLUNTARIADO",
                OTHER: "GERAL"
            };
            const categories = event.templateType != null ? [
                templateToCategory[String(event.templateType)] ?? "GERAL"
            ] : [
                "GERAL"
            ];
            return {
                id: event.id,
                type: mappedType,
                slug: event.slug,
                title: event.title,
                shortDescription: event.description?.slice(0, 200) ?? null,
                startsAt: event.startsAt ? new Date(event.startsAt).toISOString() : "",
                endsAt: event.endsAt ? new Date(event.endsAt).toISOString() : "",
                location: {
                    name: event.locationName ?? null,
                    city: event.locationCity ?? null,
                    lat: event.latitude ?? null,
                    lng: event.longitude ?? null
                },
                coverImageUrl: event.coverImageUrl ?? null,
                isFree: event.isFree,
                priceFrom,
                categories,
                hostName,
                hostUsername,
                status,
                isHighlighted: false
            };
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            items,
            pagination: {
                nextCursor,
                hasMore: nextCursor !== null
            }
        });
    } catch (error) {
        console.error("[api/explorar/list] erro:", error);
        // Em caso de erro, devolve lista vazia mas não rebenta o frontend
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            items: [],
            pagination: {
                nextCursor: null,
                hasMore: false
            },
            error: error instanceof Error ? error.message : "Erro desconhecido"
        }, {
            status: 200
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__dad2b819._.js.map