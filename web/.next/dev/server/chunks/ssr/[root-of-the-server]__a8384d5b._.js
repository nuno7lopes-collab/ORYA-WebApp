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
"[project]/app/eventos/[slug]/loading.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/eventos/[slug]/loading.tsx [app-rsc] (ecmascript)"));
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
"[project]/app/components/checkout/contextoCheckout.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "CheckoutProvider",
    ()=>CheckoutProvider,
    "useCheckout",
    ()=>useCheckout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const CheckoutProvider = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call CheckoutProvider() from the server but CheckoutProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/checkout/contextoCheckout.tsx <module evaluation>", "CheckoutProvider");
const useCheckout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call useCheckout() from the server but useCheckout is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/checkout/contextoCheckout.tsx <module evaluation>", "useCheckout");
}),
"[project]/app/components/checkout/contextoCheckout.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "CheckoutProvider",
    ()=>CheckoutProvider,
    "useCheckout",
    ()=>useCheckout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const CheckoutProvider = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call CheckoutProvider() from the server but CheckoutProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/checkout/contextoCheckout.tsx", "CheckoutProvider");
const useCheckout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call useCheckout() from the server but useCheckout is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/components/checkout/contextoCheckout.tsx", "useCheckout");
}),
"[project]/app/components/checkout/contextoCheckout.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/eventos/[slug]/WavesSectionClient.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/WavesSectionClient.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/WavesSectionClient.tsx <module evaluation>", "default");
}),
"[project]/app/eventos/[slug]/WavesSectionClient.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/WavesSectionClient.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/WavesSectionClient.tsx", "default");
}),
"[project]/app/eventos/[slug]/WavesSectionClient.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$WavesSectionClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/WavesSectionClient.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$WavesSectionClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/WavesSectionClient.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$WavesSectionClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/eventos/[slug]/EventPageClient.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/EventPageClient.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/EventPageClient.tsx <module evaluation>", "default");
}),
"[project]/app/eventos/[slug]/EventPageClient.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/EventPageClient.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/EventPageClient.tsx", "default");
}),
"[project]/app/eventos/[slug]/EventPageClient.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventPageClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventPageClient.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventPageClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventPageClient.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventPageClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/eventos/[slug]/EventLiveClient.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/EventLiveClient.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/EventLiveClient.tsx <module evaluation>", "default");
}),
"[project]/app/eventos/[slug]/EventLiveClient.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/EventLiveClient.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/EventLiveClient.tsx", "default");
}),
"[project]/app/eventos/[slug]/EventLiveClient.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventLiveClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventLiveClient.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventLiveClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventLiveClient.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventLiveClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
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
"[project]/lib/padel/eventSnapshot.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "buildPadelEventSnapshot",
    ()=>buildPadelEventSnapshot
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-rsc] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
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
    const event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
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
    const partnerClubs = partnerIds.length > 0 ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].padelClub.findMany({
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
"[project]/app/eventos/[slug]/EventBackgroundTuner.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/EventBackgroundTuner.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/EventBackgroundTuner.tsx <module evaluation>", "default");
}),
"[project]/app/eventos/[slug]/EventBackgroundTuner.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/EventBackgroundTuner.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/EventBackgroundTuner.tsx", "default");
}),
"[project]/app/eventos/[slug]/EventBackgroundTuner.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventBackgroundTuner$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventBackgroundTuner.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventBackgroundTuner$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventBackgroundTuner.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventBackgroundTuner$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/lib/utils/email.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/lib/username.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/app/eventos/[slug]/InviteGateClient.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/InviteGateClient.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/InviteGateClient.tsx <module evaluation>", "default");
}),
"[project]/app/eventos/[slug]/InviteGateClient.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/eventos/[slug]/InviteGateClient.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/eventos/[slug]/InviteGateClient.tsx", "default");
}),
"[project]/app/eventos/[slug]/InviteGateClient.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$InviteGateClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/InviteGateClient.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$InviteGateClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/InviteGateClient.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$InviteGateClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/eventos/[slug]/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

// app/eventos/[slug]/page.tsx
__turbopack_context__.s([
    "default",
    ()=>EventPage,
    "dynamic",
    ()=>dynamic,
    "generateMetadata",
    ()=>generateMetadata,
    "revalidate",
    ()=>revalidate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$WavesSectionClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/WavesSectionClient.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventPageClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventPageClient.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventLiveClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventLiveClient.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/image.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$eventSnapshot$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/padel/eventSnapshot.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventBackgroundTuner$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventBackgroundTuner.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2f$email$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils/email.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/username.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$InviteGateClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/InviteGateClient.tsx [app-rsc] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$eventSnapshot$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$eventSnapshot$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
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
;
;
;
;
function slugify(input) {
    return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function generateMetadata({ params }) {
    const resolved = await params;
    const slug = resolved?.slug;
    if (!slug) {
        return {
            title: "Evento | ORYA",
            description: "Explora eventos na ORYA."
        };
    }
    let event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            slug
        },
        select: {
            title: true,
            description: true,
            locationName: true,
            organizerId: true
        }
    });
    if (!event) {
        const normalized = slugify(slug);
        if (normalized && normalized !== slug) {
            event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
                where: {
                    slug: normalized
                },
                select: {
                    title: true,
                    description: true,
                    locationName: true,
                    organizerId: true
                }
            });
        }
    }
    if (!event || !event.organizerId) {
        return {
            title: "Evento não encontrado | ORYA",
            description: "Este evento já não está disponível."
        };
    }
    const location = event.locationName || "ORYA";
    const baseTitle = event.title || "Evento ORYA";
    return {
        title: `${baseTitle} | ORYA`,
        description: event.description && event.description.trim().length > 0 ? event.description : `Descobre o evento ${baseTitle} em ${location} na ORYA.`
    };
}
const UPDATE_CATEGORY_LABELS = {
    TODAY: "Hoje",
    CHANGES: "Alterações",
    RESULTS: "Resultados",
    CALL_UPS: "Convocatórias"
};
const EVENT_BG_MASK = `linear-gradient(
  to bottom,
  rgba(0,0,0,var(--event-bg-mask-alpha-1,1)) var(--event-bg-mask-stop-1,0%),
  rgba(0,0,0,var(--event-bg-mask-alpha-2,0.98)) var(--event-bg-mask-stop-2,24%),
  rgba(0,0,0,var(--event-bg-mask-alpha-3,0.82)) var(--event-bg-mask-stop-3,46%),
  rgba(0,0,0,var(--event-bg-mask-alpha-4,0.5)) var(--event-bg-mask-stop-4,68%),
  rgba(0,0,0,var(--event-bg-mask-alpha-5,0.2)) var(--event-bg-mask-stop-5,86%),
  rgba(0,0,0,var(--event-bg-mask-alpha-6,0)) var(--event-bg-mask-stop-6,100%)
)`;
const EVENT_BG_OVERLAY = `linear-gradient(
  to bottom,
  rgba(0,0,0,var(--event-bg-overlay-top,0.38)) 0%,
  rgba(0,0,0,var(--event-bg-overlay-mid,0.22)) 45%,
  rgba(0,0,0,var(--event-bg-overlay-bottom,0.06)) 100%
)`;
const EVENT_BG_FADE = `linear-gradient(
  to bottom,
  rgba(0,0,0,0) 0%,
  rgba(0,0,0,0) var(--event-bg-fade-start,78%),
  rgba(0,0,0,var(--event-bg-fade-dark,0.78)) var(--event-bg-fade-mid,90%),
  rgba(0,0,0,1) var(--event-bg-fade-end,99%)
)`;
function initialsFromName(name) {
    const trimmed = name.trim();
    if (!trimmed) return "OR";
    return trimmed.split(/\s+/).slice(0, 2).map((part)=>part[0]?.toUpperCase()).join("");
}
function getWaveStatus(ticket) {
    const now = new Date();
    if (ticket.totalQuantity !== null && ticket.totalQuantity !== undefined && ticket.soldQuantity >= ticket.totalQuantity) {
        return "sold_out";
    }
    if (ticket.startsAt && now < ticket.startsAt) {
        return "upcoming";
    }
    if (ticket.endsAt && now > ticket.endsAt) {
        return "closed";
    }
    return "on_sale";
}
async function EventPage({ params, searchParams }) {
    const { slug } = await params;
    const resolvedSearchParams = await Promise.resolve(searchParams);
    if (!slug) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
    const { data: { user } } = await supabase.auth.getUser();
    const profile = user ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].profile.findUnique({
        where: {
            id: user.id
        }
    }) : null;
    const isAdmin = Array.isArray(profile?.roles) ? profile.roles.includes("admin") : false;
    const event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            slug
        },
        include: {
            ticketTypes: {
                include: {
                    padelEventCategoryLink: {
                        include: {
                            category: {
                                select: {
                                    label: true
                                }
                            }
                        }
                    }
                }
            },
            padelCategoryLinks: {
                include: {
                    category: {
                        select: {
                            label: true
                        }
                    }
                }
            },
            padelTournamentConfig: true,
            organizer: {
                select: {
                    username: true,
                    publicName: true,
                    businessName: true,
                    brandingAvatarUrl: true,
                    publicListingEnabled: true,
                    status: true
                }
            }
        }
    });
    if (!event || !event.organizerId) {
        const normalized = slugify(slug);
        if (normalized && normalized !== slug) {
            const fallback = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
                where: {
                    slug: normalized
                },
                include: {
                    ticketTypes: {
                        include: {
                            padelEventCategoryLink: {
                                include: {
                                    category: {
                                        select: {
                                            label: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    padelCategoryLinks: {
                        include: {
                            category: {
                                select: {
                                    label: true
                                }
                            }
                        }
                    },
                    padelTournamentConfig: true,
                    organizer: {
                        select: {
                            username: true,
                            publicName: true,
                            businessName: true,
                            brandingAvatarUrl: true,
                            publicListingEnabled: true,
                            status: true
                        }
                    }
                }
            });
            if (fallback && fallback.organizerId) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(`/eventos/${fallback.slug}`);
            }
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    if (event.isTest && !isAdmin) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    const publicAccessMode = event.publicAccessMode ?? (event.inviteOnly ? "INVITE" : "OPEN");
    const inviteOnly = publicAccessMode === "INVITE";
    const userEmailNormalized = user ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2f$email$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeEmail"])(user.email ?? null) : null;
    const usernameNormalized = profile?.username ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sanitizeUsername"])(profile.username) : null;
    const hasUsername = Boolean(usernameNormalized);
    let isInvited = !inviteOnly;
    if (inviteOnly && !isAdmin && user) {
        const identifiers = [];
        if (userEmailNormalized) identifiers.push(userEmailNormalized);
        if (usernameNormalized) identifiers.push(usernameNormalized);
        if (identifiers.length > 0) {
            const invite = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].eventInvite.findFirst({
                where: {
                    eventId: event.id,
                    targetIdentifier: {
                        in: identifiers
                    },
                    scope: "PUBLIC"
                },
                select: {
                    id: true
                }
            });
            if (invite) {
                isInvited = true;
            }
        }
    } else if (inviteOnly && isAdmin) {
        isInvited = true;
    }
    const showInviteGate = inviteOnly && !isInvited;
    const canFreeCheckout = Boolean(user) && hasUsername && (!inviteOnly || isInvited);
    const allowCheckout = !showInviteGate && (event.isFree ? canFreeCheckout : true);
    const freeUsernameGateMessage = event.isFree ? user ? hasUsername ? null : "Define um username na tua conta para concluíres a inscrição gratuita." : "Inicia sessão e define um username para garantires o lugar." : null;
    const isPadel = event.templateType === "PADEL";
    const checkoutVariant = isPadel && event.padelTournamentConfig?.padelV2Enabled ? "PADEL" : "DEFAULT";
    const padelSnapshot = isPadel ? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$padel$2f$eventSnapshot$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["buildPadelEventSnapshot"])(event.id) : null;
    const viewParam = typeof resolvedSearchParams?.view === "string" ? resolvedSearchParams.view : null;
    const showLiveInline = viewParam === "live";
    const liveHref = `/eventos/${slug}/live`;
    const liveInlineHref = `/eventos/${slug}?view=live`;
    // Buscar bilhetes ligados a este evento (para contagem de pessoas)
    const safeLocationName = event.locationName || "Local a anunciar";
    const safeTimezone = event.timezone || "Europe/Lisbon";
    const organizerDisplay = event.organizer?.publicName || event.organizer?.businessName || null;
    const organizerUsername = event.organizer?.publicListingEnabled !== false && event.organizer?.status === "ACTIVE" ? event.organizer?.username ?? null : null;
    const safeOrganizer = organizerDisplay || "Organização ORYA";
    const organizerAvatarUrl = event.organizer?.brandingAvatarUrl?.trim() || null;
    const organizerInitials = initialsFromName(safeOrganizer);
    const organizerHandle = organizerUsername ? `@${organizerUsername}` : null;
    const liveHubVisibility = event.liveHubVisibility ?? "PUBLIC";
    const eventUpdates = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].organizationUpdate.findMany({
        where: {
            eventId: event.id,
            status: "PUBLISHED"
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
        take: 5
    });
    const updateDateFormatter = new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: safeTimezone
    });
    const formattedUpdates = eventUpdates.map((update)=>{
        const date = update.publishedAt ?? update.createdAt;
        return {
            ...update,
            dateLabel: date ? updateDateFormatter.format(date) : "A definir",
            categoryLabel: UPDATE_CATEGORY_LABELS[update.category] ?? update.category
        };
    });
    // Nota: no modelo atual, não determinamos o utilizador autenticado neste
    // Server Component para evitar erros de escrita de cookies.
    // A verificação de "já tens bilhete" pode ser feita no cliente.
    const userId = null;
    const currentUserHasTicket = false;
    const startDateObj = event.startsAt;
    const endDateObj = event.endsAt ?? event.startsAt;
    const dateFormatter = new Intl.DateTimeFormat("pt-PT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: safeTimezone
    });
    const timeFormatter = new Intl.DateTimeFormat("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: safeTimezone
    });
    const date = dateFormatter.format(startDateObj);
    const time = timeFormatter.format(startDateObj);
    const endTime = timeFormatter.format(endDateObj);
    const formattedDate = date.charAt(0).toUpperCase() + date.slice(1);
    const descriptionText = event.description && event.description.trim().length > 0 ? event.description.trim() : "A descrição deste evento será atualizada em breve.";
    const rawCover = event.coverImageUrl && event.coverImageUrl.trim().length > 0 ? event.coverImageUrl : "/images/placeholder-event.jpg";
    const cover = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["optimizeImageUrl"])(rawCover, 1200, 72, "webp");
    // versão ultra-leve apenas para o blur de fundo (mantém o efeito mas evita puxar MBs)
    const blurredCover = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["optimizeImageUrl"])(rawCover, 120, 20, "webp");
    const nowDate = new Date();
    const eventEnded = endDateObj < nowDate;
    const eventStarted = startDateObj <= nowDate && endDateObj >= nowDate;
    const eventUpcoming = startDateObj > nowDate;
    const phaseIndex = eventEnded ? 2 : eventStarted ? 1 : 0;
    const timelineSteps = [
        {
            key: "before",
            label: "Antes",
            hint: eventUpcoming ? "Inscrições abertas" : "Concluído"
        },
        {
            key: "during",
            label: "Durante",
            hint: eventStarted ? "A decorrer agora" : eventEnded ? "Concluído" : "Em breve"
        },
        {
            key: "after",
            label: "Depois",
            hint: eventEnded ? "Histórico disponível" : "Em breve"
        }
    ].map((step, idx)=>({
            ...step,
            state: idx < phaseIndex ? "done" : idx === phaseIndex ? "active" : "pending"
        }));
    const ticketTypesWithVisibility = event.ticketTypes;
    const orderedTickets = ticketTypesWithVisibility.filter((t)=>t.isVisible ?? true).sort((a, b)=>{
        const ao = a.sortOrder ?? 0;
        const bo = b.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return a.price - b.price;
    });
    const uiTickets = orderedTickets.map((t, index)=>{
        const rawStatus = String(t.status || "").toUpperCase();
        const remaining = t.totalQuantity === null || t.totalQuantity === undefined ? null : t.totalQuantity - t.soldQuantity;
        const statusFromEnum = rawStatus === "CLOSED" || rawStatus === "ENDED" || rawStatus === "OFF_SALE" ? "closed" : rawStatus === "SOLD_OUT" ? "sold_out" : rawStatus === "UPCOMING" ? "upcoming" : "on_sale";
        // Override: if remaining is 0, this wave é sold_out (mesmo com status)
        const finalStatus = remaining !== null && remaining <= 0 ? "sold_out" : statusFromEnum !== "on_sale" ? statusFromEnum : getWaveStatus({
            startsAt: t.startsAt,
            endsAt: t.endsAt,
            totalQuantity: t.totalQuantity,
            soldQuantity: t.soldQuantity
        });
        return {
            id: String(t.id),
            name: t.name?.trim() || `Wave ${index + 1}`,
            price: (t.price ?? 0) / 100,
            currency: t.currency,
            totalQuantity: t.totalQuantity,
            soldQuantity: t.soldQuantity,
            remaining,
            status: finalStatus,
            startsAt: t.startsAt ? t.startsAt.toISOString() : null,
            endsAt: t.endsAt ? t.endsAt.toISOString() : null,
            available: finalStatus === "on_sale" ? remaining === null ? true : remaining > 0 && !eventEnded : false,
            isVisible: t.isVisible ?? true,
            padelCategoryId: t.padelEventCategoryLink?.padelCategoryId ?? null,
            padelCategoryLabel: t.padelEventCategoryLink?.category?.label ?? null,
            padelCategoryLinkId: t.padelEventCategoryLinkId ?? null
        };
    });
    const minTicketPrice = uiTickets.length > 0 ? uiTickets.reduce((min, t)=>t.price < min ? t.price : min, uiTickets[0].price) : null;
    const displayPriceFrom = minTicketPrice;
    const anyOnSale = uiTickets.some((t)=>t.status === "on_sale");
    const anyUpcoming = uiTickets.some((t)=>t.status === "upcoming");
    const allClosed = uiTickets.length > 0 && uiTickets.every((t)=>t.status === "closed");
    const allSoldOut = uiTickets.length > 0 && uiTickets.every((t)=>t.status === "sold_out");
    const availabilityLabel = eventEnded ? "Evento terminado" : allSoldOut ? "Esgotado" : anyOnSale ? "Bilhetes à venda" : anyUpcoming ? "Vendas em breve" : allClosed ? "Vendas encerradas" : "Bilhetes";
    const availabilityTone = eventEnded || allClosed ? "border-white/25 bg-white/10 text-white/70" : allSoldOut ? "border-orange-400/40 bg-orange-500/15 text-orange-100" : anyOnSale ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100" : "border-yellow-400/40 bg-yellow-500/15 text-yellow-100";
    // Carregar revendas deste evento via API F5-9
    let resales = [];
    try {
        const headersList = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["headers"])();
        const protocol = headersList.get("x-forwarded-proto") ?? "http";
        const host = headersList.get("host");
        if (host) {
            const baseUrl = `${protocol}://${host}`;
            const res = await fetch(`${baseUrl}/api/eventos/${encodeURIComponent(slug)}/resales`, {
                cache: "no-store"
            });
            if (res.ok) {
                const data = await res.json().catch(()=>null);
                if (data?.ok && Array.isArray(data.resales)) {
                    resales = data.resales;
                }
            } else {
                console.error("Falha ao carregar revendas para o evento", slug, res.status);
            }
        }
    } catch (err) {
        console.error("Erro ao carregar revendas para o evento", slug, err);
    }
    const showPriceFrom = !event.isFree && minTicketPrice !== null;
    const padelV2Enabled = Boolean(event.padelTournamentConfig?.padelV2Enabled);
    const padelCategoryLinks = Array.isArray(event.padelCategoryLinks) ? event.padelCategoryLinks : [];
    const padelDefaultCategoryId = event.padelTournamentConfig?.defaultCategoryId ?? padelCategoryLinks.find((link)=>link.isEnabled)?.padelCategoryId ?? null;
    const padelDefaultCategoryLinkId = padelDefaultCategoryId != null ? padelCategoryLinks.find((link)=>link.padelCategoryId === padelDefaultCategoryId)?.id ?? null : null;
    const defaultPadelTicketId = (()=>{
        const eligible = orderedTickets.filter((t)=>{
            const remaining = t.totalQuantity === null || t.totalQuantity === undefined ? null : t.totalQuantity - t.soldQuantity;
            const onSale = String(t.status || "").toUpperCase() === "ON_SALE";
            const hasStock = remaining === null ? true : remaining > 0;
            return onSale && hasStock;
        });
        const filtered = padelV2Enabled && padelDefaultCategoryLinkId ? eligible.filter((t)=>t.padelEventCategoryLinkId === padelDefaultCategoryLinkId) : eligible;
        if (!filtered.length) return null;
        const cheapest = filtered.reduce((min, cur)=>cur.price < min.price ? cur : min, filtered[0]);
        return cheapest.id ?? null;
    })();
    const backgroundDefaults = {
        blur: 56,
        scale: 1.28,
        saturate: 1.28,
        brightness: 1.06,
        maskStops: [
            0,
            24,
            46,
            68,
            86,
            100
        ],
        maskAlphas: [
            1,
            0.98,
            0.82,
            0.5,
            0.2,
            0
        ],
        overlayTop: 0.38,
        overlayMid: 0.22,
        overlayBottom: 0.06,
        fadeStart: 78,
        fadeMid: 90,
        fadeEnd: 99,
        fadeDark: 0.78
    };
    const backgroundVars = {
        "--event-bg-blur": `${backgroundDefaults.blur}px`,
        "--event-bg-scale": `${backgroundDefaults.scale}`,
        "--event-bg-saturate": `${backgroundDefaults.saturate}`,
        "--event-bg-brightness": `${backgroundDefaults.brightness}`,
        "--event-bg-mask-stop-1": `${backgroundDefaults.maskStops[0]}%`,
        "--event-bg-mask-stop-2": `${backgroundDefaults.maskStops[1]}%`,
        "--event-bg-mask-stop-3": `${backgroundDefaults.maskStops[2]}%`,
        "--event-bg-mask-stop-4": `${backgroundDefaults.maskStops[3]}%`,
        "--event-bg-mask-stop-5": `${backgroundDefaults.maskStops[4]}%`,
        "--event-bg-mask-stop-6": `${backgroundDefaults.maskStops[5]}%`,
        "--event-bg-mask-alpha-1": `${backgroundDefaults.maskAlphas[0]}`,
        "--event-bg-mask-alpha-2": `${backgroundDefaults.maskAlphas[1]}`,
        "--event-bg-mask-alpha-3": `${backgroundDefaults.maskAlphas[2]}`,
        "--event-bg-mask-alpha-4": `${backgroundDefaults.maskAlphas[3]}`,
        "--event-bg-mask-alpha-5": `${backgroundDefaults.maskAlphas[4]}`,
        "--event-bg-mask-alpha-6": `${backgroundDefaults.maskAlphas[5]}`,
        "--event-bg-overlay-top": `${backgroundDefaults.overlayTop}`,
        "--event-bg-overlay-mid": `${backgroundDefaults.overlayMid}`,
        "--event-bg-overlay-bottom": `${backgroundDefaults.overlayBottom}`,
        "--event-bg-fade-start": `${backgroundDefaults.fadeStart}%`,
        "--event-bg-fade-mid": `${backgroundDefaults.fadeMid}%`,
        "--event-bg-fade-end": `${backgroundDefaults.fadeEnd}%`,
        "--event-bg-fade-dark": `${backgroundDefaults.fadeDark}`
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        id: "event-page",
        className: "relative orya-body-bg min-h-screen w-full overflow-hidden text-white",
        style: backgroundVars,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CheckoutProvider"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventBackgroundTuner$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    targetId: "event-page",
                    defaults: backgroundDefaults
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                    lineNumber: 635,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "pointer-events-none fixed inset-0 overflow-hidden",
                    "aria-hidden": "true",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-full w-full",
                            style: {
                                backgroundImage: `url(${blurredCover})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                filter: "blur(var(--event-bg-blur, 56px)) saturate(var(--event-bg-saturate, 1.28)) brightness(var(--event-bg-brightness, 1.06))",
                                WebkitFilter: "blur(var(--event-bg-blur, 56px)) saturate(var(--event-bg-saturate, 1.28)) brightness(var(--event-bg-brightness, 1.06))",
                                transform: "scale(var(--event-bg-scale, 1.28))",
                                WebkitTransform: "scale(var(--event-bg-scale, 1.28))",
                                WebkitMaskImage: EVENT_BG_MASK,
                                maskImage: EVENT_BG_MASK
                            }
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 642,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute inset-0",
                            style: {
                                background: EVENT_BG_OVERLAY
                            }
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 659,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute inset-0",
                            style: {
                                background: EVENT_BG_FADE
                            }
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 661,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                    lineNumber: 637,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "pointer-events-none absolute inset-0",
                    "aria-hidden": "true",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.35),transparent_60%)] opacity-80 blur-3xl"
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 671,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute top-[26vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.3),transparent_60%)] opacity-80 blur-3xl"
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 672,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_35%,rgba(0,0,0,0.6))] mix-blend-screen"
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 673,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                    lineNumber: 670,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "relative z-10 w-full pb-16 pt-20 md:pb-20 md:pt-28",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "orya-page-width flex items-center justify-between px-4 md:px-8",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/explorar",
                                    className: "inline-flex items-center gap-2 text-xs font-medium text-white/75 transition hover:text-white",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-lg leading-none",
                                            children: "←"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 683,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Voltar a explorar"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 684,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 679,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70 sm:flex",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Evento ORYA"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 687,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "h-1 w-1 rounded-full bg-white/40"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 688,
                                            columnNumber: 15
                                        }, this),
                                        organizerUsername ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                            href: `/${organizerUsername}`,
                                            className: "text-white/80 hover:text-white",
                                            children: safeOrganizer
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 690,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: safeOrganizer
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 694,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 686,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 678,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "orya-page-width mt-6 grid grid-cols-1 gap-6 px-4 md:px-8 lg:grid-cols-[1.1fr_0.9fr]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "pointer-events-none absolute -inset-[1px] rounded-[32px] bg-[linear-gradient(135deg,rgba(255,0,200,0.35),rgba(107,255,255,0.35),rgba(22,70,245,0.35))] opacity-70 blur-[2px]"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 701,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative rounded-[30px] border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.16),rgba(2,6,16,0.78))] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl md:p-8 animate-fade-slide",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.18),transparent_55%)] opacity-80"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 703,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.35))] opacity-70"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 704,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "relative",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/60",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: safeLocationName
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 707,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "h-1 w-1 rounded-full bg-white/30"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 708,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: event.locationCity || "Cidade a anunciar"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 709,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 706,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "mt-4 flex flex-wrap gap-2 text-white/85",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: `rounded-full border px-3 py-1.5 text-[11px] font-semibold ${availabilityTone}`,
                                                                    children: availabilityLabel
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 713,
                                                                    columnNumber: 21
                                                                }, this),
                                                                inviteOnly && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/80",
                                                                    children: "Só por convite"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 717,
                                                                    columnNumber: 23
                                                                }, this),
                                                                event.isFree ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-100",
                                                                    children: "Entrada gratuita"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 722,
                                                                    columnNumber: 23
                                                                }, this) : showPriceFrom ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-100",
                                                                    children: [
                                                                        "Desde ",
                                                                        (displayPriceFrom ?? 0).toFixed(2),
                                                                        " €"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 726,
                                                                    columnNumber: 23
                                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/75",
                                                                    children: "Preço a anunciar"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 730,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 712,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                            className: "mt-4 bg-gradient-to-r from-[#FF72D0] via-[#6BFFFF] to-[#5B7CFF] bg-clip-text text-4xl font-extrabold leading-tight text-transparent md:text-5xl lg:text-6xl",
                                                            children: event.title
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 736,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "mt-4",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-[10px] uppercase tracking-[0.2em] text-white/60",
                                                                    children: "Organizado por"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 741,
                                                                    columnNumber: 21
                                                                }, this),
                                                                organizerUsername ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                                    href: `/${organizerUsername}`,
                                                                    className: "mt-2 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition hover:border-white/20 hover:bg-white/10",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/40 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70",
                                                                            children: organizerAvatarUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                src: organizerAvatarUrl,
                                                                                alt: safeOrganizer,
                                                                                className: "h-full w-full object-cover"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 752,
                                                                                columnNumber: 29
                                                                            }, this) : organizerInitials
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 749,
                                                                            columnNumber: 25
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex flex-col",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "flex items-center gap-2",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                            className: "text-sm font-semibold text-white",
                                                                                            children: safeOrganizer
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 763,
                                                                                            columnNumber: 29
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                            className: "rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/65",
                                                                                            children: "Organização"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 764,
                                                                                            columnNumber: 29
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                    lineNumber: 762,
                                                                                    columnNumber: 27
                                                                                }, this),
                                                                                organizerHandle && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "text-xs text-white/60",
                                                                                    children: organizerHandle
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                    lineNumber: 769,
                                                                                    columnNumber: 29
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 761,
                                                                            columnNumber: 25
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 745,
                                                                    columnNumber: 23
                                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "mt-2 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/40 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70",
                                                                            children: organizerAvatarUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                src: organizerAvatarUrl,
                                                                                alt: safeOrganizer,
                                                                                className: "h-full w-full object-cover"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 778,
                                                                                columnNumber: 29
                                                                            }, this) : organizerInitials
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 775,
                                                                            columnNumber: 25
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex flex-col",
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "flex items-center gap-2",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        className: "text-sm font-semibold text-white",
                                                                                        children: safeOrganizer
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                        lineNumber: 789,
                                                                                        columnNumber: 29
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        className: "rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/65",
                                                                                        children: "Organização"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                        lineNumber: 790,
                                                                                        columnNumber: 29
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 788,
                                                                                columnNumber: 27
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 787,
                                                                            columnNumber: 25
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 774,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 740,
                                                            columnNumber: 19
                                                        }, this),
                                                        currentUserHasTicket && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-100",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-sm",
                                                                    children: "🎟️"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 801,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: "Já tens bilhete para este evento"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 802,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 800,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "mt-6 flex flex-wrap items-center gap-4",
                                                            children: [
                                                                !eventEnded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                                    href: "#bilhetes",
                                                                    className: "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-transform hover:scale-105 active:scale-95 md:text-sm",
                                                                    children: [
                                                                        event.isFree ? "Garantir lugar" : "Ver bilhetes",
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "text-xs",
                                                                            children: "↓"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 813,
                                                                            columnNumber: 25
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 808,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                                    href: "#resumo",
                                                                    className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white/80 transition hover:border-white/30 hover:bg-white/10 md:text-sm",
                                                                    children: "Ver resumo"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 816,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 806,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 705,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 702,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 700,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "pointer-events-none absolute -inset-[1px] rounded-[34px] bg-[conic-gradient(from_120deg,rgba(107,255,255,0.5),rgba(255,0,200,0.4),rgba(22,70,245,0.5),rgba(107,255,255,0.5))] opacity-60 blur-[2px]"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 828,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative h-full min-h-[260px] overflow-hidden rounded-[32px] border border-white/15 bg-white/5 shadow-[0_28px_70px_rgba(0,0,0,0.85)]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                    src: cover,
                                                    alt: `Capa do evento ${event.title}`,
                                                    fill: true,
                                                    priority: true,
                                                    fetchPriority: "high",
                                                    sizes: "(max-width: 768px) 90vw, (max-width: 1200px) 40vw, 480px",
                                                    className: "object-cover",
                                                    placeholder: "blur",
                                                    blurDataURL: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["defaultBlurDataURL"]
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 830,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 841,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 829,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 827,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 699,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "orya-page-width mt-6 px-4 md:px-8",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-1 gap-3 md:grid-cols-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Data & hora"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 849,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-sm font-semibold text-white/90",
                                                children: formattedDate
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 852,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-xs text-white/60",
                                                children: [
                                                    time,
                                                    " – ",
                                                    endTime
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 855,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                        lineNumber: 848,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Local"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 860,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-sm font-semibold text-white/90",
                                                children: safeLocationName
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 863,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-xs text-white/60",
                                                children: event.locationCity || "Cidade a anunciar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 866,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                        lineNumber: 859,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Preço"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 871,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-sm font-semibold text-white/90",
                                                children: event.isFree ? "Entrada gratuita" : showPriceFrom ? `${(displayPriceFrom ?? 0).toFixed(2)} €` : "A anunciar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 874,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-xs text-white/60",
                                                children: event.isFree ? "Reserva o teu lugar agora." : "Taxas incluídas no checkout."
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 881,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                        lineNumber: 870,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                lineNumber: 847,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 846,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                    lineNumber: 677,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "pointer-events-none relative z-10 orya-page-width px-6 md:px-10",
                    "aria-hidden": "true",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative my-8 md:my-10",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-px w-full bg-gradient-to-r from-transparent via-white/18 to-transparent"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                lineNumber: 896,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute inset-0 blur-2xl",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-px w-full bg-gradient-to-r from-transparent via-[#6BFFFF]/25 to-transparent"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 898,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                lineNumber: 897,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                        lineNumber: 895,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                    lineNumber: 891,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "relative z-10 orya-page-width grid grid-cols-1 gap-12 px-6 pb-28 pt-10 md:grid-cols-3 md:px-10",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-12 md:col-span-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                    id: "resumo",
                                    className: "rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8 animate-fade-slide",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: "O que precisas de saber"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 912,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "h-1 w-1 rounded-full bg-white/30"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 913,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: "Informação essencial"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 914,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 911,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "mt-3 text-2xl font-semibold",
                                            children: "Resumo do evento"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 916,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-3 whitespace-pre-line text-sm leading-relaxed text-white/80 md:text-base",
                                            children: descriptionText
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 917,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 907,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                    className: "rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: "O que acontece agora"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 924,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "h-1 w-1 rounded-full bg-white/30"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 925,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: eventUpcoming ? "Antes" : eventStarted ? "Durante" : "Depois"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 926,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 923,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "mt-3 text-xl font-semibold",
                                            children: "Antes · Durante · Depois"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 928,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-2 text-xs text-white/60",
                                            children: "Mantém-te atualizado pela página do evento. Esta linha do tempo mostra o estado atual."
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 929,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 grid gap-3 sm:grid-cols-3",
                                            children: timelineSteps.map((step)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: `rounded-lg border px-3 py-2 text-sm ${step.state === "done" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50" : step.state === "active" ? "border-[#6BFFFF]/60 bg-[#0b1224] text-white" : "border-white/15 bg-white/5 text-white/70"}`,
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "font-semibold",
                                                            children: step.label
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 944,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] opacity-80",
                                                            children: step.hint
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 945,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, step.key, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 934,
                                                    columnNumber: 19
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 932,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 922,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                    className: "rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8",
                                    id: "live",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center justify-between gap-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: "Live"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 955,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "h-1 w-1 rounded-full bg-white/30"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 956,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: isPadel ? "Jogos e resultados" : "Atualizações em tempo real"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 957,
                                                                    columnNumber: 21
                                                                }, this),
                                                                liveHubVisibility !== "PUBLIC" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "h-1 w-1 rounded-full bg-white/30"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 960,
                                                                            columnNumber: 25
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: liveHubVisibility === "PRIVATE" ? "Privado" : "Desativado"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 961,
                                                                            columnNumber: 25
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 954,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                            className: "mt-3 text-xl font-semibold",
                                                            children: isPadel ? "Acompanhamento ao vivo" : "Live do evento"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 965,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mt-2 text-xs text-white/60",
                                                            children: isPadel ? "Acompanha jogos, brackets e ranking em tempo real." : "Acompanha o evento com destaques, horários e informação atualizada."
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 966,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 953,
                                                    columnNumber: 17
                                                }, this),
                                                liveHubVisibility !== "DISABLED" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                            href: liveHref,
                                                            className: "rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10",
                                                            children: "Abrir live"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 974,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                            href: liveInlineHref,
                                                            className: "rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10",
                                                            children: "Ver aqui"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 980,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 973,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 952,
                                            columnNumber: 15
                                        }, this),
                                        liveHubVisibility === "DISABLED" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/70",
                                            children: "O LiveHub deste evento está desativado."
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 991,
                                            columnNumber: 17
                                        }, this) : showLiveInline ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventLiveClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                slug: slug,
                                                variant: "inline"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                lineNumber: 996,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 995,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/70",
                                            children: isPadel ? "Abre o modo live para veres resultados e jogos atualizados." : "Abre o modo live para veres as atualizações do evento."
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 999,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 951,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                    className: "rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: "Canal oficial"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1009,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "h-1 w-1 rounded-full bg-white/30"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1010,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: "Atualizações da organização"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1011,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1008,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "mt-3 text-xl font-semibold",
                                            children: "Comunicados rápidos"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1013,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-2 text-xs text-white/60",
                                            children: "Alterações e informações importantes aparecem aqui primeiro."
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1014,
                                            columnNumber: 15
                                        }, this),
                                        formattedUpdates.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/70",
                                            children: "Sem atualizações oficiais para já."
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1019,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 space-y-3",
                                            children: formattedUpdates.map((update)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/80",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap items-start justify-between gap-2",
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
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1031,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                                                            className: "text-base font-semibold text-white",
                                                                            children: update.title
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1035,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 1030,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-[11px] text-white/55",
                                                                    children: update.dateLabel
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 1037,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1029,
                                                            columnNumber: 23
                                                        }, this),
                                                        update.body && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mt-2 text-[12px] text-white/70 whitespace-pre-line",
                                                            children: update.body
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1040,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, update.id, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1025,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1023,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 1007,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 906,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                            className: "space-y-8 md:sticky md:top-28 md:self-start",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "pointer-events-none absolute -inset-[1px] rounded-[32px] bg-[linear-gradient(135deg,rgba(255,0,200,0.35),rgba(107,255,255,0.35),rgba(22,70,245,0.35))] opacity-60 blur-[2px]"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1054,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative rounded-[30px] border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.16),rgba(2,6,16,0.78))] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.18),transparent_55%)] opacity-80"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1056,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.35))] opacity-70"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1057,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "relative",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-start justify-between gap-3",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                            className: "text-xl font-semibold",
                                                                            children: "Bilhetes"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1061,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-xs text-white/60",
                                                                            children: "Compra segura com confirmação imediata."
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1062,
                                                                            columnNumber: 23
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 1060,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: `rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${availabilityTone}`,
                                                                    children: availabilityLabel
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 1066,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1059,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-1",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "rounded-xl border border-white/15 bg-black/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-[11px] uppercase tracking-[0.18em] text-white/60",
                                                                            children: "Data"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1075,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "mt-1 text-sm text-white/85",
                                                                            children: formattedDate
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1078,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-xs text-white/60",
                                                                            children: [
                                                                                time,
                                                                                " – ",
                                                                                endTime
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1081,
                                                                            columnNumber: 23
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 1074,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "rounded-xl border border-white/15 bg-black/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-[11px] uppercase tracking-[0.18em] text-white/60",
                                                                            children: "Local"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1086,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "mt-1 text-sm text-white/85",
                                                                            children: safeLocationName
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1089,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-xs text-white/60",
                                                                            children: event.address || "Morada a anunciar"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                            lineNumber: 1092,
                                                                            columnNumber: 23
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 1085,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1073,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            id: "bilhetes",
                                                            className: "mt-4 scroll-mt-28",
                                                            children: !eventEnded ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "space-y-5 border-t border-white/12 pt-5",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center justify-between gap-2",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                                className: "text-base font-semibold",
                                                                                children: "Seleciona o teu bilhete"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1102,
                                                                                columnNumber: 27
                                                                            }, this),
                                                                            !event.isFree && showPriceFrom && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "text-xs text-white/75",
                                                                                children: [
                                                                                    "A partir de",
                                                                                    " ",
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        className: "font-semibold text-white",
                                                                                        children: [
                                                                                            (displayPriceFrom ?? 0).toFixed(2),
                                                                                            " €"
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                        lineNumber: 1108,
                                                                                        columnNumber: 31
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1106,
                                                                                columnNumber: 29
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                        lineNumber: 1101,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    showInviteGate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$InviteGateClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                                        slug: event.slug,
                                                                        isFree: event.isFree,
                                                                        isAuthenticated: Boolean(user),
                                                                        hasUsername: hasUsername,
                                                                        userEmailNormalized: userEmailNormalized,
                                                                        usernameNormalized: usernameNormalized,
                                                                        uiTickets: uiTickets,
                                                                        checkoutUiVariant: checkoutVariant,
                                                                        padelMeta: checkoutVariant === "PADEL" ? {
                                                                            eventId: event.id,
                                                                            organizerId: event.organizerId ?? null,
                                                                            categoryId: padelDefaultCategoryId ?? null,
                                                                            categoryLinkId: padelDefaultCategoryLinkId ?? null
                                                                        } : undefined
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                        lineNumber: 1116,
                                                                        columnNumber: 27
                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                                                                        children: [
                                                                            event.isFree && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        className: "flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2.5 text-sm text-emerald-100",
                                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                            children: [
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                    className: "font-semibold",
                                                                                                    children: "Entrada gratuita"
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                    lineNumber: 1142,
                                                                                                    columnNumber: 37
                                                                                                }, this),
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                    className: "text-[11px] text-emerald-100/85",
                                                                                                    children: "Basta garantir o teu lugar — não há custo de bilhete."
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                    lineNumber: 1143,
                                                                                                    columnNumber: 37
                                                                                                }, this)
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 1141,
                                                                                            columnNumber: 35
                                                                                        }, this)
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                        lineNumber: 1140,
                                                                                        columnNumber: 33
                                                                                    }, this),
                                                                                    freeUsernameGateMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        className: "rounded-xl border border-white/12 bg-black/50 px-3.5 py-2.5 text-sm text-white/85",
                                                                                        children: [
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                className: "font-semibold",
                                                                                                children: "Inscrição gratuita"
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                lineNumber: 1150,
                                                                                                columnNumber: 37
                                                                                            }, this),
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                className: "text-[11px] text-white/70",
                                                                                                children: freeUsernameGateMessage
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                lineNumber: 1151,
                                                                                                columnNumber: 37
                                                                                            }, this)
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                        lineNumber: 1149,
                                                                                        columnNumber: 35
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true),
                                                                            allowCheckout ? uiTickets.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white/80",
                                                                                children: "Ainda não há waves configuradas para este evento."
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1159,
                                                                                columnNumber: 33
                                                                            }, this) : allSoldOut ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "rounded-xl border border-orange-400/40 bg-orange-500/15 px-3.5 py-2.5 text-sm text-orange-100",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "font-semibold",
                                                                                            children: "Evento esgotado"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 1165,
                                                                                            columnNumber: 37
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "text-[11px] text-orange-100/85",
                                                                                            children: "Não há mais bilhetes disponíveis para este evento."
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 1166,
                                                                                            columnNumber: 37
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                    lineNumber: 1164,
                                                                                    columnNumber: 35
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1163,
                                                                                columnNumber: 33
                                                                            }, this) : !anyOnSale && anyUpcoming ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "rounded-xl border border-yellow-400/40 bg-yellow-500/15 px-3.5 py-2.5 text-sm text-yellow-100",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "font-semibold",
                                                                                            children: "Vendas ainda não abriram"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 1174,
                                                                                            columnNumber: 37
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "text-[11px] text-yellow-100/85",
                                                                                            children: "As vendas de bilhetes para este evento ainda não abriram. Volta mais tarde!"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 1175,
                                                                                            columnNumber: 37
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                    lineNumber: 1173,
                                                                                    columnNumber: 35
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1172,
                                                                                columnNumber: 33
                                                                            }, this) : allClosed ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white/80",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "font-semibold",
                                                                                            children: "Vendas encerradas"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 1183,
                                                                                            columnNumber: 37
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "text-[11px] text-white/70",
                                                                                            children: "As vendas para este evento já encerraram."
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                            lineNumber: 1184,
                                                                                            columnNumber: 37
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                    lineNumber: 1182,
                                                                                    columnNumber: 35
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1181,
                                                                                columnNumber: 33
                                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$WavesSectionClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                                                slug: event.slug,
                                                                                tickets: uiTickets,
                                                                                isFreeEvent: event.isFree,
                                                                                checkoutUiVariant: checkoutVariant,
                                                                                padelMeta: checkoutVariant === "PADEL" ? {
                                                                                    eventId: event.id,
                                                                                    organizerId: event.organizerId ?? null,
                                                                                    categoryId: padelDefaultCategoryId ?? null,
                                                                                    categoryLinkId: padelDefaultCategoryLinkId ?? null
                                                                                } : undefined
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1190,
                                                                                columnNumber: 33
                                                                            }, this) : null
                                                                        ]
                                                                    }, void 0, true),
                                                                    resales.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "mt-7 space-y-4 border-t border-white/15 pt-5",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "flex items-center justify-between gap-2",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                                        className: "text-base font-semibold",
                                                                                        children: "Bilhetes entre utilizadores"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                        lineNumber: 1214,
                                                                                        columnNumber: 31
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        className: "text-xs text-white/70",
                                                                                        children: [
                                                                                            resales.length,
                                                                                            " oferta",
                                                                                            resales.length === 1 ? "" : "s",
                                                                                            " de revenda"
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                        lineNumber: 1217,
                                                                                        columnNumber: 31
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1213,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                className: "text-xs text-white/65",
                                                                                children: "Estes bilhetes são vendidos por outros utilizadores da ORYA. O pagamento é feito de forma segura através da plataforma."
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1223,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "space-y-4",
                                                                                children: resales.map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        className: "flex items-center justify-between rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm",
                                                                                        children: [
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                className: "flex flex-col gap-0.5",
                                                                                                children: [
                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                        className: "flex flex-wrap items-center gap-2",
                                                                                                        children: [
                                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                                className: "font-medium",
                                                                                                                children: r.ticketTypeName ?? "Bilhete ORYA"
                                                                                                            }, void 0, false, {
                                                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                                lineNumber: 1236,
                                                                                                                columnNumber: 39
                                                                                                            }, this),
                                                                                                            r.seller && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                                className: "text-xs text-white/60",
                                                                                                                children: [
                                                                                                                    "por",
                                                                                                                    " ",
                                                                                                                    r.seller.username ? `@${r.seller.username}` : r.seller.fullName ?? "utilizador ORYA"
                                                                                                                ]
                                                                                                            }, void 0, true, {
                                                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                                lineNumber: 1240,
                                                                                                                columnNumber: 41
                                                                                                            }, this)
                                                                                                        ]
                                                                                                    }, void 0, true, {
                                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                        lineNumber: 1235,
                                                                                                        columnNumber: 37
                                                                                                    }, this),
                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                        className: "text-xs text-white/65",
                                                                                                        children: [
                                                                                                            "Preço pedido:",
                                                                                                            " ",
                                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                                className: "font-semibold text-white",
                                                                                                                children: [
                                                                                                                    (r.price / 100).toFixed(2),
                                                                                                                    " €"
                                                                                                                ]
                                                                                                            }, void 0, true, {
                                                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                                lineNumber: 1250,
                                                                                                                columnNumber: 39
                                                                                                            }, this)
                                                                                                        ]
                                                                                                    }, void 0, true, {
                                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                        lineNumber: 1248,
                                                                                                        columnNumber: 37
                                                                                                    }, this)
                                                                                                ]
                                                                                            }, void 0, true, {
                                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                lineNumber: 1234,
                                                                                                columnNumber: 35
                                                                                            }, this),
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                                                                href: `/resale/${r.id}`,
                                                                                                className: "inline-flex items-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.65)] hover:scale-[1.01] active:scale-95 transition-transform",
                                                                                                children: "Comprar agora"
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                                lineNumber: 1256,
                                                                                                columnNumber: 35
                                                                                            }, this)
                                                                                        ]
                                                                                    }, r.id, true, {
                                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                        lineNumber: 1230,
                                                                                        columnNumber: 33
                                                                                    }, this))
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                                lineNumber: 1228,
                                                                                columnNumber: 29
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                        lineNumber: 1212,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                lineNumber: 1100,
                                                                columnNumber: 23
                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white/85",
                                                                children: "Este evento já terminou. Bilhetes e inscrições deixaram de estar disponíveis."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                lineNumber: 1269,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1098,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1058,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1055,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 1053,
                                    columnNumber: 13
                                }, this),
                                padelSnapshot && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center justify-between gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[11px] uppercase tracking-[0.16em] text-white/60",
                                                            children: "PADEL"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1283,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                            className: "text-base font-semibold",
                                                            children: "Competição em detalhe"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1286,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] text-white/65",
                                                            children: [
                                                                padelSnapshot.clubName || "Clube a anunciar",
                                                                " ·",
                                                                " ",
                                                                padelSnapshot.clubCity || "Cidade em breve"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1287,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1282,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/75",
                                                    children: [
                                                        "Estado: ",
                                                        padelSnapshot.status
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1292,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1281,
                                            columnNumber: 17
                                        }, this),
                                        padelSnapshot.timeline && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 grid gap-3 sm:grid-cols-3",
                                            children: padelSnapshot.timeline.map((step)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: `rounded-lg border px-3 py-2 text-sm ${step.state === "done" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50" : step.state === "active" ? "border-[#6BFFFF]/60 bg-[#0b1224] text-white" : "border-white/15 bg-white/5 text-white/70"}`,
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "font-semibold",
                                                            children: step.label
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1309,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] opacity-80",
                                                            children: step.cancelled ? "Cancelado" : step.date ? dateFormatter.format(new Date(step.date)) : "Data a anunciar"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1310,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, step.key, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1299,
                                                    columnNumber: 23
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1297,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 grid gap-3 text-[13px] md:grid-cols-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-lg border border-white/10 bg-white/5 p-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[11px] uppercase tracking-[0.12em] text-white/60",
                                                            children: "Clubes"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1323,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-white/80",
                                                            children: [
                                                                "Principal:",
                                                                " ",
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "font-semibold text-white",
                                                                    children: padelSnapshot.clubName || "A anunciar"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 1328,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1326,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-white/70",
                                                            children: [
                                                                "Parceiros:",
                                                                " ",
                                                                padelSnapshot.partnerClubs && padelSnapshot.partnerClubs.length > 0 ? padelSnapshot.partnerClubs.map((c)=>c.name || `Clube ${c.id}`).join(" · ") : "—"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1332,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1322,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-lg border border-white/10 bg-white/5 p-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[11px] uppercase tracking-[0.12em] text-white/60",
                                                            children: "Courts"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1342,
                                                            columnNumber: 21
                                                        }, this),
                                                        padelSnapshot.courts && padelSnapshot.courts.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap gap-2",
                                                            children: padelSnapshot.courts.map((c, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[12px]",
                                                                    children: [
                                                                        c.name,
                                                                        " ",
                                                                        c.clubName ? `· ${c.clubName}` : "",
                                                                        " ",
                                                                        c.indoor ? "· Indoor" : ""
                                                                    ]
                                                                }, `${c.name}-${idx}`, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                                    lineNumber: 1348,
                                                                    columnNumber: 27
                                                                }, this))
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1346,
                                                            columnNumber: 23
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] text-white/70",
                                                            children: "Courts a definir."
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                            lineNumber: 1358,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                                    lineNumber: 1341,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                                            lineNumber: 1321,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                                    lineNumber: 1280,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/page.tsx",
                            lineNumber: 1052,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                    lineNumber: 904,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventPageClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    slug: event.slug,
                    uiTickets: uiTickets,
                    checkoutUiVariant: checkoutVariant === "PADEL" ? "PADEL" : "DEFAULT",
                    padelMeta: checkoutVariant === "PADEL" ? {
                        eventId: event.id,
                        organizerId: event.organizerId ?? null,
                        categoryId: padelDefaultCategoryId ?? null,
                        categoryLinkId: padelDefaultCategoryLinkId ?? null
                    } : undefined,
                    defaultPadelTicketId: defaultPadelTicketId
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/page.tsx",
                    lineNumber: 1367,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/page.tsx",
            lineNumber: 634,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/page.tsx",
        lineNumber: 629,
        columnNumber: 5
    }, this);
}
const dynamic = "force-dynamic";
const revalidate = 0;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/eventos/[slug]/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/eventos/[slug]/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a8384d5b._.js.map