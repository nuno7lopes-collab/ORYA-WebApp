(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/organizador/objectiveNav.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getObjectiveSections",
    ()=>getObjectiveSections,
    "normalizeOrgCategory",
    ()=>normalizeOrgCategory
]);
function normalizeOrgCategory(value) {
    const normalized = value?.toUpperCase() ?? "";
    if (normalized === "PADEL") return "PADEL";
    if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
    return "EVENTOS";
}
function getObjectiveSections(objective, _context, _options) {
    const sections = [];
    if (objective === "manage") {
        sections.push({
            id: "eventos",
            label: "Eventos",
            href: "/organizador?tab=manage&section=eventos"
        });
        sections.push({
            id: "inscricoes",
            label: "Inscrições",
            href: "/organizador?tab=manage&section=inscricoes"
        });
        return sections;
    }
    if (objective === "promote") {
        const baseHref = "/organizador?tab=promote&section=marketing&marketing=";
        sections.push({
            id: "overview",
            label: "Visão geral",
            href: `${baseHref}overview`
        });
        sections.push({
            id: "promos",
            label: "Códigos promocionais",
            href: `${baseHref}promos`
        });
        sections.push({
            id: "updates",
            label: "Canal oficial",
            href: `${baseHref}updates`
        });
        sections.push({
            id: "promoters",
            label: "Promotores e parcerias",
            href: `${baseHref}promoters`
        });
        sections.push({
            id: "content",
            label: "Conteúdos e kits",
            href: `${baseHref}content`
        });
        return sections;
    }
    if (objective === "profile") {
        return [
            {
                id: "perfil",
                label: "Perfil público",
                href: "/organizador?tab=profile"
            }
        ];
    }
    return [
        {
            id: "financas",
            label: "Finanças",
            href: "/organizador?tab=analyze&section=financas"
        },
        {
            id: "invoices",
            label: "Faturação",
            href: "/organizador?tab=analyze&section=invoices"
        }
    ];
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/ObjectiveSubnav.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ObjectiveSubnav
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$objectiveNav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/objectiveNav.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
const fetcher = (url)=>fetch(url).then((res)=>res.json());
const OBJECTIVE_LABELS = {
    manage: "Gerir",
    promote: "Promover",
    analyze: "Analisar",
    profile: "Perfil"
};
function ObjectiveSubnav({ objective, activeId, category, modules, mode, variant = "full", hideWhenSingle = true, className }) {
    _s();
    const { data } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(category || modules ? null : "/api/organizador/me", fetcher);
    const organizer = data?.organizer ?? null;
    const context = {
        category: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$objectiveNav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeOrgCategory"])(category ?? organizer?.organizationCategory),
        modules: Array.isArray(modules) ? modules : Array.isArray(organizer?.modules) ? organizer.modules : [],
        username: organizer?.username ?? null
    };
    const sections = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$objectiveNav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getObjectiveSections"])(objective, context, {
        mode
    });
    const active = activeId && sections.some((section)=>section.id === activeId) ? activeId : sections[0]?.id;
    if (hideWhenSingle && sections.length <= 1) return null;
    const tabs = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.4)]",
        children: sections.map((section)=>{
            const isActive = section.id === active;
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: section.href,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-xl px-3 py-2 font-semibold transition", isActive ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]" : "text-white/80 hover:bg-white/10"),
                "aria-current": isActive ? "page" : undefined,
                children: section.label
            }, section.id, false, {
                fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
                lineNumber: 65,
                columnNumber: 11
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
        lineNumber: 61,
        columnNumber: 5
    }, this);
    if (variant === "tabs") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: className,
            children: tabs
        }, void 0, false, {
            fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
            lineNumber: 84,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 p-4 shadow-[0_26px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.4)]",
                        children: [
                            "Objetivo · ",
                            OBJECTIVE_LABELS[objective]
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
                        lineNumber: 95,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-[11px] text-white/60",
                        children: [
                            sections.length,
                            " secções"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
                        lineNumber: 98,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
                lineNumber: 94,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-3",
                children: tabs
            }, void 0, false, {
                fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
                lineNumber: 100,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
        lineNumber: 88,
        columnNumber: 5
    }, this);
}
_s(ObjectiveSubnav, "Bw9uScf/xQBWZKhLCWSR33xISM4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = ObjectiveSubnav;
var _c;
__turbopack_context__.k.register(_c, "ObjectiveSubnav");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/pagamentos/invoices/invoices-client.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>InvoicesClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/money.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const fetcher = (url)=>fetch(url).then((r)=>r.json());
const orgFetcher = (url)=>fetch(url).then((r)=>r.json());
const toQuery = (params)=>{
    const url = new URLSearchParams();
    Object.entries(params).forEach(([k, v])=>{
        if (v !== null && v !== undefined && String(v).trim() !== "") {
            url.set(k, String(v));
        }
    });
    const qs = url.toString();
    return qs ? `?${qs}` : "";
};
const formatDateTime = (iso)=>new Date(iso).toLocaleString("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
function InvoicesClient({ basePath = "/organizador/pagamentos/invoices", fullWidth = true, organizerId: organizerIdProp = null }) {
    _s();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const organizerIdParam = searchParams?.get("organizerId") ?? null;
    const from = searchParams?.get("from") ?? "";
    const to = searchParams?.get("to") ?? "";
    const organizerIdQuery = organizerIdParam ? Number(organizerIdParam) : null;
    const shouldFetchOrganizer = !organizerIdProp && !organizerIdQuery;
    const { data: organizerData } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])({
        "InvoicesClient.useSWR": ()=>shouldFetchOrganizer ? "/api/organizador/me" : null
    }["InvoicesClient.useSWR"], orgFetcher);
    const organizerIdFromMe = organizerData?.organizer?.id ?? null;
    const organizerId = organizerIdProp ?? (organizerIdQuery && !Number.isNaN(organizerIdQuery) ? organizerIdQuery : null) ?? organizerIdFromMe ?? null;
    const qs = toQuery({
        organizerId,
        from,
        to
    });
    const { data, isLoading, mutate } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])({
        "InvoicesClient.useSWR": ()=>organizerId ? `/api/organizador/pagamentos/invoices${qs}` : null
    }["InvoicesClient.useSWR"], fetcher, {
        revalidateOnFocus: false
    });
    const summary = data?.ok ? data.summary : {
        grossCents: 0,
        discountCents: 0,
        platformFeeCents: 0,
        netCents: 0,
        tickets: 0
    };
    const items = data?.ok ? data.items : [];
    const totalTickets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InvoicesClient.useMemo[totalTickets]": ()=>data?.ok ? data.items.reduce({
                "InvoicesClient.useMemo[totalTickets]": (acc, sale)=>acc + (sale.lines?.reduce({
                        "InvoicesClient.useMemo[totalTickets]": (s, l)=>s + l.quantity
                    }["InvoicesClient.useMemo[totalTickets]"], 0) ?? 0)
            }["InvoicesClient.useMemo[totalTickets]"], 0) : 0
    }["InvoicesClient.useMemo[totalTickets]"], [
        data
    ]);
    const withQuery = (path, params)=>{
        const query = toQuery(params);
        if (!query) return path;
        return path.includes("?") ? `${path}&${query.slice(1)}` : `${path}${query}`;
    };
    // Se houver organizerId mas não na query, sincroniza a URL.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InvoicesClient.useEffect": ()=>{
            if (!organizerIdParam && organizerId) {
                router.replace(withQuery(basePath, {
                    organizerId,
                    from,
                    to
                }));
            }
        }
    }["InvoicesClient.useEffect"], [
        organizerIdParam,
        organizerId,
        router,
        from,
        to,
        basePath
    ]);
    const downloadCsv = ()=>{
        if (!items.length) return;
        const rows = [
            [
                "Data",
                "Evento",
                "Payout Mode",
                "Subtotal",
                "Desconto",
                "Taxas",
                "Total",
                "Líquido",
                "Bilhetes"
            ],
            ...items.map((sale)=>[
                    sale.createdAt,
                    sale.event?.title ?? "",
                    sale.event?.payoutMode ?? "",
                    (sale.subtotalCents / 100).toFixed(2),
                    (sale.discountCents / 100).toFixed(2),
                    (sale.platformFeeCents / 100).toFixed(2),
                    (sale.totalCents / 100).toFixed(2),
                    (sale.netCents / 100).toFixed(2),
                    sale.lines?.reduce((s, l)=>s + l.quantity, 0) ?? 0
                ])
        ];
        const csvContent = rows.map((r)=>r.join(",")).join("\n");
        const blob = new Blob([
            csvContent
        ], {
            type: "text/csv;charset=utf-8;"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "invoices.csv";
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleDateChange = (which, value)=>{
        router.push(withQuery(basePath, {
            organizerId,
            from: which === "from" ? value : from,
            to: which === "to" ? value : to
        }));
    };
    const stateCard = (()=>{
        if (isLoading) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-10 w-10 rounded-2xl bg-white/10 animate-pulse"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 142,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-4 w-40 rounded bg-white/10 animate-pulse"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                        lineNumber: 144,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-3 w-32 rounded bg-white/10 animate-pulse"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                        lineNumber: 145,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 143,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 141,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-2 md:grid-cols-3",
                        children: [
                            ...Array(3)
                        ].map((_, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-16 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
                            }, idx, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 150,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 148,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 140,
                columnNumber: 9
            }, this);
        }
        if (!organizerId) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)]",
                children: "A carregar organização..."
            }, void 0, false, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 158,
                columnNumber: 9
            }, this);
        }
        if (!data || data.ok === false) {
            const errorCode = data && "error" in data ? data.error : null;
            if (errorCode && [
                "UNAUTHENTICATED",
                "FORBIDDEN"
            ].includes(errorCode)) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)]",
                    children: "Não tens permissões para ver a faturação desta organização."
                }, void 0, false, {
                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                    lineNumber: 167,
                    columnNumber: 11
                }, this);
            }
            if (errorCode && errorCode !== "INTERNAL_ERROR") {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                    children: "Ainda não há faturação para mostrar. Quando houver vendas, vais ver tudo aqui."
                }, void 0, false, {
                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                    lineNumber: 174,
                    columnNumber: 11
                }, this);
            }
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/15 bg-red-500/10 p-5 text-sm text-white/80 shadow-[0_18px_50px_rgba(0,0,0,0.55)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-semibold text-white",
                        children: "Não foi possível carregar faturação."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 181,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-white/65",
                        children: "Tenta novamente ou ajusta o intervalo."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 182,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>mutate(),
                        className: `${__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"]} mt-3 text-[12px]`,
                        children: "Recarregar"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 183,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 180,
                columnNumber: 9
            }, this);
        }
        if (items.length === 0) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                children: "Ainda não existem vendas neste intervalo. Ajusta as datas ou volta mais tarde."
            }, void 0, false, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 195,
                columnNumber: 9
            }, this);
        }
        return null;
    })();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: fullWidth ? "w-full space-y-6 text-white" : "mx-auto max-w-6xl px-4 py-6 space-y-6 text-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0d1530]/75 to-[#050912]/90 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.6)] backdrop-blur-3xl",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
                                    children: "Faturação premium"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 208,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                    className: "text-3xl font-semibold drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
                                    children: "Receitas, taxas e liquidez."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 211,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm text-white/70",
                                    children: "Bruto, descontos, Stripe/ORYA e líquido por evento. Exporta tudo em CSV num clique."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 212,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                            lineNumber: 207,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center gap-2 text-[12px]",
                            children: [
                                [
                                    {
                                        key: "7d",
                                        label: "7d"
                                    },
                                    {
                                        key: "30d",
                                        label: "30d"
                                    },
                                    {
                                        key: "90d",
                                        label: "90d"
                                    },
                                    {
                                        key: "all",
                                        label: "Sempre"
                                    }
                                ].map((preset)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>router.push(withQuery(basePath, {
                                                organizerId,
                                                from: preset.key === "all" ? "" : new Date(Date.now() - (preset.key === "7d" ? 7 : preset.key === "30d" ? 30 : 90) * 86400000).toISOString().slice(0, 10),
                                                to: preset.key === "all" ? "" : new Date().toISOString().slice(0, 10)
                                            })),
                                        className: `rounded-full px-3 py-1.5 transition ${preset.key !== "all" && from && to ? "bg-gradient-to-r from-[#FF00C8]/25 via-[#6BFFFF]/20 to-[#1646F5]/25 text-white shadow-[0_0_14px_rgba(107,255,255,0.35)]" : "border border-white/20 text-white/75 hover:bg-white/10"}`,
                                        children: preset.label
                                    }, preset.key, false, {
                                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                        lineNumber: 221,
                                        columnNumber: 15
                                    }, this)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "date",
                                    value: from,
                                    onChange: (e)=>handleDateChange("from", e.target.value),
                                    className: "rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/50"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 244,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "date",
                                    value: to,
                                    onChange: (e)=>handleDateChange("to", e.target.value),
                                    className: "rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/50"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 250,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: downloadCsv,
                                    className: `${__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"]} disabled:opacity-50`,
                                    disabled: !items.length,
                                    children: "Exportar CSV"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 256,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                            lineNumber: 214,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                    lineNumber: 206,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 205,
                columnNumber: 7
            }, this),
            stateCard,
            data?.ok && items.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Receita bruta",
                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEuro"])(summary.grossCents / 100),
                                tone: "bright"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 273,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Descontos",
                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEuro"])(summary.discountCents / 100),
                                tone: "muted"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 274,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Taxas",
                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEuro"])(summary.platformFeeCents / 100),
                                tone: "muted",
                                helper: "Inclui Stripe + ORYA (se aplicável)."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 275,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Líquido",
                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEuro"])(summary.netCents / 100),
                                tone: "success",
                                helper: "Valor que recebes."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 276,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Bilhetes",
                                value: `${totalTickets}`,
                                tone: "slate",
                                helper: "Total no intervalo."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 277,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 272,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.6)] overflow-x-auto backdrop-blur-2xl",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                            className: "min-w-full text-sm text-white/85",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                    className: "text-left text-[11px] uppercase tracking-[0.18em] text-white/60",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        className: "border-b border-white/10",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Evento"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 284,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Data"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 285,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Bilhetes"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 286,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Bruto"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 287,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Descontos"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 288,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Taxas"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 289,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Líquido"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 290,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Modo"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 291,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                        lineNumber: 283,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 282,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                    className: "divide-y divide-white/10",
                                    children: items.map((sale)=>{
                                        const tickets = sale.lines?.reduce((s, l)=>s + l.quantity, 0) ?? 0;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                            className: "hover:bg-white/5 transition",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "font-semibold text-white",
                                                            children: sale.event?.title ?? "Evento"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                            lineNumber: 300,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-[11px] text-white/60",
                                                            children: sale.event?.slug ?? "—"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                            lineNumber: 301,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 299,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3 text-[12px] text-white/70",
                                                    children: formatDateTime(sale.createdAt)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 303,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3 text-[12px]",
                                                    children: tickets
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 304,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEuro"])(sale.subtotalCents / 100)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 305,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEuro"])(sale.discountCents / 100)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 306,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEuro"])(sale.platformFeeCents / 100)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 307,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3 font-semibold text-white",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatEuro"])(sale.netCents / 100)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 308,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3 text-[11px]",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)]",
                                                        children: sale.event?.payoutMode ?? "STANDARD"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                        lineNumber: 310,
                                                        columnNumber: 25
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 309,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, sale.id, true, {
                                            fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                            lineNumber: 298,
                                            columnNumber: 21
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 294,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                            lineNumber: 281,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 280,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
        lineNumber: 204,
        columnNumber: 5
    }, this);
}
_s(InvoicesClient, "GMekJ91oUsRfkwEATg21k51pAuY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = InvoicesClient;
function SummaryCard({ label, value, tone = "default", helper }) {
    const toneClass = tone === "success" ? "bg-gradient-to-br from-emerald-400/25 via-emerald-500/20 to-teal-500/25 border-emerald-300/45 text-emerald-50" : tone === "bright" ? "bg-gradient-to-r from-[#FF00C8]/30 via-[#6BFFFF]/18 to-[#1646F5]/28 border-white/18 text-white" : tone === "muted" ? "bg-white/6 text-white/70 border-white/12" : tone === "slate" ? "bg-gradient-to-br from-white/12 via-white/6 to-white/4 text-white/80 border-white/14" : "bg-white/8 text-white border-white/12";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `rounded-2xl border p-4 shadow-[0_16px_50px_rgba(0,0,0,0.38)] backdrop-blur-2xl ${toneClass}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[11px] uppercase tracking-[0.2em] text-white/75",
                children: label
            }, void 0, false, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 350,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xl font-semibold leading-tight drop-shadow-[0_10px_25px_rgba(0,0,0,0.4)]",
                children: value
            }, void 0, false, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 351,
                columnNumber: 7
            }, this),
            helper && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[11px] text-white/60 mt-1",
                children: helper
            }, void 0, false, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 352,
                columnNumber: 18
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
        lineNumber: 349,
        columnNumber: 5
    }, this);
}
_c1 = SummaryCard;
var _c, _c1;
__turbopack_context__.k.register(_c, "InvoicesClient");
__turbopack_context__.k.register(_c1, "SummaryCard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_organizador_55b9510b._.js.map