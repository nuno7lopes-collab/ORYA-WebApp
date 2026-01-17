(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/organizador/DashboardClient.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>DashboardClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ConfirmDestructiveActionDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/ConfirmDestructiveActionDialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/analytics.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$promo$2f$PromoCodesClient$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/promo/PromoCodesClient.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$updates$2f$page$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/(dashboard)/updates/page.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$charts$2f$SalesAreaChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/charts/SalesAreaChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$pagamentos$2f$invoices$2f$invoices$2d$client$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/pagamentos/invoices/invoices-client.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/ObjectiveSubnav.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$padel$2f$PadelHubSection$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$OrganizerPublicProfilePanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/OrganizerPublicProfilePanel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$inscricoes$2f$page$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/(dashboard)/inscricoes/page.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/image.ts [app-client] (ecmascript)");
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
const fetcher = (url)=>fetch(url).then((res)=>res.json());
const OBJECTIVE_TABS = [
    "manage",
    "promote",
    "analyze",
    "profile"
];
const CATEGORY_LABELS = {
    EVENTOS: "Eventos",
    PADEL: "Padel",
    VOLUNTARIADO: "Voluntariado"
};
const DATE_LOCALE = "pt-PT";
const DATE_TIMEZONE = "Europe/Lisbon";
const formatDateTime = (date, options)=>date ? date.toLocaleString(DATE_LOCALE, {
        timeZone: DATE_TIMEZONE,
        ...options
    }) : "Data a definir";
const formatDateOnly = (date, options)=>date ? date.toLocaleDateString(DATE_LOCALE, {
        timeZone: DATE_TIMEZONE,
        ...options
    }) : "";
const mapTabToObjective = (tab)=>{
    if (OBJECTIVE_TABS.includes(tab || "manage")) {
        return tab || "manage";
    }
    switch(tab){
        case "overview":
            return "manage";
        case "perfil":
            return "profile";
        case "profile":
            return "profile";
        case "events":
        case "padel":
        case "staff":
        case "volunteer":
            return "manage";
        case "marketing":
            return "promote";
        case "sales":
        case "finance":
        case "invoices":
            return "analyze";
        default:
            return "manage";
    }
};
const normalizeOrganizationCategory = (category)=>{
    const normalized = category?.toUpperCase() ?? "";
    if (normalized === "PADEL") return "PADEL";
    if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
    return "EVENTOS";
};
function OrganizadorPageInner({ hasOrganizer }) {
    _s();
    const { user, profile, isLoading: userLoading, mutate: mutateUser } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const { openModal } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"])();
    const [stripeCtaLoading, setStripeCtaLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [stripeCtaError, setStripeCtaError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [billingSaving, setBillingSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [billingMessage, setBillingMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [refundPolicy, setRefundPolicy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [vatRate, setVatRate] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [entityType, setEntityType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [businessName, setBusinessName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [city, setCity] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [payoutIban, setPayoutIban] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [eventStatusFilter, setEventStatusFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("all");
    const [eventCategoryFilter, setEventCategoryFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("all");
    const [eventPartnerClubFilter, setEventPartnerClubFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("all");
    const [salesEventId, setSalesEventId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [searchTerm, setSearchTerm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [timeScope, setTimeScope] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("all");
    const [eventActionLoading, setEventActionLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [eventDialog, setEventDialog] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const [marketingSection, setMarketingSection] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("overview");
    const marketingSectionSourceRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])("url");
    const handleMarketingSectionSelect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "OrganizadorPageInner.useCallback[handleMarketingSectionSelect]": (section)=>{
            marketingSectionSourceRef.current = "ui";
            setMarketingSection(section);
        }
    }["OrganizadorPageInner.useCallback[handleMarketingSectionSelect]"], [
        setMarketingSection
    ]);
    const [salesRange, setSalesRange] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("30d");
    const salesRangeLabelShort = (range)=>{
        switch(range){
            case "7d":
                return "7d";
            case "30d":
                return "30d";
            case "90d":
                return "3m";
            case "365d":
                return "1a";
            default:
                return "sempre";
        }
    };
    const salesRangeLabelLong = (range)=>{
        switch(range){
            case "7d":
                return "Últimos 7 dias";
            case "30d":
                return "Últimos 30 dias";
            case "90d":
                return "Últimos 3 meses";
            case "365d":
                return "Último ano";
            default:
                return "Todo o histórico";
        }
    };
    const tabParamRaw = searchParams?.get("tab");
    const sectionParamRaw = searchParams?.get("section");
    const marketingParamRaw = searchParams?.get("marketing");
    const activeObjective = mapTabToObjective(tabParamRaw);
    const isLegacyStandaloneTab = false;
    const normalizedSection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[normalizedSection]": ()=>{
            if (!sectionParamRaw) return undefined;
            if (activeObjective === "manage") {
                if (sectionParamRaw === "events") return "eventos";
                if (sectionParamRaw === "torneios") return "eventos";
                if (sectionParamRaw === "padel") return "padel-hub";
                if (sectionParamRaw === "volunteer") return "acoes";
            }
            if (activeObjective === "analyze") {
                if (sectionParamRaw === "sales") return "vendas";
                if (sectionParamRaw === "finance") return "financas";
            }
            if (activeObjective === "promote") {
                const marketingSections = [
                    "overview",
                    "promos",
                    "updates",
                    "promoters",
                    "content"
                ];
                if (marketingSections.includes(sectionParamRaw)) return "marketing";
            }
            return sectionParamRaw;
        }
    }["OrganizadorPageInner.useMemo[normalizedSection]"], [
        activeObjective,
        sectionParamRaw
    ]);
    const scrollSection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[scrollSection]": ()=>{
            if (!sectionParamRaw) return undefined;
            if (activeObjective === "promote") {
                const marketingSections = [
                    "overview",
                    "promos",
                    "updates",
                    "promoters",
                    "content"
                ];
                if (marketingSections.includes(sectionParamRaw)) return "marketing";
            }
            if (activeObjective === "analyze") {
                if (sectionParamRaw === "sales") return "vendas";
                if (sectionParamRaw === "finance") return "financas";
            }
            if (activeObjective === "manage") {
                if (sectionParamRaw === "events") return "eventos";
                if (sectionParamRaw === "torneios") return "eventos";
                if (sectionParamRaw === "padel") return "padel-hub";
                if (sectionParamRaw === "volunteer") return "acoes";
            }
            return sectionParamRaw;
        }
    }["OrganizadorPageInner.useMemo[scrollSection]"], [
        activeObjective,
        sectionParamRaw
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const stored = window.localStorage.getItem("organizadorFinanceLocal");
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed.refundPolicy) setRefundPolicy(parsed.refundPolicy);
                    if (parsed.vatRate) setVatRate(parsed.vatRate);
                } catch  {
                // ignore invalid
                }
            }
        }
    }["OrganizadorPageInner.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            if (!searchParams) return;
            const tabParam = searchParams.get("tab");
            if (!tabParam) return;
            const orgParam = searchParams.get("org");
            const orgSuffix = orgParam ? `&org=${orgParam}` : "";
            if (tabParam === "settings") {
                router.replace(`/organizador/settings${orgParam ? `?org=${orgParam}` : ""}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "overview") {
                router.replace(`/organizador?tab=manage${orgSuffix}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "staff") {
                router.replace(`/organizador?tab=manage&section=staff${orgSuffix}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "invoices") {
                router.replace(`/organizador?tab=analyze&section=invoices${orgSuffix}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "events") {
                router.replace(`/organizador?tab=manage&section=eventos${orgSuffix}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "padel") {
                router.replace(`/organizador?tab=manage&section=padel-hub${orgSuffix}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "volunteer") {
                router.replace(`/organizador?tab=manage&section=acoes${orgSuffix}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "marketing") {
                router.replace(`/organizador?tab=promote&section=marketing${orgSuffix}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "sales") {
                router.replace(`/organizador?tab=analyze&section=vendas${orgSuffix}`, {
                    scroll: false
                });
                return;
            }
            if (tabParam === "finance") {
                router.replace(`/organizador?tab=analyze&section=financas${orgSuffix}`, {
                    scroll: false
                });
            }
        }
    }["OrganizadorPageInner.useEffect"], [
        router,
        searchParams,
        sectionParamRaw
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            if (!sectionParamRaw || !searchParams) return;
            const legacyMap = {
                events: "eventos",
                padel: "padel-hub",
                torneios: "eventos",
                volunteer: "acoes",
                sales: "vendas",
                finance: "financas"
            };
            if (activeObjective === "promote") {
                const marketingLegacy = [
                    "overview",
                    "promos",
                    "updates",
                    "promoters",
                    "content"
                ];
                if (marketingLegacy.includes(sectionParamRaw)) {
                    const params = new URLSearchParams(searchParams);
                    params.set("section", "marketing");
                    params.set("marketing", sectionParamRaw);
                    router.replace(`${pathname}?${params.toString()}`, {
                        scroll: false
                    });
                    return;
                }
            }
            const normalized = legacyMap[sectionParamRaw];
            if (!normalized || normalized === sectionParamRaw) return;
            const params = new URLSearchParams(searchParams);
            params.set("section", normalized);
            router.replace(`${pathname}?${params.toString()}`, {
                scroll: false
            });
        }
    }["OrganizadorPageInner.useEffect"], [
        sectionParamRaw,
        searchParams,
        router,
        pathname,
        activeObjective
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            const statusParam = searchParams?.get("status");
            const catParam = searchParams?.get("cat");
            const clubParam = searchParams?.get("club");
            const searchParam = searchParams?.get("search");
            const scopeParam = searchParams?.get("scope");
            const eventIdParam = searchParams?.get("eventId");
            const marketingSectionParam = marketingParamRaw && [
                "overview",
                "promos",
                "updates",
                "promoters",
                "content"
            ].includes(marketingParamRaw) ? marketingParamRaw : [
                "overview",
                "promos",
                "updates",
                "promoters",
                "content"
            ].includes(sectionParamRaw ?? "") ? sectionParamRaw : null;
            if (statusParam) setEventStatusFilter(statusParam);
            if (catParam) setEventCategoryFilter(catParam);
            if (clubParam) setEventPartnerClubFilter(clubParam);
            if (searchParam) setSearchTerm(searchParam);
            if (scopeParam) setTimeScope(scopeParam);
            if (eventIdParam) setSalesEventId(Number(eventIdParam));
            if (marketingSectionParam) {
                const allowed = [
                    "overview",
                    "promos",
                    "updates",
                    "promoters",
                    "content"
                ];
                if (allowed.includes(marketingSectionParam)) {
                    marketingSectionSourceRef.current = "url";
                    setMarketingSection(marketingSectionParam);
                }
            } else if (activeObjective === "promote" && sectionParamRaw === "marketing") {
                marketingSectionSourceRef.current = "url";
                setMarketingSection("overview");
            }
        }
    }["OrganizadorPageInner.useEffect"], [
        searchParams,
        marketingParamRaw,
        sectionParamRaw,
        activeObjective
    ]);
    const orgParam = searchParams?.get("org");
    const orgMeUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[orgMeUrl]": ()=>{
            if (!user) return null;
            return orgParam ? `/api/organizador/me?org=${orgParam}` : "/api/organizador/me";
        }
    }["OrganizadorPageInner.useMemo[orgMeUrl]"], [
        user,
        orgParam
    ]);
    const { data: organizerData, isLoading: organizerLoading, mutate: mutateOrganizer } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(orgMeUrl, fetcher);
    const organizer = organizerData?.organizer ?? null;
    const organizationCategory = organizer?.organizationCategory ?? null;
    const orgCategory = normalizeOrganizationCategory(organizationCategory);
    const categoryLabel = CATEGORY_LABELS[orgCategory];
    const categoryCta = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[categoryCta]": ()=>{
            if (orgCategory === "PADEL") {
                return {
                    label: "Criar torneio de padel",
                    href: "/organizador/eventos/novo?preset=padel"
                };
            }
            if (orgCategory === "VOLUNTARIADO") {
                return {
                    label: "Criar evento",
                    href: "/organizador/eventos/novo?preset=voluntariado"
                };
            }
            return {
                label: "Criar evento",
                href: "/organizador/eventos/novo"
            };
        }
    }["OrganizadorPageInner.useMemo[categoryCta]"], [
        orgCategory
    ]);
    const eventLabel = orgCategory === "PADEL" ? "torneio" : "evento";
    const eventLabelPlural = orgCategory === "PADEL" ? "torneios" : "eventos";
    const eventLabelTitle = orgCategory === "PADEL" ? "Torneio" : "Evento";
    const eventLabelPluralTitle = orgCategory === "PADEL" ? "Torneios" : "Eventos";
    const ticketLabelPluralTitle = orgCategory === "PADEL" ? "Inscrições" : "Bilhetes";
    const ticketSalesLabel = orgCategory === "PADEL" ? "Inscrições vendidas" : "Bilhetes vendidos";
    const ticketLabelTitle = orgCategory === "PADEL" ? "Inscrição" : "Bilhete";
    const showPadelHub = orgCategory === "PADEL";
    const supportsInscricoes = orgCategory !== "PADEL";
    const loading = userLoading || organizerLoading;
    const paymentsStatus = organizerData?.paymentsStatus ?? "NO_STRIPE";
    const paymentsMode = organizerData?.paymentsMode ?? "CONNECT";
    const membershipRole = organizerData?.membershipRole ?? null;
    const officialEmail = organizer?.officialEmail ?? null;
    const officialEmailVerifiedAtRaw = organizer?.officialEmailVerifiedAt ?? null;
    const officialEmailVerifiedAt = officialEmailVerifiedAtRaw ? new Date(officialEmailVerifiedAtRaw) : null;
    const showOfficialEmailWarning = Boolean(organizer) && !officialEmailVerifiedAt;
    const onboardingParam = searchParams?.get("onboarding");
    const [stripeRequirements, setStripeRequirements] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [stripeSuccessMessage, setStripeSuccessMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            if (!scrollSection) return;
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const manageTargets = showPadelHub ? [
                "eventos",
                "padel-hub"
            ] : [
                "eventos",
                "inscricoes"
            ];
            const scrollTargets = {
                manage: manageTargets,
                promote: [
                    "marketing"
                ],
                analyze: [
                    "financas",
                    "invoices"
                ],
                profile: [
                    "perfil"
                ]
            };
            const allowed = scrollTargets[activeObjective] ?? [];
            if (!allowed.includes(scrollSection)) return;
            const target = document.getElementById(scrollSection);
            if (target) {
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        }
    }["OrganizadorPageInner.useEffect"], [
        scrollSection,
        activeObjective,
        showPadelHub
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            if (!searchParams) return;
            if (!showPadelHub) return;
            if (activeObjective !== "manage") return;
            if (sectionParamRaw !== "inscricoes") return;
            const params = new URLSearchParams(searchParams);
            params.set("section", "eventos");
            router.replace(`${pathname}?${params.toString()}`, {
                scroll: false
            });
        }
    }["OrganizadorPageInner.useEffect"], [
        activeObjective,
        pathname,
        router,
        searchParams,
        sectionParamRaw,
        showPadelHub
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            const refreshStripe = {
                "OrganizadorPageInner.useEffect.refreshStripe": async ()=>{
                    try {
                        const res = await fetch("/api/organizador/payouts/status");
                        const data = await res.json().catch({
                            "OrganizadorPageInner.useEffect.refreshStripe": ()=>null
                        }["OrganizadorPageInner.useEffect.refreshStripe"]);
                        if (res.ok && data?.status) {
                            setStripeRequirements(Array.isArray(data.requirements_due) ? data.requirements_due : []);
                            if (data.status === "CONNECTED" && onboardingParam === "done") {
                                setStripeSuccessMessage("Conta Stripe ligada. Já podes vender bilhetes pagos.");
                                setTimeout({
                                    "OrganizadorPageInner.useEffect.refreshStripe": ()=>setStripeSuccessMessage(null)
                                }["OrganizadorPageInner.useEffect.refreshStripe"], 3200);
                            }
                        }
                        mutateOrganizer();
                    } catch (err) {
                        console.error("[stripe][refresh-status] err", err);
                    }
                }
            }["OrganizadorPageInner.useEffect.refreshStripe"];
            if (activeObjective === "analyze" && !isLegacyStandaloneTab) {
                refreshStripe();
            }
        }
    }["OrganizadorPageInner.useEffect"], [
        onboardingParam,
        activeObjective,
        isLegacyStandaloneTab,
        mutateOrganizer
    ]);
    // Prefill onboarding fields quando já existirem dados
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            if (!businessName && profile?.fullName) setBusinessName(profile.fullName);
            if (!city && profile?.city) setCity(profile.city);
            if (organizer) {
                if (!entityType && organizer.entityType) setEntityType(organizer.entityType);
                if (!businessName && organizer.publicName) setBusinessName(organizer.publicName);
                if (!city && organizer.city) setCity(organizer.city);
                if (!payoutIban && organizer.payoutIban) setPayoutIban(organizer.payoutIban);
            }
        }
    }["OrganizadorPageInner.useEffect"], [
        organizer,
        profile,
        businessName,
        city,
        entityType,
        payoutIban
    ]);
    const { data: overview } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(organizer?.status === "ACTIVE" ? "/api/organizador/estatisticas/overview?range=30d" : null, fetcher, {
        revalidateOnFocus: false
    });
    const { data: events, error: eventsError, mutate: mutateEvents } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(organizer?.status === "ACTIVE" ? "/api/organizador/events/list" : null, fetcher, {
        revalidateOnFocus: false
    });
    const shouldLoadSales = organizer?.status === "ACTIVE" && activeObjective === "analyze" && normalizedSection === "vendas" && !isLegacyStandaloneTab;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            if (!shouldLoadSales) return;
            if (!salesEventId && events?.items?.length) {
                setSalesEventId(events.items[0].id);
            }
        }
    }["OrganizadorPageInner.useEffect"], [
        events,
        salesEventId,
        shouldLoadSales
    ]);
    const { data: payoutSummary } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(organizer?.status === "ACTIVE" ? "/api/organizador/payouts/summary" : null, fetcher, {
        revalidateOnFocus: false
    });
    const { data: financeOverview } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(organizer?.status === "ACTIVE" && activeObjective === "analyze" && !isLegacyStandaloneTab ? "/api/organizador/finance/overview" : null, fetcher, {
        revalidateOnFocus: false
    });
    const oneYearAgoIso = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[oneYearAgoIso]": ()=>{
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - 365);
            return d.toISOString();
        }
    }["OrganizadorPageInner.useMemo[oneYearAgoIso]"], []);
    const salesSeriesKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[salesSeriesKey]": ()=>{
            if (!shouldLoadSales || !salesEventId) return null;
            if (salesRange === "7d" || salesRange === "30d" || salesRange === "90d") {
                return `/api/organizador/estatisticas/time-series?range=${salesRange}&eventId=${salesEventId}`;
            }
            if (salesRange === "365d") {
                return `/api/organizador/estatisticas/time-series?eventId=${salesEventId}&from=${oneYearAgoIso}`;
            }
            return `/api/organizador/estatisticas/time-series?eventId=${salesEventId}`;
        }
    }["OrganizadorPageInner.useMemo[salesSeriesKey]"], [
        salesEventId,
        salesRange,
        oneYearAgoIso,
        shouldLoadSales
    ]);
    const { data: salesSeries } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(salesSeriesKey, fetcher, {
        revalidateOnFocus: false
    });
    const { data: buyers } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(shouldLoadSales && salesEventId ? `/api/organizador/estatisticas/buyers?eventId=${salesEventId}` : null, fetcher, {
        revalidateOnFocus: false
    });
    const archiveEvent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "OrganizadorPageInner.useCallback[archiveEvent]": async (target, mode)=>{
            setEventActionLoading(target.id);
            setCtaError(null);
            const archive = mode === "archive" || mode === "delete";
            try {
                const res = await fetch("/api/organizador/events/update", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        eventId: target.id,
                        archive
                    })
                });
                const json = await res.json().catch({
                    "OrganizadorPageInner.useCallback[archiveEvent]": ()=>null
                }["OrganizadorPageInner.useCallback[archiveEvent]"]);
                if (!res.ok || json?.ok === false) {
                    setCtaError(json?.error || "Não foi possível concluir esta ação.");
                } else {
                    mutateEvents();
                    if (mode === "delete") {
                        setCtaSuccess("Rascunho apagado.");
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trackEvent"])("event_draft_deleted", {
                            eventId: target.id,
                            status: target.status
                        });
                    } else if (mode === "archive") {
                        setCtaSuccess("Evento arquivado.");
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trackEvent"])("event_archived", {
                            eventId: target.id,
                            status: target.status
                        });
                    } else {
                        setCtaSuccess("Evento reativado.");
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trackEvent"])("event_unarchived", {
                            eventId: target.id,
                            status: target.status
                        });
                    }
                    setTimeout({
                        "OrganizadorPageInner.useCallback[archiveEvent]": ()=>setCtaSuccess(null)
                    }["OrganizadorPageInner.useCallback[archiveEvent]"], 3000);
                }
            } catch (err) {
                console.error("[events][archive]", err);
                setCtaError("Erro inesperado ao processar a ação.");
            } finally{
                setEventActionLoading(null);
                setEventDialog(null);
            }
        }
    }["OrganizadorPageInner.useCallback[archiveEvent]"], [
        mutateEvents
    ]);
    const { data: marketingOverview } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(organizer?.status === "ACTIVE" && activeObjective === "promote" && !isLegacyStandaloneTab ? "/api/organizador/marketing/overview" : null, fetcher, {
        revalidateOnFocus: false
    });
    const { data: promoData } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(organizer?.status === "ACTIVE" ? "/api/organizador/promo" : null, fetcher, {
        revalidateOnFocus: false
    });
    const currentQuery = searchParams?.toString() || "";
    async function handleStripeConnect() {
        __turbopack_context__.A("[project]/lib/analytics.ts [app-client] (ecmascript, async loader)").then(({ trackEvent })=>trackEvent("connect_stripe_clicked", {
                status: paymentsStatus
            }));
        setStripeCtaError(null);
        setStripeCtaLoading(true);
        try {
            const res = await fetch("/api/organizador/payouts/connect", {
                method: "POST"
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok || !json.url) {
                setStripeCtaError(json?.error || "Não foi possível gerar o link de onboarding.");
                setStripeCtaLoading(false);
                return;
            }
            window.location.href = json.url;
        } catch (err) {
            console.error(err);
            setStripeCtaError("Erro inesperado ao gerar link de onboarding.");
            setStripeCtaLoading(false);
        }
    }
    async function handleSaveBilling() {
        setBillingMessage(null);
        setBillingSaving(true);
        try {
            const res = await fetch("/api/organizador/me", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    businessName,
                    entityType,
                    city,
                    payoutIban
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setBillingMessage(json?.error || "Não foi possível guardar os dados de faturação.");
            } else {
                setBillingMessage("Dados de faturação guardados.");
                await mutateOrganizer();
            }
        } catch (err) {
            console.error("[finance] guardar faturação", err);
            setBillingMessage("Erro inesperado ao guardar os dados.");
        } finally{
            setBillingSaving(false);
        }
    }
    const handleSavePolicy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "OrganizadorPageInner.useCallback[handleSavePolicy]": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const payload = {
                refundPolicy,
                vatRate
            };
            window.localStorage.setItem("organizadorFinanceLocal", JSON.stringify(payload));
            setBillingMessage("Política e IVA guardados localmente.");
        }
    }["OrganizadorPageInner.useCallback[handleSavePolicy]"], [
        refundPolicy,
        vatRate
    ]);
    // Usar largura completa do inset para evitar que o conteúdo fique centrado/direita quando a sidebar está aberta
    const containerClasses = "w-full max-w-none px-4 pb-12 pt-6 md:pt-8 md:px-6 lg:px-8";
    const statusLabelMap = {
        all: "Todos",
        active: "Ativos",
        draft: "Rascunhos",
        finished: "Concluídos",
        ongoing: "Em curso",
        archived: "Arquivados"
    };
    const timeScopeLabels = {
        all: "Todos",
        upcoming: "Próximos",
        ongoing: "A decorrer",
        past: "Passados"
    };
    const eventsList = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[eventsList]": ()=>events?.items ?? []
    }["OrganizadorPageInner.useMemo[eventsList]"], [
        events
    ]);
    const eventsListLoading = organizer?.status === "ACTIVE" && activeObjective === "manage" && !isLegacyStandaloneTab && !events;
    const partnerClubOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[partnerClubOptions]": ()=>{
            const map = new Map();
            eventsList.forEach({
                "OrganizadorPageInner.useMemo[partnerClubOptions]": (ev)=>{
                    if (ev.templateType !== "PADEL") return;
                    if (Number.isFinite(ev.padelClubId)) {
                        map.set(ev.padelClubId, ev.padelClubName || `Clube ${ev.padelClubId}`);
                    }
                    (ev.padelPartnerClubIds || []).forEach({
                        "OrganizadorPageInner.useMemo[partnerClubOptions]": (id, idx)=>{
                            if (!Number.isFinite(id)) return;
                            const label = ev.padelPartnerClubNames?.[idx] || `Clube ${id}`;
                            map.set(id, label);
                        }
                    }["OrganizadorPageInner.useMemo[partnerClubOptions]"]);
                }
            }["OrganizadorPageInner.useMemo[partnerClubOptions]"]);
            return Array.from(map.entries()).map({
                "OrganizadorPageInner.useMemo[partnerClubOptions]": ([id, name])=>({
                        id,
                        name
                    })
            }["OrganizadorPageInner.useMemo[partnerClubOptions]"]);
        }
    }["OrganizadorPageInner.useMemo[partnerClubOptions]"], [
        eventsList
    ]);
    const persistFilters = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "OrganizadorPageInner.useCallback[persistFilters]": (params)=>{
            const paramString = params.toString();
            if (paramString !== currentQuery) {
                router.replace(paramString ? `${pathname}?${paramString}` : pathname, {
                    scroll: false
                });
            }
            const payload = {
                status: eventStatusFilter,
                cat: eventCategoryFilter,
                club: eventPartnerClubFilter,
                search: searchTerm,
                scope: timeScope,
                marketing: marketingSection
            };
            if ("TURBOPACK compile-time truthy", 1) {
                localStorage.setItem("organizadorFilters", JSON.stringify(payload));
            }
        }
    }["OrganizadorPageInner.useCallback[persistFilters]"], [
        eventCategoryFilter,
        eventPartnerClubFilter,
        eventStatusFilter,
        pathname,
        router,
        searchTerm,
        timeScope,
        marketingSection,
        currentQuery
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            if (searchParams?.toString()) return;
            const saved = localStorage.getItem("organizadorFilters");
            if (!saved) return;
            try {
                const parsed = JSON.parse(saved);
                if (parsed.status) setEventStatusFilter(parsed.status);
                if (parsed.cat) setEventCategoryFilter(parsed.cat);
                if (parsed.club) setEventPartnerClubFilter(parsed.club);
                if (parsed.search) setSearchTerm(parsed.search);
                if (parsed.scope) setTimeScope(parsed.scope);
                const persistedMarketing = parsed.marketing ?? parsed.section;
                if (persistedMarketing && [
                    "overview",
                    "promos",
                    "updates",
                    "promoters",
                    "content"
                ].includes(persistedMarketing)) {
                    setMarketingSection(persistedMarketing);
                }
            } catch  {
            // ignore parse errors
            }
        }
    }["OrganizadorPageInner.useEffect"], [
        searchParams
    ]);
    const filteredEvents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[filteredEvents]": ()=>{
            const now = new Date();
            const search = searchTerm.trim().toLowerCase();
            return eventsList.filter({
                "OrganizadorPageInner.useMemo[filteredEvents]": (ev)=>{
                    const startsAt = ev.startsAt ? new Date(ev.startsAt) : null;
                    const endsAt = ev.endsAt ? new Date(ev.endsAt) : null;
                    const isFinished = endsAt ? endsAt.getTime() < now.getTime() : false;
                    const isFuture = startsAt ? startsAt.getTime() >= now.getTime() : false;
                    const isOngoing = startsAt && endsAt ? startsAt.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime() : false;
                    if (eventStatusFilter === "draft" && ev.status !== "DRAFT") return false;
                    if (eventStatusFilter === "archived" && ev.status !== "ARCHIVED") return false;
                    if (eventStatusFilter === "active" && !(ev.status === "PUBLISHED" && isFuture)) return false;
                    if (eventStatusFilter === "finished" && !isFinished) return false;
                    if (eventStatusFilter === "ongoing" && !isOngoing) return false;
                    if (eventCategoryFilter !== "all") {
                        const cats = ev.categories ?? [];
                        if (!cats.includes(eventCategoryFilter)) return false;
                    }
                    if (eventPartnerClubFilter !== "all") {
                        const clubId = Number(eventPartnerClubFilter);
                        if (Number.isFinite(clubId)) {
                            const partners = ev.padelPartnerClubIds ?? [];
                            const mainClub = ev.padelClubId ?? null;
                            if (mainClub !== clubId && !partners.includes(clubId)) return false;
                        }
                    }
                    if (search) {
                        if (!ev.title.toLowerCase().includes(search)) return false;
                    }
                    if (timeScope === "upcoming" && !isFuture) return false;
                    if (timeScope === "ongoing" && !isOngoing) return false;
                    if (timeScope === "past" && !isFinished) return false;
                    return true;
                }
            }["OrganizadorPageInner.useMemo[filteredEvents]"]);
        }
    }["OrganizadorPageInner.useMemo[filteredEvents]"], [
        eventCategoryFilter,
        eventPartnerClubFilter,
        eventStatusFilter,
        eventsList,
        searchTerm,
        timeScope
    ]);
    const activeFilterCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[activeFilterCount]": ()=>[
                eventStatusFilter !== "all",
                eventCategoryFilter !== "all",
                eventPartnerClubFilter !== "all",
                timeScope !== "all",
                searchTerm.trim() !== ""
            ].filter(Boolean).length
    }["OrganizadorPageInner.useMemo[activeFilterCount]"], [
        eventCategoryFilter,
        eventPartnerClubFilter,
        eventStatusFilter,
        searchTerm,
        timeScope
    ]);
    const selectedSalesEvent = salesEventId ? eventsList.find((ev)=>ev.id === salesEventId) ?? null : null;
    const financeData = financeOverview && financeOverview.ok ? financeOverview : null;
    const financeSummary = payoutSummary && "ok" in payoutSummary && payoutSummary.ok ? payoutSummary : null;
    const stripeState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[stripeState]": ()=>{
            const hasReqs = stripeRequirements.length > 0;
            if (paymentsStatus === "READY") {
                return {
                    badge: "Ativo",
                    tone: "success",
                    title: "Conta Stripe ligada ✅",
                    desc: `Já podes vender ${ticketLabelPluralTitle.toLowerCase()} pagos e receber os teus payouts normalmente.`,
                    cta: "Abrir painel Stripe"
                };
            }
            if (paymentsStatus === "PENDING") {
                return {
                    badge: hasReqs ? "Requer atenção" : "Onboarding incompleto",
                    tone: hasReqs ? "error" : "warning",
                    title: hasReqs ? "Falta concluir dados no Stripe" : "Conta Stripe em configuração",
                    desc: hasReqs ? "A tua conta Stripe precisa de dados antes de ativar pagamentos." : `Conclui o onboarding no Stripe para começares a receber os pagamentos das tuas ${ticketLabelPluralTitle.toLowerCase()}.`,
                    cta: hasReqs ? "Rever ligação Stripe" : "Continuar configuração no Stripe"
                };
            }
            return {
                badge: "Por ligar",
                tone: "neutral",
                title: "Ainda não ligaste a tua conta Stripe",
                desc: `Podes criar ${eventLabelPlural} gratuitos, mas para vender ${ticketLabelPluralTitle.toLowerCase()} pagos precisas de ligar uma conta Stripe.`,
                cta: "Ligar conta Stripe"
            };
        }
    }["OrganizadorPageInner.useMemo[stripeState]"], [
        eventLabelPlural,
        paymentsStatus,
        stripeRequirements,
        ticketLabelPluralTitle
    ]);
    const marketingPromos = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[marketingPromos]": ()=>promoData?.promoCodes ?? []
    }["OrganizadorPageInner.useMemo[marketingPromos]"], [
        promoData
    ]);
    const marketingKpis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[marketingKpis]": ()=>{
            const activePromos = marketingPromos.filter({
                "OrganizadorPageInner.useMemo[marketingKpis]": (p)=>p.active
            }["OrganizadorPageInner.useMemo[marketingKpis]"]).length;
            const fallbackTop = [
                ...marketingPromos
            ].sort({
                "OrganizadorPageInner.useMemo[marketingKpis]": (a, b)=>(b.redemptionsCount ?? 0) - (a.redemptionsCount ?? 0)
            }["OrganizadorPageInner.useMemo[marketingKpis]"])[0];
            return {
                totalTickets: marketingOverview?.totalTickets ?? overview?.totalTickets ?? 0,
                ticketsWithPromo: marketingOverview?.ticketsWithPromo ?? marketingPromos.reduce({
                    "OrganizadorPageInner.useMemo[marketingKpis]": (sum, p)=>sum + (p.redemptionsCount ?? 0)
                }["OrganizadorPageInner.useMemo[marketingKpis]"], 0),
                guestTickets: marketingOverview?.guestTickets ?? 0,
                marketingRevenueCents: marketingOverview?.marketingRevenueCents ?? 0,
                activePromos,
                topPromo: marketingOverview?.topPromo ?? (fallbackTop ? {
                    id: fallbackTop.id,
                    code: fallbackTop.code,
                    redemptionsCount: fallbackTop.redemptionsCount ?? 0,
                    revenueCents: 0
                } : null)
            };
        }
    }["OrganizadorPageInner.useMemo[marketingKpis]"], [
        marketingOverview,
        marketingPromos,
        overview
    ]);
    const buyersItems = buyers && buyers.ok !== false ? buyers.items : [];
    const salesLoading = !!salesEventId && !salesSeries;
    const buyersLoading = !!salesEventId && !buyers;
    const salesKpis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[salesKpis]": ()=>{
            const tickets = salesSeries?.points?.reduce({
                "OrganizadorPageInner.useMemo[salesKpis]": (sum, p)=>sum + p.tickets
            }["OrganizadorPageInner.useMemo[salesKpis]"], 0) ?? 0;
            const revenueCents = salesSeries?.points?.reduce({
                "OrganizadorPageInner.useMemo[salesKpis]": (sum, p)=>sum + p.revenueCents
            }["OrganizadorPageInner.useMemo[salesKpis]"], 0) ?? 0;
            const eventsWithSales = tickets > 0 ? 1 : 0;
            const avgOccupancy = ({
                "OrganizadorPageInner.useMemo[salesKpis].avgOccupancy": ()=>{
                    const capacity = selectedSalesEvent?.capacity ?? null;
                    if (!capacity) return null;
                    const sold = selectedSalesEvent?.ticketsSold ?? 0;
                    return Math.min(100, Math.round(sold / capacity * 100));
                }
            })["OrganizadorPageInner.useMemo[salesKpis].avgOccupancy"]();
            return {
                tickets,
                revenueCents,
                eventsWithSales,
                avgOccupancy
            };
        }
    }["OrganizadorPageInner.useMemo[salesKpis]"], [
        salesSeries?.points,
        selectedSalesEvent
    ]);
    const topEvents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[topEvents]": ()=>{
            return [
                ...eventsList
            ].filter({
                "OrganizadorPageInner.useMemo[topEvents]": (ev)=>(ev.revenueCents ?? 0) > 0 || (ev.ticketsSold ?? 0) > 0
            }["OrganizadorPageInner.useMemo[topEvents]"]).sort({
                "OrganizadorPageInner.useMemo[topEvents]": (a, b)=>(b.revenueCents ?? 0) - (a.revenueCents ?? 0) || (b.ticketsSold ?? 0) - (a.ticketsSold ?? 0)
            }["OrganizadorPageInner.useMemo[topEvents]"]).slice(0, 5);
        }
    }["OrganizadorPageInner.useMemo[topEvents]"], [
        eventsList
    ]);
    const formatEuros = (val)=>`${(val / 100).toFixed(2)} €`;
    const extractFees = (p)=>p.platformFeeCents ?? p.feesCents ?? 0;
    const normalizePoint = (p)=>{
        const netCents = p.netCents ?? p.revenueCents ?? 0;
        const discount = p.discountCents ?? 0;
        const fees = extractFees(p);
        const grossCents = p.grossCents ?? netCents + discount + fees;
        return {
            date: p.date,
            gross: grossCents / 100,
            net: netCents / 100
        };
    };
    const salesSeriesBreakdown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[salesSeriesBreakdown]": ()=>{
            if (!salesSeries?.points?.length) return null;
            const gross = salesSeries.points.reduce({
                "OrganizadorPageInner.useMemo[salesSeriesBreakdown].gross": (acc, p)=>acc + (p.grossCents ?? (p.netCents ?? p.revenueCents ?? 0) + (p.discountCents ?? 0) + extractFees(p))
            }["OrganizadorPageInner.useMemo[salesSeriesBreakdown].gross"], 0);
            const discount = salesSeries.points.reduce({
                "OrganizadorPageInner.useMemo[salesSeriesBreakdown].discount": (acc, p)=>acc + (p.discountCents ?? 0)
            }["OrganizadorPageInner.useMemo[salesSeriesBreakdown].discount"], 0);
            const fees = salesSeries.points.reduce({
                "OrganizadorPageInner.useMemo[salesSeriesBreakdown].fees": (acc, p)=>acc + extractFees(p)
            }["OrganizadorPageInner.useMemo[salesSeriesBreakdown].fees"], 0);
            const net = salesSeries.points.reduce({
                "OrganizadorPageInner.useMemo[salesSeriesBreakdown].net": (acc, p)=>acc + (p.netCents ?? p.revenueCents ?? 0)
            }["OrganizadorPageInner.useMemo[salesSeriesBreakdown].net"], 0);
            return {
                gross,
                discount,
                fees,
                net
            };
        }
    }["OrganizadorPageInner.useMemo[salesSeriesBreakdown]"], [
        salesSeries?.points
    ]);
    const salesChartPoints = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[salesChartPoints]": ()=>{
            if (!salesSeries?.points?.length) return [];
            return salesSeries.points.map({
                "OrganizadorPageInner.useMemo[salesChartPoints]": (p)=>({
                        ...normalizePoint(p),
                        tickets: p.tickets ?? 0
                    })
            }["OrganizadorPageInner.useMemo[salesChartPoints]"]);
        }
    }["OrganizadorPageInner.useMemo[salesChartPoints]"], [
        salesSeries?.points,
        normalizePoint
    ]);
    const exportFinanceCsv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "OrganizadorPageInner.useCallback[exportFinanceCsv]": ()=>{
            if (!financeData || !financeData.events.length) return;
            const header = [
                "ID",
                eventLabelTitle,
                ticketLabelPluralTitle,
                "Bruto (€)",
                "Taxas (€)",
                "Líquido (€)",
                "Estado",
                "Data"
            ];
            const rows = financeData.events.map({
                "OrganizadorPageInner.useCallback[exportFinanceCsv].rows": (ev)=>[
                        ev.id,
                        ev.title,
                        ev.ticketsSold,
                        (ev.grossCents / 100).toFixed(2),
                        (ev.feesCents / 100).toFixed(2),
                        (ev.netCents / 100).toFixed(2),
                        ev.status ?? "",
                        formatDateOnly(ev.startsAt ? new Date(ev.startsAt) : null)
                    ]
            }["OrganizadorPageInner.useCallback[exportFinanceCsv].rows"]);
            const csv = [
                header.join(";"),
                ...rows.map({
                    "OrganizadorPageInner.useCallback[exportFinanceCsv].csv": (r)=>r.join(";")
                }["OrganizadorPageInner.useCallback[exportFinanceCsv].csv"])
            ].join("\n");
            const blob = new Blob([
                csv
            ], {
                type: "text/csv"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `vendas-por-${eventLabel}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }["OrganizadorPageInner.useCallback[exportFinanceCsv]"], [
        eventLabelTitle,
        financeData,
        ticketLabelPluralTitle
    ]);
    const handleExportSalesCsv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "OrganizadorPageInner.useCallback[handleExportSalesCsv]": ()=>{
            if (!salesSeries?.points?.length || !selectedSalesEvent) return;
            const header = [
                "Data",
                ticketLabelPluralTitle,
                "Bruto (€)",
                "Desconto (€)",
                "Taxas (€)",
                "Líquido (€)"
            ];
            const rows = salesSeries.points.map({
                "OrganizadorPageInner.useCallback[handleExportSalesCsv].rows": (p)=>{
                    const date = formatDateOnly(new Date(p.date));
                    const gross = (p.grossCents ?? p.revenueCents ?? 0) / 100;
                    const discount = (p.discountCents ?? 0) / 100;
                    const fees = (p.platformFeeCents ?? 0) / 100;
                    const net = (p.netCents ?? p.revenueCents ?? 0) / 100;
                    return [
                        date,
                        p.tickets,
                        gross.toFixed(2),
                        (-discount).toFixed(2),
                        (-fees).toFixed(2),
                        net.toFixed(2)
                    ];
                }
            }["OrganizadorPageInner.useCallback[handleExportSalesCsv].rows"]);
            const csv = [
                header.join(";"),
                ...rows.map({
                    "OrganizadorPageInner.useCallback[handleExportSalesCsv].csv": (r)=>r.join(";")
                }["OrganizadorPageInner.useCallback[handleExportSalesCsv].csv"])
            ].join("\n");
            const blob = new Blob([
                csv
            ], {
                type: "text/csv"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const rangeLabel = salesRangeLabelShort(salesRange);
            a.download = `vendas-${selectedSalesEvent.title}-${rangeLabel}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }["OrganizadorPageInner.useCallback[handleExportSalesCsv]"], [
        salesRange,
        salesSeries?.points,
        selectedSalesEvent,
        ticketLabelPluralTitle
    ]);
    const fillTheRoomEvents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[fillTheRoomEvents]": ()=>{
            const sourceEvents = marketingOverview?.events && marketingOverview.events.length > 0 ? marketingOverview.events : eventsList;
            const now = new Date();
            return sourceEvents.filter({
                "OrganizadorPageInner.useMemo[fillTheRoomEvents]": (ev)=>{
                    const start = ev.startsAt ? new Date(ev.startsAt) : null;
                    return start && start.getTime() >= now.getTime();
                }
            }["OrganizadorPageInner.useMemo[fillTheRoomEvents]"]).sort({
                "OrganizadorPageInner.useMemo[fillTheRoomEvents]": (a, b)=>a.startsAt && b.startsAt ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() : 0
            }["OrganizadorPageInner.useMemo[fillTheRoomEvents]"]).slice(0, 6).map({
                "OrganizadorPageInner.useMemo[fillTheRoomEvents]": (ev)=>{
                    const start = ev.startsAt ? new Date(ev.startsAt) : null;
                    const diffDays = start ? Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    const capacity = ev.capacity ?? null;
                    const sold = ev.ticketsSold ?? 0;
                    const occupancy = capacity ? Math.min(1, sold / capacity) : null;
                    let tag = {
                        label: "Atenção",
                        tone: "border-amber-400/40 bg-amber-400/10 text-amber-100",
                        suggestion: "Criar código -10% 48h"
                    };
                    if (occupancy !== null) {
                        if (occupancy >= 0.8) {
                            tag = {
                                label: "Confortável",
                                tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
                                suggestion: "Preparar lista de espera"
                            };
                        } else if (occupancy < 0.4 && (diffDays ?? 0) <= 7) {
                            tag = {
                                label: "Crítico",
                                tone: "border-red-400/50 bg-red-500/10 text-red-100",
                                suggestion: "Last-minute boost"
                            };
                        }
                    } else if ((diffDays ?? 0) <= 5) {
                        tag = {
                            label: "Sem lotação",
                            tone: "border-white/20 bg-white/5 text-white/70",
                            suggestion: "Definir capacidade e criar código"
                        };
                    }
                    return {
                        ...ev,
                        diffDays,
                        capacity,
                        occupancy,
                        tag
                    };
                }
            }["OrganizadorPageInner.useMemo[fillTheRoomEvents]"]);
        }
    }["OrganizadorPageInner.useMemo[fillTheRoomEvents]"], [
        eventsList,
        marketingOverview?.events
    ]);
    const stripeIncomplete = paymentsMode !== "PLATFORM" && paymentsStatus === "PENDING";
    const profileCoverUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[profileCoverUrl]": ()=>{
            const customCover = organizer?.brandingCoverUrl?.trim() || null;
            const coverCandidate = customCover ?? eventsList.find({
                "OrganizadorPageInner.useMemo[profileCoverUrl]": (ev)=>ev.coverImageUrl
            }["OrganizadorPageInner.useMemo[profileCoverUrl]"])?.coverImageUrl ?? null;
            return coverCandidate ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["optimizeImageUrl"])(coverCandidate, 1400, 70) : null;
        }
    }["OrganizadorPageInner.useMemo[profileCoverUrl]"], [
        eventsList,
        organizer?.brandingCoverUrl
    ]);
    const publicProfileUrl = organizer?.username ? `/${organizer.username}` : null;
    const activeSection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrganizadorPageInner.useMemo[activeSection]": ()=>{
            const manageSections = showPadelHub ? [
                "eventos",
                "padel-hub"
            ] : [
                "eventos",
                "inscricoes"
            ];
            const baseSections = {
                manage: manageSections,
                promote: [
                    "marketing"
                ],
                analyze: [
                    "financas",
                    "invoices"
                ],
                profile: [
                    "perfil"
                ]
            };
            const allowed = baseSections[activeObjective] ?? [
                "eventos"
            ];
            const candidate = normalizedSection ?? (activeObjective === "analyze" ? "financas" : activeObjective === "promote" ? "marketing" : activeObjective === "profile" ? "perfil" : "eventos");
            return allowed.includes(candidate) ? candidate : allowed[0];
        }
    }["OrganizadorPageInner.useMemo[activeSection]"], [
        activeObjective,
        normalizedSection,
        showPadelHub
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            const params = new URLSearchParams(currentQuery);
            const setParam = {
                "OrganizadorPageInner.useEffect.setParam": (key, value, defaultVal)=>{
                    if (!value || value === defaultVal) params.delete(key);
                    else params.set(key, value);
                }
            }["OrganizadorPageInner.useEffect.setParam"];
            setParam("status", eventStatusFilter, "all");
            setParam("cat", eventCategoryFilter, "all");
            setParam("club", eventPartnerClubFilter, "all");
            setParam("search", searchTerm, "");
            setParam("scope", timeScope, "all");
            if (activeObjective === "promote" && activeSection === "marketing") {
                const validMarketingParam = marketingParamRaw && [
                    "overview",
                    "promos",
                    "updates",
                    "promoters",
                    "content"
                ].includes(marketingParamRaw) ? marketingParamRaw : null;
                if (marketingSectionSourceRef.current !== "ui" && validMarketingParam && validMarketingParam !== marketingSection) {
                    return;
                }
                setParam("marketing", marketingSection, "overview");
            } else {
                params.delete("marketing");
            }
            if (salesEventId) params.set("eventId", String(salesEventId));
            else params.delete("eventId");
            persistFilters(params);
            if (marketingSectionSourceRef.current === "ui") {
                marketingSectionSourceRef.current = "url";
            }
        }
    }["OrganizadorPageInner.useEffect"], [
        eventCategoryFilter,
        eventPartnerClubFilter,
        eventStatusFilter,
        marketingSection,
        persistFilters,
        salesEventId,
        searchTerm,
        timeScope,
        currentQuery,
        activeObjective,
        activeSection,
        marketingParamRaw
    ]);
    const [fadeIn, setFadeIn] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizadorPageInner.useEffect": ()=>{
            setFadeIn(false);
            const id = requestAnimationFrame({
                "OrganizadorPageInner.useEffect.id": ()=>setFadeIn(true)
            }["OrganizadorPageInner.useEffect.id"]);
            return ({
                "OrganizadorPageInner.useEffect": ()=>cancelAnimationFrame(id)
            })["OrganizadorPageInner.useEffect"];
        }
    }["OrganizadorPageInner.useEffect"], [
        activeObjective,
        activeSection,
        marketingSection
    ]);
    const fadeClass = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("transition-opacity duration-300", fadeIn ? "opacity-100" : "opacity-0");
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `${containerClasses} space-y-6`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-8 w-48 rounded-full bg-white/10 animate-pulse"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 1224,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-24 rounded-3xl bg-white/5 border border-white/10 animate-pulse"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 1225,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/DashboardClient.tsx",
            lineNumber: 1223,
            columnNumber: 7
        }, this);
    }
    if (!hasOrganizer || organizer?.status !== "ACTIVE") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `${containerClasses} space-y-6`,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-xl space-y-3 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] uppercase tracking-[0.24em] text-white/70",
                        children: "Sem organização ativa"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1234,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "text-2xl font-semibold text-white",
                        children: "Liga-te a uma organização para continuares."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1235,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-white/70",
                        children: "Precisas de criar ou escolher uma organização para aceder ao dashboard."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1236,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "/organizador/become",
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"], "justify-center"),
                                children: "Criar organização"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1240,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "/organizador/organizations",
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "justify-center"),
                                children: "Escolher organização"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1243,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1239,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 1233,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/organizador/DashboardClient.tsx",
            lineNumber: 1232,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `${containerClasses} space-y-6 text-white`,
        children: [
            showOfficialEmailWarning && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-wrap items-center justify-between gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "font-semibold",
                                    children: officialEmail ? "Email oficial pendente de verificação." : "Define o email oficial da organização para faturação e alertas críticos."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1258,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[12px] text-amber-100/80",
                                    children: "Usamos este email para invoices, alertas de vendas/payouts e transferências de Owner."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1263,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 1257,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/organizador/settings",
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "text-[12px]"),
                            children: "Atualizar email oficial"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 1267,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 1256,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 1255,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "manage" && activeSection === "eventos" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-4", fadeClass),
                id: "eventos",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 p-5 shadow-[0_30px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "pointer-events-none absolute inset-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "absolute -left-20 top-2 h-56 w-56 rounded-full bg-[#6BFFFF]/18 blur-[120px]"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1277,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "absolute right-10 top-0 h-48 w-48 rounded-full bg-[#FF7AD1]/18 blur-[120px]"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1278,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "absolute -right-18 -bottom-20 h-64 w-64 rounded-full bg-[#6A7BFF]/18 blur-[120px]"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1279,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/8 to-transparent"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1280,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 1276,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "relative space-y-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] uppercase tracking-[0.26em] text-white/70",
                                                    children: eventLabelPluralTitle
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1286,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                    className: "text-2xl font-semibold text-white drop-shadow-[0_14px_40px_rgba(0,0,0,0.45)]",
                                                    children: "Vista geral"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1287,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-white/80",
                                                    children: [
                                                        "Seleciona um ",
                                                        eventLabel,
                                                        " e clica em Gerir para aceder a tudo."
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1288,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1285,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                            href: categoryCta.href,
                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"], "text-[12px]"),
                                            children: categoryCta.label
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1290,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1284,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid gap-3 lg:grid-cols-[1.4fr,1fr]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-2xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#0b1124]/70 to-[#050912]/90 backdrop-blur-2xl px-3 py-3 shadow-[0_22px_80px_rgba(0,0,0,0.55)]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "text-[10px] uppercase tracking-[0.24em] text-white/55",
                                                    children: "Pesquisa"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1297,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "mt-1 flex items-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "search",
                                                            placeholder: `Procurar por ${eventLabel}...`,
                                                            value: searchTerm,
                                                            onChange: (e)=>setSearchTerm(e.target.value),
                                                            className: "flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1299,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "hidden text-[12px] text-white/50 md:inline",
                                                            children: "⌘/"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1306,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1298,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1296,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-2xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#0b1124]/70 to-[#050912]/90 backdrop-blur-2xl p-3 shadow-[0_22px_80px_rgba(0,0,0,0.55)]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[10px] uppercase tracking-[0.24em] text-white/55",
                                                    children: "Período"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1311,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "mt-2 inline-flex w-full rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_16px_50px_rgba(0,0,0,0.4)]",
                                                    children: [
                                                        "all",
                                                        "upcoming",
                                                        "ongoing",
                                                        "past"
                                                    ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setTimeScope(opt),
                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold transition", timeScope === opt ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]" : "text-white/80 hover:bg-white/10"),
                                                            children: opt === "all" ? "Todos" : opt === "upcoming" ? "Próximos" : opt === "ongoing" ? "A decorrer" : "Passados"
                                                        }, opt, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1314,
                                                            columnNumber: 23
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1312,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1310,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1295,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap items-center gap-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[10px] uppercase tracking-[0.22em] text-white/55",
                                                    children: "Estados"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1334,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "inline-flex flex-wrap rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl",
                                                    children: [
                                                        {
                                                            key: "all",
                                                            label: "Todos"
                                                        },
                                                        {
                                                            key: "active",
                                                            label: "Ativos"
                                                        },
                                                        {
                                                            key: "ongoing",
                                                            label: "Em curso"
                                                        },
                                                        {
                                                            key: "finished",
                                                            label: "Concluídos"
                                                        },
                                                        {
                                                            key: "archived",
                                                            label: "Arquivados"
                                                        }
                                                    ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setEventStatusFilter(opt.key),
                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-xl px-3 py-2 text-[12px] font-semibold transition", eventStatusFilter === opt.key ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]" : "text-white/80 hover:bg-white/10"),
                                                            children: opt.label
                                                        }, opt.key, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1343,
                                                            columnNumber: 23
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1335,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1333,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>{
                                                setEventStatusFilter("all");
                                                setEventCategoryFilter("all");
                                                setEventPartnerClubFilter("all");
                                                setSearchTerm("");
                                                setTimeScope("all");
                                            },
                                            className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                            children: "Limpar filtros"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1359,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1332,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-4 space-y-4",
                                    children: [
                                        activeFilterCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center gap-2 rounded-2xl border border-white/12 bg-gradient-to-r from-white/8 via-white/6 to-white/4 px-3 py-2 text-[12px] text-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-semibold text-white/75",
                                                    children: [
                                                        "Filtros ativos (",
                                                        activeFilterCount,
                                                        ")"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1377,
                                                    columnNumber: 21
                                                }, this),
                                                eventStatusFilter !== "all" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>setEventStatusFilter("all"),
                                                    className: "inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40",
                                                    children: [
                                                        "Estado: ",
                                                        statusLabelMap[eventStatusFilter],
                                                        " ×"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1379,
                                                    columnNumber: 23
                                                }, this),
                                                eventCategoryFilter !== "all" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>setEventCategoryFilter("all"),
                                                    className: "inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40",
                                                    children: [
                                                        "Categoria: ",
                                                        eventCategoryFilter,
                                                        " ×"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1388,
                                                    columnNumber: 23
                                                }, this),
                                                eventPartnerClubFilter !== "all" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>setEventPartnerClubFilter("all"),
                                                    className: "inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40",
                                                    children: [
                                                        "Clube: ",
                                                        partnerClubOptions.find((o)=>`${o.id}` === eventPartnerClubFilter)?.name ?? eventPartnerClubFilter,
                                                        " ×"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1397,
                                                    columnNumber: 23
                                                }, this),
                                                timeScope !== "all" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>setTimeScope("all"),
                                                    className: "inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40",
                                                    children: [
                                                        "Período: ",
                                                        timeScopeLabels[timeScope],
                                                        " ×"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1406,
                                                    columnNumber: 23
                                                }, this),
                                                searchTerm.trim() && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>setSearchTerm(""),
                                                    className: "inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40",
                                                    children: [
                                                        "Pesquisa: “",
                                                        searchTerm,
                                                        "” ×"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1415,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1376,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap items-center justify-between gap-2",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-2 text-sm text-white/80",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                className: "text-lg font-semibold",
                                                                children: "Eventos"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 1429,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[11px] rounded-full bg-white/10 px-2 py-0.5",
                                                                children: filteredEvents.length
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 1430,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1428,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1427,
                                                    columnNumber: 19
                                                }, this),
                                                eventsListLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "grid gap-2 md:grid-cols-2",
                                                    children: [
                                                        1,
                                                        2,
                                                        3
                                                    ].map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "h-28 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
                                                        }, i, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1437,
                                                            columnNumber: 19
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1435,
                                                    columnNumber: 15
                                                }, this),
                                                eventsError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 flex items-center justify-between gap-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "font-semibold",
                                                                    children: [
                                                                        "Não foi possível carregar os ",
                                                                        eventLabelPlural,
                                                                        "."
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 1445,
                                                                    columnNumber: 19
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-[12px] text-red-100/80",
                                                                    children: "Verifica a ligação e tenta novamente."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 1446,
                                                                    columnNumber: 19
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1444,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>mutateEvents(),
                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "text-[12px]"),
                                                            children: "Tentar novamente"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1448,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1443,
                                                    columnNumber: 15
                                                }, this),
                                                !eventsListLoading && events?.items?.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70 space-y-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-base font-semibold text-white",
                                                            children: [
                                                                "Ainda não tens ",
                                                                eventLabelPlural,
                                                                " criados."
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1460,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            children: [
                                                                "Começa por criar o teu primeiro ",
                                                                eventLabel,
                                                                " e acompanha tudo a partir daqui."
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1461,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1459,
                                                    columnNumber: 15
                                                }, this),
                                                !eventsListLoading && events?.items && events.items.length > 0 && filteredEvents.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70 space-y-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-base font-semibold text-white",
                                                            children: [
                                                                "Nenhum ",
                                                                eventLabel,
                                                                " corresponde a estes filtros."
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1467,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-white/65",
                                                            children: "Troca o período ou limpa os filtros para veres todos."
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1468,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap justify-center gap-2 text-[12px]",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>{
                                                                        setEventStatusFilter("all");
                                                                        setEventCategoryFilter("all");
                                                                        setTimeScope("all");
                                                                        setEventPartnerClubFilter("all");
                                                                        setSearchTerm("");
                                                                    },
                                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "text-[12px]"),
                                                                    children: "Limpar filtros"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 1470,
                                                                    columnNumber: 19
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                                    href: categoryCta.href,
                                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"], "text-[12px]"),
                                                                    children: categoryCta.label
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 1483,
                                                                    columnNumber: 19
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1469,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1466,
                                                    columnNumber: 15
                                                }, this),
                                                filteredEvents.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "overflow-hidden rounded-3xl border border-white/16 bg-gradient-to-br from-white/18 via-[#15284c]/75 to-[#070d19]/92 shadow-[0_34px_110px_rgba(0,0,0,0.62)] backdrop-blur-3xl",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                                        className: "min-w-full text-sm text-white/90",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                                className: "bg-white/10 text-left text-[11px] uppercase tracking-wide text-white/75",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                            className: "px-4 py-3 font-semibold",
                                                                            children: eventLabelTitle
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 1498,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                            className: "px-4 py-3 font-semibold",
                                                                            children: "Data"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 1499,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                            className: "px-4 py-3 font-semibold",
                                                                            children: "Estado"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 1500,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                            className: "px-4 py-3 font-semibold",
                                                                            children: "Tipo"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 1501,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                            className: "px-4 py-3 font-semibold",
                                                                            children: ticketLabelPluralTitle
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 1502,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                            className: "px-4 py-3 font-semibold",
                                                                            children: "Receita"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 1503,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                            className: "px-4 py-3 text-right font-semibold",
                                                                            children: "Gerir"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 1504,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 1497,
                                                                    columnNumber: 25
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 1496,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                                className: "divide-y divide-white/5",
                                                                children: filteredEvents.map((ev)=>{
                                                                    const date = ev.startsAt ? new Date(ev.startsAt) : null;
                                                                    const endsAt = ev.endsAt ? new Date(ev.endsAt) : null;
                                                                    const now = new Date();
                                                                    const isOngoing = date && endsAt ? date.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime() : false;
                                                                    const isFuture = date ? date.getTime() > now.getTime() : false;
                                                                    const isFinished = endsAt ? endsAt.getTime() < now.getTime() : false;
                                                                    const dateLabel = date ? formatDateTime(date, {
                                                                        day: "2-digit",
                                                                        month: "short",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit"
                                                                    }) : "Data a confirmar";
                                                                    const ticketsSold = ev.ticketsSold ?? 0;
                                                                    const capacity = ev.capacity ?? null;
                                                                    const revenue = ((ev.revenueCents ?? 0) / 100).toFixed(2);
                                                                    const normalizedTemplate = ev.templateType ?? "OTHER";
                                                                    const typeLabel = normalizedTemplate === "PADEL" ? "Padel" : "Evento padrão";
                                                                    const typeTone = normalizedTemplate === "PADEL" ? "border-sky-400/40 bg-sky-400/10 text-sky-100" : "border-white/20 bg-white/5 text-white/80";
                                                                    const statusBadge = ev.status === "CANCELLED" ? {
                                                                        label: "Cancelado",
                                                                        classes: "border-red-400/60 bg-red-500/10 text-red-100"
                                                                    } : ev.status === "ARCHIVED" ? {
                                                                        label: "Arquivado",
                                                                        classes: "border-amber-400/60 bg-amber-500/10 text-amber-100"
                                                                    } : ev.status === "DRAFT" ? {
                                                                        label: "Draft",
                                                                        classes: "border-white/20 bg-white/5 text-white/70"
                                                                    } : isOngoing ? {
                                                                        label: "A decorrer",
                                                                        classes: "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                                                                    } : isFuture ? {
                                                                        label: "Publicado",
                                                                        classes: "border-sky-400/60 bg-sky-500/10 text-sky-100"
                                                                    } : isFinished ? {
                                                                        label: "Concluído",
                                                                        classes: "border-purple-400/60 bg-purple-500/10 text-purple-100"
                                                                    } : {
                                                                        label: ev.status,
                                                                        classes: "border-white/20 bg-white/5 text-white/70"
                                                                    };
                                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                        className: "hover:bg-white/10 transition duration-150",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "px-4 py-3",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                                                    href: `/organizador/eventos/${ev.id}`,
                                                                                    className: "text-left text-white hover:underline",
                                                                                    children: ev.title
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                    lineNumber: 1550,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                lineNumber: 1549,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "px-4 py-3 text-[12px] text-white/80",
                                                                                children: dateLabel
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                lineNumber: 1557,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "px-4 py-3",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] shadow-[0_10px_24px_rgba(0,0,0,0.35)] ${statusBadge.classes}`,
                                                                                    children: statusBadge.label
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                    lineNumber: 1559,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                lineNumber: 1558,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "px-4 py-3",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] shadow-[0_8px_20px_rgba(0,0,0,0.3)] ${typeTone}`,
                                                                                    children: typeLabel
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                    lineNumber: 1564,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                lineNumber: 1563,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "px-4 py-3 text-[12px]",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        className: "font-semibold text-white",
                                                                                        children: ticketsSold
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                        lineNumber: 1569,
                                                                                        columnNumber: 33
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        className: "text-white/60",
                                                                                        children: [
                                                                                            " / ",
                                                                                            capacity ?? "—"
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                        lineNumber: 1570,
                                                                                        columnNumber: 33
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                lineNumber: 1568,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "px-4 py-3 text-[12px] font-semibold text-white",
                                                                                children: [
                                                                                    revenue,
                                                                                    " €"
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                lineNumber: 1572,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "px-4 py-3 text-right text-[11px]",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "flex flex-wrap items-center justify-end gap-2",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                                                            href: `/organizador/eventos/${ev.id}`,
                                                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"], "px-3 py-1 text-[11px]"),
                                                                                            children: "Gerir"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                            lineNumber: 1575,
                                                                                            columnNumber: 35
                                                                                        }, this),
                                                                                        ev.status === "ARCHIVED" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                            type: "button",
                                                                                            disabled: eventActionLoading === ev.id,
                                                                                            onClick: ()=>setEventDialog({
                                                                                                    mode: "unarchive",
                                                                                                    ev
                                                                                                }),
                                                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SUCCESS"], "px-3 py-1 text-[11px] disabled:opacity-60"),
                                                                                            children: "Reativar"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                            lineNumber: 1582,
                                                                                            columnNumber: 37
                                                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                            type: "button",
                                                                                            disabled: eventActionLoading === ev.id,
                                                                                            onClick: ()=>setEventDialog({
                                                                                                    mode: ev.status === "DRAFT" ? "delete" : "archive",
                                                                                                    ev
                                                                                                }),
                                                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_DANGER"], "px-3 py-1 text-[11px] disabled:opacity-60"),
                                                                                            children: ev.status === "DRAFT" ? "Apagar rascunho" : "Arquivar"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                            lineNumber: 1591,
                                                                                            columnNumber: 37
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                    lineNumber: 1574,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                lineNumber: 1573,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, ev.id, true, {
                                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                        lineNumber: 1548,
                                                                        columnNumber: 29
                                                                    }, this);
                                                                })
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 1507,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1495,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1494,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1426,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1374,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 1283,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 1275,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 1274,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "manage" && activeSection === "inscricoes" && supportsInscricoes && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-4", fadeClass),
                id: "inscricoes",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$inscricoes$2f$page$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    embedded: true
                }, void 0, false, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 1618,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 1617,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "manage" && activeSection === "padel-hub" && showPadelHub && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-4", fadeClass),
                id: "padel-hub",
                children: organizer?.id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$padel$2f$PadelHubSection$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    organizerId: organizer.id,
                    organizationKind: organizer.organizationKind ?? null
                }, void 0, false, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 1625,
                    columnNumber: 13
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-2xl border border-white/12 bg-white/5 px-4 py-6 text-sm text-white/70",
                    children: "Organização indisponível para carregar o hub."
                }, void 0, false, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 1630,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 1623,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "profile" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-4", fadeClass),
                id: "perfil",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl shadow-[0_26px_90px_rgba(0,0,0,0.55)]",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-start justify-between gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.4)]",
                                            children: "Dashboard · Perfil"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1642,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_12px_45px_rgba(0,0,0,0.6)]",
                                            children: "Perfil público"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1645,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm text-white/70",
                                            children: "Pré-visualiza a tua página pública e edita o que aparece ao público."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1648,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1641,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap items-center gap-2 text-[11px] text-white/70",
                                    children: publicProfileUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        href: publicProfileUrl,
                                        target: "_blank",
                                        rel: "noreferrer",
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "text-[12px]"),
                                        children: "Ver página pública"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1654,
                                        columnNumber: 19
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-white/65",
                                        children: "Define um @username para teres link público"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1663,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1652,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 1640,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1639,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$OrganizerPublicProfilePanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        organizer: organizer ?? null,
                        membershipRole: membershipRole,
                        categoryLabel: categoryLabel,
                        coverUrl: profileCoverUrl
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1671,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 1638,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "analyze" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-3", fadeClass),
                id: "analisar",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl shadow-[0_26px_90px_rgba(0,0,0,0.55)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center justify-between gap-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.4)]",
                                        children: "Dashboard · Analisar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1685,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_12px_45px_rgba(0,0,0,0.6)]",
                                        children: "Finanças & faturação"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1688,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/70",
                                        children: "Receitas, payouts e documentos fiscais num só lugar."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1691,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1684,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 1683,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-4",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                objective: "analyze",
                                activeId: activeSection,
                                category: orgCategory,
                                modules: organizer?.modules ?? [],
                                mode: "dashboard",
                                variant: "tabs"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1695,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 1694,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 1682,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 1681,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "analyze" && activeSection === "vendas" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-4", fadeClass),
                id: "vendas",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-3xl space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_35%),linear-gradient(225deg,rgba(255,255,255,0.08),transparent_40%)]"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1711,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.3em] text-white/70",
                                                children: [
                                                    ticketLabelPluralTitle,
                                                    " & Vendas"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1714,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-2xl font-semibold text-white",
                                                children: [
                                                    "Vendas por ",
                                                    eventLabel
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1717,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-white/70",
                                                children: [
                                                    "Escolhe um ",
                                                    eventLabel,
                                                    " e vê evolução + compradores."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1718,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1713,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[11px] text-white/70",
                                                children: "Período"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1721,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "inline-flex rounded-full border border-white/15 bg-white/5 p-[3px] text-[11px] shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
                                                children: [
                                                    "7d",
                                                    "30d",
                                                    "90d",
                                                    "365d",
                                                    "all"
                                                ].map((range)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: ()=>setSalesRange(range),
                                                        className: `rounded-full px-3 py-1 transition ${salesRange === range ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold shadow-[0_0_12px_rgba(107,255,255,0.6)]" : "text-white/75 hover:bg-white/5"}`,
                                                        children: range === "7d" ? "7 dias" : range === "30d" ? "30 dias" : range === "90d" ? "3 meses" : range === "365d" ? "1 ano" : "Sempre"
                                                    }, range, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1724,
                                                        columnNumber: 21
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1722,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1720,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1712,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative flex flex-wrap items-center gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "w-full max-w-md",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "text-xs uppercase tracking-[0.18em] text-white/65 block mb-1",
                                                children: [
                                                    "Seleciona o ",
                                                    eventLabel
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1751,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: salesEventId ?? "",
                                                onChange: (e)=>setSalesEventId(e.target.value ? Number(e.target.value) : null),
                                                className: "w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        children: "Escolhe"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1759,
                                                        columnNumber: 19
                                                    }, this),
                                                    eventsList.map((ev)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                            value: ev.id,
                                                            children: ev.title
                                                        }, ev.id, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1761,
                                                            columnNumber: 21
                                                        }, this))
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1754,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1750,
                                        columnNumber: 15
                                    }, this),
                                    !eventsList.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[12px] text-white/65",
                                        children: [
                                            "Sem ",
                                            eventLabelPlural,
                                            " para analisar."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1767,
                                        columnNumber: 38
                                    }, this),
                                    selectedSalesEvent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/75 shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
                                        children: [
                                            "A ver: ",
                                            selectedSalesEvent.title
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1769,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1749,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1710,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-2 lg:grid-cols-4",
                        children: [
                            !salesEventId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "col-span-full rounded-2xl border border-dashed border-white/20 bg-black/30 p-4 text-white/70 text-sm",
                                children: [
                                    "Seleciona um ",
                                    eventLabel,
                                    " para ver as métricas de vendas."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1778,
                                columnNumber: 15
                            }, this),
                            salesLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    ...Array(4)
                                ].map((_, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/10 bg-white/5 p-3 animate-pulse space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-3 w-24 rounded bg-white/15"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1786,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-7 w-20 rounded bg-white/20"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1787,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-3 w-28 rounded bg-white/10"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1788,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, idx, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1785,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false),
                            !salesLoading && salesSeries && salesSeries.points?.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "col-span-full rounded-2xl border border-dashed border-white/20 bg-black/30 p-4 text-white/70 text-sm",
                                children: [
                                    "Sem dados de vendas neste período. Escolhe outro ",
                                    eventLabel,
                                    " ou intervalo."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1794,
                                columnNumber: 15
                            }, this),
                            !salesLoading && salesSeries && salesSeries.points?.length !== 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/60",
                                                children: "Receita no período"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1801,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-2xl font-bold text-white mt-1",
                                                children: [
                                                    (salesKpis.revenueCents / 100).toFixed(2),
                                                    " €"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1802,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/50",
                                                children: salesRangeLabelLong(salesRange)
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1803,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1800,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/60",
                                                children: ticketSalesLabel
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1806,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-2xl font-bold text-white mt-1",
                                                children: salesKpis.tickets
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1807,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/50",
                                                children: "No período selecionado"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1808,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1805,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/60",
                                                children: [
                                                    eventLabelPluralTitle,
                                                    " com vendas"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1811,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-2xl font-bold text-white mt-1",
                                                children: salesKpis.eventsWithSales
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1812,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/50",
                                                children: [
                                                    eventLabelPluralTitle,
                                                    " com pelo menos 1 venda"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1813,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1810,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/60",
                                                children: "Ocupação média"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1816,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-2xl font-bold text-white mt-1",
                                                children: salesKpis.avgOccupancy !== null ? `${salesKpis.avgOccupancy}%` : "—"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1817,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/50",
                                                children: [
                                                    "Calculado nos ",
                                                    eventLabelPlural,
                                                    " com capacidade"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1820,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1815,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1776,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0a1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-lg font-semibold",
                                        children: "Evolução"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1828,
                                        columnNumber: 15
                                    }, this),
                                    selectedSalesEvent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[11px] text-white/60",
                                                children: selectedSalesEvent.title
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1831,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                disabled: !salesSeries?.points?.length,
                                                onClick: handleExportSalesCsv,
                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "px-3 py-1 text-[11px] disabled:opacity-50"),
                                                children: "Exportar vendas"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1832,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1830,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1827,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1224]/60 to-white/0 shadow-inner overflow-hidden px-2 py-3 min-h-[260px]",
                                children: salesLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex w-full items-center gap-3 px-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "h-28 flex-1 rounded-xl bg-white/10 animate-pulse"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1846,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "hidden h-28 w-20 rounded-xl bg-white/10 animate-pulse md:block"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1847,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1845,
                                    columnNumber: 17
                                }, this) : !salesEventId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-white/40 text-xs",
                                    children: [
                                        "Escolhe um ",
                                        eventLabel,
                                        " para ver a evolução."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1850,
                                    columnNumber: 19
                                }, this) : salesSeries?.points?.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$charts$2f$SalesAreaChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SalesAreaChart"], {
                                    data: salesChartPoints,
                                    periodLabel: salesRangeLabelLong(salesRange)
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1852,
                                    columnNumber: 19
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-white/40 text-xs",
                                    children: [
                                        "Sem dados de vendas para este ",
                                        eventLabel,
                                        "."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1857,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1843,
                                columnNumber: 13
                            }, this),
                            salesSeriesBreakdown && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap gap-3 text-[11px] text-white/70",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "Bruto: ",
                                            formatEuros(salesSeriesBreakdown.gross)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1862,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "Desconto: -",
                                            formatEuros(salesSeriesBreakdown.discount)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1863,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "Taxas: -",
                                            formatEuros(salesSeriesBreakdown.fees)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1864,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "Líquido: ",
                                            formatEuros(salesSeriesBreakdown.net)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1865,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1861,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1826,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0a1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-lg font-semibold",
                                            children: [
                                                eventLabelPluralTitle,
                                                " com mais vendas"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1873,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] text-white/60",
                                            children: "Top por receita total. Usa como atalho para ver o detalhe."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1874,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1872,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1871,
                                columnNumber: 13
                            }, this),
                            topEvents.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/60",
                                children: [
                                    "Ainda sem ",
                                    eventLabelPlural,
                                    " com vendas para ordenar."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1878,
                                columnNumber: 40
                            }, this),
                            topEvents.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "overflow-auto",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                    className: "min-w-full text-sm",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                            className: "text-left text-[11px] text-white/60",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: eventLabelTitle
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1884,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: ticketLabelPluralTitle
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1885,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: "Receita"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1886,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: "Estado"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1887,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3 text-right",
                                                        children: "Ações"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1888,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1883,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1882,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                            className: "divide-y divide-white/5",
                                            children: topEvents.map((ev)=>{
                                                const statusBadge = ev.status === "CANCELLED" ? {
                                                    label: "Cancelado",
                                                    classes: "border-red-400/50 bg-red-500/10 text-red-100"
                                                } : ev.status === "DRAFT" ? {
                                                    label: "Draft",
                                                    classes: "border-white/20 bg-white/5 text-white/70"
                                                } : {
                                                    label: "Publicado",
                                                    classes: "border-sky-400/50 bg-sky-500/10 text-sky-100"
                                                };
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-white",
                                                            children: ev.title
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1901,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-white/80",
                                                            children: ev.ticketsSold ?? 0
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1902,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-white",
                                                            children: [
                                                                ((ev.revenueCents ?? 0) / 100).toFixed(2),
                                                                " €"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1903,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-[11px]",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: `rounded-full border px-2 py-0.5 ${statusBadge.classes}`,
                                                                children: statusBadge.label
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 1905,
                                                                columnNumber: 29
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1904,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-right text-[11px]",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex items-center justify-end gap-2",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                                    href: `/organizador?tab=analyze&section=vendas&eventId=${ev.id}`,
                                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "px-3 py-1 text-[11px]"),
                                                                    children: "Dashboard de vendas"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 1909,
                                                                    columnNumber: 31
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 1908,
                                                                columnNumber: 29
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 1907,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, ev.id, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 1900,
                                                    columnNumber: 25
                                                }, this);
                                            })
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1891,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1881,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1880,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1870,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-3xl border border-white/10 bg-black/40 p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "text-lg font-semibold",
                                                children: "Compradores"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1929,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/60",
                                                children: "Lista rápida por bilhete. Exporta para CSV para detalhe."
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1930,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1928,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        disabled: !buyers || buyers.ok === false || buyersItems.length === 0,
                                        onClick: ()=>{
                                            if (!buyers || buyers.ok === false) return;
                                            const rows = buyersItems;
                                            const header = [
                                                "ID",
                                                "Nome",
                                                "Email",
                                                "Cidade",
                                                "Tipo",
                                                "Preço (€)",
                                                "Estado",
                                                "Comprado em"
                                            ];
                                            const body = rows.map((r)=>[
                                                    r.id,
                                                    r.buyerName,
                                                    r.buyerEmail,
                                                    r.buyerCity ?? "",
                                                    r.ticketType,
                                                    (r.totalPaidCents / 100).toFixed(2),
                                                    r.status,
                                                    formatDateTime(new Date(r.purchasedAt))
                                                ].join(";")).join("\n");
                                            const blob = new Blob([
                                                [
                                                    header.join(";"),
                                                    body
                                                ].join("\n")
                                            ], {
                                                type: "text/csv"
                                            });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = "compradores.csv";
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        },
                                        className: "text-[11px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 disabled:opacity-50",
                                        children: "Exportar CSV"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1932,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1927,
                                columnNumber: 13
                            }, this),
                            buyersLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: [
                                    ...Array(4)
                                ].map((_, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between rounded-xl border border-white/10 bg-black/25 p-3 animate-pulse",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-3 w-32 rounded bg-white/10"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1975,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-3 w-20 rounded bg-white/5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1976,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1974,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-3 w-16 rounded bg-white/10"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1978,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, idx, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 1970,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1968,
                                columnNumber: 15
                            }, this),
                            !buyersLoading && !salesEventId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/60",
                                children: [
                                    "Escolhe um ",
                                    eventLabel,
                                    " para ver compradores."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1984,
                                columnNumber: 15
                            }, this),
                            !buyersLoading && salesEventId && buyers && buyers.ok === false && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-red-400",
                                children: "Não foi possível carregar os compradores."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1987,
                                columnNumber: 15
                            }, this),
                            !buyersLoading && salesEventId && buyers && buyers.ok !== false && buyersItems.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/60",
                                children: [
                                    "Sem compras registadas para este ",
                                    eventLabel,
                                    "."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1990,
                                columnNumber: 15
                            }, this),
                            !buyersLoading && salesEventId && buyers && buyers.ok !== false && buyersItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "overflow-auto",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                    className: "min-w-full text-sm",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                            className: "text-left text-[11px] text-white/60",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: "Comprador"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1997,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: "Email"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1998,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: ticketLabelTitle
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 1999,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: "Estado"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2000,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3 text-right",
                                                        children: "Pago"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2001,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "py-2 pr-3",
                                                        children: "Data"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2002,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 1996,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 1995,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                            className: "divide-y divide-white/5",
                                            children: buyersItems.map((row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-white",
                                                            children: row.buyerName
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2008,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-white/70",
                                                            children: row.buyerEmail
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2009,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-white/80",
                                                            children: row.ticketType
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2010,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-[11px]",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "rounded-full border border-white/15 px-2 py-0.5 text-white/70",
                                                                children: row.status
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 2012,
                                                                columnNumber: 27
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2011,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-right text-white",
                                                            children: [
                                                                (row.totalPaidCents / 100).toFixed(2),
                                                                " €"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2014,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "py-2 pr-3 text-white/70",
                                                            children: formatDateTime(new Date(row.purchasedAt))
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2017,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, row.id, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2007,
                                                    columnNumber: 23
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2005,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 1994,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 1993,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 1926,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 1709,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "analyze" && activeSection === "financas" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-5", fadeClass),
                id: "financas",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0d1530]/75 to-[#050912]/90 px-5 py-4 shadow-[0_30px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
                                    children: "Finanças & Payouts"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2034,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-3xl font-semibold text-white drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
                                    children: "Receita, liquidez e Stripe."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2037,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm text-white/70",
                                    children: "Glassmorphism premium para veres o dinheiro, taxas e o estado da conta Stripe."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2038,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2033,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 2032,
                        columnNumber: 11
                    }, this),
                    paymentsMode === "CONNECT" && paymentsStatus !== "READY" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.55)] ${stripeIncomplete ? "border-amber-400/50 bg-gradient-to-r from-amber-400/15 via-amber-500/10 to-orange-500/15 text-amber-50" : "border-amber-400/35 bg-gradient-to-r from-amber-400/12 via-amber-500/10 to-orange-500/12 text-amber-50"}`,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center justify-between gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "font-semibold",
                                            children: stripeIncomplete ? "Onboarding incompleto no Stripe." : "Liga o Stripe para começar a receber."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2052,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-amber-100/85",
                                            children: paymentsStatus === "NO_STRIPE" ? "Sem ligação Stripe não há payouts. O resto da gestão continua disponível." : stripeRequirements.length > 0 ? `Faltam ${stripeRequirements.length} passos no Stripe Connect. Abre o painel para concluir.` : "Conclui o onboarding no Stripe para ativares payouts."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2055,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2051,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: handleStripeConnect,
                                    disabled: stripeCtaLoading,
                                    className: "rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow hover:scale-[1.01] disabled:opacity-60",
                                    children: stripeCtaLoading ? "A ligar..." : stripeIncomplete ? "Continuar configuração" : "Ligar conta Stripe"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2063,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2050,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 2043,
                        columnNumber: 13
                    }, this),
                    paymentsMode === "PLATFORM" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-emerald-400/45 bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/20 px-4 py-3 text-sm text-emerald-50 shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center justify-between gap-2",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "font-semibold",
                                        children: "Conta interna ORYA"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2078,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] text-emerald-50/85",
                                        children: "Pagamentos processados na conta principal da ORYA. Não precisas de ligar Stripe Connect."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2079,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2077,
                                columnNumber: 17
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2076,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 2075,
                        columnNumber: 13
                    }, this),
                    stripeSuccessMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-emerald-400/45 bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/20 px-4 py-3 text-sm text-emerald-50 shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                        children: stripeSuccessMessage
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 2087,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-2 lg:grid-cols-4",
                        children: [
                            {
                                label: "Receita líquida total",
                                value: financeData?.totals.netCents !== undefined ? `${(financeData.totals.netCents / 100).toFixed(2)} €` : financeSummary ? `${(financeSummary.estimatedPayoutCents / 100).toFixed(2)} €` : "—",
                                hint: "Valor que fica para ti (bruto - taxas)."
                            },
                            {
                                label: "Receita últimos 30d",
                                value: financeData?.rolling.last30.netCents !== undefined ? `${(financeData.rolling.last30.netCents / 100).toFixed(2)} €` : "—",
                                hint: "Líquido nos últimos 30 dias."
                            },
                            {
                                label: "Taxas",
                                value: financeData?.totals.feesCents !== undefined ? `${(financeData.totals.feesCents / 100).toFixed(2)} €` : financeSummary ? `${(financeSummary.platformFeesCents / 100).toFixed(2)} €` : "—",
                                hint: "Custos de processamento + eventuais fees."
                            },
                            {
                                label: "Eventos com vendas",
                                value: financeData?.totals.eventsWithSales ?? financeSummary?.eventsWithSales ?? "—",
                                hint: "Eventos pagos com pelo menos 1 bilhete."
                            }
                        ].map((card)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/65 to-[#050810]/90 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.18em] text-white/70",
                                        children: card.label
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2132,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-2xl font-bold text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)]",
                                        children: card.value
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2133,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/60",
                                        children: card.hint
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2134,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, card.label, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2128,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 2092,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-4 md:grid-cols-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/70 to-[#050810]/90 backdrop-blur-3xl p-4 space-y-3 shadow-[0_22px_70px_rgba(0,0,0,0.65)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center justify-between gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-lg font-semibold text-white",
                                                        children: "Stripe"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2143,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: `rounded-full px-2.5 py-0.5 text-[11px] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${stripeState.tone === "success" ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100" : stripeState.tone === "warning" ? "border-amber-400/60 bg-amber-500/15 text-amber-100" : stripeState.tone === "error" ? "border-red-400/60 bg-red-500/15 text-red-100" : "border-white/25 bg-white/10 text-white/70"}`,
                                                        children: stripeState.badge
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2144,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2142,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-wrap items-center gap-2",
                                                children: paymentsStatus === "READY" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                    href: "https://dashboard.stripe.com/",
                                                    target: "_blank",
                                                    rel: "noreferrer",
                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "px-3 py-1 text-[11px]"),
                                                    children: stripeState.cta
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2160,
                                                    columnNumber: 21
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: handleStripeConnect,
                                                    disabled: stripeCtaLoading,
                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "px-3 py-1 text-[11px] disabled:opacity-60"),
                                                    children: stripeState.cta
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2169,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2158,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2141,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/12 bg-black/35 p-3 text-sm space-y-1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/70",
                                                children: [
                                                    "Conta: ",
                                                    organizer.stripeAccountId ? `…${organizer.stripeAccountId.slice(-6)}` : "Por ligar"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2181,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/70",
                                                children: [
                                                    "Cobranças: ",
                                                    organizer.stripeChargesEnabled ? "Ativo" : "Inativo"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2182,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/70",
                                                children: [
                                                    "Payouts: ",
                                                    organizer.stripePayoutsEnabled ? "Ativo" : "Inativo"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2183,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2180,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-[11px] text-white/75 space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                children: stripeState.desc
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2186,
                                                columnNumber: 17
                                            }, this),
                                            stripeRequirements.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/70",
                                                children: [
                                                    stripeRequirements.length,
                                                    " itens pendentes no Stripe. Conclui-os no painel Connect para ativares payouts."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2188,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2185,
                                        columnNumber: 15
                                    }, this),
                                    stripeCtaError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-xs text-red-300",
                                        children: stripeCtaError
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2193,
                                        columnNumber: 34
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2140,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/70 to-[#050810]/90 backdrop-blur-3xl p-4 space-y-3 shadow-[0_22px_70px_rgba(0,0,0,0.65)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "text-lg font-semibold text-white",
                                                children: "Payouts"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2198,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[11px] text-white/70",
                                                children: "Informativo"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2199,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2197,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid gap-2 sm:grid-cols-2 text-sm",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-2xl border border-white/12 bg-white/8 p-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-white/70 text-xs",
                                                        children: "Próximo payout (estimado)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2203,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-xl font-semibold text-white",
                                                        children: [
                                                            financeData ? (financeData.upcomingPayoutCents / 100).toFixed(2) : financeSummary ? (financeSummary.estimatedPayoutCents / 100).toFixed(2) : "—",
                                                            " €"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2204,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] text-white/60",
                                                        children: "Baseado em vendas recentes. Funcionalidade de payouts automáticos em breve."
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2207,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2202,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-2xl border border-white/12 bg-white/8 p-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-white/70 text-xs",
                                                        children: "Receita bruta (total)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2210,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-xl font-semibold text-white",
                                                        children: [
                                                            financeData ? (financeData.totals.grossCents / 100).toFixed(2) : financeSummary ? (financeSummary.revenueCents / 100).toFixed(2) : "—",
                                                            " €"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2211,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] text-white/60",
                                                        children: [
                                                            "Inclui todos os ",
                                                            eventLabelPlural,
                                                            "."
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2214,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2209,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2201,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid gap-2 sm:grid-cols-2 text-sm",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-2xl border border-white/12 bg-white/8 p-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-white/70 text-xs",
                                                        children: "Taxas acumuladas"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2219,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-xl font-semibold text-white",
                                                        children: [
                                                            financeData ? (financeData.totals.feesCents / 100).toFixed(2) : financeSummary ? (financeSummary.platformFeesCents / 100).toFixed(2) : "—",
                                                            " €"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2220,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] text-white/60",
                                                        children: "Inclui processamento Stripe e fees aplicadas."
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2223,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2218,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-2xl border border-white/12 bg-white/8 p-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-white/70 text-xs",
                                                        children: [
                                                            eventLabelPluralTitle,
                                                            " com vendas"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2226,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-xl font-semibold text-white",
                                                        children: financeData ? financeData.totals.eventsWithSales : financeSummary ? financeSummary.eventsWithSales : "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2227,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2225,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2217,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/65",
                                        children: "Payouts automáticos e gestão avançada de taxas chegam em breve. Estes valores são informativos."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2232,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2196,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 2139,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 backdrop-blur-3xl p-4 space-y-3 shadow-[0_22px_70px_rgba(0,0,0,0.65)]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "text-lg font-semibold text-white",
                                                children: [
                                                    "Por ",
                                                    eventLabel
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2241,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[12px] text-white/65",
                                                children: [
                                                    "Bruto, taxas e líquido por ",
                                                    eventLabel,
                                                    "."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2242,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2240,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: exportFinanceCsv,
                                            disabled: !financeData || financeData.events.length === 0,
                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "px-3 py-1 text-[11px] disabled:opacity-50"),
                                            children: "Exportar CSV"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2245,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2244,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2239,
                                columnNumber: 13
                            }, this),
                            !financeData && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/60",
                                children: "A carregar finanças…"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2256,
                                columnNumber: 30
                            }, this),
                            financeData && financeData.events.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-sm text-white/70",
                                children: [
                                    "Sem vendas ainda. Assim que venderes ",
                                    ticketLabelPluralTitle.toLowerCase(),
                                    ", verás aqui os totais por ",
                                    eventLabel,
                                    "."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2258,
                                columnNumber: 15
                            }, this),
                            stripeSuccessMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50",
                                children: stripeSuccessMessage
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2263,
                                columnNumber: 15
                            }, this),
                            financeData && financeData.events.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "overflow-auto",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                    className: "min-w-full text-sm text-white/80",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                            className: "text-left text-[11px] uppercase tracking-wide text-white/60",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3",
                                                        children: eventLabelTitle
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2273,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3",
                                                        children: ticketLabelPluralTitle
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2274,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3",
                                                        children: "Bruto"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2275,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3",
                                                        children: "Taxas"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2276,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3",
                                                        children: "Líquido"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2277,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3",
                                                        children: "Estado"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                        lineNumber: 2278,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                lineNumber: 2272,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2271,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                            className: "divide-y divide-white/5",
                                            children: financeData.events.map((ev)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    className: "hover:bg-white/5 transition",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-3",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex flex-col",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "font-semibold text-white",
                                                                        children: ev.title
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                        lineNumber: 2286,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "text-[11px] text-white/60",
                                                                        children: ev.startsAt ? formatDateOnly(new Date(ev.startsAt)) : "Data a definir"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                        lineNumber: 2287,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 2285,
                                                                columnNumber: 27
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2284,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-3 text-[12px]",
                                                            children: ev.ticketsSold
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2292,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-3 text-[12px]",
                                                            children: [
                                                                (ev.grossCents / 100).toFixed(2),
                                                                " €"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2293,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-3 text-[12px]",
                                                            children: [
                                                                (ev.feesCents / 100).toFixed(2),
                                                                " €"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2294,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-3 text-[12px]",
                                                            children: [
                                                                (ev.netCents / 100).toFixed(2),
                                                                " €"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2295,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-3 text-[11px]",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "rounded-full border border-white/20 px-2 py-0.5 text-white/70",
                                                                children: ev.status ?? "—"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                lineNumber: 2297,
                                                                columnNumber: 27
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2296,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, ev.id, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2283,
                                                    columnNumber: 23
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2281,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2270,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2269,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                        lineNumber: 2238,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 2031,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "analyze" && activeSection === "invoices" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-4", fadeClass),
                id: "invoices",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$pagamentos$2f$invoices$2f$invoices$2d$client$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    basePath: "/organizador?tab=analyze&section=invoices",
                    fullWidth: true,
                    organizerId: organizer?.id ?? null
                }, void 0, false, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 2311,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 2310,
                columnNumber: 9
            }, this),
            !isLegacyStandaloneTab && activeObjective === "promote" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "space-y-5",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl shadow-[0_26px_90px_rgba(0,0,0,0.55)]", fadeClass),
                    id: "marketing",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.4)]",
                                        children: "Dashboard · Marketing"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2326,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_12px_45px_rgba(0,0,0,0.6)]",
                                        children: "Marketing"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2329,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/70",
                                        children: [
                                            "Promoções, audiência e ações para encher o ",
                                            eventLabel,
                                            "."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/DashboardClient.tsx",
                                        lineNumber: 2332,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2325,
                                columnNumber: 11
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2324,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.4)]",
                            children: [
                                {
                                    key: "overview",
                                    label: "Visão geral"
                                },
                                {
                                    key: "promos",
                                    label: "Códigos promocionais"
                                },
                                {
                                    key: "updates",
                                    label: "Canal oficial"
                                },
                                {
                                    key: "promoters",
                                    label: "Promotores e parcerias"
                                },
                                {
                                    key: "content",
                                    label: "Conteúdos e kits"
                                }
                            ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>handleMarketingSectionSelect(opt.key),
                                    className: `rounded-xl px-3 py-2 font-semibold transition ${marketingSection === opt.key ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]" : "text-white/80 hover:bg-white/10"}`,
                                    children: opt.label
                                }, opt.key, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2344,
                                    columnNumber: 13
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2336,
                            columnNumber: 9
                        }, this),
                        marketingSection === "overview" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-4 space-y-4", fadeClass),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid gap-3 md:grid-cols-2 lg:grid-cols-4",
                                    children: marketingOverview ? [
                                        {
                                            label: "Receita atribuída a marketing",
                                            value: marketingKpis.marketingRevenueCents ? `${(marketingKpis.marketingRevenueCents / 100).toFixed(2)} €` : "—",
                                            hint: "Receita estimada através de códigos."
                                        },
                                        {
                                            label: `${ticketLabelPluralTitle} via marketing`,
                                            value: marketingKpis.ticketsWithPromo,
                                            hint: "Utilizações de códigos."
                                        },
                                        {
                                            label: "Top código",
                                            value: marketingKpis.topPromo ? marketingKpis.topPromo.code : "—",
                                            hint: marketingKpis.topPromo ? `${marketingKpis.topPromo.redemptionsCount ?? 0} utilizações` : "Sem dados."
                                        },
                                        {
                                            label: "Promo codes ativos",
                                            value: marketingKpis.activePromos,
                                            hint: "Disponíveis para vender agora."
                                        }
                                    ].map((card, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: `rounded-2xl border border-white/10 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.45)] ${idx % 2 === 0 ? "bg-gradient-to-br from-[#0f1c3d]/70 via-[#0b1124]/65 to-[#050810]/85" : "bg-gradient-to-br from-[#170b1f]/70 via-[#0e122a]/65 to-[#050810]/85"}`,
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] text-white/60",
                                                    children: card.label
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2393,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mt-1 text-2xl font-bold text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
                                                    children: card.value
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2394,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] text-white/50",
                                                    children: card.hint
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2395,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, card.label, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2385,
                                            columnNumber: 21
                                        }, this)) : [
                                        ...Array(4)
                                    ].map((_, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-[#0f1c3d]/50 to-[#050810]/85 p-3 space-y-2 animate-pulse",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "h-3 w-24 rounded bg-white/15"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2403,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "h-6 w-20 rounded bg-white/20"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2404,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "h-3 w-32 rounded bg-white/10"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2405,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, idx, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2399,
                                            columnNumber: 21
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2361,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0c162c]/65 to-[#050912]/90 p-4 space-y-3 shadow-[0_24px_90px_rgba(0,0,0,0.55)]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                            className: "text-lg font-semibold text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]",
                                                            children: "Fill the Room"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2413,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] text-white/65",
                                                            children: [
                                                                "Próximos ",
                                                                eventLabelPlural,
                                                                " com ocupação e ação sugerida."
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2414,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2412,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/70",
                                                    children: "Ações sugeridas"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2416,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2411,
                                            columnNumber: 15
                                        }, this),
                                        fillTheRoomEvents.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-sm text-white/70",
                                            children: [
                                                "Sem ",
                                                eventLabelPlural,
                                                " futuros para otimizar. Cria um ",
                                                eventLabel,
                                                " ou define datas para ver sugestões."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2422,
                                            columnNumber: 17
                                        }, this),
                                        fillTheRoomEvents.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-2",
                                            children: fillTheRoomEvents.map((ev)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-col gap-2 rounded-2xl border border-white/12 bg-gradient-to-r from-[#130c24]/70 via-[#0b162c]/65 to-[#050912]/85 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)] md:flex-row md:items-center md:justify-between",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "space-y-1",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex flex-wrap items-center gap-2",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-sm font-semibold",
                                                                            children: ev.title
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2436,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: `rounded-full border px-2 py-0.5 text-[11px] ${ev.tag.tone}`,
                                                                            children: ev.tag.label
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2437,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-white/75",
                                                                            children: ev.templateType === "PADEL" ? "Padel" : "Evento"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2438,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        typeof ev.diffDays === "number" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70",
                                                                            children: [
                                                                                "Faltam ",
                                                                                ev.diffDays,
                                                                                " dia",
                                                                                ev.diffDays === 1 ? "" : "s"
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2442,
                                                                            columnNumber: 29
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 2435,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex flex-wrap gap-2 text-[11px] text-white/70",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: ev.startsAt ? formatDateTime(new Date(ev.startsAt), {
                                                                                day: "2-digit",
                                                                                month: "short",
                                                                                hour: "2-digit",
                                                                                minute: "2-digit"
                                                                            }) : "Data a definir"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2448,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: "·"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2458,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: ev.locationCity || ev.locationName || "Local a anunciar"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2459,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: "·"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2460,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: [
                                                                                "Lotação: ",
                                                                                ev.ticketsSold ?? 0,
                                                                                " / ",
                                                                                ev.capacity ?? "—",
                                                                                " ",
                                                                                ev.occupancy !== null ? `(${Math.round((ev.occupancy ?? 0) * 100)}%)` : ""
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2461,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 2447,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2434,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-col gap-2 text-[12px] md:text-right",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-2 text-[11px] text-white/70",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "h-2 w-28 rounded-full bg-white/10",
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "h-2 rounded-full bg-gradient-to-r from-[#FF7AD1] via-[#7FE0FF] to-[#6A7BFF]",
                                                                                style: {
                                                                                    width: `${Math.min(100, Math.round((ev.occupancy ?? 0) * 100))}%`
                                                                                }
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                                lineNumber: 2470,
                                                                                columnNumber: 29
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2469,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: ev.occupancy !== null ? `${Math.round((ev.occupancy ?? 0) * 100)}%` : "—"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2475,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 2468,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex flex-wrap justify-end gap-2 text-[11px]",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                                            href: "/organizador?tab=promote&section=marketing&marketing=promos",
                                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "px-3 py-1 text-[11px]"),
                                                                            children: ev.tag.suggestion
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2478,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                                            href: `/organizador/eventos/${ev.id}/edit`,
                                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"], "px-3 py-1 text-[11px]"),
                                                                            children: [
                                                                                "Editar ",
                                                                                eventLabel
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2484,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                                            href: `/eventos/${ev.slug}`,
                                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_NEUTRAL"], "px-3 py-1 text-[11px]"),
                                                                            children: "Partilhar"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                            lineNumber: 2490,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                                    lineNumber: 2477,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2467,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, ev.id, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2430,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2428,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2410,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#101b39]/60 to-[#050912]/90 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center justify-between gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                                            className: "text-lg font-semibold text-white",
                                                            children: "Funil de marketing (v1)"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2507,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] text-white/65",
                                                            children: [
                                                                ticketLabelPluralTitle,
                                                                " totais vs. com promo vs. convidados."
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2508,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2506,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70",
                                                    children: "Baseado em códigos"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2512,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2505,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 grid gap-3 md:grid-cols-3",
                                            children: [
                                                {
                                                    label: `${ticketLabelPluralTitle} totais`,
                                                    value: marketingKpis.totalTickets ?? "—"
                                                },
                                                {
                                                    label: `${ticketLabelPluralTitle} com promo`,
                                                    value: marketingKpis.ticketsWithPromo ?? 0
                                                },
                                                {
                                                    label: "Guest / convidados",
                                                    value: marketingKpis.guestTickets ?? 0
                                                }
                                            ].map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-2xl border border-white/10 bg-white/5/80 bg-black/20 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.4)]",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[11px] text-white/60",
                                                            children: item.label
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2521,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-xl font-bold text-white mt-1",
                                                            children: item.value
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                            lineNumber: 2522,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, item.label, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2520,
                                                    columnNumber: 19
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2514,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2504,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2360,
                            columnNumber: 11
                        }, this),
                        marketingSection === "promos" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-4", fadeClass),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$promo$2f$PromoCodesClient$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2532,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2531,
                            columnNumber: 11
                        }, this),
                        marketingSection === "updates" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-4", fadeClass),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$updates$2f$page$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                embedded: true
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/DashboardClient.tsx",
                                lineNumber: 2538,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2537,
                            columnNumber: 11
                        }, this),
                        marketingSection === "promoters" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-4 space-y-3", fadeClass),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "text-xl font-semibold text-white",
                                                    children: "Promotores & Parcerias"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2546,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[12px] text-white/65",
                                                    children: "Quem te ajuda a vender (pessoas, grupos, parceiros)."
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2547,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2545,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            className: "rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 cursor-not-allowed",
                                            disabled: true,
                                            children: "Em breve"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2549,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2544,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-3xl border border-white/10 bg-black/35 p-4 text-sm text-white/70 space-y-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-white/80 font-semibold",
                                            children: "Em breve"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2558,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-white/65",
                                            children: "Dashboard de vendas por promotor e links com comissão estimada."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2559,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2557,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2543,
                            columnNumber: 11
                        }, this),
                        marketingSection === "content" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-4 space-y-3", fadeClass),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "text-xl font-semibold text-white",
                                                    children: "Conteúdo & Kits"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2568,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[12px] text-white/65",
                                                    children: [
                                                        "Copiar e partilhar: textos rápidos por ",
                                                        eventLabel,
                                                        "."
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                                    lineNumber: 2569,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2567,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70",
                                            children: "Em breve"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                                            lineNumber: 2571,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2566,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-3xl border border-white/10 bg-black/35 p-4 text-sm text-white/70",
                                    children: [
                                        "Em breve: kits rápidos para Instagram, WhatsApp e email por ",
                                        eventLabel,
                                        ", com botões de copiar."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                                    lineNumber: 2573,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/DashboardClient.tsx",
                            lineNumber: 2565,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/DashboardClient.tsx",
                    lineNumber: 2317,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 2316,
                columnNumber: 5
            }, this),
            eventDialog && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ConfirmDestructiveActionDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConfirmDestructiveActionDialog"], {
                open: true,
                title: eventDialog.mode === "delete" ? "Apagar rascunho?" : eventDialog.mode === "unarchive" ? `Reativar ${eventLabel}?` : `Arquivar ${eventLabel}?`,
                description: eventDialog.mode === "delete" ? `Esta ação remove o rascunho e ${ticketLabelPluralTitle.toLowerCase()} associadas.` : eventDialog.mode === "unarchive" ? `O ${eventLabel} volta a aparecer nas listas e dashboards.` : `O ${eventLabel} deixa de estar visível para o público. Vendas e relatórios mantêm-se.`,
                consequences: eventDialog.mode === "delete" ? [
                    `Podes criar outro ${eventLabel} quando quiseres.`
                ] : eventDialog.mode === "unarchive" ? [
                    "Podes sempre voltar a arquivar mais tarde."
                ] : [
                    "Sai de /explorar e das listas do dashboard.",
                    "Mantém histórico para relatórios/finanças."
                ],
                confirmLabel: eventDialog.mode === "delete" ? "Apagar rascunho" : eventDialog.mode === "unarchive" ? `Reativar ${eventLabel}` : `Arquivar ${eventLabel}`,
                dangerLevel: eventDialog.mode === "delete" ? "high" : eventDialog.mode === "archive" ? "high" : "medium",
                onConfirm: ()=>archiveEvent(eventDialog.ev, eventDialog.mode),
                onClose: ()=>setEventDialog(null)
            }, void 0, false, {
                fileName: "[project]/app/organizador/DashboardClient.tsx",
                lineNumber: 2583,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/DashboardClient.tsx",
        lineNumber: 1253,
        columnNumber: 5
    }, this);
}
_s(OrganizadorPageInner, "1KSdHzvwn+kJNvzJKNj84j+r7Qg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = OrganizadorPageInner;
function DashboardClient({ hasOrganizer = false }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthModalProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(OrganizadorPageInner, {
            hasOrganizer: hasOrganizer
        }, void 0, false, {
            fileName: "[project]/app/organizador/DashboardClient.tsx",
            lineNumber: 2621,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/organizador/DashboardClient.tsx",
        lineNumber: 2620,
        columnNumber: 5
    }, this);
}
_c1 = DashboardClient;
var _c, _c1;
__turbopack_context__.k.register(_c, "OrganizadorPageInner");
__turbopack_context__.k.register(_c1, "DashboardClient");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_organizador_DashboardClient_tsx_fe131095._.js.map