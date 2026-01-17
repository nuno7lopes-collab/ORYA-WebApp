module.exports = [
"[project]/app/organizador/objectiveNav.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getObjectiveSections",
    ()=>getObjectiveSections,
    "normalizeOrgCategory",
    ()=>normalizeOrgCategory
]);
const CATEGORY_META = {
    EVENTOS: {
        createLabel: "Criar evento",
        manageLabel: "Eventos",
        createHref: "/organizador/eventos/novo",
        manageSection: "eventos"
    },
    PADEL: {
        createLabel: "Criar evento",
        manageLabel: "Eventos",
        createHref: "/organizador/eventos/novo?preset=padel",
        manageSection: "eventos"
    },
    VOLUNTARIADO: {
        createLabel: "Criar evento",
        manageLabel: "Eventos",
        createHref: "/organizador/eventos/novo?preset=voluntariado",
        manageSection: "acoes"
    }
};
function normalizeOrgCategory(value) {
    const normalized = value?.toUpperCase() ?? "";
    if (normalized === "PADEL") return "PADEL";
    if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
    return "EVENTOS";
}
function hasModule(modules, key) {
    return Array.isArray(modules) && modules.includes(key);
}
function getObjectiveSections(objective, context, options) {
    const categoryMeta = CATEGORY_META[context.category];
    const sections = [];
    const isDashboard = options?.mode === "dashboard";
    if (objective === "create") {
        sections.push({
            id: "overview",
            label: "Resumo",
            href: "/organizador?tab=overview"
        });
        if (!isDashboard) {
            sections.push({
                id: "primary",
                label: categoryMeta.createLabel,
                href: categoryMeta.createHref
            });
            if (hasModule(context.modules, "INSCRICOES")) {
                sections.push({
                    id: "inscricoes",
                    label: "Inscrições",
                    href: "/organizador/inscricoes"
                });
            }
        }
        return sections;
    }
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
}),
"[project]/app/organizador/ObjectiveSubnav.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ObjectiveSubnav
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$objectiveNav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/objectiveNav.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
const fetcher = (url)=>fetch(url).then((res)=>res.json());
const OBJECTIVE_LABELS = {
    create: "Criar",
    manage: "Gerir",
    promote: "Promover",
    analyze: "Analisar"
};
function ObjectiveSubnav({ objective, activeId, category, modules, mode, variant = "full", hideWhenSingle = true, className }) {
    const { data } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(category || modules ? null : "/api/organizador/me", fetcher);
    const organizer = data?.organizer ?? null;
    const context = {
        category: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$objectiveNav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeOrgCategory"])(category ?? organizer?.organizationCategory),
        modules: Array.isArray(modules) ? modules : Array.isArray(organizer?.modules) ? organizer.modules : [],
        username: organizer?.username ?? null
    };
    const sections = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$objectiveNav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getObjectiveSections"])(objective, context, {
        mode
    });
    const active = activeId && sections.some((section)=>section.id === activeId) ? activeId : "overview";
    if (hideWhenSingle && sections.length <= 1) return null;
    const tabs = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.4)]",
        children: sections.map((section)=>{
            const isActive = section.id === active;
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                href: section.href,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])("rounded-xl px-3 py-2 font-semibold transition", isActive ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]" : "text-white/80 hover:bg-white/10"),
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
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: className,
            children: tabs
        }, void 0, false, {
            fileName: "[project]/app/organizador/ObjectiveSubnav.tsx",
            lineNumber: 84,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])("rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 p-4 shadow-[0_26px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
}),
"[project]/app/organizador/pagamentos/invoices/invoices-client.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>InvoicesClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/money.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-ssr] (ecmascript)");
"use client";
;
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
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const organizerIdParam = searchParams?.get("organizerId") ?? null;
    const from = searchParams?.get("from") ?? "";
    const to = searchParams?.get("to") ?? "";
    const organizerIdQuery = organizerIdParam ? Number(organizerIdParam) : null;
    const shouldFetchOrganizer = !organizerIdProp && !organizerIdQuery;
    const { data: organizerData } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(()=>shouldFetchOrganizer ? "/api/organizador/me" : null, orgFetcher);
    const organizerIdFromMe = organizerData?.organizer?.id ?? null;
    const organizerId = organizerIdProp ?? (organizerIdQuery && !Number.isNaN(organizerIdQuery) ? organizerIdQuery : null) ?? organizerIdFromMe ?? null;
    const qs = toQuery({
        organizerId,
        from,
        to
    });
    const { data, isLoading, mutate } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(()=>organizerId ? `/api/organizador/pagamentos/invoices${qs}` : null, fetcher, {
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
    const totalTickets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>data?.ok ? data.items.reduce((acc, sale)=>acc + (sale.lines?.reduce((s, l)=>s + l.quantity, 0) ?? 0), 0) : 0, [
        data
    ]);
    const withQuery = (path, params)=>{
        const query = toQuery(params);
        if (!query) return path;
        return path.includes("?") ? `${path}&${query.slice(1)}` : `${path}${query}`;
    };
    // Se houver organizerId mas não na query, sincroniza a URL.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!organizerIdParam && organizerId) {
            router.replace(withQuery(basePath, {
                organizerId,
                from,
                to
            }));
        }
    }, [
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
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-10 w-10 rounded-2xl bg-white/10 animate-pulse"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 142,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-4 w-40 rounded bg-white/10 animate-pulse"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                        lineNumber: 144,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-2 md:grid-cols-3",
                        children: [
                            ...Array(3)
                        ].map((_, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)]",
                    children: "Não tens permissões para ver a faturação desta organização."
                }, void 0, false, {
                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                    lineNumber: 167,
                    columnNumber: 11
                }, this);
            }
            if (errorCode && errorCode !== "INTERNAL_ERROR") {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                    children: "Ainda não há faturação para mostrar. Quando houver vendas, vais ver tudo aqui."
                }, void 0, false, {
                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                    lineNumber: 174,
                    columnNumber: 11
                }, this);
            }
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/15 bg-red-500/10 p-5 text-sm text-white/80 shadow-[0_18px_50px_rgba(0,0,0,0.55)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-semibold text-white",
                        children: "Não foi possível carregar faturação."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 181,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-white/65",
                        children: "Tenta novamente ou ajusta o intervalo."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                        lineNumber: 182,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>mutate(),
                        className: `${__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CTA_SECONDARY"]} mt-3 text-[12px]`,
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
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: fullWidth ? "w-full space-y-6 text-white" : "mx-auto max-w-6xl px-4 py-6 space-y-6 text-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0d1530]/75 to-[#050912]/90 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.6)] backdrop-blur-3xl",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
                                    children: "Faturação premium"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 208,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                    className: "text-3xl font-semibold drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
                                    children: "Receitas, taxas e liquidez."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 211,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                ].map((preset)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "date",
                                    value: from,
                                    onChange: (e)=>handleDateChange("from", e.target.value),
                                    className: "rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/50"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 244,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "date",
                                    value: to,
                                    onChange: (e)=>handleDateChange("to", e.target.value),
                                    className: "rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/50"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                    lineNumber: 250,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: downloadCsv,
                                    className: `${__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CTA_PRIMARY"]} disabled:opacity-50`,
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
            data?.ok && items.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Receita bruta",
                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(summary.grossCents / 100),
                                tone: "bright"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 273,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Descontos",
                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(summary.discountCents / 100),
                                tone: "muted"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 274,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Taxas",
                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(summary.platformFeeCents / 100),
                                tone: "muted",
                                helper: "Inclui Stripe + ORYA (se aplicável)."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 275,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
                                label: "Líquido",
                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(summary.netCents / 100),
                                tone: "success",
                                helper: "Valor que recebes."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                lineNumber: 276,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SummaryCard, {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.6)] overflow-x-auto backdrop-blur-2xl",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                            className: "min-w-full text-sm text-white/85",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                    className: "text-left text-[11px] uppercase tracking-[0.18em] text-white/60",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        className: "border-b border-white/10",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Evento"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 284,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Data"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 285,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Bilhetes"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 286,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Bruto"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 287,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Descontos"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 288,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Taxas"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 289,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "py-2 pr-3",
                                                children: "Líquido"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                lineNumber: 290,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                    className: "divide-y divide-white/10",
                                    children: items.map((sale)=>{
                                        const tickets = sale.lines?.reduce((s, l)=>s + l.quantity, 0) ?? 0;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                            className: "hover:bg-white/5 transition",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "font-semibold text-white",
                                                            children: sale.event?.title ?? "Evento"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                            lineNumber: 300,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3 text-[12px] text-white/70",
                                                    children: formatDateTime(sale.createdAt)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 303,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3 text-[12px]",
                                                    children: tickets
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 304,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(sale.subtotalCents / 100)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 305,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(sale.discountCents / 100)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 306,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(sale.platformFeeCents / 100)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 307,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3 font-semibold text-white",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(sale.netCents / 100)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                                                    lineNumber: 308,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "py-3 pr-3 text-[11px]",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
function SummaryCard({ label, value, tone = "default", helper }) {
    const toneClass = tone === "success" ? "bg-gradient-to-br from-emerald-400/25 via-emerald-500/20 to-teal-500/25 border-emerald-300/45 text-emerald-50" : tone === "bright" ? "bg-gradient-to-r from-[#FF00C8]/30 via-[#6BFFFF]/18 to-[#1646F5]/28 border-white/18 text-white" : tone === "muted" ? "bg-white/6 text-white/70 border-white/12" : tone === "slate" ? "bg-gradient-to-br from-white/12 via-white/6 to-white/4 text-white/80 border-white/14" : "bg-white/8 text-white border-white/12";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `rounded-2xl border p-4 shadow-[0_16px_50px_rgba(0,0,0,0.38)] backdrop-blur-2xl ${toneClass}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[11px] uppercase tracking-[0.2em] text-white/75",
                children: label
            }, void 0, false, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 350,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xl font-semibold leading-tight drop-shadow-[0_10px_25px_rgba(0,0,0,0.4)]",
                children: value
            }, void 0, false, {
                fileName: "[project]/app/organizador/pagamentos/invoices/invoices-client.tsx",
                lineNumber: 351,
                columnNumber: 7
            }, this),
            helper && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
}),
"[project]/app/organizador/OrganizerPublicProfilePanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>OrganizerPublicProfilePanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/username.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
const BIO_LIMIT = 280;
function OrganizerPublicProfilePanel({ organizer, membershipRole, categoryLabel, coverUrl }) {
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useUser"])();
    const { openModal } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthModal"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const canEdit = membershipRole === "OWNER";
    const [name, setName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [username, setUsername] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [bio, setBio] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [city, setCity] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [avatarUrl, setAvatarUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [coverImageUrl, setCoverImageUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [editingField, setEditingField] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [savingUsername, setSavingUsername] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [usernameMessage, setUsernameMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [uploading, setUploading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [uploadingCover, setUploadingCover] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [coverDirty, setCoverDirty] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const avatarInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const coverInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!organizer) return;
        const initialName = organizer.publicName || organizer.businessName || "";
        setName(initialName);
        setUsername(organizer.username ?? "");
        setBio(organizer.publicDescription ?? "");
        setAvatarUrl(organizer.brandingAvatarUrl ?? null);
        setCity(organizer.city ?? "");
        if (!coverDirty) {
            setCoverImageUrl(organizer.brandingCoverUrl ?? coverUrl ?? null);
        }
    }, [
        organizer,
        coverUrl,
        coverDirty
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setCoverDirty(false);
    }, [
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
                redirectTo: "/organizador?tab=overview"
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
                    city: city.trim()
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
                redirectTo: "/organizador?tab=overview"
            });
            return;
        }
        if (!canEdit) return;
        setUsernameMessage(null);
        const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateUsername"])(username);
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
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-3xl border border-white/12 bg-white/5 p-6 text-white/70",
            children: "A carregar perfil público…"
        }, void 0, false, {
            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
            lineNumber: 226,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: coverInputRef,
                type: "file",
                accept: "image/*",
                className: "hidden",
                disabled: !canEdit || uploadingCover,
                onChange: (e)=>handleCoverUpload(e.target.files?.[0] ?? null)
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 234,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: avatarInputRef,
                type: "file",
                accept: "image/*",
                className: "hidden",
                disabled: !canEdit || uploading,
                onChange: (e)=>handleAvatarUpload(e.target.files?.[0] ?? null)
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 242,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/7 via-[#060914]/92 to-[#05070f]/96 shadow-[0_26px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-5 pt-5 sm:px-8",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto w-full max-w-5xl",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative h-36 w-full overflow-hidden rounded-2xl border border-white/10",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute inset-0 bg-cover bg-center",
                                        style: coverPreviewUrl ? {
                                            backgroundImage: `url(${coverPreviewUrl})`
                                        } : undefined
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 255,
                                        columnNumber: 15
                                    }, this),
                                    !coverPreviewUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(107,255,255,0.25),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(255,0,200,0.2),transparent_55%),linear-gradient(135deg,rgba(6,10,20,0.8),rgba(9,10,18,0.95))]"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 260,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-[#05070f]/95"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 262,
                                        columnNumber: 15
                                    }, this),
                                    canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute right-3 top-3 z-10 flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>coverInputRef.current?.click(),
                                                className: "rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] text-white/80 hover:bg-black/60",
                                                disabled: uploadingCover,
                                                children: uploadingCover ? "A carregar…" : "Alterar capa"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                lineNumber: 265,
                                                columnNumber: 19
                                            }, this),
                                            coverPreviewUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>{
                                                    setCoverImageUrl(null);
                                                    setCoverDirty(true);
                                                    setMessage("Capa removida. Não te esqueças de guardar.");
                                                },
                                                className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CTA_NEUTRAL"],
                                                disabled: uploadingCover,
                                                children: "Remover"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                lineNumber: 274,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 264,
                                        columnNumber: 17
                                    }, this),
                                    canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>coverInputRef.current?.click(),
                                        className: "absolute inset-0 z-0",
                                        "aria-label": "Editar capa"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                        lineNumber: 290,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                lineNumber: 254,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                            lineNumber: 253,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                        lineNumber: 252,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative -mt-10 px-5 pb-6 sm:px-8",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto flex w-full max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-start gap-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative shrink-0",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>avatarInputRef.current?.click(),
                                                    className: "relative inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] p-[2px] shadow-[0_0_24px_rgba(255,0,200,0.26)]",
                                                    disabled: !canEdit || uploading,
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/90",
                                                            children: avatarPreviewUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                src: avatarPreviewUrl,
                                                                alt: displayName,
                                                                className: "h-full w-full object-cover"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 314,
                                                                columnNumber: 23
                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-xs font-semibold uppercase tracking-[0.2em] text-white/60",
                                                                children: displayName.slice(0, 2).toUpperCase()
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 316,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 311,
                                                            columnNumber: 19
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/70 p-1.5 text-white/80",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 323,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 322,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 305,
                                                    columnNumber: 17
                                                }, this),
                                                canEdit && avatarPreviewUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>{
                                                        setAvatarUrl(null);
                                                        setMessage("Foto removida. Não te esqueças de guardar.");
                                                    },
                                                    className: "mt-2 text-[11px] text-white/70 hover:text-white",
                                                    children: "Remover foto"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 328,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 304,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex min-w-0 flex-col gap-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap items-center gap-2",
                                                    children: [
                                                        editingField === "name" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: name,
                                                            onChange: (e)=>setName(e.target.value),
                                                            className: "rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-lg font-semibold text-white outline-none focus:border-white/40",
                                                            placeholder: "Nome público"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 344,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                            className: "text-[22px] sm:text-3xl font-semibold tracking-tight text-white truncate",
                                                            children: displayName
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 351,
                                                            columnNumber: 21
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEditingField(editingField === "name" ? null : "name"),
                                                            className: "rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 361,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 356,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 342,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap items-center gap-2 text-[12px] text-white/80",
                                                    children: [
                                                        editingField === "username" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap items-center gap-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "inline-flex items-center rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "text-white/50",
                                                                            children: "@"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                            lineNumber: 370,
                                                                            columnNumber: 25
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            value: username,
                                                                            onChange: (e)=>setUsername((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sanitizeUsername"])(e.target.value)),
                                                                            className: "ml-2 min-w-[140px] bg-transparent text-sm text-white outline-none"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                            lineNumber: 371,
                                                                            columnNumber: 25
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                    lineNumber: 369,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                                                    onClick: handleSaveUsername,
                                                                    disabled: !canEdit || savingUsername,
                                                                    children: savingUsername ? "A guardar…" : "Guardar @"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                    lineNumber: 377,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 368,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "rounded-full border border-white/15 bg-white/6 px-3 py-1 font-semibold text-white",
                                                            children: displayUsername ? `@${displayUsername}` : "Define um @username"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 387,
                                                            columnNumber: 21
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEditingField(editingField === "username" ? null : "username"),
                                                            className: "rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 397,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 392,
                                                            columnNumber: 21
                                                        }, this),
                                                        editingField === "city" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: city,
                                                            onChange: (e)=>setCity(e.target.value),
                                                            className: "rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:border-white/40",
                                                            placeholder: "Cidade"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 401,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "rounded-full border border-white/10 px-3 py-1 text-white/70",
                                                            children: displayCity || "Cidade por definir"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 408,
                                                            columnNumber: 21
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEditingField(editingField === "city" ? null : "city"),
                                                            className: "rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 418,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 413,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 366,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-start gap-2",
                                                    children: [
                                                        editingField === "bio" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                            value: bio,
                                                            onChange: (e)=>setBio(e.target.value.slice(0, BIO_LIMIT)),
                                                            rows: 3,
                                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40",
                                                            placeholder: "Escreve uma bio curta"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 425,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "max-w-xl text-sm text-white/85 leading-relaxed",
                                                            children: displayBio || "Sem bio no momento."
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 433,
                                                            columnNumber: 21
                                                        }, this),
                                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEditingField(editingField === "bio" ? null : "bio"),
                                                            className: "mt-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PencilIcon, {}, void 0, false, {
                                                                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                                lineNumber: 443,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                            lineNumber: 438,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 423,
                                                    columnNumber: 17
                                                }, this),
                                                categoryLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[11px] text-white/50",
                                                    children: [
                                                        "Categoria: ",
                                                        categoryLabel
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 447,
                                                    columnNumber: 35
                                                }, this),
                                                usernameMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] text-white/60",
                                                    children: usernameMessage
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 448,
                                                    columnNumber: 37
                                                }, this),
                                                message && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[12px] text-white/70",
                                                    children: message
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                                    lineNumber: 449,
                                                    columnNumber: 29
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 341,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                    lineNumber: 303,
                                    columnNumber: 13
                                }, this),
                                organizer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/75",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                                            children: "Premium da organização"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 455,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm text-white/80",
                                            children: [
                                                organizer.liveHubPremiumEnabled ? "Ativo" : "Inativo",
                                                " · Gerido automaticamente pela subscrição."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 458,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                    lineNumber: 454,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap items-center gap-2",
                                    children: [
                                        publicProfileUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-white/70",
                                            children: publicProfileUrl
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 466,
                                            columnNumber: 17
                                        }, this),
                                        canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: handleSaveProfile,
                                            className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CTA_PRIMARY"],
                                            disabled: saving,
                                            children: saving ? "A guardar…" : "Guardar alterações"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                            lineNumber: 471,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                                    lineNumber: 464,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                            lineNumber: 302,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                        lineNumber: 301,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 251,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
        lineNumber: 233,
        columnNumber: 5
    }, this);
}
function PencilIcon() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        "aria-hidden": "true",
        className: "h-3.5 w-3.5",
        viewBox: "0 0 24 24",
        fill: "none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M4 20l4.5-1 9.2-9.2a2.5 2.5 0 0 0 0-3.5l-.9-.9a2.5 2.5 0 0 0-3.5 0L4 14.6V20z",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round"
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 496,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M12.5 6.5l5 5",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round"
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
                lineNumber: 503,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/OrganizerPublicProfilePanel.tsx",
        lineNumber: 490,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/organizador/OrganizerTour.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OrganizerTour",
    ()=>OrganizerTour
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/analytics.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
const steps = [
    {
        id: "welcome",
        title: "Bem-vindo ao painel de organizador",
        body: "Vamos guiar-te pelos pontos chave para lançares o teu primeiro evento em minutos.",
        ctaLabel: "Começar",
        ctaAction: {
            type: "next"
        }
    },
    {
        id: "org-switcher",
        title: "Organizações e troca rápida",
        body: "Aqui mudas entre organizações, crias uma nova ou voltas ao modo utilizador.",
        anchor: "[data-tour='org-switcher-button']",
        ctaLabel: "Seguinte",
        ctaAction: {
            type: "next"
        }
    },
    {
        id: "create-event",
        title: "Criar evento",
        body: "Usa templates de Padel ou eventos gerais e publica em minutos.",
        anchor: "[data-tour='criar-evento']",
        ctaLabel: "Seguinte",
        ctaAction: {
            type: "next"
        }
    },
    {
        id: "finance",
        title: "Finanças & Stripe",
        body: "Liga o Stripe/Connect, acompanha receita, payouts e alertas.",
        anchor: "[data-tour='finance']",
        ctaLabel: "Seguinte",
        ctaAction: {
            type: "next"
        }
    },
    {
        id: "marketing",
        title: "Marketing & códigos",
        body: "Códigos promocionais, boosts e partilha de links para vender mais rápido.",
        anchor: "[data-tour='marketing']",
        ctaLabel: "Seguinte",
        ctaAction: {
            type: "next"
        }
    },
    {
        id: "staff",
        title: "Equipa & acessos",
        body: "Convida staff, define papéis e controla quem faz check-in.",
        anchor: "[data-tour='staff']",
        ctaLabel: "Seguinte",
        ctaAction: {
            type: "next"
        }
    },
    {
        id: "overview",
        title: "KPIs e resumo",
        body: "Acompanha vendas, receita líquida e próximos passos logo no resumo.",
        anchor: "[data-tour='overview']",
        ctaLabel: "Seguinte",
        ctaAction: {
            type: "next"
        }
    },
    {
        id: "finish",
        title: "Pronto para lançar",
        body: "Completa Stripe, cria o evento e convida a equipa. Estamos aqui se precisares.",
        ctaLabel: "Terminar tour",
        ctaAction: {
            type: "next"
        }
    }
];
const TOUR_KEY = "orya_org_tour_seen_v2";
const TOUR_PROGRESS_KEY = "orya_org_tour_step_v2";
const TOUR_GLOBAL_KEY = "orya_org_tour_seen_once";
const TOUR_EVENT = "orya:startTour";
const SIDEBAR_WIDTH_EVENT = "orya:sidebar-width";
const SIDEBAR_READY_EVENT = "orya:sidebar-ready";
const anchorSelectors = (anchor)=>{
    if (!anchor) return [];
    const list = [
        anchor
    ];
    if (anchor === "[data-tour='org-switcher']" || anchor === "[data-tour='org-switcher-button']") {
        list.push("[data-tour='org-switcher-button']", "[data-tour='org-switcher']");
    }
    // Fallback apenas quando há anchor definido
    list.push("[data-tour='sidebar-rail']");
    return list;
};
function OrganizerTour({ organizerId }) {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [index, setIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [viewport, setViewport] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        width: 0,
        height: 0
    });
    const [anchorRect, setAnchorRect] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [anchorEl, setAnchorEl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const tourKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>organizerId ? `${TOUR_KEY}:${organizerId}` : TOUR_KEY, [
        organizerId
    ]);
    const progressKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>organizerId ? `${TOUR_PROGRESS_KEY}:${organizerId}` : TOUR_PROGRESS_KEY, [
        organizerId
    ]);
    const shouldShow = mounted && open;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const id = requestAnimationFrame(()=>{
            setMounted(true);
            const seenGlobal = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : "1";
            const seen = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : "1";
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const handler = ()=>{
                if (("TURBOPACK compile-time value", "undefined") !== "undefined" && localStorage.getItem(TOUR_GLOBAL_KEY)) //TURBOPACK unreachable
                ;
                localStorage.removeItem(tourKey);
                localStorage.removeItem(progressKey);
                setIndex(0);
                setOpen(true);
            };
            window.addEventListener(TOUR_EVENT, handler);
            return ()=>window.removeEventListener(TOUR_EVENT, handler);
        });
        return ()=>cancelAnimationFrame(id);
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const updateViewport = ()=>{
            if ("TURBOPACK compile-time truthy", 1) return;
            //TURBOPACK unreachable
            ;
        };
        updateViewport();
        window.addEventListener("resize", updateViewport);
        return ()=>window.removeEventListener("resize", updateViewport);
    }, []);
    const step = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>steps[index], [
        index
    ]);
    const isMobile = viewport.width < 768 && viewport.width > 0;
    const highlightEnabled = shouldShow && !isMobile && !!step.anchor;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!shouldShow) return;
        if (!highlightEnabled || !step.anchor) {
            const id = requestAnimationFrame(()=>{
                setAnchorRect(null);
                setAnchorEl(null);
            });
            return ()=>cancelAnimationFrame(id);
        }
        let stopped = false;
        let observer = null;
        const tryResolve = ()=>{
            if (!shouldShow || stopped || !highlightEnabled) return;
            const el = document.querySelector(step.anchor);
            if (el) {
                const rect = el.getBoundingClientRect();
                setAnchorRect(rect);
                setAnchorEl(el);
                observer = new ResizeObserver(()=>{
                    const nextRect = el.getBoundingClientRect();
                    setAnchorRect(nextRect);
                });
                observer.observe(el);
            } else {
                setAnchorRect(null);
                setAnchorEl(null);
                requestAnimationFrame(tryResolve);
            }
        };
        tryResolve();
        return ()=>{
            stopped = true;
            if (observer) observer.disconnect();
        };
    }, [
        shouldShow,
        step.anchor,
        pathname,
        highlightEnabled
    ]);
    const goNext = ()=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["trackEvent"])("organizer_tour_next", {
            step: index
        });
        if (index < steps.length - 1) {
            setIndex((v)=>{
                const next = v + 1;
                localStorage.setItem(progressKey, String(next));
                return next;
            });
        } else {
            finish();
        }
    };
    const goPrev = ()=>{
        if (index === 0) return;
        setIndex((v)=>{
            const prev = Math.max(0, v - 1);
            localStorage.setItem(progressKey, String(prev));
            return prev;
        });
    };
    const finish = ()=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["trackEvent"])("organizer_tour_finish");
        localStorage.setItem(TOUR_GLOBAL_KEY, "1");
        localStorage.setItem(tourKey, "1");
        localStorage.removeItem(progressKey);
        setOpen(false);
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (highlightEnabled && anchorRect && step.anchor) {
            const selectors = anchorSelectors(step.anchor);
            const el = selectors.map((sel)=>document.querySelector(sel)).find(Boolean);
            el?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }, [
        anchorRect,
        highlightEnabled,
        step.anchor
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!highlightEnabled) return;
        const handler = ()=>{
            if (!step.anchor) return;
            const el = document.querySelector(step.anchor);
            if (!el) return;
            setAnchorRect(el.getBoundingClientRect());
            setAnchorEl(el);
        };
        window.addEventListener(SIDEBAR_WIDTH_EVENT, handler);
        window.addEventListener(SIDEBAR_READY_EVENT, handler);
        return ()=>{
            window.removeEventListener(SIDEBAR_WIDTH_EVENT, handler);
            window.removeEventListener(SIDEBAR_READY_EVENT, handler);
        };
    }, [
        highlightEnabled,
        step.anchor
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (typeof document === "undefined") return;
        if (!document.getElementById("tour-highlight-style")) {
            const style = document.createElement("style");
            style.id = "tour-highlight-style";
            style.textContent = ".tour-highlight-ring{position:relative;box-shadow:0 0 0 3px rgba(107,255,255,0.6),0 0 24px rgba(107,255,255,0.35);border-radius:14px;z-index:9999;}";
            document.head.appendChild(style);
        }
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!highlightEnabled) return;
        if (!anchorEl) return;
        const previousPointerEvents = anchorEl.style.pointerEvents;
        anchorEl.classList.add("tour-highlight-ring");
        // Evita cliques acidentais no elemento real enquanto o tour está aberto
        anchorEl.style.pointerEvents = "none";
        return ()=>{
            anchorEl.classList.remove("tour-highlight-ring");
            anchorEl.style.pointerEvents = previousPointerEvents;
        };
    }, [
        anchorEl,
        highlightEnabled,
        step.id
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onKey = (e)=>{
            if (e.key === "Escape") {
                finish();
            }
        };
        if (!shouldShow) return;
        window.addEventListener("keydown", onKey);
        return ()=>{
            window.removeEventListener("keydown", onKey);
        };
    }, [
        shouldShow
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!shouldShow) return;
        if (step.anchor !== "[data-tour='user-event']") return;
        const el = document.querySelector(step.anchor);
        if (!el) return;
        const details = el.closest("details");
        if (!details) return;
        const hadOpen = details.hasAttribute("open");
        details.setAttribute("open", "true");
        return ()=>{
            if (!hadOpen) details.removeAttribute("open");
        };
    }, [
        shouldShow,
        step.anchor
    ]);
    if (!shouldShow) return null;
    const cardWidth = isMobile ? viewport.width - 32 : Math.min(480, viewport.width - 32);
    const margin = 16;
    const estimatedHeight = isMobile ? 260 : 240;
    let cardLeft = (viewport.width - cardWidth) / 2;
    let cardTop = isMobile ? Math.max((viewport.height - estimatedHeight) / 2, margin) : 96;
    let arrowPos = null;
    if (!isMobile && anchorRect) {
        const centerX = anchorRect.left + anchorRect.width / 2;
        const preferRight = centerX < viewport.width / 2;
        // Horizontal positioning: prefer ao lado do alvo, senão centra próximo
        if (preferRight) {
            cardLeft = Math.min(viewport.width - cardWidth - margin, anchorRect.right + margin);
        } else {
            cardLeft = Math.max(margin, anchorRect.left - cardWidth - margin);
        }
        // Vertical positioning: centrar relativamente ao alvo, com limites
        cardTop = Math.max(margin, Math.min(viewport.height - estimatedHeight - margin, anchorRect.top + anchorRect.height / 2 - estimatedHeight / 2));
        const arrowX = preferRight ? Math.max(12, Math.min(cardWidth - 12, anchorRect.left - cardLeft)) : Math.max(12, Math.min(cardWidth - 12, anchorRect.right - cardLeft));
        const arrowY = Math.max(12, Math.min(estimatedHeight - 12, anchorRect.top + anchorRect.height / 2 - cardTop));
        arrowPos = {
            x: arrowX,
            y: arrowY,
            side: preferRight ? "left" : "right"
        };
    }
    const highlightPadding = 12;
    const highlightRect = highlightEnabled && anchorRect && viewport.width && viewport.height ? {
        left: Math.max(0, anchorRect.left - highlightPadding),
        top: Math.max(0, anchorRect.top - highlightPadding),
        width: Math.min(anchorRect.width + highlightPadding * 2, viewport.width - Math.max(0, anchorRect.left - highlightPadding)),
        height: Math.min(anchorRect.height + highlightPadding * 2, viewport.height - Math.max(0, anchorRect.top - highlightPadding))
    } : null;
    const rightWidth = highlightRect && viewport.width ? Math.max(0, viewport.width - (highlightRect.left + highlightRect.width)) : 0;
    const bottomHeight = highlightRect && viewport.height ? Math.max(0, viewport.height - (highlightRect.top + highlightRect.height)) : 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-[9999] pointer-events-auto",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(107,255,255,0.09),rgba(0,0,0,0)),rgba(5,9,21,0.7)] backdrop-blur-[9px] backdrop-saturate-[1.4]"
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                lineNumber: 363,
                columnNumber: 7
            }, this),
            highlightRect && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute rounded-2xl",
                style: {
                    left: highlightRect.left,
                    top: highlightRect.top,
                    width: highlightRect.width,
                    height: highlightRect.height,
                    boxShadow: "0 0 0 2px rgba(107,255,255,0.75), 0 0 24px rgba(107,255,255,0.35)",
                    background: "radial-gradient(circle at center, rgba(107,255,255,0.08), rgba(7,11,19,0))"
                }
            }, void 0, false, {
                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                lineNumber: 365,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl p-5 shadow-[0_30px_120px_rgba(0,0,0,0.7)] pointer-events-auto",
                style: {
                    width: cardWidth,
                    left: cardLeft,
                    top: cardTop,
                    maxHeight: isMobile ? "80vh" : "60vh",
                    overflow: "auto"
                },
                children: [
                    !isMobile && arrowPos && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute h-3 w-3 rotate-45 border border-white/15 bg-black/80",
                        style: {
                            left: arrowPos.side === "left" ? -6 : arrowPos.side === "right" ? cardWidth - 10 : Math.min(cardWidth - 10, Math.max(10, arrowPos.x - 6)),
                            top: arrowPos.side === "top" ? arrowPos.y : arrowPos.side === "bottom" ? undefined : Math.min(estimatedHeight - 10, Math.max(10, arrowPos.y - 6)),
                            bottom: arrowPos.side === "bottom" ? -6 : undefined
                        }
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                        lineNumber: 388,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-start justify-between gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.18em] text-white/55",
                                        children: "Tour"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                        lineNumber: 409,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-lg font-semibold text-white",
                                        children: step.title
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                        lineNumber: 410,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/80",
                                        children: step.body
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                        lineNumber: 411,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                lineNumber: 408,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: finish,
                                className: "text-white/60 hover:text-white rounded-full p-1 transition",
                                "aria-label": "Fechar tour",
                                children: "✕"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                lineNumber: 413,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                        lineNumber: 407,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 flex items-center justify-between text-[12px] text-white/60",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "Passo ",
                                    index + 1,
                                    " / ",
                                    steps.length
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                lineNumber: 422,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: finish,
                                        className: "rounded-full border border-white/20 px-3 py-1 text-white/75 hover:bg-white/10",
                                        children: "Saltar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                        lineNumber: 426,
                                        columnNumber: 13
                                    }, this),
                                    isMobile ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: goPrev,
                                                disabled: index === 0,
                                                className: "rounded-full border border-white/20 px-4 py-1.5 text-white/80 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed",
                                                children: "Anterior"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                                lineNumber: 434,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>{
                                                    if (step.ctaAction?.type === "navigate" && step.ctaAction.href) {
                                                        router.push(step.ctaAction.href);
                                                    }
                                                    goNext();
                                                },
                                                className: "rounded-full bg-white text-black px-4 py-1.5 font-semibold hover:scale-[1.01] active:scale-95 transition",
                                                children: index === steps.length - 1 ? "Terminar" : "Próximo"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                                lineNumber: 441,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true) : step.ctaLabel ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>{
                                            if (step.ctaAction?.type === "navigate" && step.ctaAction.href) {
                                                router.push(step.ctaAction.href);
                                            }
                                            goNext();
                                        },
                                        className: "rounded-full bg-white text-black px-4 py-1.5 font-semibold hover:scale-[1.01] active:scale-95 transition",
                                        children: step.ctaLabel
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                        lineNumber: 454,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: goNext,
                                        className: "rounded-full bg-white text-black px-4 py-1.5 font-semibold hover:scale-[1.01] active:scale-95 transition",
                                        children: index === steps.length - 1 ? "Terminar" : "Seguinte"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                        lineNumber: 466,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                                lineNumber: 425,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/OrganizerTour.tsx",
                        lineNumber: 421,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/OrganizerTour.tsx",
                lineNumber: 377,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/OrganizerTour.tsx",
        lineNumber: 362,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=app_organizador_a3ea36fa._.js.map