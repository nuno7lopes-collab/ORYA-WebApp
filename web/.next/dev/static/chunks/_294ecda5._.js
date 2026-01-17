(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/analytics.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "trackEvent",
    ()=>trackEvent
]);
function trackEvent(name, payload) {
    if (!name) return;
    // Por agora, apenas console.log; preparado para PostHog/Amplitude/GA.
    // Mantém formato consistente para fácil troca futura.
    console.log("[trackEvent]", name, payload ?? {});
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/money.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// lib/money.ts
__turbopack_context__.s([
    "centsToEuro",
    ()=>centsToEuro,
    "formatEuro",
    ()=>formatEuro
]);
const EUR_NUMBER_FORMATTER = new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
function formatEuro(amount) {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "";
    // Intl usa espaços não separáveis em PT; trocamos para espaço normal para evitar chars estranhos.
    const formatted = EUR_NUMBER_FORMATTER.format(amount).replace(/\u00A0/g, " ");
    return `${formatted} €`;
}
function centsToEuro(cents) {
    if (cents === null || cents === undefined || Number.isNaN(cents)) return null;
    return cents / 100;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/constants/ptCities.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PT_CITIES",
    ()=>PT_CITIES
]);
const PT_CITIES = [
    "Porto",
    "Lisboa",
    "Braga",
    "Coimbra",
    "Aveiro",
    "Faro",
    "Setúbal",
    "Leiria",
    "Viseu",
    "Guimarães",
    "Matosinhos",
    "Vila Nova de Gaia",
    "Maia",
    "Póvoa de Varzim",
    "Funchal",
    "Évora",
    "Cascais",
    "Sintra",
    "Amadora",
    "Almada"
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/username.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/image.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/chart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ChartContainer",
    ()=>ChartContainer,
    "ChartLegend",
    ()=>ChartLegend,
    "ChartLegendContent",
    ()=>ChartLegendContent,
    "ChartTooltip",
    ()=>ChartTooltip,
    "ChartTooltipContent",
    ()=>ChartTooltipContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
;
function ChartContainer({ config, className, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-chart-config": JSON.stringify(config),
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2", className),
        ...props,
        children: children
    }, void 0, false, {
        fileName: "[project]/components/ui/chart.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
_c = ChartContainer;
function ChartLegend({ payload }) {
    if (!payload?.length) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-3 flex flex-wrap gap-3 text-[12px] text-white/80",
        children: payload.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "inline-flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "h-2 w-2 rounded-full",
                        style: {
                            background: item.color || "var(--foreground)"
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/ui/chart.tsx",
                        lineNumber: 41,
                        columnNumber: 11
                    }, this),
                    item.value
                ]
            }, item.dataKey || item.value, true, {
                fileName: "[project]/components/ui/chart.tsx",
                lineNumber: 40,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/components/ui/chart.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_c1 = ChartLegend;
function ChartTooltipContent({ active, label, payload, labelFormatter, formatter }) {
    if (!active || !payload || payload.length === 0) return null;
    const labelText = labelFormatter ? labelFormatter(label ?? "") : label;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded-xl border border-white/12 bg-black/80 px-3 py-2 text-[12px] shadow-lg",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-2 text-white/90",
                children: labelText
            }, void 0, false, {
                fileName: "[project]/components/ui/chart.tsx",
                lineNumber: 73,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: payload.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 text-white/80",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "h-2 w-2 rounded-full",
                                style: {
                                    background: item.color
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/ui/chart.tsx",
                                lineNumber: 77,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "flex-1",
                                children: formatter ? formatter(item.value, item.name) : `${item.name}: ${item.value}`
                            }, void 0, false, {
                                fileName: "[project]/components/ui/chart.tsx",
                                lineNumber: 78,
                                columnNumber: 13
                            }, this)
                        ]
                    }, item.name, true, {
                        fileName: "[project]/components/ui/chart.tsx",
                        lineNumber: 76,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/ui/chart.tsx",
                lineNumber: 74,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/ui/chart.tsx",
        lineNumber: 72,
        columnNumber: 5
    }, this);
}
_c2 = ChartTooltipContent;
const ChartTooltip = (props)=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/chart.tsx",
        lineNumber: 89,
        columnNumber: 10
    }, ("TURBOPACK compile-time value", void 0));
};
_c3 = ChartTooltip;
function ChartLegendContent(props) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ChartLegend, {
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/chart.tsx",
        lineNumber: 93,
        columnNumber: 10
    }, this);
}
_c4 = ChartLegendContent;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "ChartContainer");
__turbopack_context__.k.register(_c1, "ChartLegend");
__turbopack_context__.k.register(_c2, "ChartTooltipContent");
__turbopack_context__.k.register(_c3, "ChartTooltip");
__turbopack_context__.k.register(_c4, "ChartLegendContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/config/cities.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PORTUGAL_CITIES",
    ()=>PORTUGAL_CITIES
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants/ptCities.ts [app-client] (ecmascript)");
;
const PORTUGAL_CITIES = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PT_CITIES"];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_294ecda5._.js.map