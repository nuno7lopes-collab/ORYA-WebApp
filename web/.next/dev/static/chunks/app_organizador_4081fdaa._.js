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
"[project]/app/organizador/(dashboard)/inscricoes/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>InscricoesPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/ObjectiveSubnav.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
const fetcher = (url)=>fetch(url).then((res)=>res.json());
const statusLabel = {
    DRAFT: "Rascunho",
    PUBLISHED: "Publicado",
    ARCHIVED: "Arquivado"
};
const formatDate = (value)=>{
    if (!value) return "Disponível sempre";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Disponível sempre";
    return parsed.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};
function InscricoesPage({ embedded }) {
    _s();
    const { user, isLoading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const { openModal } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const orgParam = searchParams?.get("org");
    const orgMeUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InscricoesPage.useMemo[orgMeUrl]": ()=>{
            if (!user) return null;
            return orgParam ? `/api/organizador/me?org=${orgParam}` : "/api/organizador/me";
        }
    }["InscricoesPage.useMemo[orgMeUrl]"], [
        user,
        orgParam
    ]);
    const { data: organizerData } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(orgMeUrl, fetcher);
    const { data, mutate, isLoading: loadingForms } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(user ? "/api/organizador/inscricoes" : null, fetcher);
    const [title, setTitle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [description, setDescription] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [creating, setCreating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InscricoesPage.useMemo[items]": ()=>data?.ok ? data.items : []
    }["InscricoesPage.useMemo[items]"], [
        data
    ]);
    const moduleDisabled = data?.ok === false && data?.error?.includes("Módulo");
    const loadError = data?.ok === false && !moduleDisabled ? data?.error : null;
    const orgCategory = organizerData?.organizer?.organizationCategory ?? null;
    const isPadelOrg = orgCategory?.toUpperCase() === "PADEL";
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InscricoesPage.useEffect": ()=>{
            if (!isPadelOrg) return;
            const orgSuffix = orgParam ? `&org=${orgParam}` : "";
            router.replace(`/organizador?tab=manage&section=eventos${orgSuffix}`);
        }
    }["InscricoesPage.useEffect"], [
        isPadelOrg,
        orgParam,
        router
    ]);
    const handleCreate = async ()=>{
        if (!user) {
            openModal({
                mode: "login",
                redirectTo: embedded ? "/organizador?tab=manage&section=inscricoes" : "/organizador/inscricoes",
                showGoogle: true
            });
            return;
        }
        setCreating(true);
        setError(null);
        try {
            const res = await fetch("/api/organizador/inscricoes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title,
                    description
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setError(json?.error || "Não foi possível criar a inscrição.");
                setCreating(false);
                return;
            }
            setTitle("");
            setDescription("");
            mutate();
            if (json?.form?.id) {
                router.push(`/organizador/inscricoes/${json.form.id}`);
            }
            setCreating(false);
        } catch (err) {
            console.error("[inscricoes][create] erro", err);
            setError("Erro inesperado ao criar inscrição.");
            setCreating(false);
        }
    };
    if (isLoading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: embedded ? "text-sm text-white/70" : "px-6 py-10 text-sm text-white/70",
            children: "A carregar..."
        }, void 0, false, {
            fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
            lineNumber: 119,
            columnNumber: 7
        }, this);
    }
    if (isPadelOrg) return null;
    const wrapperClass = embedded ? "space-y-6 text-white" : "px-6 py-8 space-y-6 text-white";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: wrapperClass,
        children: [
            !embedded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                objective: "manage",
                activeId: "inscricoes"
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                lineNumber: 130,
                columnNumber: 21
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.3em] text-white/60",
                            children: "Inscrições"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                            lineNumber: 133,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-2xl font-semibold",
                            children: "Inscrições e formulários"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                            lineNumber: 134,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-white/60",
                            children: "Cria inscrições ou formulários simples para recolher informação e vagas."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                            lineNumber: 135,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                    lineNumber: 132,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                lineNumber: 131,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-lg font-semibold",
                                children: "Criar nova inscrição"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 143,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[12px] text-white/60",
                                children: "Começa pelo nome e depois ajusta campos, datas e capacidade."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 144,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 142,
                        columnNumber: 9
                    }, this),
                    moduleDisabled && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100",
                        children: "O módulo de Inscrições está desativado para esta organização."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 149,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-[1.2fr_1.8fr]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                placeholder: "Título da inscrição",
                                value: title,
                                onChange: (e)=>setTitle(e.target.value)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 154,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                placeholder: "Descrição curta (opcional) · também pode ser só um formulário",
                                value: description,
                                onChange: (e)=>setDescription(e.target.value)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 160,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 153,
                        columnNumber: 9
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-red-300",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 167,
                        columnNumber: 19
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: creating || !title.trim() || moduleDisabled,
                        onClick: handleCreate,
                        className: "rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-110 disabled:opacity-60",
                        children: creating ? "A criar..." : "Criar inscrição"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 168,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                lineNumber: 141,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-lg font-semibold",
                                children: "As tuas inscrições"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 180,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[12px] text-white/60",
                                children: [
                                    items.length,
                                    " total"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 181,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 179,
                        columnNumber: 9
                    }, this),
                    loadingForms && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-white/60",
                        children: "A carregar inscrições..."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 184,
                        columnNumber: 26
                    }, this),
                    loadError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-red-300",
                        children: loadError
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 185,
                        columnNumber: 23
                    }, this),
                    !loadingForms && !loadError && items.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70",
                        children: "Ainda não criaste nenhuma inscrição ou formulário. Usa o botão acima para começar."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 188,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-4 lg:grid-cols-2",
                        children: items.map((form)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-lg font-semibold",
                                                        children: form.title
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                        lineNumber: 201,
                                                        columnNumber: 19
                                                    }, this),
                                                    form.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[12px] text-white/70",
                                                        children: form.description
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                        lineNumber: 202,
                                                        columnNumber: 40
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 200,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70",
                                                children: statusLabel[form.status]
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 204,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                        lineNumber: 199,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap gap-2 text-[11px] text-white/60",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5",
                                                children: formatDate(form.startAt)
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 209,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5",
                                                children: form.capacity ? `${form.capacity} vagas` : "Sem limite"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 212,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5",
                                                children: [
                                                    form.submissionsCount,
                                                    " inscrito",
                                                    form.submissionsCount === 1 ? "" : "s"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 215,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                        lineNumber: 208,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center gap-3 text-[12px]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                href: `/organizador/inscricoes/${form.id}`,
                                                className: "rounded-full bg-white px-3 py-1 text-black",
                                                children: "Gerir"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 220,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                href: `/inscricoes/${form.id}`,
                                                className: "rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10",
                                                children: "Ver público"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 226,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                        lineNumber: 219,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, form.id, true, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 195,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 193,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                lineNumber: 178,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
        lineNumber: 129,
        columnNumber: 5
    }, this);
}
_s(InscricoesPage, "BsIjbUOL+qn8D7NmOFaesWsr30g=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = InscricoesPage;
var _c;
__turbopack_context__.k.register(_c, "InscricoesPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_organizador_4081fdaa._.js.map