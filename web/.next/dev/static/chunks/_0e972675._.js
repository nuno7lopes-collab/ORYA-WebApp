(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
function toClassList(value) {
    if (!value) return [];
    if (typeof value === "string" || typeof value === "number") {
        return [
            String(value)
        ];
    }
    if (Array.isArray(value)) {
        return value.flatMap(toClassList);
    }
    if (typeof value === "object") {
        return Object.entries(value).filter(([, enabled])=>Boolean(enabled)).map(([key])=>key);
    }
    return [];
}
function cn(...inputs) {
    return inputs.flatMap(toClassList).join(" ");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/sidebar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SidebarInset",
    ()=>SidebarInset,
    "SidebarProvider",
    ()=>SidebarProvider,
    "SidebarRail",
    ()=>SidebarRail,
    "SidebarTrigger",
    ()=>SidebarTrigger,
    "useSidebar",
    ()=>useSidebar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature();
"use client";
;
;
// Sidebar: base compacta e responsiva, sem forçar colagem ao topo/rodapé
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;
const STORAGE_KEY = "orya_sidebar_width";
const WIDTH_VAR = "var(--orya-sidebar-width, 240px)";
const clampWidth = (value)=>Math.min(Math.max(value, MIN_WIDTH), MAX_WIDTH);
const readStoredWidth = ()=>{
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) return clampWidth(parsed);
        }
    } catch  {
    /* ignore */ }
    return DEFAULT_WIDTH;
};
const SidebarContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function SidebarProvider({ children, defaultOpen = true }) {
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultOpen);
    const [width, setWidthState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "SidebarProvider.useState": ()=>readStoredWidth()
    }["SidebarProvider.useState"]);
    const [ready, setReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const applyWidth = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SidebarProvider.useCallback[applyWidth]": (value)=>{
            const clamped = clampWidth(value);
            setWidthState(clamped);
            try {
                localStorage.setItem(STORAGE_KEY, String(clamped));
            } catch  {
            /* ignore */ }
            if (typeof document !== "undefined") {
                document.documentElement.style.setProperty("--orya-sidebar-width", `${clamped}px`);
                window.dispatchEvent(new CustomEvent("orya:sidebar-width", {
                    detail: clamped
                }));
            }
        }
    }["SidebarProvider.useCallback[applyWidth]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SidebarProvider.useEffect": ()=>{
            applyWidth(width);
            setReady(true);
            try {
                window.dispatchEvent(new Event("orya:sidebar-ready"));
            } catch  {
            /* ignore */ }
        }
    }["SidebarProvider.useEffect"], [
        applyWidth,
        width
    ]);
    const toggle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SidebarProvider.useCallback[toggle]": ()=>setOpen({
                "SidebarProvider.useCallback[toggle]": (v)=>!v
            }["SidebarProvider.useCallback[toggle]"])
    }["SidebarProvider.useCallback[toggle]"], []);
    const setWidth = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SidebarProvider.useCallback[setWidth]": (value)=>applyWidth(value)
    }["SidebarProvider.useCallback[setWidth]"], [
        applyWidth
    ]);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SidebarProvider.useMemo[value]": ()=>({
                open,
                setOpen,
                toggle,
                width,
                setWidth,
                ready
            })
    }["SidebarProvider.useMemo[value]"], [
        open,
        toggle,
        width,
        setWidth,
        ready
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SidebarContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/components/ui/sidebar.tsx",
        lineNumber: 88,
        columnNumber: 10
    }, this);
}
_s(SidebarProvider, "MMMyCDW3cUtl7c2uq7xsNMooSZc=");
_c = SidebarProvider;
function useSidebar() {
    _s1();
    const ctx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(SidebarContext);
    if (!ctx) throw new Error("Sidebar components must be used within SidebarProvider");
    return ctx;
}
_s1(useSidebar, "/dMy7t63NXD4eYACoT93CePwGrg=");
function SidebarInset({ children, className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex-1 min-w-0 flex flex-col min-h-screen transition-[margin,padding] duration-200 ease-out", "lg:pl-6 pb-6 pt-6", className),
        children: children
    }, void 0, false, {
        fileName: "[project]/components/ui/sidebar.tsx",
        lineNumber: 99,
        columnNumber: 5
    }, this);
}
_c1 = SidebarInset;
function SidebarTrigger({ className, ...props }) {
    _s2();
    const { toggle, open } = useSidebar();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: toggle,
        "aria-label": open ? "Fechar sidebar" : "Abrir sidebar",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:border-white/30 hover:bg-white/10", className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative h-4 w-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "absolute inset-x-0 top-0 h-[2px] rounded-full bg-current"
                }, void 0, false, {
                    fileName: "[project]/components/ui/sidebar.tsx",
                    lineNumber: 125,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-current"
                }, void 0, false, {
                    fileName: "[project]/components/ui/sidebar.tsx",
                    lineNumber: 126,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-current"
                }, void 0, false, {
                    fileName: "[project]/components/ui/sidebar.tsx",
                    lineNumber: 127,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/ui/sidebar.tsx",
            lineNumber: 124,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/ui/sidebar.tsx",
        lineNumber: 114,
        columnNumber: 5
    }, this);
}
_s2(SidebarTrigger, "2kac6CiW6Al8L6kojLDY5kQB2Pw=", false, function() {
    return [
        useSidebar
    ];
});
_c2 = SidebarTrigger;
function SidebarRail({ children, className }) {
    _s3();
    const { width, setWidth, ready, open, setOpen } = useSidebar();
    const dragStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const onMouseMove = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SidebarRail.useCallback[onMouseMove]": (event)=>{
            if (!dragStart.current) return;
            const delta = event.clientX - dragStart.current.x;
            setWidth(dragStart.current.width + delta);
        }
    }["SidebarRail.useCallback[onMouseMove]"], [
        setWidth
    ]);
    const stopDrag = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SidebarRail.useCallback[stopDrag]": ()=>{
            dragStart.current = null;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", stopDrag);
        }
    }["SidebarRail.useCallback[stopDrag]"], [
        onMouseMove
    ]);
    const startDrag = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SidebarRail.useCallback[startDrag]": (event)=>{
            dragStart.current = {
                x: event.clientX,
                width
            };
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", stopDrag);
        }
    }["SidebarRail.useCallback[startDrag]"], [
        onMouseMove,
        stopDrag,
        width
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden",
                "aria-hidden": true,
                onClick: ()=>setOpen(false)
            }, void 0, false, {
                fileName: "[project]/components/ui/sidebar.tsx",
                lineNumber: 164,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                suppressHydrationWarning: true,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("fixed inset-y-0 left-0 z-50 flex w-[80vw] max-w-sm flex-col overflow-hidden bg-white/5 backdrop-blur-2xl border-r border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] transition-transform duration-200", open ? "translate-x-0" : "-translate-x-full", "lg:translate-x-0 lg:sticky lg:top-0 lg:min-h-screen lg:h-auto lg:max-h-none lg:flex lg:self-stretch", className),
                style: {
                    width: WIDTH_VAR,
                    minWidth: WIDTH_VAR,
                    maxWidth: WIDTH_VAR
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "relative flex h-full min-h-full w-full flex-col overflow-y-auto pt-6 pb-8",
                    children: [
                        ready ? children : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-full w-full space-y-4 p-4 animate-pulse",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "h-10 w-10 rounded-2xl bg-white/10"
                                        }, void 0, false, {
                                            fileName: "[project]/components/ui/sidebar.tsx",
                                            lineNumber: 190,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex-1 space-y-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "h-3 w-16 rounded-full bg-white/10"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/ui/sidebar.tsx",
                                                    lineNumber: 192,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "h-4 w-24 rounded-full bg-white/15"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/ui/sidebar.tsx",
                                                    lineNumber: 193,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/ui/sidebar.tsx",
                                            lineNumber: 191,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/ui/sidebar.tsx",
                                    lineNumber: 189,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-10 w-full rounded-xl bg-white/5"
                                }, void 0, false, {
                                    fileName: "[project]/components/ui/sidebar.tsx",
                                    lineNumber: 196,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-10 w-full rounded-xl bg-white/5"
                                }, void 0, false, {
                                    fileName: "[project]/components/ui/sidebar.tsx",
                                    lineNumber: 197,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-10 w-3/4 rounded-xl bg-white/5"
                                }, void 0, false, {
                                    fileName: "[project]/components/ui/sidebar.tsx",
                                    lineNumber: 198,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-10 w-full rounded-xl bg-white/5"
                                }, void 0, false, {
                                    fileName: "[project]/components/ui/sidebar.tsx",
                                    lineNumber: 199,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-10 w-2/3 rounded-xl bg-white/5"
                                }, void 0, false, {
                                    fileName: "[project]/components/ui/sidebar.tsx",
                                    lineNumber: 200,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/ui/sidebar.tsx",
                            lineNumber: 188,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "pointer-events-none h-[200vh] w-full",
                            "aria-hidden": true
                        }, void 0, false, {
                            fileName: "[project]/components/ui/sidebar.tsx",
                            lineNumber: 204,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            onMouseDown: startDrag,
                            className: "absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-white/5 active:bg-white/10",
                            role: "separator",
                            "aria-orientation": "vertical",
                            "aria-label": "Redimensionar sidebar"
                        }, void 0, false, {
                            fileName: "[project]/components/ui/sidebar.tsx",
                            lineNumber: 205,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/ui/sidebar.tsx",
                    lineNumber: 184,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/ui/sidebar.tsx",
                lineNumber: 170,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_s3(SidebarRail, "DtbkD/HrhMuzWw4aYLnO7ZY3BlM=", false, function() {
    return [
        useSidebar
    ];
});
_c3 = SidebarRail;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "SidebarProvider");
__turbopack_context__.k.register(_c1, "SidebarInset");
__turbopack_context__.k.register(_c2, "SidebarTrigger");
__turbopack_context__.k.register(_c3, "SidebarRail");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/dashboardUi.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/app-sidebar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppSidebar",
    ()=>AppSidebar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$sidebar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/sidebar.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseBrowser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-client] (ecmascript)");
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
const normalizeOrganizationCategory = (category)=>{
    const normalized = category?.toUpperCase() ?? "";
    if (normalized === "PADEL") return "PADEL";
    if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
    return "EVENTOS";
};
const CATEGORY_LABELS = {
    EVENTOS: "Eventos",
    PADEL: "Padel",
    VOLUNTARIADO: "Voluntariado"
};
const CATEGORY_CTA = {
    EVENTOS: {
        label: "Criar evento",
        href: "/organizador/eventos/novo"
    },
    PADEL: {
        label: "Criar torneio de padel",
        href: "/organizador/eventos/novo?preset=padel"
    },
    VOLUNTARIADO: {
        label: "Criar evento",
        href: "/organizador/eventos/novo?preset=voluntariado"
    }
};
function buildNav() {
    const linkClass = (active)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center justify-between rounded-xl px-3 py-2 transition border border-transparent text-sm", active ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.35)]" : "text-white/75 hover:bg-white/10 hover:text-white");
    const subLinkClass = (active)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center justify-between rounded-xl px-3 py-2 transition border border-transparent text-sm", active ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.35)]" : "text-white/75 hover:bg-white/10 hover:text-white");
    return {
        linkClass,
        subLinkClass
    };
}
function AppSidebar({ activeOrg, orgOptions, user }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const tabParamRaw = searchParams?.get("tab");
    const sectionParam = searchParams?.get("section");
    const [orgOpen, setOrgOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [userOpen, setUserOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [switchingOrgId, setSwitchingOrgId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const isEventsActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AppSidebar.useMemo[isEventsActive]": ()=>{
            if (pathname === "/organizador") return true;
            if (pathname?.startsWith("/organizador/eventos")) return true;
            if (tabParamRaw === "manage") {
                if (!sectionParam) return true;
                return [
                    "eventos",
                    "events",
                    "torneios"
                ].includes(sectionParam);
            }
            return false;
        }
    }["AppSidebar.useMemo[isEventsActive]"], [
        pathname,
        tabParamRaw,
        sectionParam
    ]);
    const isInscricoesActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AppSidebar.useMemo[isInscricoesActive]": ()=>{
            if (pathname?.startsWith("/organizador/inscricoes")) return true;
            return tabParamRaw === "manage" && sectionParam === "inscricoes";
        }
    }["AppSidebar.useMemo[isInscricoesActive]"], [
        pathname,
        tabParamRaw,
        sectionParam
    ]);
    const isPadelActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AppSidebar.useMemo[isPadelActive]": ()=>{
            if (pathname?.startsWith("/organizador/padel")) return true;
            return tabParamRaw === "manage" && [
                "padel-hub",
                "padel"
            ].includes(sectionParam ?? "");
        }
    }["AppSidebar.useMemo[isPadelActive]"], [
        pathname,
        tabParamRaw,
        sectionParam
    ]);
    const isPromoteActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AppSidebar.useMemo[isPromoteActive]": ()=>{
            if (pathname?.startsWith("/organizador/updates")) return true;
            return tabParamRaw === "promote";
        }
    }["AppSidebar.useMemo[isPromoteActive]"], [
        pathname,
        tabParamRaw
    ]);
    const isAnalyzeActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AppSidebar.useMemo[isAnalyzeActive]": ()=>{
            if (pathname?.startsWith("/organizador/faturacao")) return true;
            if (pathname?.startsWith("/organizador/pagamentos/invoices")) return true;
            if (pathname?.startsWith("/organizador/tournaments/") && pathname?.endsWith("/finance")) return true;
            return tabParamRaw === "analyze";
        }
    }["AppSidebar.useMemo[isAnalyzeActive]"], [
        pathname,
        tabParamRaw
    ]);
    const isProfileActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AppSidebar.useMemo[isProfileActive]": ()=>tabParamRaw === "profile" || tabParamRaw === "perfil"
    }["AppSidebar.useMemo[isProfileActive]"], [
        tabParamRaw
    ]);
    const isStaffActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AppSidebar.useMemo[isStaffActive]": ()=>pathname?.startsWith("/organizador/staff")
    }["AppSidebar.useMemo[isStaffActive]"], [
        pathname
    ]);
    const isSettingsActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AppSidebar.useMemo[isSettingsActive]": ()=>pathname?.startsWith("/organizador/settings")
    }["AppSidebar.useMemo[isSettingsActive]"], [
        pathname
    ]);
    const { linkClass, subLinkClass } = buildNav();
    const orgDisplay = activeOrg?.name ?? "Organização";
    const orgAvatar = activeOrg?.avatarUrl ?? null;
    const switchOrg = async (orgId)=>{
        if (switchingOrgId) return;
        setSwitchingOrgId(orgId);
        try {
            const res = await fetch("/api/organizador/organizations/switch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    organizerId: orgId
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                console.warn("[org switch] falhou", json?.error ?? res.statusText);
                return;
            }
            setOrgOpen(false);
            router.replace(`/organizador?tab=manage&org=${orgId}`);
            router.refresh();
        } catch (err) {
            console.error("[org switch] erro inesperado", err);
        } finally{
            setSwitchingOrgId(null);
        }
    };
    const goUserMode = ()=>{
        try {
            document.cookie = "orya_org=; path=/; Max-Age=0; SameSite=Lax";
        } catch  {
        /* ignore */ }
        setUserOpen(false);
        router.push("/me");
    };
    const signOut = async ()=>{
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.signOut();
        } catch (err) {
            console.error("Erro no signOut", err);
        } finally{
            router.push("/login");
        }
    };
    const userLabel = user?.name || user?.email || "Utilizador";
    const userInitial = (userLabel || "U").charAt(0).toUpperCase();
    const orgList = orgOptions ?? [];
    const orgCurrent = orgList.find((o)=>o.organizerId === activeOrg?.id) ?? orgList[0] ?? null;
    const orgButtonAvatar = orgCurrent?.organizer.brandingAvatarUrl || orgAvatar;
    const orgCategoryValue = orgCurrent?.organizer.organizationCategory ?? activeOrg?.organizationCategory ?? null;
    const orgCategory = normalizeOrganizationCategory(orgCategoryValue);
    const categoryLabel = CATEGORY_LABELS[orgCategory];
    const categoryCta = CATEGORY_CTA[orgCategory];
    const eventsLabel = orgCategory === "PADEL" ? "Torneios" : "Eventos";
    const supportsInscricoes = orgCategory !== "PADEL";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$sidebar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SidebarRail"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-3",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setOrgOpen((v)=>!v),
                                "aria-expanded": orgOpen,
                                className: "flex w-full items-center justify-between gap-2 text-left",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            orgButtonAvatar ? // eslint-disable-next-line @next/next/no-img-element
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                src: orgButtonAvatar,
                                                alt: orgCurrent?.organizer.publicName || orgDisplay || "Organização",
                                                className: "h-8 w-8 rounded-lg border border-white/10 object-cover"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 224,
                                                columnNumber: 17
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold",
                                                children: (orgCurrent?.organizer.publicName || orgCurrent?.organizer.businessName || "O")[0]
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 230,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-left",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] uppercase tracking-[0.18em] text-white/50",
                                                        children: "Organização"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/app-sidebar.tsx",
                                                        lineNumber: 235,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-sm font-semibold text-white",
                                                        children: orgCurrent?.organizer.publicName || orgCurrent?.organizer.businessName || "Selecionar"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/app-sidebar.tsx",
                                                        lineNumber: 236,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 234,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 221,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-white/60 transition-transform", orgOpen ? "rotate-180" : ""),
                                        children: "▾"
                                    }, void 0, false, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 243,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 215,
                                columnNumber: 11
                            }, this),
                            orgOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-2 space-y-1",
                                children: [
                                    orgList.map((item)=>{
                                        const isActive = item.organizerId === orgCurrent?.organizerId;
                                        const isSwitching = switchingOrgId === item.organizerId;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            disabled: isSwitching,
                                            onClick: ()=>switchOrg(item.organizerId),
                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition", isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10", isSwitching && "opacity-70 cursor-progress"),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-left",
                                                    children: item.organizer.publicName || item.organizer.businessName
                                                }, void 0, false, {
                                                    fileName: "[project]/components/app-sidebar.tsx",
                                                    lineNumber: 262,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "rounded-full border border-white/15 bg-white/5 px-2 py-[1px] text-white/70",
                                                            children: item.role
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/app-sidebar.tsx",
                                                            lineNumber: 266,
                                                            columnNumber: 23
                                                        }, this),
                                                        isActive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-emerald-200",
                                                            children: "ativo"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/app-sidebar.tsx",
                                                            lineNumber: 269,
                                                            columnNumber: 36
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/app-sidebar.tsx",
                                                    lineNumber: 265,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, item.organizerId, true, {
                                            fileName: "[project]/components/app-sidebar.tsx",
                                            lineNumber: 251,
                                            columnNumber: 19
                                        }, this);
                                    }),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        href: "/organizador/become",
                                        className: "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white/80 transition hover:bg-white/10",
                                        onClick: ()=>setOrgOpen(false),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "Adicionar organização"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 279,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[10px] text-white/60",
                                                children: "+"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 280,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 274,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 246,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/app-sidebar.tsx",
                        lineNumber: 214,
                        columnNumber: 9
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/app-sidebar.tsx",
                    lineNumber: 213,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                    className: "mt-6 flex-1 space-y-3 px-3 text-sm",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[10px] uppercase tracking-[0.24em] text-white/55",
                                    children: "Categoria ativa"
                                }, void 0, false, {
                                    fileName: "[project]/components/app-sidebar.tsx",
                                    lineNumber: 290,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm font-semibold text-white",
                                    children: categoryLabel
                                }, void 0, false, {
                                    fileName: "[project]/components/app-sidebar.tsx",
                                    lineNumber: 291,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 289,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: categoryCta.href,
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"], "w-full justify-center"),
                            children: categoryCta.label
                        }, void 0, false, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 294,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "px-2 pt-2 text-[10px] uppercase tracking-[0.24em] text-white/45",
                            children: "Organização"
                        }, void 0, false, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 301,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/organizador",
                            className: linkClass(isEventsActive),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: eventsLabel
                            }, void 0, false, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 303,
                                columnNumber: 11
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 302,
                            columnNumber: 9
                        }, this),
                        supportsInscricoes && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/organizador/inscricoes",
                            className: linkClass(isInscricoesActive),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Inscrições"
                            }, void 0, false, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 307,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 306,
                            columnNumber: 11
                        }, this),
                        orgCategory === "PADEL" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/organizador/padel",
                            className: linkClass(isPadelActive),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Padel Hub"
                            }, void 0, false, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 312,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 311,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/organizador?tab=promote&section=marketing&marketing=overview",
                            className: linkClass(isPromoteActive),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Promover"
                            }, void 0, false, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 319,
                                columnNumber: 11
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 315,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/organizador?tab=analyze&section=financas",
                            className: linkClass(isAnalyzeActive),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Analisar"
                            }, void 0, false, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 322,
                                columnNumber: 11
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 321,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/organizador?tab=profile",
                            className: linkClass(isProfileActive),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Perfil"
                            }, void 0, false, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 325,
                                columnNumber: 11
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 324,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "pt-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "px-2 text-[10px] uppercase tracking-[0.24em] text-white/45",
                                    children: "Equipa & Conta"
                                }, void 0, false, {
                                    fileName: "[project]/components/app-sidebar.tsx",
                                    lineNumber: 329,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/organizador/staff",
                                    className: subLinkClass(isStaffActive),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Staff"
                                    }, void 0, false, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 331,
                                        columnNumber: 13
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/app-sidebar.tsx",
                                    lineNumber: 330,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/organizador/settings",
                                    className: subLinkClass(isSettingsActive),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Definições"
                                    }, void 0, false, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 334,
                                        columnNumber: 13
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/app-sidebar.tsx",
                                    lineNumber: 333,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/app-sidebar.tsx",
                            lineNumber: 328,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/app-sidebar.tsx",
                    lineNumber: 288,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2 px-3 pb-4 pt-3",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setUserOpen((v)=>!v),
                                "aria-expanded": userOpen,
                                className: "flex w-full cursor-pointer items-center justify-between gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            user?.avatarUrl ? // eslint-disable-next-line @next/next/no-img-element
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                src: user.avatarUrl,
                                                alt: userLabel,
                                                className: "h-8 w-8 rounded-lg border border-white/10 object-cover"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 351,
                                                columnNumber: 17
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold",
                                                children: userInitial
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 353,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-left",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] uppercase tracking-[0.18em] text-white/50",
                                                        children: "Utilizador"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/app-sidebar.tsx",
                                                        lineNumber: 358,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-sm font-semibold text-white",
                                                        children: userLabel
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/app-sidebar.tsx",
                                                        lineNumber: 359,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 357,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 348,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-white/60 transition-transform", userOpen ? "rotate-180" : ""),
                                        children: "▾"
                                    }, void 0, false, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 362,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 342,
                                columnNumber: 11
                            }, this),
                            userOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-2 space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: goUserMode,
                                        className: "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white transition hover:bg-white/10",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "Voltar a utilizador"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 371,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[10px] text-white/60",
                                                children: "↺"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 372,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 366,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        href: "/me/settings",
                                        className: "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white transition hover:bg-white/10",
                                        onClick: ()=>setUserOpen(false),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "Settings"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 379,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[10px] text-white/60",
                                                children: "↗"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 380,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 374,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: signOut,
                                        className: "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-500/15",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "Terminar sessão"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 387,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[10px] text-rose-200",
                                                children: "×"
                                            }, void 0, false, {
                                                fileName: "[project]/components/app-sidebar.tsx",
                                                lineNumber: 388,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/app-sidebar.tsx",
                                        lineNumber: 382,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/app-sidebar.tsx",
                                lineNumber: 365,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/app-sidebar.tsx",
                        lineNumber: 341,
                        columnNumber: 9
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/app-sidebar.tsx",
                    lineNumber: 340,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/app-sidebar.tsx",
            lineNumber: 211,
            columnNumber: 7
        }, this)
    }, void 0, false);
}
_s(AppSidebar, "fq63jHlYz5bXgnUnkxzEzycKhFY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"]
    ];
});
_c = AppSidebar;
var _c;
__turbopack_context__.k.register(_c, "AppSidebar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/OrganizerLangSetter.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OrganizerLangSetter",
    ()=>OrganizerLangSetter
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
function OrganizerLangSetter({ language }) {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OrganizerLangSetter.useEffect": ()=>{
            if (!language || typeof document === "undefined") return;
            const lang = language.toLowerCase() === "en" ? "en" : "pt";
            const previous = document.documentElement.lang;
            document.documentElement.lang = lang;
            return ({
                "OrganizerLangSetter.useEffect": ()=>{
                    if (previous) document.documentElement.lang = previous;
                }
            })["OrganizerLangSetter.useEffect"];
        }
    }["OrganizerLangSetter.useEffect"], [
        language
    ]);
    return null;
}
_s(OrganizerLangSetter, "OD7bBpZva5O2jO+Puf00hKivP7c=");
_c = OrganizerLangSetter;
var _c;
__turbopack_context__.k.register(_c, "OrganizerLangSetter");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/breadcrumb.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Breadcrumb",
    ()=>Breadcrumb,
    "BreadcrumbItem",
    ()=>BreadcrumbItem,
    "BreadcrumbList",
    ()=>BreadcrumbList,
    "BreadcrumbPage",
    ()=>BreadcrumbPage,
    "BreadcrumbSeparator",
    ()=>BreadcrumbSeparator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
function Breadcrumb({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        "aria-label": "breadcrumb",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center text-sm text-white/70", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/breadcrumb.tsx",
        lineNumber: 7,
        columnNumber: 10
    }, this);
}
_c = Breadcrumb;
function BreadcrumbList({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-2", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/breadcrumb.tsx",
        lineNumber: 11,
        columnNumber: 10
    }, this);
}
_c1 = BreadcrumbList;
function BreadcrumbItem({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("inline-flex items-center gap-1 text-white/75", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/breadcrumb.tsx",
        lineNumber: 15,
        columnNumber: 10
    }, this);
}
_c2 = BreadcrumbItem;
function BreadcrumbSeparator({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        role: "presentation",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-white/40", className),
        ...props,
        children: "/"
    }, void 0, false, {
        fileName: "[project]/components/ui/breadcrumb.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
_c3 = BreadcrumbSeparator;
function BreadcrumbPage({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        "aria-current": "page",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-semibold text-white", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/breadcrumb.tsx",
        lineNumber: 27,
        columnNumber: 10
    }, this);
}
_c4 = BreadcrumbPage;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "Breadcrumb");
__turbopack_context__.k.register(_c1, "BreadcrumbList");
__turbopack_context__.k.register(_c2, "BreadcrumbItem");
__turbopack_context__.k.register(_c3, "BreadcrumbSeparator");
__turbopack_context__.k.register(_c4, "BreadcrumbPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/OrganizerBreadcrumb.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OrganizerBreadcrumb",
    ()=>OrganizerBreadcrumb
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$breadcrumb$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/breadcrumb.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const SECTION_LABELS = {
    overview: "Visão geral",
    eventos: "Eventos",
    torneios: "Torneios",
    "padel-hub": "Hub Padel",
    acoes: "Ações",
    inscricoes: "Inscrições",
    checkin: "Check-in",
    staff: "Staff",
    settings: "Definições",
    perfil: "Perfil público",
    updates: "Canal oficial",
    marketing: "Marketing",
    perfil: "Perfil",
    promos: "Códigos promocionais",
    promoters: "Promotores e parcerias",
    content: "Conteúdos e kits",
    sales: "Vendas",
    vendas: "Vendas",
    finance: "Finanças",
    financas: "Finanças",
    invoices: "Faturação"
};
const OBJECTIVE_LABELS = {
    manage: "Gerir",
    promote: "Promover",
    analyze: "Analisar",
    profile: "Perfil"
};
function resolveLabel(pathname, tab, section, marketing, preset) {
    if (pathname.startsWith("/organizador/eventos/novo")) {
        const normalized = preset?.toLowerCase() ?? "";
        const isPadelPreset = normalized === "padel" || preset?.toUpperCase() === "PADEL";
        return isPadelPreset ? "Criar torneio de padel" : "Criar evento";
    }
    if (pathname.includes("/eventos/") && pathname.endsWith("/edit")) return "Editar evento";
    if (pathname.includes("/eventos/") && pathname.endsWith("/live")) return "Gerir · Preparar live";
    if (pathname.includes("/eventos/") && pathname.endsWith("/checkin")) return "Check-in do evento";
    if (pathname.includes("/eventos/")) return "Eventos";
    if (pathname.startsWith("/organizador/inscricoes")) return "Inscrições";
    if (pathname.startsWith("/organizador/updates")) return "Canal oficial";
    if (pathname.startsWith("/organizador/scan")) return "Check-in";
    if (pathname.startsWith("/organizador/faturacao")) return "Finanças";
    if (pathname.startsWith("/organizador/pagamentos/invoices")) return "Faturação";
    if (pathname.startsWith("/organizador/tournaments/") && pathname.endsWith("/finance")) return "Finanças do torneio";
    if (pathname.startsWith("/organizador/tournaments/") && pathname.endsWith("/live")) return "Live do torneio";
    if (pathname.startsWith("/organizador/tournaments/")) return "Torneios";
    if (pathname.startsWith("/organizador/staff")) return "Staff";
    if (pathname.startsWith("/organizador/settings")) return "Definições";
    const normalizedTab = tab === "overview" || tab === "create" ? "manage" : tab === "perfil" ? "profile" : tab;
    const objectiveLabel = OBJECTIVE_LABELS[normalizedTab];
    const sectionKey = normalizedTab === "promote" && section === "marketing" && marketing ? marketing : section;
    const sectionLabel = sectionKey ? SECTION_LABELS[sectionKey] : null;
    if (objectiveLabel && sectionLabel) {
        return `${objectiveLabel} · ${sectionLabel}`;
    }
    if (objectiveLabel) return objectiveLabel;
    const map = {
        events: "Eventos",
        sales: "Vendas",
        finance: "Finanças",
        invoices: "Faturação",
        marketing: "Marketing",
        padel: "Padel",
        staff: "Staff",
        settings: "Definições",
        overview: "Gerir",
        profile: "Perfil"
    };
    return map[normalizedTab] ?? "Dashboard";
}
function OrganizerBreadcrumb() {
    _s();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const tabParamRaw = searchParams?.get("tab") || "manage";
    const sectionParamRaw = searchParams?.get("section");
    const marketingParamRaw = searchParams?.get("marketing");
    const presetParamRaw = searchParams?.get("preset") ?? searchParams?.get("category") ?? searchParams?.get("type");
    const label = resolveLabel(pathname || "", tabParamRaw, sectionParamRaw, marketingParamRaw, presetParamRaw);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$breadcrumb$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Breadcrumb"], {
        className: "text-base md:text-lg font-semibold text-white/80",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$breadcrumb$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BreadcrumbList"], {
            className: "gap-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$breadcrumb$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BreadcrumbItem"], {
                    className: "text-white/75 hover:text-white transition",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: "/organizador",
                        children: "Dashboard"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/OrganizerBreadcrumb.tsx",
                        lineNumber: 104,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/organizador/OrganizerBreadcrumb.tsx",
                    lineNumber: 103,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$breadcrumb$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BreadcrumbSeparator"], {
                    className: "text-white/50"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/OrganizerBreadcrumb.tsx",
                    lineNumber: 106,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$breadcrumb$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BreadcrumbItem"], {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$breadcrumb$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BreadcrumbPage"], {
                        className: "text-white",
                        children: label
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/OrganizerBreadcrumb.tsx",
                        lineNumber: 108,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/organizador/OrganizerBreadcrumb.tsx",
                    lineNumber: 107,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/OrganizerBreadcrumb.tsx",
            lineNumber: 102,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/organizador/OrganizerBreadcrumb.tsx",
        lineNumber: 101,
        columnNumber: 5
    }, this);
}
_s(OrganizerBreadcrumb, "AxA9T5G2Po78UC4hL8ljCdvMciE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"]
    ];
});
_c = OrganizerBreadcrumb;
var _c;
__turbopack_context__.k.register(_c, "OrganizerBreadcrumb");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_0e972675._.js.map