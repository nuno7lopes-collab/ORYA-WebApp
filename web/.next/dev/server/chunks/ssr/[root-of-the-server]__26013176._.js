module.exports = [
"[project]/app/favicon.ico.mjs { IMAGE => \"[project]/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/favicon.ico.mjs { IMAGE => \"[project]/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript)"));
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/app/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/app/error.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/error.tsx [app-rsc] (ecmascript)"));
}),
"[project]/app/not-found.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/not-found.tsx [app-rsc] (ecmascript)"));
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
"[project]/lib/env.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/lib/prisma.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env.ts [app-rsc] (ecmascript)");
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
    connectionString: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["env"].dbUrl,
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
"[project]/lib/supabaseServer.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSupabaseServer",
    ()=>createSupabaseServer,
    "getCurrentUser",
    ()=>getCurrentUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env.ts [app-rsc] (ecmascript)");
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
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createServerClient"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["env"].supabaseUrl, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["env"].supabaseAnonKey, {
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
"[project]/app/components/profile/ProfileHeader.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/components/profile/ProfileHeader.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/profile/ProfileHeader.tsx <module evaluation>", "default");
}),
"[project]/app/components/profile/ProfileHeader.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/components/profile/ProfileHeader.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/profile/ProfileHeader.tsx", "default");
}),
"[project]/app/components/profile/ProfileHeader.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$ProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/components/profile/ProfileHeader.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$ProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/components/profile/ProfileHeader.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$ProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/components/profile/OrganizationProfileHeader.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/components/profile/OrganizationProfileHeader.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/profile/OrganizationProfileHeader.tsx <module evaluation>", "default");
}),
"[project]/app/components/profile/OrganizationProfileHeader.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/components/profile/OrganizationProfileHeader.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/profile/OrganizationProfileHeader.tsx", "default");
}),
"[project]/app/components/profile/OrganizationProfileHeader.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizationProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/components/profile/OrganizationProfileHeader.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizationProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/components/profile/OrganizationProfileHeader.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizationProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/components/profile/OrganizerAgendaTabs.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/components/profile/OrganizerAgendaTabs.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/profile/OrganizerAgendaTabs.tsx <module evaluation>", "default");
}),
"[project]/app/components/profile/OrganizerAgendaTabs.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/components/profile/OrganizerAgendaTabs.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/profile/OrganizerAgendaTabs.tsx", "default");
}),
"[project]/app/components/profile/OrganizerAgendaTabs.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizerAgendaTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/components/profile/OrganizerAgendaTabs.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizerAgendaTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/components/profile/OrganizerAgendaTabs.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizerAgendaTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/lib/image.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "defaultBlurDataURL",
    ()=>defaultBlurDataURL,
    "optimizeImageUrl",
    ()=>optimizeImageUrl
]);
function optimizeImageUrl(url, width = 1200, quality = 75, format = "webp") {
    if (!url || typeof url !== "string") return url ?? "";
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes("supabase.co")) {
            parsed.searchParams.set("width", String(width));
            parsed.searchParams.set("quality", String(quality));
            parsed.searchParams.set("format", format);
            return parsed.toString();
        }
        return url;
    } catch (err) {
        return url;
    }
}
const defaultBlurDataURL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9' viewBox='0 0 16 9'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23050B16' offset='0'%3E%3C/stop%3E%3Cstop stop-color='%23111F3B' offset='1'%3E%3C/stop%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='16' height='9' fill='url(%23g)'/%3E%3C/svg%3E";
}),
"[project]/lib/organizerPremium.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/app/[username]/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>UserProfilePage,
    "dynamic",
    ()=>dynamic,
    "revalidate",
    ()=>revalidate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$ProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/profile/ProfileHeader.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizationProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/profile/OrganizationProfileHeader.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizerAgendaTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/profile/OrganizerAgendaTabs.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/image.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerPremium.ts [app-rsc] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
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
const dynamic = "force-dynamic";
const revalidate = 0;
async function getViewerId() {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) return null;
        return data.user.id;
    } catch  {
        return null;
    }
}
function formatDate(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("pt-PT", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}
function formatDayLabel(date, timezone) {
    return new Intl.DateTimeFormat("pt-PT", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        timeZone: timezone
    }).format(date);
}
function formatTimeLabel(date, timezone) {
    if (!date) return "—";
    return new Intl.DateTimeFormat("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone
    }).format(date);
}
const CATEGORY_META = {
    EVENTOS: {
        label: "Eventos",
        cta: "Ver eventos",
        noun: "evento",
        nounPlural: "eventos"
    },
    PADEL: {
        label: "PADEL",
        cta: "Ver torneios",
        noun: "torneio",
        nounPlural: "torneios"
    },
    VOLUNTARIADO: {
        label: "Voluntariado",
        cta: "Participar",
        noun: "ação",
        nounPlural: "ações"
    }
};
const CATEGORY_TEMPLATE = {
    EVENTOS: null,
    PADEL: "PADEL",
    VOLUNTARIADO: "VOLUNTEERING"
};
const UPDATE_CATEGORY_LABELS = {
    TODAY: "Hoje",
    CHANGES: "Alterações",
    RESULTS: "Resultados",
    CALL_UPS: "Convocatórias"
};
function formatEventDateRange(start, end, timezone) {
    if (!start) return "Data a definir";
    const safeTimezone = timezone || "Europe/Lisbon";
    const optsDay = {
        weekday: "short",
        day: "2-digit",
        month: "short"
    };
    const optsTime = {
        hour: "2-digit",
        minute: "2-digit"
    };
    const dayStr = new Intl.DateTimeFormat("pt-PT", {
        ...optsDay,
        timeZone: safeTimezone
    }).format(start);
    const startTimeStr = new Intl.DateTimeFormat("pt-PT", {
        ...optsTime,
        timeZone: safeTimezone
    }).format(start);
    const endTimeStr = end ? new Intl.DateTimeFormat("pt-PT", {
        ...optsTime,
        timeZone: safeTimezone
    }).format(end) : null;
    return `${dayStr} · ${startTimeStr}${endTimeStr ? ` – ${endTimeStr}` : ""}`;
}
function buildAgendaGroups(events, pastEventIds) {
    const groups = [];
    const groupMap = new Map();
    for (const event of events){
        const timezone = event.timezone || "Europe/Lisbon";
        const hasDate = Boolean(event.startsAt);
        const key = hasDate ? new Intl.DateTimeFormat("pt-PT", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: timezone
        }).format(event.startsAt) : "data-a-definir";
        const label = hasDate ? formatDayLabel(event.startsAt, timezone) : "Data a definir";
        const locationLabel = [
            event.locationName,
            event.locationCity
        ].filter(Boolean).join(" · ") || "Local a anunciar";
        const item = {
            id: event.id,
            slug: event.slug,
            title: event.title,
            timeLabel: hasDate ? formatTimeLabel(event.startsAt, timezone) : "—",
            locationLabel,
            isPast: pastEventIds?.has(event.id) ?? false,
            isFree: event.isFree
        };
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                key,
                label,
                items: [
                    item
                ]
            });
        } else {
            groupMap.get(key)?.items.push(item);
        }
    }
    for (const group of groupMap.values()){
        groups.push(group);
    }
    return groups;
}
async function UserProfilePage({ params }) {
    const resolvedParams = await params;
    const usernameParam = resolvedParams?.username;
    if (!usernameParam || usernameParam.toLowerCase() === "me") {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/me");
    }
    const [viewerId, profile, organizerProfileRaw] = await Promise.all([
        getViewerId(),
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].profile.findUnique({
            where: {
                username: usernameParam
            },
            select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
                coverUrl: true,
                bio: true,
                city: true,
                visibility: true,
                createdAt: true
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].organizer.findFirst({
            where: {
                username: usernameParam,
                status: "ACTIVE"
            },
            select: {
                id: true,
                userId: true,
                username: true,
                publicName: true,
                businessName: true,
                city: true,
                organizationCategory: true,
                brandingAvatarUrl: true,
                brandingCoverUrl: true,
                officialEmail: true,
                officialEmailVerifiedAt: true,
                publicListingEnabled: true,
                status: true,
                publicWebsite: true,
                publicInstagram: true,
                publicYoutube: true,
                publicDescription: true,
                publicHours: true,
                infoRules: true,
                infoFaq: true,
                infoRequirements: true,
                infoPolicies: true,
                infoLocationNotes: true,
                address: true,
                showAddressPublicly: true,
                liveHubPremiumEnabled: true,
                organizationModules: {
                    where: {
                        enabled: true
                    },
                    select: {
                        moduleKey: true
                    }
                }
            }
        })
    ]);
    const organizerProfile = organizerProfileRaw && organizerProfileRaw.publicListingEnabled !== false ? organizerProfileRaw : null;
    if (!profile?.username && !organizerProfile) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    if (!profile?.username && organizerProfile) {
        const now = new Date();
        const organizationCategory = organizerProfile.organizationCategory ?? "EVENTOS";
        const categoryMeta = CATEGORY_META[organizationCategory];
        const categoryTemplate = CATEGORY_TEMPLATE[organizationCategory];
        const orgDisplayName = organizerProfile.publicName?.trim() || organizerProfile.businessName?.trim() || "Organização ORYA";
        const modules = organizerProfile.organizationModules?.map((module)=>module.moduleKey) ?? [];
        const ownerMembership = viewerId ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].organizerMember.findFirst({
            where: {
                organizerId: organizerProfile.id,
                userId: viewerId,
                role: "OWNER"
            },
            select: {
                userId: true
            }
        }) : null;
        const isOrgOwner = Boolean(ownerMembership);
        const contactEmail = organizerProfile.officialEmail?.trim() || null;
        const publicWebsite = organizerProfile.publicWebsite?.trim() || null;
        const publicInstagram = organizerProfile.publicInstagram?.trim() || null;
        const publicYoutube = organizerProfile.publicYoutube?.trim() || null;
        const publicWebsiteHref = publicWebsite ? (()=>{
            const normalized = /^https?:\/\//i.test(publicWebsite) ? publicWebsite : `https://${publicWebsite}`;
            try {
                new URL(normalized);
                return normalized;
            } catch  {
                return null;
            }
        })() : null;
        const publicDescription = organizerProfile.publicDescription?.trim() || null;
        const premiumKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCustomPremiumKey"])(organizerProfile);
        const premiumActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isCustomPremiumActive"])(organizerProfile);
        const premiumModules = premiumActive ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCustomPremiumProfileModules"])(organizerProfile) ?? {} : {};
        const isOneVOnePremium = premiumActive && premiumKey === "ONEVONE";
        const hasInscricoes = modules.includes("INSCRICOES") && Boolean(premiumModules.inscricoes);
        const hasLoja = modules.includes("LOJA") && Boolean(premiumModules.loja);
        const hasGaleria = modules.includes("GALERIA") && Boolean(premiumModules.galeria);
        const shouldLoadForms = hasInscricoes || isOrgOwner;
        const formsWhere = {
            organizerId: organizerProfile.id,
            status: {
                in: [
                    "PUBLISHED",
                    "DRAFT"
                ]
            }
        };
        const [events, updates, followersCount, followRow, forms] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].event.findMany({
                where: {
                    organizerId: organizerProfile.id,
                    status: "PUBLISHED",
                    isDeleted: false,
                    type: "ORGANIZER_EVENT"
                },
                orderBy: [
                    {
                        startsAt: "asc"
                    }
                ],
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    startsAt: true,
                    endsAt: true,
                    locationName: true,
                    locationCity: true,
                    address: true,
                    isFree: true,
                    timezone: true,
                    templateType: true,
                    coverImageUrl: true,
                    ticketTypes: {
                        select: {
                            price: true
                        }
                    }
                }
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].organizationUpdate.findMany({
                where: {
                    organizerId: organizerProfile.id,
                    status: "PUBLISHED"
                },
                include: {
                    event: {
                        select: {
                            slug: true,
                            title: true
                        }
                    }
                },
                orderBy: [
                    {
                        isPinned: "desc"
                    },
                    {
                        publishedAt: "desc"
                    },
                    {
                        createdAt: "desc"
                    }
                ],
                take: 6
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].organizer_follows.count({
                where: {
                    organizer_id: organizerProfile.id
                }
            }),
            viewerId ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].organizer_follows.findFirst({
                where: {
                    organizer_id: organizerProfile.id,
                    follower_id: viewerId
                },
                select: {
                    follower_id: true
                }
            }) : Promise.resolve(null),
            shouldLoadForms ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].organizationForm.findMany({
                where: formsWhere,
                orderBy: [
                    {
                        createdAt: "desc"
                    }
                ],
                select: {
                    id: true,
                    title: true,
                    description: true,
                    startAt: true,
                    endAt: true,
                    capacity: true,
                    waitlistEnabled: true,
                    status: true
                }
            }) : Promise.resolve([])
        ]);
        const formattedUpdates = updates.map((update)=>({
                ...update,
                dateLabel: formatDate(update.publishedAt ?? update.createdAt),
                categoryLabel: UPDATE_CATEGORY_LABELS[update.category] ?? update.category
            }));
        const categoryEvents = categoryTemplate ? events.filter((event)=>event.templateType === categoryTemplate || event.templateType === null || event.templateType === "OTHER") : events;
        const upcomingEvents = categoryEvents.filter((event)=>event.startsAt && event.startsAt >= now).sort((a, b)=>(a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
        const pastEvents = categoryEvents.filter((event)=>event.startsAt && event.startsAt < now).sort((a, b)=>(b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0));
        const spotlightEvent = upcomingEvents[0] ?? null;
        const coverCandidate = organizerProfile.brandingCoverUrl?.trim() || spotlightEvent?.coverImageUrl || upcomingEvents.find((event)=>event.coverImageUrl)?.coverImageUrl || pastEvents.find((event)=>event.coverImageUrl)?.coverImageUrl || null;
        const headerCoverUrl = coverCandidate ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["optimizeImageUrl"])(coverCandidate, 1400, 72) : null;
        const galleryItems = categoryEvents.filter((event)=>event.coverImageUrl).slice(0, 6);
        const initialIsFollowing = Boolean(followRow);
        const isVerified = Boolean(organizerProfile.officialEmailVerifiedAt);
        const followersTotal = followersCount ?? 0;
        const pastEventIds = new Set(pastEvents.map((event)=>event.id));
        const agendaUpcomingEvents = spotlightEvent ? upcomingEvents.filter((event)=>event.id !== spotlightEvent.id) : upcomingEvents;
        const upcomingGroups = buildAgendaGroups(agendaUpcomingEvents, pastEventIds);
        const pastGroups = buildAgendaGroups(pastEvents, pastEventIds);
        const allGroups = buildAgendaGroups([
            ...upcomingEvents,
            ...pastEvents
        ], pastEventIds);
        const publicForms = forms.filter((form)=>form.status !== "ARCHIVED");
        const featuredForm = publicForms.find((form)=>/guarda[-\s]?redes/i.test(form.title)) ?? publicForms[0] ?? null;
        const showInscricoes = hasInscricoes;
        const spotlightCtaLabel = spotlightEvent?.isFree ? "Garantir lugar" : "Comprar bilhete";
        const spotlightCtaHref = spotlightEvent ? buildTicketHref(spotlightEvent.slug) : null;
        const inscriptionsCoverUrl = spotlightEvent?.coverImageUrl ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["optimizeImageUrl"])(spotlightEvent.coverImageUrl, 900, 70) : "/images/placeholder-event.jpg";
        const featuredFormDateLabel = featuredForm ? formatFormDateRange(featuredForm.startAt, featuredForm.endAt) : null;
        const featuredFormCapacityLabel = featuredForm?.capacity ? `${featuredForm.capacity} vagas` : null;
        const merchItems = hasLoja ? isOneVOnePremium ? [
            {
                title: "Camisola OneVOne",
                description: "Edição limitada oficial dos torneios.",
                price: "Em breve",
                href: publicWebsiteHref
            },
            {
                title: "Pulseira OneVOne",
                description: "Identidade premium para atletas e staff.",
                price: "Em breve",
                href: publicWebsiteHref
            }
        ] : [
            {
                title: "Camisola oficial",
                description: "Edição limitada com assinatura da organização.",
                price: "Em breve",
                href: publicWebsiteHref
            },
            {
                title: "Pulseira de evento",
                description: "Identidade premium para a equipa e atletas.",
                price: "Em breve",
                href: publicWebsiteHref
            }
        ] : [];
        const agendaTotal = upcomingEvents.length + pastEvents.length;
        const galleryPreview = galleryItems.slice(0, 4);
        const galleryHref = publicInstagram || null;
        const galleryLinkLabel = publicInstagram ? "Instagram" : null;
        const padelPlayersCount = organizationCategory === "PADEL" ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].padelPlayerProfile.count({
            where: {
                organizerId: organizerProfile.id
            }
        }) : 0;
        const padelTopPlayers = organizationCategory === "PADEL" ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].padelPlayerProfile.findMany({
            where: {
                organizerId: organizerProfile.id,
                isActive: true
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 4,
            select: {
                id: true,
                displayName: true,
                fullName: true,
                level: true,
                gender: true
            }
        }) : [];
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
            className: "relative orya-body-bg min-h-screen w-full overflow-hidden text-white",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "relative orya-page-width flex flex-col gap-8 py-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizationProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        name: orgDisplayName,
                        username: organizerProfile.username ?? usernameParam,
                        avatarUrl: organizerProfile.brandingAvatarUrl ?? null,
                        coverUrl: headerCoverUrl,
                        bio: publicDescription,
                        city: organizerProfile.city ?? null,
                        followersCount: followersTotal,
                        followingCount: 0,
                        organizerId: organizerProfile.id,
                        initialIsFollowing: initialIsFollowing,
                        isOwner: isOrgOwner,
                        isPublic: organizerProfile.publicListingEnabled !== false,
                        isVerified: isVerified,
                        instagramHref: publicInstagram,
                        youtubeHref: publicYoutube,
                        websiteHref: publicWebsiteHref,
                        contactEmail: contactEmail
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 497,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "grid gap-6 px-5 sm:px-8 md:grid-cols-3 md:grid-rows-[auto_1fr] md:items-start",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$OrganizerAgendaTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                title: "Agenda pública",
                                anchorId: "agenda",
                                layout: "grid",
                                upcomingGroups: upcomingGroups,
                                pastGroups: pastGroups,
                                allGroups: allGroups,
                                upcomingCount: upcomingEvents.length,
                                pastCount: pastEvents.length,
                                totalCount: agendaTotal,
                                prelude: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(EventSpotlightCard, {
                                    event: spotlightEvent,
                                    label: `Próximo ${categoryMeta.noun}`,
                                    emptyLabel: `Sem ${categoryMeta.noun} anunciado`,
                                    ctaLabel: spotlightCtaLabel,
                                    ctaHref: spotlightCtaHref,
                                    variant: "embedded"
                                }, void 0, false, {
                                    fileName: "[project]/app/[username]/page.tsx",
                                    lineNumber: 529,
                                    columnNumber: 17
                                }, void 0)
                            }, void 0, false, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 518,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                                className: "space-y-4 md:col-span-1 md:row-start-2 min-w-0",
                                children: [
                                    showInscricoes && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                        className: "relative overflow-hidden rounded-3xl border border-white/12 bg-[#05070f]/80 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "absolute inset-0",
                                                "aria-hidden": "true",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "absolute inset-0 bg-gradient-to-r from-[#05070f]/95 via-[#0b1124]/85 to-transparent"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 544,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "absolute inset-y-0 right-0 w-2/3",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "absolute inset-0 bg-cover bg-center opacity-80",
                                                                style: {
                                                                    backgroundImage: `url(${inscriptionsCoverUrl})`
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 546,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "absolute inset-0 bg-gradient-to-l from-transparent via-black/40 to-[#05070f]/95"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 550,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 545,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 543,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "relative z-10 space-y-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] uppercase tracking-[0.22em] text-white/60",
                                                        children: "Inscrições"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 555,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-lg font-semibold text-white",
                                                        children: featuredForm?.title || (isOneVOnePremium ? "Ficha Guarda-Redes OneVOne" : "Inscrições em preparação")
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 558,
                                                        columnNumber: 21
                                                    }, this),
                                                    featuredFormDateLabel || featuredFormCapacityLabel ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "mt-3 flex flex-wrap gap-2 text-[11px] text-white/70",
                                                        children: [
                                                            featuredFormDateLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "rounded-full border border-white/15 bg-white/10 px-3 py-1",
                                                                children: featuredFormDateLabel
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 565,
                                                                columnNumber: 27
                                                            }, this),
                                                            featuredFormCapacityLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "rounded-full border border-white/15 bg-white/10 px-3 py-1",
                                                                children: featuredFormCapacityLabel
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 570,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 563,
                                                        columnNumber: 23
                                                    }, this) : null,
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "mt-4 flex flex-wrap items-center gap-2",
                                                        children: featuredForm ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                            href: `/inscricoes/${featuredForm.id}`,
                                                            className: "rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]",
                                                            children: "Inscrever-me"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/[username]/page.tsx",
                                                            lineNumber: 578,
                                                            columnNumber: 25
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/70",
                                                            children: "Em breve"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/[username]/page.tsx",
                                                            lineNumber: 585,
                                                            columnNumber: 25
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 576,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 554,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 542,
                                        columnNumber: 17
                                    }, this),
                                    hasLoja && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                        className: "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] uppercase tracking-[0.22em] text-white/60",
                                                                children: "Loja"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 598,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                className: "text-base font-semibold text-white",
                                                                children: "Merch premium"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 599,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 597,
                                                        columnNumber: 21
                                                    }, this),
                                                    publicWebsiteHref && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                        href: publicWebsiteHref,
                                                        target: "_blank",
                                                        rel: "noreferrer",
                                                        className: "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/30 hover:bg-white/10",
                                                        children: "Ver loja"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 602,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 596,
                                                columnNumber: 19
                                            }, this),
                                            merchItems.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70",
                                                children: "Produtos em preparação. Vamos lançar novidades em breve."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 613,
                                                columnNumber: 21
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 grid gap-3 sm:grid-cols-2",
                                                children: merchItems.slice(0, 2).map((item)=>{
                                                    const titleLower = item.title.toLowerCase();
                                                    const isCamisola = titleLower.includes("camisola");
                                                    const isPulseira = titleLower.includes("pulseira");
                                                    const imageStyle = isCamisola ? {
                                                        backgroundImage: "url(/ov1.png)"
                                                    } : isPulseira ? {
                                                        backgroundImage: "url(/onevone-pulseira.png)"
                                                    } : undefined;
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "overflow-hidden rounded-2xl border border-white/12 bg-[#05070f]/85 text-[12px] text-white/80 shadow-[0_16px_50px_rgba(0,0,0,0.5)]",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "relative aspect-square w-full overflow-hidden border-b border-white/10",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: `absolute inset-0 bg-cover bg-center ${isCamisola ? "" : "bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%),linear-gradient(135deg,#0b1124,#05070f)]"}`,
                                                                    style: imageStyle
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/[username]/page.tsx",
                                                                    lineNumber: 633,
                                                                    columnNumber: 31
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/[username]/page.tsx",
                                                                    lineNumber: 641,
                                                                    columnNumber: 31
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "relative z-10 flex h-full flex-col justify-end p-3",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-sm font-semibold text-white drop-shadow",
                                                                            children: item.title
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/[username]/page.tsx",
                                                                            lineNumber: 643,
                                                                            columnNumber: 33
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "mt-2 flex flex-wrap items-center gap-2",
                                                                            children: [
                                                                                item.href ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                                                    href: item.href,
                                                                                    target: "_blank",
                                                                                    rel: "noreferrer",
                                                                                    className: "inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[10px] text-white",
                                                                                    children: "Comprar"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/[username]/page.tsx",
                                                                                    lineNumber: 648,
                                                                                    columnNumber: 37
                                                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] text-white/80",
                                                                                    children: "Comprar"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/[username]/page.tsx",
                                                                                    lineNumber: 657,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "text-[10px] text-white/70",
                                                                                    children: item.price
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/[username]/page.tsx",
                                                                                    lineNumber: 661,
                                                                                    columnNumber: 35
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/[username]/page.tsx",
                                                                            lineNumber: 646,
                                                                            columnNumber: 33
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/[username]/page.tsx",
                                                                    lineNumber: 642,
                                                                    columnNumber: 31
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/[username]/page.tsx",
                                                            lineNumber: 632,
                                                            columnNumber: 29
                                                        }, this)
                                                    }, item.title, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 628,
                                                        columnNumber: 27
                                                    }, this);
                                                })
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 617,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 595,
                                        columnNumber: 17
                                    }, this),
                                    hasGaleria && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                        className: "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] uppercase tracking-[0.22em] text-white/60",
                                                                children: "Galeria"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 677,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                className: "text-base font-semibold text-white",
                                                                children: "Highlights"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 678,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 676,
                                                        columnNumber: 21
                                                    }, this),
                                                    galleryHref && galleryLinkLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                        href: galleryHref,
                                                        target: "_blank",
                                                        rel: "noreferrer",
                                                        className: "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/30 hover:bg-white/10",
                                                        children: [
                                                            "Ver ",
                                                            galleryLinkLabel
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 681,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 675,
                                                columnNumber: 19
                                            }, this),
                                            galleryPreview.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70",
                                                children: "Ainda não existem imagens publicadas."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 692,
                                                columnNumber: 21
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 grid grid-cols-3 gap-2",
                                                children: galleryPreview.map((event)=>{
                                                    const coverUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["optimizeImageUrl"])(event.coverImageUrl, 600, 70);
                                                    const content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "group relative h-20 overflow-hidden rounded-xl border border-white/10",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.04]",
                                                                style: {
                                                                    backgroundImage: `url(${coverUrl})`
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 701,
                                                                columnNumber: 29
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 705,
                                                                columnNumber: 29
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 700,
                                                        columnNumber: 27
                                                    }, this);
                                                    return galleryHref ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                        href: galleryHref,
                                                        target: "_blank",
                                                        rel: "noreferrer",
                                                        className: "block",
                                                        children: content
                                                    }, event.id, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 710,
                                                        columnNumber: 27
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: content
                                                    }, event.id, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 720,
                                                        columnNumber: 27
                                                    }, this);
                                                })
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 696,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 674,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 540,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 517,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.22em] text-white/60",
                                        children: "Canal oficial"
                                    }, void 0, false, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 732,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-xl font-semibold text-white",
                                        children: "Atualizações da organização"
                                    }, void 0, false, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 733,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 731,
                                columnNumber: 13
                            }, this),
                            formattedUpdates.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl",
                                children: "Sem atualizações oficiais por agora. As novidades aparecem sempre aqui primeiro."
                            }, void 0, false, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 736,
                                columnNumber: 15
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-3",
                                children: formattedUpdates.map((update)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-wrap items-start justify-between gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                                children: [
                                                                    update.categoryLabel,
                                                                    update.isPinned ? " · Fixado" : ""
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 748,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                className: "text-base font-semibold text-white",
                                                                children: update.title
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 752,
                                                                columnNumber: 25
                                                            }, this),
                                                            update.event?.slug && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                                href: `/eventos/${update.event.slug}`,
                                                                className: "text-[12px] text-white/60 hover:text-white",
                                                                children: [
                                                                    "Evento: ",
                                                                    update.event.title
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 754,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 747,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[11px] text-white/55",
                                                        children: update.dateLabel
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 762,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 746,
                                                columnNumber: 21
                                            }, this),
                                            update.body && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-[12px] text-white/70 whitespace-pre-line",
                                                children: update.body
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 765,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, update.id, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 742,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 740,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 730,
                        columnNumber: 11
                    }, this),
                    organizationCategory === "PADEL" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.22em] text-white/60",
                                        children: "Centro de competição"
                                    }, void 0, false, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 778,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-xl font-semibold text-white",
                                        children: "PADEL oficial"
                                    }, void 0, false, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 779,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 777,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-4 md:grid-cols-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Jogadores"
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 783,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-2xl font-semibold text-white",
                                                children: padelPlayersCount
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 784,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[12px] text-white/60",
                                                children: "Perfis ativos na competição."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 785,
                                                columnNumber: 19
                                            }, this),
                                            padelTopPlayers.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 flex flex-wrap gap-2 text-[12px] text-white/70",
                                                children: padelTopPlayers.map((player)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "rounded-full border border-white/15 bg-white/10 px-3 py-1",
                                                        children: [
                                                            player.displayName || player.fullName || "Jogador",
                                                            player.level ? ` · ${player.level}` : ""
                                                        ]
                                                    }, player.id, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 789,
                                                        columnNumber: 25
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 787,
                                                columnNumber: 21
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-3 text-[12px] text-white/50",
                                                children: "Top players a definir."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 798,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 782,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Ranking & histórico"
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 802,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-[12px] text-white/70",
                                                children: "Aqui vês rankings, campeões e resultados oficiais assim que forem publicados."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 803,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70",
                                                children: "Temporada atual em preparação."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 806,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 801,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 781,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 776,
                        columnNumber: 13
                    }, this),
                    organizationCategory === "VOLUNTARIADO" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.22em] text-white/60",
                                        children: "Missão"
                                    }, void 0, false, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 817,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-xl font-semibold text-white",
                                        children: "Impacto e participação"
                                    }, void 0, false, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 818,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 816,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-4 md:grid-cols-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Missão"
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 822,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-[12px] text-white/70",
                                                children: publicDescription || "Esta organização cria ações com impacto real. A missão e os objetivos serão atualizados em breve."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 823,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 821,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Como participar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 829,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-[12px] text-white/70",
                                                children: organizerProfile.infoRequirements || organizerProfile.infoRules || "Segue a organização, inscreve-te nas próximas ações e confirma a tua disponibilidade."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 830,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 828,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 820,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 815,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 496,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/[username]/page.tsx",
            lineNumber: 495,
            columnNumber: 7
        }, this);
    }
    const isOwner = viewerId === profile.id;
    const isPrivate = profile.visibility === "PRIVATE";
    const canShowPrivate = isOwner || !isPrivate;
    let initialIsFollowing = false;
    let stats = {
        total: 0,
        upcoming: 0,
        past: 0,
        totalSpent: "—"
    };
    let followersCount = 0;
    let followingCount = 0;
    let recent = [];
    if (__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].follows) {
        const [followers, following] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].follows.count({
                where: {
                    following_id: profile.id
                }
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].follows.count({
                where: {
                    follower_id: profile.id
                }
            })
        ]);
        followersCount = followers;
        followingCount = following;
        if (!isOwner && viewerId) {
            const followRow = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].follows.findFirst({
                where: {
                    follower_id: viewerId,
                    following_id: profile.id
                },
                select: {
                    id: true
                }
            });
            initialIsFollowing = Boolean(followRow);
        }
    }
    if (canShowPrivate && __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].entitlement) {
        const now = new Date();
        try {
            const [total, upcoming, past, recentEntitlements] = await Promise.all([
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].entitlement.count({
                    where: {
                        ownerUserId: profile.id
                    }
                }),
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].entitlement.count({
                    where: {
                        ownerUserId: profile.id,
                        snapshotStartAt: {
                            gte: now
                        }
                    }
                }),
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].entitlement.count({
                    where: {
                        ownerUserId: profile.id,
                        snapshotStartAt: {
                            lt: now
                        }
                    }
                }),
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].entitlement.findMany({
                    where: {
                        ownerUserId: profile.id
                    },
                    orderBy: [
                        {
                            snapshotStartAt: "desc"
                        }
                    ],
                    take: 4,
                    select: {
                        id: true,
                        snapshotTitle: true,
                        snapshotVenueName: true,
                        snapshotCoverUrl: true,
                        snapshotStartAt: true
                    }
                })
            ]);
            stats = {
                total,
                upcoming,
                past,
                totalSpent: "—"
            };
            recent = (recentEntitlements ?? []).map((r)=>({
                    id: r.id,
                    title: r.snapshotTitle,
                    venueName: r.snapshotVenueName,
                    coverUrl: r.snapshotCoverUrl,
                    startAt: r.snapshotStartAt,
                    isUpcoming: r.snapshotStartAt ? new Date(r.snapshotStartAt) >= now : false
                }));
        } catch (err) {
            console.warn("[profile] falha ao carregar entitlements", err);
        }
    }
    const displayName = organizerProfile?.publicName?.trim() || profile.fullName?.trim() || profile.username || "Utilizador ORYA";
    const coverCandidate = profile.coverUrl?.trim() || recent.find((item)=>item.coverUrl)?.coverUrl || profile.avatarUrl || null;
    const headerCoverUrl = coverCandidate ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["optimizeImageUrl"])(coverCandidate, 1400, 72) : null;
    const isOrganizationProfile = Boolean(organizerProfile);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "relative orya-body-bg min-h-screen w-full overflow-hidden text-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none fixed inset-0",
                "aria-hidden": "true",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 946,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 947,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 948,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen"
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 949,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 945,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_60%)]"
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 951,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "relative flex flex-col gap-6 py-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$profile$2f$ProfileHeader$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        isOwner: isOwner,
                        name: displayName,
                        username: profile.username,
                        avatarUrl: profile.avatarUrl,
                        coverUrl: headerCoverUrl,
                        bio: profile.bio,
                        city: profile.city,
                        visibility: profile.visibility,
                        createdAt: profile.createdAt?.toISOString?.() ?? null,
                        followers: followersCount,
                        following: followingCount,
                        targetUserId: profile.id,
                        initialIsFollowing: initialIsFollowing,
                        isOrganization: isOrganizationProfile
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 953,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-5 sm:px-8",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "orya-page-width flex flex-col gap-6",
                            children: canShowPrivate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                        className: "rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                                                    title: "Eventos com bilhete",
                                                    value: stats.total,
                                                    subtitle: "Timeline ORYA.",
                                                    tone: "default"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/[username]/page.tsx",
                                                    lineNumber: 976,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                                                    title: "Próximos",
                                                    value: stats.upcoming,
                                                    subtitle: "O que vem aí.",
                                                    tone: "emerald"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/[username]/page.tsx",
                                                    lineNumber: 982,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                                                    title: "Passados",
                                                    value: stats.past,
                                                    subtitle: "Memórias.",
                                                    tone: "cyan"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/[username]/page.tsx",
                                                    lineNumber: 988,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                                                    title: "Total investido",
                                                    value: stats.totalSpent,
                                                    subtitle: "Bruto - taxas.",
                                                    tone: "purple"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/[username]/page.tsx",
                                                    lineNumber: 994,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/[username]/page.tsx",
                                            lineNumber: 975,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 974,
                                        columnNumber: 17
                                    }, this),
                                    isOwner ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                        className: "rounded-3xl border border-white/15 bg-white/5 backdrop-blur-2xl p-5 space-y-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)] min-h-[280px] relative overflow-hidden",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.03),transparent_34%),radial-gradient(circle_at_50%_85%,rgba(255,255,255,0.03),transparent_40%)]"
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 1005,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between gap-3 flex-wrap",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                                className: "text-sm font-semibold text-white/95 tracking-[0.08em]",
                                                                children: "Carteira ORYA"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 1008,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] text-white/68",
                                                                children: "Entitlements ativos primeiro; memórias logo atrás. Tudo num só lugar."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 1011,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 1007,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                        href: "/me/carteira",
                                                        className: "inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:border-white/45 hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur",
                                                        children: [
                                                            "Ver carteira",
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[12px]",
                                                                children: "↗"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/[username]/page.tsx",
                                                                lineNumber: 1020,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 1015,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 1006,
                                                columnNumber: 21
                                            }, this),
                                            recent.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex h-48 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-sm text-white/80",
                                                children: "Ainda não tens bilhetes ORYA."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 1025,
                                                columnNumber: 23
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid gap-3 md:grid-cols-2",
                                                children: recent.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(RecentCard, {
                                                        item: item
                                                    }, item.id, false, {
                                                        fileName: "[project]/app/[username]/page.tsx",
                                                        lineNumber: 1031,
                                                        columnNumber: 27
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 1029,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 1004,
                                        columnNumber: 19
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid gap-4 md:grid-cols-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(EventListCard, {
                                                title: "Próximos eventos",
                                                items: recent.filter((r)=>r.isUpcoming),
                                                emptyLabel: "Sem eventos futuros para mostrar."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 1038,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(EventListCard, {
                                                title: "Eventos passados",
                                                items: recent.filter((r)=>!r.isUpcoming),
                                                emptyLabel: "Sem eventos passados para mostrar."
                                            }, void 0, false, {
                                                fileName: "[project]/app/[username]/page.tsx",
                                                lineNumber: 1043,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 1037,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-lg font-semibold text-white",
                                        children: "Perfil privado"
                                    }, void 0, false, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 1053,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-sm text-white/70",
                                        children: [
                                            displayName,
                                            " mantém a timeline privada. Só o próprio consegue ver os eventos e bilhetes."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/[username]/page.tsx",
                                        lineNumber: 1054,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/[username]/page.tsx",
                                lineNumber: 1052,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/[username]/page.tsx",
                            lineNumber: 971,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 970,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 952,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/[username]/page.tsx",
        lineNumber: 944,
        columnNumber: 5
    }, this);
}
function formatFormDateRange(startAt, endAt) {
    if (!startAt && !endAt) return "Disponível sempre";
    if (startAt && endAt) {
        const startLabel = formatDate(startAt);
        const endLabel = formatDate(endAt);
        return startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel || endLabel;
    }
    return formatDate(startAt ?? endAt);
}
function buildTicketHref(slug) {
    return `/eventos/${slug}?checkout=1#bilhetes`;
}
function EventSpotlightCard({ event, label, emptyLabel, ctaLabel, ctaHref, variant = "default" }) {
    if (!event) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/70 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                    children: label
                }, void 0, false, {
                    fileName: "[project]/app/[username]/page.tsx",
                    lineNumber: 1099,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    className: "mt-2 text-xl font-semibold text-white",
                    children: emptyLabel
                }, void 0, false, {
                    fileName: "[project]/app/[username]/page.tsx",
                    lineNumber: 1100,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-1 text-[12px] text-white/60",
                    children: "A equipa atualiza as próximas datas aqui."
                }, void 0, false, {
                    fileName: "[project]/app/[username]/page.tsx",
                    lineNumber: 1101,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/[username]/page.tsx",
            lineNumber: 1098,
            columnNumber: 7
        }, this);
    }
    const cover = event.coverImageUrl ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["optimizeImageUrl"])(event.coverImageUrl, 1400, 72) : null;
    const eventHref = `/eventos/${event.slug}`;
    const wrapperClass = variant === "embedded" ? "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4" : "relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: wrapperClass,
        children: [
            cover && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 bg-cover bg-center",
                style: {
                    backgroundImage: `url(${cover})`
                }
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1116,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent"
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1121,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                href: eventHref,
                "aria-label": `Abrir ${event.title}`,
                className: "absolute inset-0 z-0"
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1122,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative z-10 max-w-xl space-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] uppercase tracking-[0.2em] text-white/70",
                        children: label
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 1128,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-2xl font-semibold text-white",
                        children: event.title
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 1129,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] text-white/75",
                        children: formatEventDateRange(event.startsAt, event.endsAt, event.timezone)
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 1130,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] text-white/65",
                        children: [
                            event.locationName,
                            event.locationCity ? ` · ${event.locationCity}` : ""
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 1133,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 flex flex-wrap items-center gap-2",
                        children: ctaHref && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                            href: ctaHref,
                            className: "relative z-10 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.35)]",
                            children: ctaLabel
                        }, void 0, false, {
                            fileName: "[project]/app/[username]/page.tsx",
                            lineNumber: 1139,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 1137,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1127,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/[username]/page.tsx",
        lineNumber: 1114,
        columnNumber: 5
    }, this);
}
function toneClasses(tone) {
    switch(tone){
        case "emerald":
            return "border-emerald-300/30 from-emerald-500/16 via-emerald-500/9 to-[#0c1a14] shadow-[0_12px_26px_rgba(16,185,129,0.18)] text-emerald-50";
        case "cyan":
            return "border-cyan-300/30 from-cyan-500/16 via-cyan-500/9 to-[#08171c] shadow-[0_12px_26px_rgba(34,211,238,0.18)] text-cyan-50";
        case "purple":
            return "border-purple-300/30 from-purple-500/16 via-purple-500/9 to-[#120d1f] shadow-[0_12px_26px_rgba(168,85,247,0.18)] text-purple-50";
        default:
            return "border-white/15 from-white/12 via-[#0b1224]/78 to-[#0a0f1d] shadow-[0_12px_26px_rgba(0,0,0,0.45)] text-white";
    }
}
function StatCard({ title, value, subtitle, tone = "default" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-transform duration-150 hover:-translate-y-[3px] hover:shadow-[0_22px_50px_rgba(0,0,0,0.65)] ${toneClasses(tone)}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute inset-0 rounded-2xl border border-white/10 mix-blend-screen"
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1184,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-white/5 blur-2xl"
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1185,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: `text-[11px] uppercase tracking-[0.16em] ${tone === "default" ? "text-white/65" : "text-white/75"}`,
                children: title
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1186,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-3xl font-semibold",
                children: value
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1193,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[12px] text-white/70",
                children: subtitle
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1194,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/[username]/page.tsx",
        lineNumber: 1179,
        columnNumber: 5
    }, this);
}
function RecentCard({ item }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-2xl",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center gap-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]",
                    children: item.coverUrl ? // eslint-disable-next-line @next/next/no-img-element
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                        src: item.coverUrl,
                        alt: item.title,
                        className: "h-full w-full object-cover"
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 1210,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55",
                        children: "ORYA"
                    }, void 0, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 1216,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/[username]/page.tsx",
                    lineNumber: 1207,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm font-semibold text-white line-clamp-2",
                            children: item.title
                        }, void 0, false, {
                            fileName: "[project]/app/[username]/page.tsx",
                            lineNumber: 1222,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] text-white/70 line-clamp-1",
                            children: item.venueName || "Local a anunciar"
                        }, void 0, false, {
                            fileName: "[project]/app/[username]/page.tsx",
                            lineNumber: 1223,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] text-white/60",
                            children: formatDate(item.startAt)
                        }, void 0, false, {
                            fileName: "[project]/app/[username]/page.tsx",
                            lineNumber: 1224,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/[username]/page.tsx",
                    lineNumber: 1221,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/[username]/page.tsx",
            lineNumber: 1206,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/[username]/page.tsx",
        lineNumber: 1205,
        columnNumber: 5
    }, this);
}
function EventListCard({ title, items, emptyLabel }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rounded-3xl border border-white/15 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 flex items-center justify-between",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    className: "text-sm font-semibold text-white/90",
                    children: title
                }, void 0, false, {
                    fileName: "[project]/app/[username]/page.tsx",
                    lineNumber: 1243,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1242,
                columnNumber: 7
            }, this),
            items.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-[12px] text-white/80",
                children: emptyLabel
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1246,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(RecentCard, {
                        item: item
                    }, item.id, false, {
                        fileName: "[project]/app/[username]/page.tsx",
                        lineNumber: 1252,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/[username]/page.tsx",
                lineNumber: 1250,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/[username]/page.tsx",
        lineNumber: 1241,
        columnNumber: 5
    }, this);
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/[username]/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/[username]/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__26013176._.js.map