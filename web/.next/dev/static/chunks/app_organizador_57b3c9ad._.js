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
function getObjectiveSections(objective, context, _options) {
    const sections = [];
    if (objective === "manage") {
        sections.push({
            id: "eventos",
            label: "Eventos",
            href: "/organizador?tab=manage&section=eventos"
        });
        if (context.category === "PADEL") {
            sections.push({
                id: "padel-hub",
                label: "Hub Padel",
                href: "/organizador?tab=manage&section=padel-hub"
            });
            return sections;
        }
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
"[project]/app/organizador/OrganizerPublicProfilePanel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>OrganizerPublicProfilePanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/username.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
const BIO_LIMIT = 280;
function OrganizerPublicProfilePanel({ organizer, membershipRole, categoryLabel, coverUrl }) {
    _s();
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const { openModal } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const canEdit = membershipRole === "OWNER";
    const [name, setName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [username, setUsername] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [bio, setBio] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [city, setCity] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [website, setWebsite] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [instagram, setInstagram] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [youtube, setYoutube] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [publicHours, setPublicHours] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [address, setAddress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [showAddressPublicly, setShowAddressPublicly] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [avatarUrl, setAvatarUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [coverImageUrl, setCoverImageUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [editingField, setEditingField] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [savingUsername, setSavingUsername] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [usernameMessage, setUsernameMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [uploading, setUploading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [uploadingCover, setUploadingCover] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [coverDirty, setCoverDirty] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const avatarInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const coverInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizerPublicProfilePanel.useEffect": ()=>{
            if (!organizer) return;
            const initialName = organizer.publicName || organizer.businessName || "";
            setName(initialName);
            setUsername(organizer.username ?? "");
            setBio(organizer.publicDescription ?? "");
            setAvatarUrl(organizer.brandingAvatarUrl ?? null);
            setCity(organizer.city ?? "");
            setWebsite(organizer.publicWebsite ?? "");
            setInstagram(organizer.publicInstagram ?? "");
            setYoutube(organizer.publicYoutube ?? "");
            setPublicHours(organizer.publicHours ?? "");
            setAddress(organizer.address ?? "");
            setShowAddressPublicly(Boolean(organizer.showAddressPublicly));
            if (!coverDirty) {
                setCoverImageUrl(organizer.brandingCoverUrl ?? coverUrl ?? null);
            }
        }
    }["OrganizerPublicProfilePanel.useEffect"], [
        organizer,
        coverUrl,
        coverDirty
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizerPublicProfilePanel.useEffect": ()=>{
            setCoverDirty(false);
        }
    }["OrganizerPublicProfilePanel.useEffect"], [
        organizer?.id
    ]);
    const handleAvatarUpload = async (file)=>{
        if (!file) return;
        setUploading(true);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload?scope=avatar", {
                method: "POST",
                body: formData
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.url) {
                setMessage(json?.error || "Não foi possível carregar a imagem.");
                return;
            }
            setAvatarUrl(json.url);
            setMessage("Imagem atualizada. Não te esqueças de guardar.");
        } catch (err) {
            console.error("[perfil-publico] upload", err);
            setMessage("Erro ao carregar a imagem.");
        } finally{
            setUploading(false);
        }
    };
    const handleCoverUpload = async (file)=>{
        if (!file) return;
        setUploadingCover(true);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload?scope=event-cover", {
                method: "POST",
                body: formData
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.url) {
                setMessage(json?.error || "Não foi possível carregar a capa.");
                return;
            }
            setCoverImageUrl(json.url);
            setCoverDirty(true);
            setMessage("Capa atualizada. Não te esqueças de guardar.");
        } catch (err) {
            console.error("[perfil-publico] cover upload", err);
            setMessage("Erro ao carregar a capa.");
        } finally{
            setUploadingCover(false);
        }
    };
    const handleSaveProfile = async ()=>{
        if (!user) {
            openModal({
                mode: "login",
                redirectTo: "/organizador?tab=profile"
            });
            return;
        }
        if (!canEdit) return;
        const trimmedName = name.trim();
        if (!trimmedName) {
            setMessage("O nome público é obrigatório.");
            return;
        }
        if (bio.length > BIO_LIMIT) {
            setMessage("A bio é demasiado longa.");
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/organizador/me", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    publicName: trimmedName,
                    publicDescription: bio.trim(),
                    brandingAvatarUrl: avatarUrl,
                    brandingCoverUrl: coverImageUrl,
                    city: city.trim(),
                    publicWebsite: website.trim() || null,
                    publicInstagram: instagram.trim() || null,
                    publicYoutube: youtube.trim() || null,
                    publicHours: publicHours.trim() || null,
                    address: address.trim() || null,
                    showAddressPublicly
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setMessage(json?.error || "Não foi possível guardar o perfil público.");
                return;
            }
            setMessage("Perfil público atualizado.");
            setEditingField(null);
            setCoverDirty(false);
            router.refresh();
        } catch (err) {
            console.error("[perfil-publico] save", err);
            setMessage("Erro ao guardar alterações.");
        } finally{
            setSaving(false);
        }
    };
    const handleSaveUsername = async ()=>{
        if (!user) {
            openModal({
                mode: "login",
                redirectTo: "/organizador?tab=profile"
            });
            return;
        }
        if (!canEdit) return;
        setUsernameMessage(null);
        const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateUsername"])(username);
        if (!validation.valid) {
            setUsernameMessage(validation.error);
            return;
        }
        setSavingUsername(true);
        try {
            const res = await fetch("/api/organizador/username", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: validation.normalized
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setUsernameMessage(json?.error || "Não foi possível atualizar o username.");
                return;
            }
            setUsername(validation.normalized);
            setUsernameMessage("Username atualizado.");
            setEditingField(null);
            router.refresh();
        } catch (err) {
            console.error("[perfil-publico] username", err);
            setUsernameMessage("Erro ao atualizar o username.");
        } finally{
            setSavingUsername(false);
        }
    };
    const displayName = name.trim() || organizer?.businessName?.trim() || "Organização ORYA";
    const displayUsername = username.trim() || organizer?.username?.trim() || null;
    const displayBio = bio.trim() || organizer?.publicDescription?.trim() || "";
    const displayCity = city.trim() || organizer?.city?.trim() || "";
    const avatarPreviewUrl = avatarUrl ?? organizer?.brandingAvatarUrl ?? null;
    const coverPreviewUrl = coverImageUrl ?? coverUrl ?? null;
    const publicProfileUrl = displayUsername ? `/${displayUsername}` : null;
    if (!organizer) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-3xl border border-white/12 bg-white/5 p-6 text-white/70",
            children: "A carregar perfil público…"
        }, void 0, false, {
            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
            lineNumber: 244,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: coverInputRef,
                type: "file",
                accept: "image/*",
                className: "hidden",
                disabled: !canEdit || uploadingCover,
                onChange: (e)=>handleCoverUpload(e.target.files?.[0] ?? null)
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 252,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: avatarInputRef,
                type: "file",
                accept: "image/*",
                className: "hidden",
                disabled: !canEdit || uploading,
                onChange: (e)=>handleAvatarUpload(e.target.files?.[0] ?? null)
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 260,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/7 via-[#060914]/92 to-[#05070f]/96 shadow-[0_26px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-5 pt-5 sm:px-8",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto w-full max-w-5xl",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative h-36 w-full overflow-hidden rounded-2xl border border-white/10",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute inset-0 bg-cover bg-center",
                                        style: coverPreviewUrl ? {
                                            backgroundImage: `url(${coverPreviewUrl})`
                                        } : undefined
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 273,
                                        columnNumber: 15
                                    }, this),
                                    !coverPreviewUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(107,255,255,0.25),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(255,0,200,0.2),transparent_55%),linear-gradient(135deg,rgba(6,10,20,0.8),rgba(9,10,18,0.95))]"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 278,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-[#05070f]/95"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 280,
                                        columnNumber: 15
                                    }, this),
                                    canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute right-3 top-3 z-10 flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>coverInputRef.current?.click(),
                                                className: "rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] text-white/80 hover:bg-black/60",
                                                disabled: uploadingCover,
                                                children: uploadingCover ? "A carregar…" : "Alterar capa"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                lineNumber: 283,
                                                columnNumber: 19
                                            }, this),
                                            coverPreviewUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>{
                                                    setCoverImageUrl(null);
                                                    setCoverDirty(true);
                                                    setMessage("Capa removida. Não te esqueças de guardar.");
                                                },
                                                className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_NEUTRAL"],
                                                disabled: uploadingCover,
                                                children: "Remover"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                lineNumber: 292,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 282,
                                        columnNumber: 17
                                    }, this),
                                    canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>coverInputRef.current?.click(),
                                        className: "absolute inset-0 z-0",
                                        "aria-label": "Editar capa"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 308,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                lineNumber: 272,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                            lineNumber: 271,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                        lineNumber: 270,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative -mt-10 px-5 pb-6 sm:px-8",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto flex w-full max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-start gap-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative shrink-0",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>avatarInputRef.current?.click(),
                                                    className: "relative inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] p-[2px] shadow-[0_0_24px_rgba(255,0,200,0.26)]",
                                                    disabled: !canEdit || uploading,
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/90",
                                                            children: avatarPreviewUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                src: avatarPreviewUrl,
                                                                alt: displayName,
                                                                className: "h-full w-full object-cover"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 332,
                                                                columnNumber: 23
                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-xs font-semibold uppercase tracking-[0.2em] text-white/60",
                                                                children: displayName.slice(0, 2).toUpperCase()
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 334,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 329,
                                                            columnNumber: 19
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/70 p-1.5 text-white/80",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 341,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 340,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 323,
                                                    columnNumber: 17
                                                }, this),
                                                canEdit && avatarPreviewUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>{
                                                        setAvatarUrl(null);
                                                        setMessage("Foto removida. Não te esqueças de guardar.");
                                                    },
                                                    className: "mt-2 text-[11px] text-white/70 hover:text-white",
                                                    children: "Remover foto"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 346,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 322,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex min-w-0 flex-col gap-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap items-center gap-2",
                                                    children: [
                                                        editingField === "name" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: name,
                                                            onChange: (e)=>setName(e.target.value),
                                                            className: "rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-lg font-semibold text-white outline-none focus:border-white/40",
                                                            placeholder: "Nome público"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 362,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                            className: "text-[22px] sm:text-3xl font-semibold tracking-tight text-white truncate",
                                                            children: displayName
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 369,
                                                            columnNumber: 21
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEditingField(editingField === "name" ? null : "name"),
                                                            className: "rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 379,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 374,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 360,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap items-center gap-2 text-[12px] text-white/80",
                                                    children: [
                                                        editingField === "username" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap items-center gap-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "inline-flex items-center rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "text-white/50",
                                                                            children: "@"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                            lineNumber: 388,
                                                                            columnNumber: 25
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            value: username,
                                                                            onChange: (e)=>setUsername((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeUsername"])(e.target.value)),
                                                                            className: "ml-2 min-w-[140px] bg-transparent text-sm text-white outline-none"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                            lineNumber: 389,
                                                                            columnNumber: 25
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                    lineNumber: 387,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                                                    onClick: handleSaveUsername,
                                                                    disabled: !canEdit || savingUsername,
                                                                    children: savingUsername ? "A guardar…" : "Guardar @"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                    lineNumber: 395,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 386,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "rounded-full border border-white/15 bg-white/6 px-3 py-1 font-semibold text-white",
                                                            children: displayUsername ? `@${displayUsername}` : "Define um @username"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 405,
                                                            columnNumber: 21
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEditingField(editingField === "username" ? null : "username"),
                                                            className: "rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 415,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 410,
                                                            columnNumber: 21
                                                        }, this),
                                                        editingField === "city" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: city,
                                                            onChange: (e)=>setCity(e.target.value),
                                                            className: "rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:border-white/40",
                                                            placeholder: "Cidade"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 419,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "rounded-full border border-white/10 px-3 py-1 text-white/70",
                                                            children: displayCity || "Cidade por definir"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 426,
                                                            columnNumber: 21
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEditingField(editingField === "city" ? null : "city"),
                                                            className: "rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 436,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 431,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 384,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-start gap-2",
                                                    children: [
                                                        editingField === "bio" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                            value: bio,
                                                            onChange: (e)=>setBio(e.target.value.slice(0, BIO_LIMIT)),
                                                            rows: 3,
                                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40",
                                                            placeholder: "Escreve uma bio curta"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 443,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "max-w-xl text-sm text-white/85 leading-relaxed",
                                                            children: displayBio || "Sem bio no momento."
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 451,
                                                            columnNumber: 21
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEditingField(editingField === "bio" ? null : "bio"),
                                                            className: "mt-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 461,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 456,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 441,
                                                    columnNumber: 17
                                                }, this),
                                                categoryLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[11px] text-white/50",
                                                    children: [
                                                        "Categoria: ",
                                                        categoryLabel
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 465,
                                                    columnNumber: 35
                                                }, this),
                                                usernameMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] text-white/60",
                                                    children: usernameMessage
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 466,
                                                    columnNumber: 37
                                                }, this),
                                                message && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[12px] text-white/70",
                                                    children: message
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 467,
                                                    columnNumber: 29
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 359,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                    lineNumber: 321,
                                    columnNumber: 13
                                }, this),
                                organizer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/75",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                                            children: "Premium da organização"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 473,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm text-white/80",
                                            children: [
                                                organizer.liveHubPremiumEnabled ? "Ativo" : "Inativo",
                                                " · Gerido automaticamente pela subscrição."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 476,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                    lineNumber: 472,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap items-center gap-2",
                                    children: [
                                        publicProfileUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-white/70",
                                            children: publicProfileUrl
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 484,
                                            columnNumber: 17
                                        }, this),
                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: handleSaveProfile,
                                            className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"],
                                            disabled: saving,
                                            children: saving ? "A guardar…" : "Guardar alterações"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 489,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                    lineNumber: 482,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                            lineNumber: 320,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                        lineNumber: 319,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "border-t border-white/10 px-5 pb-6 pt-5 sm:px-8",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto w-full max-w-5xl grid gap-3 md:grid-cols-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.22em] text-white/55",
                                            children: "Links públicos"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 504,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 space-y-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-[12px] text-white/70",
                                                            children: "Website"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 507,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: website,
                                                            onChange: (e)=>setWebsite(e.target.value),
                                                            disabled: !canEdit,
                                                            placeholder: "https://...",
                                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-70"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 508,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 506,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-[12px] text-white/70",
                                                            children: "Instagram"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 517,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: instagram,
                                                            onChange: (e)=>setInstagram(e.target.value),
                                                            disabled: !canEdit,
                                                            placeholder: "@organizador",
                                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-70"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 518,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 516,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-[12px] text-white/70",
                                                            children: "YouTube"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 527,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: youtube,
                                                            onChange: (e)=>setYoutube(e.target.value),
                                                            disabled: !canEdit,
                                                            placeholder: "Canal ou link",
                                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-70"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 528,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 526,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 505,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                    lineNumber: 503,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.22em] text-white/55",
                                            children: "Localização & horário"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 539,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 space-y-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-[12px] text-white/70",
                                                            children: "Morada"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 542,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: address,
                                                            onChange: (e)=>setAddress(e.target.value),
                                                            disabled: !canEdit,
                                                            placeholder: "Rua e número",
                                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-70"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 543,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 541,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-[12px] text-white/70",
                                                            children: "Horário"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 552,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: publicHours,
                                                            onChange: (e)=>setPublicHours(e.target.value),
                                                            disabled: !canEdit,
                                                            placeholder: "Ex.: Seg–Sex 09:00–19:00",
                                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-70"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 553,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 551,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "flex items-center gap-2 text-[12px] text-white/70",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "checkbox",
                                                            checked: showAddressPublicly,
                                                            onChange: (e)=>setShowAddressPublicly(e.target.checked),
                                                            disabled: !canEdit,
                                                            className: "h-4 w-4"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 562,
                                                            columnNumber: 19
                                                        }, this),
                                                        "Mostrar morada no perfil público"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 561,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 540,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                    lineNumber: 538,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                            lineNumber: 502,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                        lineNumber: 501,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 269,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
        lineNumber: 251,
        columnNumber: 5
    }, this);
}
_s(OrganizerPublicProfilePanel, "fX5AWqOID1U8Xzi8G41tBOd0b1U=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = OrganizerPublicProfilePanel;
function PencilIcon() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        "aria-hidden": "true",
        className: "h-3.5 w-3.5",
        viewBox: "0 0 24 24",
        fill: "none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M4 20l4.5-1 9.2-9.2a2.5 2.5 0 0 0 0-3.5l-.9-.9a2.5 2.5 0 0 0-3.5 0L4 14.6V20z",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round"
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 588,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M12.5 6.5l5 5",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round"
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 595,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
        lineNumber: 582,
        columnNumber: 5
    }, this);
}
_c1 = PencilIcon;
var _c, _c1;
__turbopack_context__.k.register(_c, "OrganizerPublicProfilePanel");
__turbopack_context__.k.register(_c1, "PencilIcon");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_organizador_57b3c9ad._.js.map