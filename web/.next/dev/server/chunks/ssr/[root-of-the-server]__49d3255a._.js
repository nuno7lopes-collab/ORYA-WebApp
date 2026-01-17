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
"[project]/app/organizador/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/organizador/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/app/organizador/(event)/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/organizador/(event)/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/lib/organizerPermissions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx <module evaluation>", "default");
}),
"[project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx", "default");
}),
"[project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$event$292f$eventos$2f5b$id$5d2f$PadelTournamentTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$event$292f$eventos$2f5b$id$5d2f$PadelTournamentTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$event$292f$eventos$2f5b$id$5d2f$PadelTournamentTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/organizador/dashboardUi.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CTA_DANGER",
    ()=>CTA_DANGER,
    "CTA_GHOST",
    ()=>CTA_GHOST,
    "CTA_NEUTRAL",
    ()=>CTA_NEUTRAL,
    "CTA_PRIMARY",
    ()=>CTA_PRIMARY,
    "CTA_SECONDARY",
    ()=>CTA_SECONDARY,
    "CTA_SUCCESS",
    ()=>CTA_SUCCESS,
    "DASHBOARD_CARD",
    ()=>DASHBOARD_CARD,
    "DASHBOARD_HEADING",
    ()=>DASHBOARD_HEADING,
    "DASHBOARD_LABEL",
    ()=>DASHBOARD_LABEL,
    "DASHBOARD_MUTED",
    ()=>DASHBOARD_MUTED,
    "DASHBOARD_SHELL_PADDING",
    ()=>DASHBOARD_SHELL_PADDING,
    "DASHBOARD_SKELETON",
    ()=>DASHBOARD_SKELETON,
    "DASHBOARD_SUBHEADING",
    ()=>DASHBOARD_SUBHEADING,
    "DASHBOARD_TITLE",
    ()=>DASHBOARD_TITLE
]);
const DASHBOARD_SHELL_PADDING = "px-4 md:px-6 lg:px-8";
const DASHBOARD_CARD = "rounded-2xl border border-white/10 bg-white/5 shadow-[0_16px_60px_rgba(0,0,0,0.35)]";
const DASHBOARD_MUTED = "text-white/65";
const DASHBOARD_HEADING = "text-lg font-semibold text-white";
const DASHBOARD_SUBHEADING = "text-sm text-white/70";
const DASHBOARD_SKELETON = "animate-pulse rounded-xl border border-white/5 bg-white/5";
const DASHBOARD_TITLE = "text-2xl font-semibold text-white";
const DASHBOARD_LABEL = "text-[11px] uppercase tracking-[0.22em] text-white/55";
const CTA_PRIMARY = "inline-flex items-center gap-2 rounded-full border border-white/25 bg-gradient-to-r from-[#FF7AD1]/35 via-[#7FE0FF]/22 to-[#6A7BFF]/35 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(107,255,255,0.45)] backdrop-blur-xl transition hover:scale-[1.02] hover:shadow-[0_22px_70px_rgba(107,255,255,0.55)] focus:outline-none focus:ring-2 focus:ring-[#6BFFFF]/60";
const CTA_SECONDARY = "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white shadow-[0_12px_38px_rgba(0,0,0,0.35)] backdrop-blur hover:border-white/35 hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-white/30";
const CTA_GHOST = "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/0 px-4 py-2 text-sm text-white/80 hover:bg-white/5 transition focus:outline-none focus:ring-2 focus:ring-white/20";
const CTA_DANGER = "inline-flex items-center gap-2 rounded-full border border-red-400/60 bg-gradient-to-r from-red-600/30 via-red-500/25 to-red-700/35 px-3 py-1.5 text-[12px] font-semibold text-red-50 shadow-[0_12px_38px_rgba(239,68,68,0.35)] hover:brightness-110 transition";
const CTA_NEUTRAL = "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:bg-white/10 transition";
const CTA_SUCCESS = "inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-gradient-to-r from-emerald-500/30 via-emerald-400/25 to-emerald-600/35 px-4 py-1.5 text-[12px] font-semibold text-emerald-50 shadow-[0_14px_36px_rgba(16,185,129,0.35)] hover:brightness-110 transition";
}),
"[project]/app/organizador/(event)/eventos/[id]/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

// app/organizador/eventos/[id]/page.tsx
/* eslint-disable @next/next/no-html-link-for-pages */ __turbopack_context__.s([
    "default",
    ()=>OrganizerEventDetailPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseServer.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerContext.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPermissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerPermissions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$event$292f$eventos$2f5b$id$5d2f$PadelTournamentTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/(event)/eventos/[id]/PadelTournamentTabs.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-rsc] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
;
;
;
async function OrganizerEventDetailPage({ params }) {
    const resolved = await params;
    // 1) Garante auth
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseServer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSupabaseServer"])();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/login");
    }
    const userId = data.user.id;
    const eventId = Number.parseInt(resolved.id, 10);
    if (!Number.isFinite(eventId)) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    // 2) Buscar evento + tipos de bilhete (waves)
    const event = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].event.findUnique({
        where: {
            id: eventId
        },
        include: {
            tournament: {
                select: {
                    id: true
                }
            },
            ticketTypes: {
                orderBy: {
                    sortOrder: "asc"
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
            padelTournamentConfig: {
                include: {
                    club: true
                }
            }
        }
    });
    if (!event) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    if (!event.organizerId) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    let { organizer, membership } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerContext$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getActiveOrganizerForUser"])(userId, {
        organizerId: event.organizerId
    });
    if (!organizer) {
        const legacyOrganizer = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].organizer.findFirst({
            where: {
                id: event.organizerId,
                userId
            }
        });
        if (legacyOrganizer) {
            organizer = legacyOrganizer;
            membership = {
                role: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["OrganizerMemberRole"].OWNER
            };
        }
    }
    if (!organizer || !membership) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/organizador");
    }
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPermissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["canManageEvents"])(membership.role)) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/organizador?tab=manage");
    }
    const now = new Date();
    // 3) Métricas agregadas
    const totalWaves = event.ticketTypes.length;
    const totalTicketsSold = event.ticketTypes.reduce((sum, t)=>sum + t.soldQuantity, 0);
    const totalStock = event.ticketTypes.reduce((sum, t)=>sum + (t.totalQuantity !== null && t.totalQuantity !== undefined ? t.totalQuantity : 0), 0);
    const overallOccupancy = totalStock > 0 ? Math.min(100, Math.round(totalTicketsSold / totalStock * 100)) : null;
    const totalRevenueCents = event.ticketTypes.reduce((sum, t)=>sum + t.soldQuantity * (t.price ?? 0), 0);
    const totalRevenue = (totalRevenueCents / 100).toFixed(2);
    const cheapestWave = event.ticketTypes.length ? event.ticketTypes.reduce((min, t)=>(t.price ?? 0) < (min.price ?? 0) ? t : min) : null;
    const formatDateTime = (d)=>{
        if (!d) return null;
        return new Date(d).toLocaleString("pt-PT", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        });
    };
    const formatMoney = (cents)=>`${(cents / 100).toFixed(2)} €`.replace(".", ",");
    const startDateFormatted = formatDateTime(event.startsAt);
    const endDateFormatted = formatDateTime(event.endsAt);
    const tournamentState = event.status === "CANCELLED" ? "Cancelado" : event.status === "FINISHED" ? "Terminado" : event.status === "DRAFT" ? "Oculto" : "Público";
    const partnerClubs = event.padelTournamentConfig?.partnerClubIds?.length ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].padelClub.findMany({
        where: {
            id: {
                in: event.padelTournamentConfig.partnerClubIds
            }
        },
        select: {
            id: true,
            name: true,
            city: true
        }
    }) : [];
    const advancedSettings = event.padelTournamentConfig?.advancedSettings;
    const padelLinks = Array.isArray(event.padelCategoryLinks) ? event.padelCategoryLinks : [];
    const categoriesMeta = padelLinks.length > 0 ? padelLinks.map((link)=>({
            name: link.category?.label ?? `Categoria ${link.padelCategoryId}`,
            categoryId: link.padelCategoryId,
            capacity: link.capacityTeams ?? link.capacityPlayers ?? null,
            registrationType: undefined
        })) : advancedSettings?.categoriesMeta ?? [];
    const timeline = [
        {
            key: "OCULTO",
            label: "Oculto",
            active: [
                "DRAFT"
            ].includes(event.status),
            done: event.status !== "DRAFT"
        },
        {
            key: "INSCRICOES",
            label: "Inscrições",
            active: event.status === "PUBLISHED",
            done: [
                "PUBLISHED",
                "FINISHED",
                "CANCELLED"
            ].includes(event.status)
        },
        {
            key: "PUBLICO",
            label: "Público",
            active: event.status === "PUBLISHED",
            done: [
                "PUBLISHED",
                "FINISHED",
                "CANCELLED"
            ].includes(event.status)
        },
        {
            key: "TERMINADO",
            label: "Terminado",
            active: event.status === "FINISHED",
            done: event.status === "FINISHED"
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "w-full space-y-7 px-4 py-8 text-white md:px-6 lg:px-8",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: "resumo",
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] uppercase tracking-[0.3em] text-white/70",
                                    children: "Gestão de evento"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 229,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                    className: "text-2xl font-semibold tracking-tight",
                                    children: "Detalhes & waves"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 230,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "line-clamp-2 text-sm text-white/70",
                                    children: event.title
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 231,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                            lineNumber: 228,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap gap-2 text-[11px]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: "/organizador",
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                    children: "← Voltar à lista"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 234,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: `/organizador/eventos/${event.id}/edit`,
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                    children: "Editar evento"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 237,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: `/organizador/eventos/${event.id}/live`,
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                    children: "Preparar Live"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 243,
                                    columnNumber: 13
                                }, this),
                                event.tournament?.id && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: `/organizador/eventos/${event.id}/live?tab=preview&edit=1`,
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                    children: "Live Ops"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 250,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: `/eventos/${event.slug}`,
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CTA_PRIMARY"],
                                    children: "Ver página pública"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 257,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                            lineNumber: 233,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                    lineNumber: 227,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                lineNumber: 226,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-3 rounded-2xl border border-white/14 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-5 backdrop-blur-xl",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-start justify-between gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-xl md:text-2xl font-semibold tracking-tight",
                                                children: event.title
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 271,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-1 text-[11px] text-white/65",
                                                children: [
                                                    startDateFormatted,
                                                    endDateFormatted ? ` — ${endDateFormatted}` : "",
                                                    " •",
                                                    " ",
                                                    event.locationName
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 274,
                                                columnNumber: 15
                                            }, this),
                                            event.address && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/45",
                                                children: event.address
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 280,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 270,
                                        columnNumber: 13
                                    }, this),
                                    event.coverImageUrl && // eslint-disable-next-line @next/next/no-img-element
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                        src: event.coverImageUrl,
                                        alt: event.title,
                                        className: "hidden md:block w-28 h-20 rounded-xl object-cover border border-white/20"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 287,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 269,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-2 flex flex-wrap items-center gap-2 text-[11px]",
                                children: timeline.map((step, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `inline-flex items-center gap-1 rounded-full border px-2 py-1 ${step.done ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100" : step.active ? "border-white/30 bg-white/10 text-white" : "border-white/15 bg-black/30 text-white/60"}`,
                                                children: step.label
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 298,
                                                columnNumber: 17
                                            }, this),
                                            idx < timeline.length - 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-white/25",
                                                children: "→"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 309,
                                                columnNumber: 47
                                            }, this)
                                        ]
                                    }, step.key, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 297,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 295,
                                columnNumber: 11
                            }, this),
                            cheapestWave && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 text-[11px] text-white/70",
                                children: [
                                    "Preço a partir de",
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: formatMoney(cheapestWave.price ?? 0)
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 317,
                                        columnNumber: 15
                                    }, this),
                                    " ",
                                    "(",
                                    totalWaves,
                                    " wave",
                                    totalWaves !== 1 ? "s" : "",
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 315,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 text-[11px] text-white/60 line-clamp-3",
                                children: event.description
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 324,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-2 text-[10px] text-white/40 font-mono",
                                children: [
                                    "ID: ",
                                    event.id,
                                    " • Slug: ",
                                    event.slug
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 328,
                                columnNumber: 11
                            }, this),
                            event.padelTournamentConfig && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Torneio de Padel"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 335,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px]",
                                                children: tournamentState
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 336,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 334,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "font-semibold",
                                        children: event.padelTournamentConfig.club?.name ?? "Clube não definido"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 340,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/70",
                                        children: [
                                            event.padelTournamentConfig.club?.city ?? "Cidade —",
                                            " ·",
                                            " ",
                                            event.padelTournamentConfig.club?.address ?? "Morada em falta"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 343,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/75",
                                        children: [
                                            "Courts usados: ",
                                            event.padelTournamentConfig.numberOfCourts
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 347,
                                        columnNumber: 15
                                    }, this),
                                    partnerClubs.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-[12px] text-white/70",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.16em] text-white/55 mt-2",
                                                children: "Clubes parceiros"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 352,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-wrap gap-2",
                                                children: partnerClubs.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "rounded-full border border-white/15 bg-white/10 px-2 py-1",
                                                        children: [
                                                            c.name,
                                                            " ",
                                                            c.city ? `· ${c.city}` : ""
                                                        ]
                                                    }, c.id, true, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 355,
                                                        columnNumber: 23
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 353,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 351,
                                        columnNumber: 17
                                    }, this),
                                    advancedSettings && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-[12px] text-white/70",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.16em] text-white/55 mt-2",
                                                children: "Opções avançadas"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 364,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/75",
                                                children: [
                                                    "Limite total: ",
                                                    advancedSettings.maxEntriesTotal ?? "—",
                                                    " · Waitlist:",
                                                    " ",
                                                    advancedSettings.waitlistEnabled ? "on" : "off",
                                                    " · 2ª categoria:",
                                                    " ",
                                                    advancedSettings.allowSecondCategory ? "sim" : "não",
                                                    " · Cancelar jogos:",
                                                    " ",
                                                    advancedSettings.allowCancelGames ? "sim" : "não",
                                                    " · Jogo padrão:",
                                                    " ",
                                                    advancedSettings.gameDurationMinutes ?? "—",
                                                    " min"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 365,
                                                columnNumber: 19
                                            }, this),
                                            advancedSettings.courtsFromClubs?.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-2 space-y-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] uppercase tracking-[0.14em] text-white/55",
                                                        children: "Courts incluídos"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 374,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-wrap gap-2",
                                                        children: advancedSettings.courtsFromClubs.map((c, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "rounded-full border border-white/15 bg-white/10 px-2 py-1",
                                                                children: [
                                                                    c.name || "Court",
                                                                    " · ",
                                                                    c.clubName || `Clube ${c.clubId ?? ""}`,
                                                                    " ",
                                                                    c.indoor ? "(Indoor)" : ""
                                                                ]
                                                            }, `${c.id}-${idx}`, true, {
                                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                                lineNumber: 377,
                                                                columnNumber: 27
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 375,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 373,
                                                columnNumber: 21
                                            }, this) : null,
                                            advancedSettings.staffFromClubs?.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-2 space-y-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] uppercase tracking-[0.14em] text-white/55",
                                                        children: "Staff herdado"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 386,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-wrap gap-2",
                                                        children: advancedSettings.staffFromClubs.map((s, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "rounded-full border border-white/15 bg-white/10 px-2 py-1",
                                                                children: [
                                                                    s.email || s.role || "Staff",
                                                                    " · ",
                                                                    s.role || "Role",
                                                                    " · ",
                                                                    s.clubName || "Clube"
                                                                ]
                                                            }, `${s.email}-${idx}`, true, {
                                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                                lineNumber: 389,
                                                                columnNumber: 27
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 387,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 385,
                                                columnNumber: 21
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 363,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 333,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                        lineNumber: 268,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-[#6BFFFF]/40 bg-[#02040b]/95 backdrop-blur-xl px-4 py-3.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-[#6BFFFF]/80",
                                        children: "Bilhetes vendidos"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 404,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-2xl font-semibold tracking-tight",
                                        children: totalTicketsSold
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 407,
                                        columnNumber: 13
                                    }, this),
                                    overallOccupancy !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-[11px] text-white/65",
                                        children: [
                                            overallOccupancy,
                                            "% de ocupação (stock total ",
                                            totalStock,
                                            ")"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 411,
                                        columnNumber: 15
                                    }, this),
                                    overallOccupancy !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "h-full rounded-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]",
                                            style: {
                                                width: `${overallOccupancy}%`
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                            lineNumber: 418,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 417,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 403,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-white/14 bg-white/5 backdrop-blur-xl px-4 py-3.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/65",
                                        children: "Receita bruta"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 427,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-2xl font-semibold tracking-tight",
                                        children: [
                                            totalRevenue.replace(".", ","),
                                            " €"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 428,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-[11px] text-white/55",
                                        children: "Calculado com base em preço × bilhetes vendidos, por wave."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 431,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-[10px] text-white/40",
                                        children: "Nota: valores em modo de teste — integrar com relatórios reais mais tarde."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 434,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 426,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                        lineNumber: 402,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                lineNumber: 267,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                id: "bilhetes",
                className: "rounded-2xl border border-white/12 bg-black/40 backdrop-blur-xl p-5 space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-sm font-semibold text-white/90",
                                    children: "Waves & bilhetes"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 445,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] text-white/65",
                                    children: "Visão por wave: estado, stock, vendas e receita individual."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                    lineNumber: 448,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                            lineNumber: 444,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                        lineNumber: 443,
                        columnNumber: 9
                    }, this),
                    event.ticketTypes.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-[11px] text-white/70",
                        children: "Este evento ainda não tem waves configuradas. Usa o criador de eventos para adicionar bilhetes."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                        lineNumber: 455,
                        columnNumber: 11
                    }, this),
                    event.ticketTypes.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-2 grid grid-cols-1 gap-4 md:grid-cols-2",
                        children: event.ticketTypes.map((ticket)=>{
                            const remaining = ticket.totalQuantity !== null && ticket.totalQuantity !== undefined ? ticket.totalQuantity - ticket.soldQuantity : null;
                            const occupancy = ticket.totalQuantity && ticket.totalQuantity > 0 ? Math.min(100, Math.round(ticket.soldQuantity / ticket.totalQuantity * 100)) : null;
                            // Determinar estado da wave
                            let statusLabel = "A vender";
                            let statusBadgeClass = "bg-emerald-500/10 border-emerald-400/70 text-emerald-100";
                            const nowTime = now.getTime();
                            const startsAtTime = ticket.startsAt ? new Date(ticket.startsAt).getTime() : null;
                            const endsAtTime = ticket.endsAt ? new Date(ticket.endsAt).getTime() : null;
                            if (ticket.totalQuantity !== null && ticket.totalQuantity !== undefined && ticket.soldQuantity >= ticket.totalQuantity) {
                                statusLabel = "Esgotado";
                                statusBadgeClass = "bg-red-500/10 border-red-400/70 text-red-100";
                            } else if (startsAtTime && nowTime < startsAtTime) {
                                statusLabel = "Em breve";
                                statusBadgeClass = "bg-amber-500/10 border-amber-400/70 text-amber-100";
                            } else if (endsAtTime && nowTime > endsAtTime) {
                                statusLabel = "Encerrado";
                                statusBadgeClass = "bg-white/8 border-white/30 text-white/75";
                            }
                            const startsAtLabel = formatDateTime(ticket.startsAt);
                            const endsAtLabel = formatDateTime(ticket.endsAt);
                            const revenueCents = ticket.soldQuantity * (ticket.price ?? 0);
                            const revenue = (revenueCents / 100).toFixed(2);
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                                className: "rounded-xl border border-white/14 bg-gradient-to-br from-white/5 via-black/80 to-black/95 px-4 py-4 flex flex-col gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-sm font-semibold text-white/95",
                                                        children: ticket.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 524,
                                                        columnNumber: 23
                                                    }, this),
                                                    ticket.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "mt-0.5 text-[11px] text-white/60 line-clamp-2",
                                                        children: ticket.description
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 528,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "mt-1 text-[10px] text-white/45 font-mono",
                                                        children: [
                                                            "ID: ",
                                                            ticket.id
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 532,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 523,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-col items-end gap-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: `px-2 py-1 rounded-full border text-[10px] ${statusBadgeClass}`,
                                                        children: statusLabel
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 538,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "px-2 py-0.5 rounded-full bg-white/5 border border-white/20 text-[10px] text-white/80",
                                                        children: formatMoney(ticket.price ?? 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 543,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 537,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 522,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center gap-3 text-[10px] text-white/65",
                                        children: [
                                            startsAtLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: [
                                                    "⏱ Abre:",
                                                    " ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-white/85",
                                                        children: startsAtLabel
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 553,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 551,
                                                columnNumber: 23
                                            }, this),
                                            endsAtLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: [
                                                    "Fecha:",
                                                    " ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-white/85",
                                                        children: endsAtLabel
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 561,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 559,
                                                columnNumber: 23
                                            }, this),
                                            !startsAtLabel && !endsAtLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "Sem janela definida (sempre ativo)."
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 565,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 549,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/80",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-col gap-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-1.5",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-white/60",
                                                                children: "Vendidos / stock:"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                                lineNumber: 572,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "font-semibold",
                                                                children: [
                                                                    ticket.soldQuantity,
                                                                    ticket.totalQuantity ? ` / ${ticket.totalQuantity}` : " / ∞"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                                lineNumber: 575,
                                                                columnNumber: 25
                                                            }, this),
                                                            remaining !== null && remaining >= 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] text-white/55",
                                                                children: [
                                                                    "(",
                                                                    remaining,
                                                                    " restantes)"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                                lineNumber: 582,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 571,
                                                        columnNumber: 23
                                                    }, this),
                                                    occupancy !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-1.5 w-40 rounded-full bg-white/10 overflow-hidden",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "h-full rounded-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]",
                                                            style: {
                                                                width: `${occupancy}%`
                                                            }
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                            lineNumber: 590,
                                                            columnNumber: 27
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 589,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 570,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-col items-end gap-1 text-right",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[10px] text-white/60",
                                                        children: "Receita estimada"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 599,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-sm font-semibold",
                                                        children: [
                                                            revenue.replace(".", ","),
                                                            " €"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                        lineNumber: 602,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                                lineNumber: 598,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 569,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-[10px] text-white/40",
                                        children: "Funcionalidades avançadas como lista de compras por utilizador, links de promotores e tracking detalhado por wave podem ser geridas na área de gestão avançada do evento."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                        lineNumber: 608,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, ticket.id, true, {
                                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                                lineNumber: 518,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                        lineNumber: 462,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                lineNumber: 442,
                columnNumber: 7
            }, this),
            event.templateType === "PADEL" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$event$292f$eventos$2f5b$id$5d2f$PadelTournamentTabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                eventId: event.id,
                categoriesMeta: categoriesMeta
            }, void 0, false, {
                fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
                lineNumber: 622,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(event)/eventos/[id]/page.tsx",
        lineNumber: 225,
        columnNumber: 5
    }, this);
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/organizador/(event)/eventos/[id]/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/organizador/(event)/eventos/[id]/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__49d3255a._.js.map