(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/components/autenticação/AuthModalContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthModalProvider",
    ()=>AuthModalProvider,
    "useAuthModal",
    ()=>useAuthModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
const AuthModalContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
const AuthModalProvider = ({ children })=>{
    _s();
    const [isOpen, setIsOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [mode, setModeState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [email, setEmailState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [redirectTo, setRedirectToState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [onboardingStep, setOnboardingStepState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [showGoogle, setShowGoogle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const openModal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthModalProvider.useCallback[openModal]": (options)=>{
            if (options?.mode !== undefined) setModeState(options.mode);
            if (options?.email !== undefined) setEmailState(options.email);
            if (options?.redirectTo !== undefined) setRedirectToState(options.redirectTo);
            if (options?.onboardingStep !== undefined) setOnboardingStepState(options.onboardingStep);
            setShowGoogle(options?.showGoogle ?? true);
            setIsOpen(true);
        }
    }["AuthModalProvider.useCallback[openModal]"], []);
    const closeModal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthModalProvider.useCallback[closeModal]": ()=>{
            setIsOpen(false);
            setModeState(null);
            setEmailState("");
            setRedirectToState(null);
            setOnboardingStepState(null);
            setShowGoogle(false);
        }
    }["AuthModalProvider.useCallback[closeModal]"], []);
    const setEmail = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthModalProvider.useCallback[setEmail]": (email)=>{
            setEmailState(email);
        }
    }["AuthModalProvider.useCallback[setEmail]"], []);
    const setRedirectTo = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthModalProvider.useCallback[setRedirectTo]": (value)=>{
            setRedirectToState(value);
        }
    }["AuthModalProvider.useCallback[setRedirectTo]"], []);
    const setOnboardingStep = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthModalProvider.useCallback[setOnboardingStep]": (step)=>{
            setOnboardingStepState(step);
        }
    }["AuthModalProvider.useCallback[setOnboardingStep]"], []);
    const setMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthModalProvider.useCallback[setMode]": (mode)=>{
            setModeState(mode);
        }
    }["AuthModalProvider.useCallback[setMode]"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthModalContext.Provider, {
        value: {
            isOpen,
            mode,
            email,
            redirectTo,
            onboardingStep,
            showGoogle,
            openModal,
            closeModal,
            setEmail,
            setMode,
            setRedirectTo,
            setOnboardingStep
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/app/components/autenticação/AuthModalContext.tsx",
        lineNumber: 84,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(AuthModalProvider, "wLFAQjYgftWyvItJ6kTT0EX+n5g=");
_c = AuthModalProvider;
const useAuthModal = ()=>{
    _s1();
    const ctx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthModalContext);
    if (!ctx) {
        throw new Error("useAuthModal must be used within an AuthModalProvider");
    }
    return ctx;
};
_s1(useAuthModal, "/dMy7t63NXD4eYACoT93CePwGrg=");
var _c;
__turbopack_context__.k.register(_c, "AuthModalProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/supabaseBrowser.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabaseBrowser",
    ()=>supabaseBrowser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createBrowserClient.js [app-client] (ecmascript)");
"use client";
;
/**
 * Cliente Supabase para uso no browser.
 * Usa as variáveis NEXT_PUBLIC_*, que são expostas ao front-end.
 * ⚠️ Não importar '@/lib/env' aqui, porque isso é só para código server-side.
 */ function cleanupAuthStorage() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const storages = [
        window.localStorage,
        window.sessionStorage
    ];
    for (const store of storages){
        try {
            for(let i = store.length - 1; i >= 0; i--){
                const key = store.key(i);
                if (!key || !key.startsWith("sb-")) continue;
            // não removemos mais base64, para não apagar sessões válidas
            }
        } catch  {
        // ignore
        }
    }
// Mantemos cookies sb- intactas; não apagamos base64 para não destruir sessões válidas
}
function getBrowserSupabaseClient() {
    const supabaseUrl = ("TURBOPACK compile-time value", "https://ytdegtoibuxcmmvtbgtq.supabase.co");
    const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZGVndG9pYnV4Y21tdnRiZ3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzY0MzgsImV4cCI6MjA3ODYxMjQzOH0.4LePHrbqF4AEgn9LOt0aRiPU_TOkBNqye9ywmjXFar0");
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    cleanupAuthStorage();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBrowserClient"])(supabaseUrl, supabaseAnonKey);
}
const supabaseBrowser = getBrowserSupabaseClient();
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/hooks/useUser.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useUser",
    ()=>useUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseBrowser.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const fetcher = async (url)=>{
    const res = await fetch(url, {
        credentials: "include",
        cache: "no-store"
    });
    if (res.status === 401) {
        // Sem sessão válida → devolve user/profile null sem erro
        return {
            user: null,
            profile: null
        };
    }
    if (!res.ok) {
        throw new Error("Falha ao carregar user");
    }
    return await res.json();
};
function useUser() {
    _s();
    const { data, error, isLoading, mutate } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])("/api/auth/me", fetcher);
    const [migrated, setMigrated] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const migratedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    // Forçar refresh quando o estado de auth muda (sign in/out) para evitar estado preso
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useUser.useEffect": ()=>{
            const { data: { subscription } } = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.onAuthStateChange({
                "useUser.useEffect": ()=>{
                    mutate();
                }
            }["useUser.useEffect"]);
            return ({
                "useUser.useEffect": ()=>{
                    subscription.unsubscribe();
                }
            })["useUser.useEffect"];
        }
    }["useUser.useEffect"], [
        mutate
    ]);
    // Claim guest purchases após email verificado (best-effort)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useUser.useEffect": ()=>{
            const claim = {
                "useUser.useEffect.claim": async ()=>{
                    try {
                        await fetch("/api/me/claim-guest", {
                            method: "POST"
                        });
                    } catch (err) {
                        console.warn("[useUser] claim-guest falhou", err);
                    }
                }
            }["useUser.useEffect.claim"];
            const emailVerified = Boolean(data?.user?.emailConfirmedAt) || Boolean(data?.user?.emailConfirmed) || Boolean(data?.user?.email);
            if (data?.user && emailVerified && !migratedRef.current) {
                migratedRef.current = true;
                claim();
            }
        }
    }["useUser.useEffect"], [
        data?.user
    ]);
    return {
        user: data?.user ?? null,
        profile: data?.profile ?? null,
        roles: data?.profile?.roles ?? [],
        isLoading,
        isLoggedIn: !!data?.user,
        error,
        mutate,
        refetch: mutate
    };
}
_s(useUser, "kxsgPJu8cCEgP9UkhRfUviWqT/c=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/notifications/NotificationBell.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NotificationBell",
    ()=>NotificationBell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$formatDistanceToNow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/formatDistanceToNow.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$locale$2f$pt$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/locale/pt.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
const fetcher = (url)=>fetch(url).then((r)=>r.json());
const TYPE_LABEL = {
    ORGANIZER_INVITE: "Convite de organização",
    STAFF_INVITE: "Convite de staff",
    EVENT_SALE: "Venda",
    STRIPE_STATUS: "Stripe",
    EVENT_REMINDER: "Lembrete",
    FRIEND_REQUEST: "Pedido de amizade",
    FRIEND_ACCEPT: "Amigo aceitou",
    MARKETING_PROMO_ALERT: "Marketing",
    SYSTEM_ANNOUNCE: "Sistema"
};
function NotificationBell() {
    _s();
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [filter, setFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("all");
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const queryTypes = filter === "sales" ? "EVENT_SALE" : filter === "invites" ? "ORGANIZER_INVITE,STAFF_INVITE" : filter === "system" ? "STRIPE_STATUS,MARKETING_PROMO_ALERT,SYSTEM_ANNOUNCE" : filter === "social" ? "FRIEND_REQUEST,FRIEND_ACCEPT" : undefined;
    const query = user ? `/api/notifications?status=all${queryTypes ? `&types=${encodeURIComponent(queryTypes)}` : ""}` : null;
    const { data, mutate } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(query, fetcher, {
        refreshInterval: 30000,
        revalidateOnFocus: true
    });
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NotificationBell.useMemo[items]": ()=>data?.items ?? []
    }["NotificationBell.useMemo[items]"], [
        data
    ]);
    const unreadCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NotificationBell.useMemo[unreadCount]": ()=>items.filter({
                "NotificationBell.useMemo[unreadCount]": (n)=>n.isRead === false || !n.isRead && !n.readAt
            }["NotificationBell.useMemo[unreadCount]"]).length
    }["NotificationBell.useMemo[unreadCount]"], [
        items
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NotificationBell.useEffect": ()=>{
            const onClick = {
                "NotificationBell.useEffect.onClick": (e)=>{
                    if (panelRef.current && !panelRef.current.contains(e.target)) {
                        setOpen(false);
                    }
                }
            }["NotificationBell.useEffect.onClick"];
            if (open) document.addEventListener("mousedown", onClick);
            return ({
                "NotificationBell.useEffect": ()=>document.removeEventListener("mousedown", onClick)
            })["NotificationBell.useEffect"];
        }
    }["NotificationBell.useEffect"], [
        open
    ]);
    const markAll = async ()=>{
        await fetch("/api/notifications/mark-read", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                markAll: true
            })
        });
        mutate();
    };
    const grouped = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NotificationBell.useMemo[grouped]": ()=>{
            const groups = {};
            for (const n of items){
                const date = new Date(n.createdAt);
                const key = date.toLocaleDateString("pt-PT");
                groups[key] = groups[key] ? [
                    ...groups[key],
                    n
                ] : [
                    n
                ];
            }
            return groups;
        }
    }["NotificationBell.useMemo[grouped]"], [
        items
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setOpen((v)=>!v),
                className: "relative rounded-full border border-white/15 bg-white/5 p-2 text-white/80 hover:bg-white/10 transition",
                "aria-label": "Notificações",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "🔔"
                    }, void 0, false, {
                        fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                        lineNumber: 105,
                        columnNumber: 9
                    }, this),
                    unreadCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "absolute -right-1 -top-1 min-w-[18px] rounded-full bg-emerald-500 px-1 text-[11px] font-semibold text-black text-center",
                        children: unreadCount
                    }, void 0, false, {
                        fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                        lineNumber: 107,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                lineNumber: 99,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: panelRef,
                className: "absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-[#0b0f18]/95 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl p-3 text-white/80 z-50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-2 flex items-center justify-between text-xs",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-semibold text-white",
                                children: "Notificações"
                            }, void 0, false, {
                                fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                lineNumber: 119,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "text-[11px] text-white/60 hover:text-white",
                                onClick: markAll,
                                children: "Marcar todas como lidas"
                            }, void 0, false, {
                                fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                lineNumber: 120,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                        lineNumber: 118,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-3 flex flex-wrap gap-2 text-[11px]",
                        children: [
                            {
                                key: "all",
                                label: "Todas"
                            },
                            {
                                key: "sales",
                                label: "Vendas"
                            },
                            {
                                key: "invites",
                                label: "Convites"
                            },
                            {
                                key: "system",
                                label: "Sistema"
                            },
                            {
                                key: "social",
                                label: "Social"
                            }
                        ].map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setFilter(item.key),
                                className: `rounded-full border px-2.5 py-1 ${filter === item.key ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100" : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"}`,
                                children: item.label
                            }, item.key, false, {
                                fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                lineNumber: 137,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                        lineNumber: 129,
                        columnNumber: 11
                    }, this),
                    items.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-dashed border-white/15 bg-white/5 p-3 text-xs text-white/60",
                        children: "Sem notificações ainda."
                    }, void 0, false, {
                        fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                        lineNumber: 153,
                        columnNumber: 13
                    }, this),
                    Object.entries(grouped).map(([day, list])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mb-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] uppercase tracking-[0.18em] text-white/50 mb-1",
                                    children: day
                                }, void 0, false, {
                                    fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                    lineNumber: 160,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1.5",
                                    children: list.map((n)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: `rounded-xl border px-3 py-2 text-xs ${n.readAt ? "border-white/10 bg-white/3" : "border-emerald-400/30 bg-emerald-500/8"}`,
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center justify-between gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-[11px] text-white/60",
                                                                    children: TYPE_LABEL[n.type] ?? "Atualização"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                                                    lineNumber: 173,
                                                                    columnNumber: 25
                                                                }, this),
                                                                (n.isRead === false || !n.isRead && !n.readAt) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "h-2 w-2 rounded-full bg-emerald-400"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                                                    lineNumber: 177,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                                            lineNumber: 172,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-[11px] text-white/45",
                                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$formatDistanceToNow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDistanceToNow"])(new Date(n.createdAt), {
                                                                locale: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$locale$2f$pt$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pt"],
                                                                addSuffix: true
                                                            })
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                                            lineNumber: 180,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                                    lineNumber: 171,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mt-1 text-[13px] font-semibold text-white",
                                                    children: n.title
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                                    lineNumber: 184,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-white/70",
                                                    children: n.body
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                                    lineNumber: 185,
                                                    columnNumber: 21
                                                }, this),
                                                n.ctaUrl && n.ctaLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: n.ctaUrl,
                                                    className: "mt-2 inline-flex text-[11px] text-[#6BFFFF] hover:underline",
                                                    children: n.ctaLabel
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                                    lineNumber: 187,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, n.id, true, {
                                            fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                            lineNumber: 163,
                                            columnNumber: 19
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                                    lineNumber: 161,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, day, true, {
                            fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                            lineNumber: 159,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/notifications/NotificationBell.tsx",
                lineNumber: 114,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/notifications/NotificationBell.tsx",
        lineNumber: 98,
        columnNumber: 5
    }, this);
}
_s(NotificationBell, "UPhwTjvTmdGK8krENEPkPzT4Lbc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = NotificationBell;
var _c;
__turbopack_context__.k.register(_c, "NotificationBell");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/Navbar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Navbar",
    ()=>Navbar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$notifications$2f$NotificationBell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/notifications/NotificationBell.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseBrowser.ts [app-client] (ecmascript)");
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
function Navbar() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const rawPathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const { openModal: openAuthModal, isOpen: isAuthOpen } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"])();
    const { user, profile, roles, isLoading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const [isVisible, setIsVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [isAtTop, setIsAtTop] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [isSearchOpen, setIsSearchOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [searchQuery, setSearchQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [eventResults, setEventResults] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [organizerResults, setOrganizerResults] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [userResults, setUserResults] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isSuggestLoading, setIsSuggestLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [activeSearchTab, setActiveSearchTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("all");
    const [followPending, setFollowPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [hydratedPathname, setHydratedPathname] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [lastOrganizerUsername, setLastOrganizerUsername] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const profileMenuRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const searchPanelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const lastScrollYRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const pathname = hydratedPathname ?? "";
    const shouldHide = rawPathname?.startsWith("/organizador");
    const Logo = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: ()=>router.push("/"),
            className: "flex items-center gap-2 transition hover:opacity-90",
            "aria-label": "Voltar à homepage ORYA",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                    src: "/brand/orya-logo.png",
                    alt: "Logo ORYA",
                    className: "h-14 w-14 rounded-full object-cover shadow-[0_0_24px_rgba(155,114,255,0.55)]"
                }, void 0, false, {
                    fileName: "[project]/app/components/Navbar.tsx",
                    lineNumber: 77,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "text-lg font-semibold tracking-[0.2em] text-white",
                    children: "ORYA"
                }, void 0, false, {
                    fileName: "[project]/app/components/Navbar.tsx",
                    lineNumber: 82,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/Navbar.tsx",
            lineNumber: 71,
            columnNumber: 5
        }, this);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            // Garantir pathname estável só depois de montar para evitar mismatch
            if ("TURBOPACK compile-time truthy", 1) {
                setHydratedPathname(rawPathname ?? window.location.pathname);
            }
        }
    }["Navbar.useEffect"], [
        rawPathname
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if (typeof document === "undefined") return;
            if (shouldHide) {
                document.body.dataset.navHidden = "true";
            } else {
                delete document.body.dataset.navHidden;
            }
        }
    }["Navbar.useEffect"], [
        shouldHide
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const handleScroll = {
                "Navbar.useEffect.handleScroll": ()=>{
                    const currentY = window.scrollY || 0;
                    const atTop = currentY < 12;
                    setIsAtTop({
                        "Navbar.useEffect.handleScroll": (prev)=>prev === atTop ? prev : atTop
                    }["Navbar.useEffect.handleScroll"]);
                    const prevY = lastScrollYRef.current;
                    if (atTop) {
                        // No topo: navbar sempre visível
                        setIsVisible(true);
                    } else {
                        // A descer esconde, a subir mostra
                        if (currentY > prevY + 12) {
                            setIsVisible(false);
                        } else if (currentY < prevY - 12) {
                            setIsVisible(true);
                        }
                    }
                    lastScrollYRef.current = currentY;
                }
            }["Navbar.useEffect.handleScroll"];
            // Inicializa logo o estado correto com a posição atual do scroll
            handleScroll();
            window.addEventListener("scroll", handleScroll, {
                passive: true
            });
            return ({
                "Navbar.useEffect": ()=>{
                    window.removeEventListener("scroll", handleScroll);
                }
            })["Navbar.useEffect"];
        }
    }["Navbar.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if (typeof document === "undefined") return;
            const originalOverflow = document.body.style.overflow;
            if (isSearchOpen) {
                document.body.style.overflow = "hidden";
            } else {
                document.body.style.overflow = originalOverflow;
            }
            return ({
                "Navbar.useEffect": ()=>{
                    document.body.style.overflow = originalOverflow;
                }
            })["Navbar.useEffect"];
        }
    }["Navbar.useEffect"], [
        isSearchOpen
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if (isSearchOpen) {
                setActiveSearchTab("all");
            }
        }
    }["Navbar.useEffect"], [
        isSearchOpen
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if (typeof document === "undefined") return;
            const handleClickOutside = {
                "Navbar.useEffect.handleClickOutside": (event)=>{
                    if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                        setIsProfileMenuOpen(false);
                    }
                }
            }["Navbar.useEffect.handleClickOutside"];
            const handleKeyDown = {
                "Navbar.useEffect.handleKeyDown": (event)=>{
                    if (event.key === "Escape") {
                        setIsSearchOpen(false);
                        setIsProfileMenuOpen(false);
                    }
                }
            }["Navbar.useEffect.handleKeyDown"];
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
            return ({
                "Navbar.useEffect": ()=>{
                    document.removeEventListener("mousedown", handleClickOutside);
                    document.removeEventListener("keydown", handleKeyDown);
                }
            })["Navbar.useEffect"];
        }
    }["Navbar.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if (!isSearchOpen) return;
            const handleGlobalClick = {
                "Navbar.useEffect.handleGlobalClick": (event)=>{
                    const target = event.target;
                    if (searchPanelRef.current && target && !searchPanelRef.current.contains(target)) {
                        setIsSearchOpen(false);
                    }
                }
            }["Navbar.useEffect.handleGlobalClick"];
            document.addEventListener("mousedown", handleGlobalClick, true);
            return ({
                "Navbar.useEffect": ()=>document.removeEventListener("mousedown", handleGlobalClick, true)
            })["Navbar.useEffect"];
        }
    }["Navbar.useEffect"], [
        isSearchOpen
    ]);
    const inAuthPage = pathname === "/login" || pathname === "/signup" || pathname === "/auth/callback";
    const handleSubmitSearch = (e)=>{
        e.preventDefault();
        const query = searchQuery.trim();
        if (!query) return;
        setIsSearchOpen(false);
        router.push(`/explorar?query=${encodeURIComponent(query)}`);
    };
    const handleQuickSearch = (value)=>{
        setIsSearchOpen(false);
        router.push(`/explorar?query=${encodeURIComponent(value)}`);
    };
    const handleLogout = async ()=>{
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.signOut();
        } catch (err) {
            console.warn("[navbar] signOut falhou", err);
        } finally{
            setIsProfileMenuOpen(false);
            router.push("/");
            router.refresh();
        }
    };
    const buildEventHref = (slug)=>`/eventos/${slug}`;
    const buildProfileHref = (username)=>username ? `/${username}` : "/me";
    // Sugestões ao digitar (tipo DICE)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            let active = true;
            const controller = new AbortController();
            async function load() {
                const q = searchQuery.trim();
                if (q.length < 1) {
                    setEventResults([]);
                    setOrganizerResults([]);
                    setUserResults([]);
                    setIsSuggestLoading(false);
                    return;
                }
                try {
                    setIsSuggestLoading(true);
                    const query = encodeURIComponent(q);
                    const [eventsData, usersData, organizersData] = await Promise.all([
                        fetch(`/api/explorar/list?q=${query}&limit=6`, {
                            cache: "no-store",
                            signal: controller.signal
                        }).then({
                            "Navbar.useEffect.load": (res)=>res.ok ? res.json() : null
                        }["Navbar.useEffect.load"]).catch({
                            "Navbar.useEffect.load": ()=>null
                        }["Navbar.useEffect.load"]),
                        fetch(`/api/users/search?q=${query}&limit=6`, {
                            cache: "no-store",
                            signal: controller.signal
                        }).then({
                            "Navbar.useEffect.load": (res)=>res.ok ? res.json() : null
                        }["Navbar.useEffect.load"]).catch({
                            "Navbar.useEffect.load": ()=>null
                        }["Navbar.useEffect.load"]),
                        fetch(`/api/organizers/search?q=${query}&limit=6`, {
                            cache: "no-store",
                            signal: controller.signal
                        }).then({
                            "Navbar.useEffect.load": (res)=>res.ok ? res.json() : null
                        }["Navbar.useEffect.load"]).catch({
                            "Navbar.useEffect.load": ()=>null
                        }["Navbar.useEffect.load"])
                    ]);
                    if (!active) return;
                    const eventItems = Array.isArray(eventsData?.items) ? eventsData.items : [];
                    const userItems = Array.isArray(usersData?.results) ? usersData.results : [];
                    const organizerItems = Array.isArray(organizersData?.results) ? organizersData.results : [];
                    setEventResults(eventItems.map({
                        "Navbar.useEffect.load": (it)=>({
                                id: it.id,
                                slug: it.slug,
                                title: it.title,
                                startsAt: it.startsAt ?? null,
                                locationName: it.location?.name ?? null,
                                locationCity: it.location?.city ?? null,
                                coverImageUrl: it.coverImageUrl ?? null,
                                priceFrom: typeof it.priceFrom === "number" ? it.priceFrom : null,
                                isFree: Boolean(it.isFree)
                            })
                    }["Navbar.useEffect.load"]));
                    setUserResults(userItems);
                    setOrganizerResults(organizerItems);
                } catch (err) {
                    if (err instanceof DOMException && err.name === "AbortError") return;
                    if (active) {
                        setEventResults([]);
                        setOrganizerResults([]);
                        setUserResults([]);
                    }
                } finally{
                    if (active) setIsSuggestLoading(false);
                }
            }
            const handle = setTimeout(load, 220);
            return ({
                "Navbar.useEffect": ()=>{
                    active = false;
                    controller.abort();
                    clearTimeout(handle);
                }
            })["Navbar.useEffect"];
        }
    }["Navbar.useEffect"], [
        searchQuery
    ]);
    // Forçar onboarding: se autenticado e perfil incompleto, abre modal e impede fechar
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            if (user && profile && !profile.onboardingDone && !isAuthOpen && !inAuthPage) {
                openAuthModal({
                    mode: "onboarding",
                    redirectTo: pathname || "/"
                });
            }
        }
    }["Navbar.useEffect"], [
        user,
        profile,
        pathname,
        openAuthModal,
        isAuthOpen,
        inAuthPage
    ]);
    const isAuthenticated = !!user;
    const userLabel = profile?.username || profile?.fullName || (typeof user?.email === "string" ? user.email : "");
    const userInitial = (userLabel || "O").trim().charAt(0).toUpperCase() || "O";
    const formatEventDate = (startsAt)=>startsAt ? new Date(startsAt).toLocaleString("pt-PT", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        }) : "Data a anunciar";
    const hasResults = eventResults.length > 0 || organizerResults.length > 0 || userResults.length > 0;
    const normalizedQuery = searchQuery.trim();
    const hasActiveQuery = normalizedQuery.length >= 1;
    const setFollowPendingFlag = (key, value)=>{
        setFollowPending((prev)=>({
                ...prev,
                [key]: value
            }));
    };
    const updateUserFollowState = (targetId, next)=>{
        setUserResults((prev)=>prev.map((item)=>item.id === targetId ? {
                    ...item,
                    isFollowing: next
                } : item));
    };
    const updateOrganizerFollowState = (targetId, next)=>{
        setOrganizerResults((prev)=>prev.map((item)=>item.id === targetId ? {
                    ...item,
                    isFollowing: next
                } : item));
    };
    const ensureAuthForFollow = ()=>{
        if (isAuthenticated) return true;
        const redirect = pathname && pathname !== "/" ? pathname : "/";
        openAuthModal({
            mode: "login",
            redirectTo: redirect
        });
        return false;
    };
    const toggleUserFollow = async (targetId, next)=>{
        if (!ensureAuthForFollow()) return;
        const key = `user_${targetId}`;
        setFollowPendingFlag(key, true);
        updateUserFollowState(targetId, next);
        try {
            const res = await fetch(next ? "/api/social/follow" : "/api/social/unfollow", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    targetUserId: targetId
                })
            });
            if (!res.ok) {
                updateUserFollowState(targetId, !next);
            }
        } catch  {
            updateUserFollowState(targetId, !next);
        } finally{
            setFollowPendingFlag(key, false);
        }
    };
    const toggleOrganizerFollow = async (targetId, next)=>{
        if (!ensureAuthForFollow()) return;
        const key = `org_${targetId}`;
        setFollowPendingFlag(key, true);
        updateOrganizerFollowState(targetId, next);
        try {
            const res = await fetch(next ? "/api/social/follow-organizer" : "/api/social/unfollow-organizer", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    organizerId: targetId
                })
            });
            if (!res.ok) {
                updateOrganizerFollowState(targetId, !next);
            }
        } catch  {
            updateOrganizerFollowState(targetId, !next);
        } finally{
            setFollowPendingFlag(key, false);
        }
    };
    const goTo = (href)=>{
        setIsSearchOpen(false);
        router.push(href);
    };
    const searchTabs = [
        {
            key: "all",
            label: "Global"
        },
        {
            key: "events",
            label: "Eventos"
        },
        {
            key: "organizers",
            label: "Organizadores"
        },
        {
            key: "users",
            label: "Utilizadores"
        }
    ];
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Navbar.useEffect": ()=>{
            try {
                const stored = sessionStorage.getItem("orya_last_organizer_username");
                if (stored) setLastOrganizerUsername(stored);
            } catch  {
            // ignore storage issues
            }
        }
    }["Navbar.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: `fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${isVisible ? "translate-y-0" : "-translate-y-full"} ${shouldHide ? "hidden" : ""}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `relative flex w-full items-center gap-4 rounded-b-[28px] border-b px-4 py-4 transition-all duration-300 md:px-6 md:py-5 lg:px-8 ${isAtTop ? "border-transparent bg-transparent shadow-none backdrop-blur-[6px]" : "border-white/10 bg-[linear-gradient(120deg,rgba(8,10,20,0.38),rgba(8,10,20,0.52))] shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-[18px]"}`,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-1 items-center gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Logo, {}, void 0, false, {
                                    fileName: "[project]/app/components/Navbar.tsx",
                                    lineNumber: 470,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                                    className: "hidden items-center gap-3 text-xs text-zinc-300 md:flex",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>router.push("/explorar"),
                                            className: `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${pathname?.startsWith("/explorar") ? "bg-[linear-gradient(120deg,rgba(255,0,200,0.22),rgba(107,255,255,0.18))] text-white border border-white/30 shadow-[0_0_18px_rgba(107,255,255,0.35)]" : "text-white/85 hover:text-white bg-white/5 border border-white/16 hover:border-white/26"}`,
                                            children: "Explorar"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/Navbar.tsx",
                                            lineNumber: 473,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>router.push("/organizador"),
                                            className: `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${pathname?.startsWith("/organizador") ? "bg-[linear-gradient(120deg,rgba(107,255,255,0.18),rgba(22,70,245,0.22))] text-white border border-white/28 shadow-[0_0_18px_rgba(22,70,245,0.28)]" : "text-white/85 hover:text-white bg-white/5 border border-white/16 hover:border-white/26"}`,
                                            children: "Organizar"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/Navbar.tsx",
                                            lineNumber: 484,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/Navbar.tsx",
                                    lineNumber: 472,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/Navbar.tsx",
                            lineNumber: 469,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "hidden md:flex flex-[1.2] justify-center",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setIsSearchOpen(true),
                                className: "group relative flex w-full max-w-xl items-center gap-3 rounded-full border border-white/16 bg-[linear-gradient(120deg,rgba(255,0,200,0.1),rgba(107,255,255,0.1)),rgba(5,6,12,0.82)] px-4 py-2 text-left text-[13px] text-white hover:border-white/35 hover:shadow-[0_0_35px_rgba(107,255,255,0.28)] transition shadow-[0_26px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "flex h-5 w-5 items-center justify-center rounded-full border border-white/30 text-[10px] text-white/70",
                                        children: "⌕"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/Navbar.tsx",
                                        lineNumber: 505,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "flex-1 truncate text-[12px]",
                                        children: "Procurar por evento, local ou cidade"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/Navbar.tsx",
                                        lineNumber: 508,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "hidden rounded-full border border-white/20 px-2.5 py-1 text-[10px] text-white/50 md:inline",
                                        children: "Pesquisar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/Navbar.tsx",
                                        lineNumber: 511,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/Navbar.tsx",
                                lineNumber: 500,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/components/Navbar.tsx",
                            lineNumber: 499,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-1 items-center justify-end gap-2 md:gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>router.push("/organizador"),
                                    className: "inline-flex md:hidden items-center rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 hover:border-white/28 hover:bg-white/16 transition",
                                    children: "Organizar"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/Navbar.tsx",
                                    lineNumber: 520,
                                    columnNumber: 13
                                }, this),
                                isLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60 animate-pulse",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "h-7 w-7 rounded-full bg-white/20"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/Navbar.tsx",
                                            lineNumber: 529,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "h-3 w-20 rounded-full bg-white/15"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/Navbar.tsx",
                                            lineNumber: 530,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/Navbar.tsx",
                                    lineNumber: 528,
                                    columnNumber: 15
                                }, this) : !isAuthenticated || inAuthPage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>{
                                        const redirect = pathname && pathname !== "/" ? pathname : "/";
                                        openAuthModal({
                                            mode: "login",
                                            redirectTo: redirect
                                        });
                                    },
                                    className: "inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3.5 py-1.5 text-[11px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.65)] hover:brightness-110",
                                    children: "Entrar / Registar"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/Navbar.tsx",
                                    lineNumber: 533,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative flex items-center gap-2",
                                    ref: profileMenuRef,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$notifications$2f$NotificationBell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NotificationBell"], {}, void 0, false, {
                                            fileName: "[project]/app/components/Navbar.tsx",
                                            lineNumber: 545,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setIsProfileMenuOpen((open)=>!open),
                                            className: "flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-2.5 py-1 text-[11px] text-white/90 hover:border-white/28 hover:bg-white/12 shadow-[0_0_22px_rgba(255,0,200,0.22)] transition",
                                            "aria-haspopup": "menu",
                                            "aria-expanded": isProfileMenuOpen,
                                            "aria-label": "Abrir menu de conta",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "relative h-9 w-9",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "absolute inset-[-3px] rounded-full bg-[conic-gradient(from_180deg,#ff00c8_0deg,#ff5afc_120deg,#6b7bff_240deg,#ff00c8_360deg)] opacity-85 blur-[8px]"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                            lineNumber: 555,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "relative h-full w-full overflow-hidden rounded-full border border-white/20 bg-gradient-to-br from-[#0b0f1b] via-[#0f1222] to-[#0a0d18] text-[11px] font-bold text-white shadow-[0_0_22px_rgba(255,0,200,0.32)]",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "pointer-events-none absolute inset-0 rounded-full border border-white/10"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                    lineNumber: 557,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF00C8]/35 via-[#6BFFFF]/22 to-transparent animate-[spin_16s_linear_infinite]"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                    lineNumber: 558,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "relative z-10 flex h-full w-full items-center justify-center bg-gradient-to-r from-[#FF9CF2] to-[#6BFFFF] bg-clip-text text-transparent",
                                                                    children: userInitial
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                    lineNumber: 559,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                            lineNumber: 556,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 554,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "hidden max-w-[120px] truncate text-[11px] sm:inline",
                                                    children: userLabel || "Conta ORYA"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 564,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/Navbar.tsx",
                                            lineNumber: 546,
                                            columnNumber: 17
                                        }, this),
                                        isProfileMenuOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "absolute right-0 top-full mt-3 w-60 origin-top-right rounded-2xl border border-white/16 bg-[linear-gradient(135deg,rgba(3,4,10,0.97),rgba(8,10,18,0.98))] p-2 text-[11px] text-white/90 shadow-[0_28px_80px_rgba(0,0,0,0.88)] backdrop-blur-3xl",
                                            role: "menu",
                                            "aria-label": "Menu de conta ORYA",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/me",
                                                    onClick: ()=>setIsProfileMenuOpen(false),
                                                    className: "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "font-semibold text-white",
                                                        children: "Minha conta"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 580,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 575,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/me/carteira",
                                                    onClick: ()=>setIsProfileMenuOpen(false),
                                                    className: "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Carteira"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 587,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 582,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/me/compras",
                                                    onClick: ()=>setIsProfileMenuOpen(false),
                                                    className: "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Compras"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 594,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 589,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/me/settings",
                                                    onClick: ()=>setIsProfileMenuOpen(false),
                                                    className: "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Definições"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 601,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 596,
                                                    columnNumber: 21
                                                }, this),
                                                lastOrganizerUsername && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: `/${lastOrganizerUsername}`,
                                                    onClick: ()=>setIsProfileMenuOpen(false),
                                                    className: "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Ver página pública"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 609,
                                                        columnNumber: 25
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 604,
                                                    columnNumber: 23
                                                }, this),
                                                pathname?.startsWith("/organizador") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/me",
                                                    onClick: ()=>setIsProfileMenuOpen(false),
                                                    className: "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/8",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Voltar a utilizador"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 618,
                                                        columnNumber: 25
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 613,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "my-1 h-px w-full bg-white/10"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 622,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: handleLogout,
                                                    className: "mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-left font-semibold text-red-100 hover:bg-white/15",
                                                    children: "Terminar sessão"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                    lineNumber: 623,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/Navbar.tsx",
                                            lineNumber: 570,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/Navbar.tsx",
                                    lineNumber: 544,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/Navbar.tsx",
                            lineNumber: 518,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/Navbar.tsx",
                    lineNumber: 461,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/components/Navbar.tsx",
                lineNumber: 456,
                columnNumber: 7
            }, this),
            isSearchOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-40 bg-black/25 backdrop-blur-[28px] backdrop-saturate-150",
                role: "dialog",
                "aria-modal": "true",
                onClick: (e)=>{
                    if (e.target === e.currentTarget) {
                        setIsSearchOpen(false);
                    }
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    ref: searchPanelRef,
                    className: "mx-auto mt-24 md:mt-28 max-w-3xl px-4",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-3xl border border-white/14 bg-[radial-gradient(circle_at_12%_0%,rgba(255,0,200,0.14),transparent_40%),radial-gradient(circle_at_88%_0%,rgba(107,255,255,0.16),transparent_36%),linear-gradient(120deg,rgba(8,10,20,0.75),rgba(8,10,20,0.58),rgba(8,10,20,0.7))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.75)] backdrop-blur-2xl",
                        "aria-label": "Pesquisa de eventos ORYA",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                onSubmit: handleSubmitSearch,
                                className: "flex items-center gap-3 rounded-2xl border border-white/16 bg-[linear-gradient(120deg,rgba(255,0,200,0.08),rgba(107,255,255,0.08)),rgba(8,10,20,0.22)] px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-[12px] text-white/80",
                                        children: "⌕"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/Navbar.tsx",
                                        lineNumber: 658,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        value: searchQuery,
                                        onChange: (e)=>setSearchQuery(e.target.value),
                                        placeholder: "O que queres fazer hoje?",
                                        className: "flex-1 bg-transparent text-base text-white placeholder:text-white/65 focus:outline-none",
                                        autoFocus: true
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/Navbar.tsx",
                                        lineNumber: 661,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setIsSearchOpen(false),
                                        className: "text-[11px] text-white/60 hover:text-white",
                                        children: "Fechar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/Navbar.tsx",
                                        lineNumber: 668,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/Navbar.tsx",
                                lineNumber: 654,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center gap-2 rounded-full border border-white/12 bg-white/5 p-1 text-[11px] text-white/70",
                                        role: "tablist",
                                        "aria-label": "Resultados da pesquisa",
                                        children: searchTabs.map((tab)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>setActiveSearchTab(tab.key),
                                                role: "tab",
                                                "aria-selected": activeSearchTab === tab.key,
                                                className: `rounded-full px-3 py-1.5 font-semibold transition ${activeSearchTab === tab.key ? "bg-white/15 text-white shadow-[0_0_18px_rgba(255,255,255,0.15)]" : "text-white/70 hover:text-white hover:bg-white/10"}`,
                                                children: tab.label
                                            }, tab.key, false, {
                                                fileName: "[project]/app/components/Navbar.tsx",
                                                lineNumber: 684,
                                                columnNumber: 21
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/Navbar.tsx",
                                        lineNumber: 678,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-4 rounded-2xl border border-white/12 bg-[linear-gradient(140deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between text-[11px] text-white/75",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Resultados"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 703,
                                                        columnNumber: 21
                                                    }, this),
                                                    isSuggestLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "animate-pulse text-white/65",
                                                        children: "a carregar…"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 705,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/Navbar.tsx",
                                                lineNumber: 702,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 max-h-[60vh] space-y-4 overflow-y-auto pr-1",
                                                children: [
                                                    !hasActiveQuery && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] text-white/70",
                                                        children: "Começa a escrever para veres eventos, organizadores e utilizadores."
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 711,
                                                        columnNumber: 23
                                                    }, this),
                                                    hasActiveQuery && !isSuggestLoading && !hasResults && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] text-white/70",
                                                        children: [
                                                            "Sem resultados para “",
                                                            normalizedQuery,
                                                            "”."
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 717,
                                                        columnNumber: 23
                                                    }, this),
                                                    hasActiveQuery && activeSearchTab === "all" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-4",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "rounded-2xl border border-white/10 bg-white/5 p-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center justify-between text-[11px] text-white/75",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: "Eventos"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 726,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            eventResults.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                type: "button",
                                                                                onClick: ()=>setActiveSearchTab("events"),
                                                                                className: "rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10",
                                                                                children: "Ver tudo"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 728,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                        lineNumber: 725,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "mt-2 space-y-2",
                                                                        children: [
                                                                            eventResults.slice(0, 3).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                    type: "button",
                                                                                    onClick: ()=>goTo(buildEventHref(item.slug)),
                                                                                    className: "w-full rounded-xl border border-white/12 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(8,10,22,0.7))] p-2.5 text-left hover:border-white/20 hover:bg-white/8 transition flex gap-3",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                            className: "h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]",
                                                                                            children: item.coverImageUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                                src: item.coverImageUrl,
                                                                                                alt: item.title,
                                                                                                className: "h-full w-full object-cover"
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                                lineNumber: 748,
                                                                                                columnNumber: 37
                                                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                className: "flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55",
                                                                                                children: "ORYA"
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                                lineNumber: 754,
                                                                                                columnNumber: 37
                                                                                            }, this)
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 745,
                                                                                            columnNumber: 33
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                            className: "flex-1 min-w-0",
                                                                                            children: [
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                    className: "text-[12px] font-semibold text-white line-clamp-1",
                                                                                                    children: item.title
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 760,
                                                                                                    columnNumber: 35
                                                                                                }, this),
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                    className: "text-[10px] text-white/80 line-clamp-1",
                                                                                                    children: item.locationName || item.locationCity || "Local a anunciar"
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 763,
                                                                                                    columnNumber: 35
                                                                                                }, this),
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                    className: "text-[10px] text-white/70",
                                                                                                    children: formatEventDate(item.startsAt)
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 766,
                                                                                                    columnNumber: 35
                                                                                                }, this)
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 759,
                                                                                            columnNumber: 33
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                            className: "flex flex-col items-end gap-1 text-[10px] text-white/70",
                                                                                            children: [
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                    children: item.isFree ? "Grátis" : item.priceFrom !== null ? `Desde ${item.priceFrom.toFixed(2)} €` : "Preço a anunciar"
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 771,
                                                                                                    columnNumber: 35
                                                                                                }, this),
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                    className: "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/85",
                                                                                                    children: "Ver"
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 778,
                                                                                                    columnNumber: 35
                                                                                                }, this)
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 770,
                                                                                            columnNumber: 33
                                                                                        }, this)
                                                                                    ]
                                                                                }, `event-${item.id}`, true, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 739,
                                                                                    columnNumber: 31
                                                                                }, this)),
                                                                            eventResults.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                className: "text-[11px] text-white/60",
                                                                                children: "Nenhum evento encontrado."
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 785,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                        lineNumber: 737,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                lineNumber: 724,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "rounded-2xl border border-white/10 bg-white/5 p-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center justify-between text-[11px] text-white/75",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: "Organizadores"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 792,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            organizerResults.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                type: "button",
                                                                                onClick: ()=>setActiveSearchTab("organizers"),
                                                                                className: "rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10",
                                                                                children: "Ver tudo"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 794,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                        lineNumber: 791,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "mt-2 space-y-2",
                                                                        children: [
                                                                            organizerResults.slice(0, 3).map((item)=>{
                                                                                const isFollowing = Boolean(item.isFollowing);
                                                                                const pending = followPending[`org_${item.id}`];
                                                                                const displayName = item.publicName?.trim() || item.businessName?.trim() || item.username || "Organizador ORYA";
                                                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "flex items-center gap-3 rounded-xl border border-white/12 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(8,10,22,0.7))] p-2.5",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                            type: "button",
                                                                                            onClick: ()=>goTo(buildProfileHref(item.username)),
                                                                                            className: "flex flex-1 items-center gap-3 text-left",
                                                                                            children: [
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                    className: "h-12 w-12 overflow-hidden rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]",
                                                                                                    children: item.brandingAvatarUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                                        src: item.brandingAvatarUrl,
                                                                                                        alt: displayName,
                                                                                                        className: "h-full w-full object-cover"
                                                                                                    }, void 0, false, {
                                                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                                                        lineNumber: 825,
                                                                                                        columnNumber: 41
                                                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                        className: "flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55",
                                                                                                        children: "ORYA"
                                                                                                    }, void 0, false, {
                                                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                                                        lineNumber: 831,
                                                                                                        columnNumber: 41
                                                                                                    }, this)
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 822,
                                                                                                    columnNumber: 37
                                                                                                }, this),
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                    className: "min-w-0",
                                                                                                    children: [
                                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                            className: "text-[12px] font-semibold text-white line-clamp-1",
                                                                                                            children: displayName
                                                                                                        }, void 0, false, {
                                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                                            lineNumber: 837,
                                                                                                            columnNumber: 39
                                                                                                        }, this),
                                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                            className: "text-[10px] text-white/70 line-clamp-1",
                                                                                                            children: item.username ? `@${item.username}` : item.city || "Organizador"
                                                                                                        }, void 0, false, {
                                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                                            lineNumber: 840,
                                                                                                            columnNumber: 39
                                                                                                        }, this)
                                                                                                    ]
                                                                                                }, void 0, true, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 836,
                                                                                                    columnNumber: 37
                                                                                                }, this)
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 817,
                                                                                            columnNumber: 35
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                            type: "button",
                                                                                            disabled: pending,
                                                                                            onClick: ()=>toggleOrganizerFollow(item.id, !isFollowing),
                                                                                            className: `rounded-full px-3 py-1 text-[10px] font-semibold transition ${isFollowing ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"} ${pending ? "opacity-60" : ""}`,
                                                                                            children: pending ? "…" : isFollowing ? "A seguir" : "Seguir"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 845,
                                                                                            columnNumber: 35
                                                                                        }, this)
                                                                                    ]
                                                                                }, `org-${item.id}`, true, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 813,
                                                                                    columnNumber: 33
                                                                                }, this);
                                                                            }),
                                                                            organizerResults.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                className: "text-[11px] text-white/60",
                                                                                children: "Nenhum organizador encontrado."
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 861,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                        lineNumber: 803,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                lineNumber: 790,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "rounded-2xl border border-white/10 bg-white/5 p-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center justify-between text-[11px] text-white/75",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: "Utilizadores"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 868,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            userResults.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                type: "button",
                                                                                onClick: ()=>setActiveSearchTab("users"),
                                                                                className: "rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10",
                                                                                children: "Ver tudo"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 870,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                        lineNumber: 867,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "mt-2 space-y-2",
                                                                        children: [
                                                                            userResults.slice(0, 3).map((item)=>{
                                                                                const isFollowing = Boolean(item.isFollowing);
                                                                                const pending = followPending[`user_${item.id}`];
                                                                                const displayName = item.fullName?.trim() || item.username || "Utilizador ORYA";
                                                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "flex items-center gap-3 rounded-xl border border-white/12 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(8,10,22,0.7))] p-2.5",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                            type: "button",
                                                                                            onClick: ()=>goTo(buildProfileHref(item.username)),
                                                                                            className: "flex flex-1 items-center gap-3 text-left",
                                                                                            children: [
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                    className: "h-12 w-12 overflow-hidden rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]",
                                                                                                    children: item.avatarUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                                        src: item.avatarUrl,
                                                                                                        alt: displayName,
                                                                                                        className: "h-full w-full object-cover"
                                                                                                    }, void 0, false, {
                                                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                                                        lineNumber: 898,
                                                                                                        columnNumber: 41
                                                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                        className: "flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55",
                                                                                                        children: "ORYA"
                                                                                                    }, void 0, false, {
                                                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                                                        lineNumber: 904,
                                                                                                        columnNumber: 41
                                                                                                    }, this)
                                                                                                }, void 0, false, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 895,
                                                                                                    columnNumber: 37
                                                                                                }, this),
                                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                    className: "min-w-0",
                                                                                                    children: [
                                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                            className: "text-[12px] font-semibold text-white line-clamp-1",
                                                                                                            children: displayName
                                                                                                        }, void 0, false, {
                                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                                            lineNumber: 910,
                                                                                                            columnNumber: 39
                                                                                                        }, this),
                                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                                            className: "text-[10px] text-white/70 line-clamp-1",
                                                                                                            children: item.username ? `@${item.username}` : "Utilizador"
                                                                                                        }, void 0, false, {
                                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                                            lineNumber: 913,
                                                                                                            columnNumber: 39
                                                                                                        }, this)
                                                                                                    ]
                                                                                                }, void 0, true, {
                                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                                    lineNumber: 909,
                                                                                                    columnNumber: 37
                                                                                                }, this)
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 890,
                                                                                            columnNumber: 35
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                            type: "button",
                                                                                            disabled: pending,
                                                                                            onClick: ()=>toggleUserFollow(item.id, !isFollowing),
                                                                                            className: `rounded-full px-3 py-1 text-[10px] font-semibold transition ${isFollowing ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"} ${pending ? "opacity-60" : ""}`,
                                                                                            children: pending ? "…" : isFollowing ? "A seguir" : "Seguir"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 918,
                                                                                            columnNumber: 35
                                                                                        }, this)
                                                                                    ]
                                                                                }, `user-${item.id}`, true, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 886,
                                                                                    columnNumber: 33
                                                                                }, this);
                                                                            }),
                                                                            userResults.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                className: "text-[11px] text-white/60",
                                                                                children: "Nenhum utilizador encontrado."
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 934,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                        lineNumber: 879,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                lineNumber: 866,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 723,
                                                        columnNumber: 23
                                                    }, this),
                                                    hasActiveQuery && activeSearchTab === "events" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2",
                                                        children: [
                                                            eventResults.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>goTo(buildEventHref(item.slug)),
                                                                    className: "w-full rounded-xl border border-white/12 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(8,10,22,0.7))] p-2.5 text-left hover:border-white/20 hover:bg-white/8 transition flex gap-3",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]",
                                                                            children: item.coverImageUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                src: item.coverImageUrl,
                                                                                alt: item.title,
                                                                                className: "h-full w-full object-cover"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 953,
                                                                                columnNumber: 33
                                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55",
                                                                                children: "ORYA"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                                lineNumber: 959,
                                                                                columnNumber: 33
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                            lineNumber: 950,
                                                                            columnNumber: 29
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex-1 min-w-0",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-[12px] font-semibold text-white line-clamp-1",
                                                                                    children: item.title
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 965,
                                                                                    columnNumber: 31
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-[10px] text-white/80 line-clamp-1",
                                                                                    children: item.locationName || item.locationCity || "Local a anunciar"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 968,
                                                                                    columnNumber: 31
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-[10px] text-white/70",
                                                                                    children: formatEventDate(item.startsAt)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 971,
                                                                                    columnNumber: 31
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                            lineNumber: 964,
                                                                            columnNumber: 29
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex flex-col items-end gap-1 text-[10px] text-white/70",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    children: item.isFree ? "Grátis" : item.priceFrom !== null ? `Desde ${item.priceFrom.toFixed(2)} €` : "Preço a anunciar"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 976,
                                                                                    columnNumber: 31
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/85",
                                                                                    children: "Ver"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 983,
                                                                                    columnNumber: 31
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                            lineNumber: 975,
                                                                            columnNumber: 29
                                                                        }, this)
                                                                    ]
                                                                }, `event-tab-${item.id}`, true, {
                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                    lineNumber: 944,
                                                                    columnNumber: 27
                                                                }, this)),
                                                            eventResults.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] text-white/60",
                                                                children: "Nenhum evento encontrado."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                lineNumber: 990,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 942,
                                                        columnNumber: 23
                                                    }, this),
                                                    hasActiveQuery && activeSearchTab === "organizers" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2",
                                                        children: [
                                                            organizerResults.map((item)=>{
                                                                const isFollowing = Boolean(item.isFollowing);
                                                                const pending = followPending[`org_${item.id}`];
                                                                const displayName = item.publicName?.trim() || item.businessName?.trim() || item.username || "Organizador ORYA";
                                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-3 rounded-xl border border-white/12 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(8,10,22,0.7))] p-2.5",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>goTo(buildProfileHref(item.username)),
                                                                            className: "flex flex-1 items-center gap-3 text-left",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "h-12 w-12 overflow-hidden rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]",
                                                                                    children: item.brandingAvatarUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                        src: item.brandingAvatarUrl,
                                                                                        alt: displayName,
                                                                                        className: "h-full w-full object-cover"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                                        lineNumber: 1018,
                                                                                        columnNumber: 37
                                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        className: "flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55",
                                                                                        children: "ORYA"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                                        lineNumber: 1024,
                                                                                        columnNumber: 37
                                                                                    }, this)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 1015,
                                                                                    columnNumber: 33
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "min-w-0",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "text-[12px] font-semibold text-white line-clamp-1",
                                                                                            children: displayName
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 1030,
                                                                                            columnNumber: 35
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "text-[10px] text-white/70 line-clamp-1",
                                                                                            children: item.username ? `@${item.username}` : item.city || "Organizador"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 1033,
                                                                                            columnNumber: 35
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 1029,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                            lineNumber: 1010,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            disabled: pending,
                                                                            onClick: ()=>toggleOrganizerFollow(item.id, !isFollowing),
                                                                            className: `rounded-full px-3 py-1 text-[10px] font-semibold transition ${isFollowing ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"} ${pending ? "opacity-60" : ""}`,
                                                                            children: pending ? "…" : isFollowing ? "A seguir" : "Seguir"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                            lineNumber: 1038,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, `org-tab-${item.id}`, true, {
                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                    lineNumber: 1006,
                                                                    columnNumber: 29
                                                                }, this);
                                                            }),
                                                            organizerResults.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] text-white/60",
                                                                children: "Nenhum organizador encontrado."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                lineNumber: 1054,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 996,
                                                        columnNumber: 23
                                                    }, this),
                                                    hasActiveQuery && activeSearchTab === "users" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2",
                                                        children: [
                                                            userResults.map((item)=>{
                                                                const isFollowing = Boolean(item.isFollowing);
                                                                const pending = followPending[`user_${item.id}`];
                                                                const displayName = item.fullName?.trim() || item.username || "Utilizador ORYA";
                                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-3 rounded-xl border border-white/12 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(8,10,22,0.7))] p-2.5",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>goTo(buildProfileHref(item.username)),
                                                                            className: "flex flex-1 items-center gap-3 text-left",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "h-12 w-12 overflow-hidden rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]",
                                                                                    children: item.avatarUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                        src: item.avatarUrl,
                                                                                        alt: displayName,
                                                                                        className: "h-full w-full object-cover"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                                        lineNumber: 1079,
                                                                                        columnNumber: 37
                                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        className: "flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55",
                                                                                        children: "ORYA"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                                                        lineNumber: 1085,
                                                                                        columnNumber: 37
                                                                                    }, this)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 1076,
                                                                                    columnNumber: 33
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "min-w-0",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "text-[12px] font-semibold text-white line-clamp-1",
                                                                                            children: displayName
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 1091,
                                                                                            columnNumber: 35
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "text-[10px] text-white/70 line-clamp-1",
                                                                                            children: item.username ? `@${item.username}` : "Utilizador"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                                            lineNumber: 1094,
                                                                                            columnNumber: 35
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                                    lineNumber: 1090,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                            lineNumber: 1071,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            disabled: pending,
                                                                            onClick: ()=>toggleUserFollow(item.id, !isFollowing),
                                                                            className: `rounded-full px-3 py-1 text-[10px] font-semibold transition ${isFollowing ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"} ${pending ? "opacity-60" : ""}`,
                                                                            children: pending ? "…" : isFollowing ? "A seguir" : "Seguir"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/components/Navbar.tsx",
                                                                            lineNumber: 1099,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, `user-tab-${item.id}`, true, {
                                                                    fileName: "[project]/app/components/Navbar.tsx",
                                                                    lineNumber: 1067,
                                                                    columnNumber: 29
                                                                }, this);
                                                            }),
                                                            userResults.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] text-white/60",
                                                                children: "Nenhum utilizador encontrado."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/components/Navbar.tsx",
                                                                lineNumber: 1115,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/components/Navbar.tsx",
                                                        lineNumber: 1060,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/Navbar.tsx",
                                                lineNumber: 709,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/Navbar.tsx",
                                        lineNumber: 701,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/Navbar.tsx",
                                lineNumber: 677,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/Navbar.tsx",
                        lineNumber: 650,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/components/Navbar.tsx",
                    lineNumber: 649,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/components/Navbar.tsx",
                lineNumber: 639,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}
_s(Navbar, "GlLGS5JgFroeuKvkqFoG17nNWEM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"]
    ];
});
_c = Navbar;
var _c;
__turbopack_context__.k.register(_c, "Navbar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/autenticação/AuthModal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AuthModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseBrowser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$_internal$2f$config$2d$context$2d$client$2d$BoS53ST9$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__j__as__mutate$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/_internal/config-context-client-BoS53ST9.mjs [app-client] (ecmascript) <export j as mutate>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
function AuthModal() {
    _s();
    const modal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"])();
    if (!modal.isOpen) return null;
    const modalKey = `${modal.mode}-${modal.redirectTo ?? "none"}`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthModalContent, {
        ...modal
    }, modalKey, false, {
        fileName: "[project]/app/components/autenticação/AuthModal.tsx",
        lineNumber: 17,
        columnNumber: 10
    }, this);
}
_s(AuthModal, "Em6qoC6GZ22I5blSimzgytzJiVE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"]
    ];
});
_c = AuthModal;
function AuthModalContent({ mode, email, setEmail, closeModal, setMode, redirectTo, showGoogle }) {
    _s1();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [confirmPassword, setConfirmPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [showPassword, setShowPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [showConfirmPassword, setShowConfirmPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [otp, setOtp] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [loginOtpSending, setLoginOtpSending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [loginOtpSent, setLoginOtpSent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [fullName, setFullName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [username, setUsername] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [signupCooldown, setSignupCooldown] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [otpCooldown, setOtpCooldown] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [otpResending, setOtpResending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [usernameHint, setUsernameHint] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const RESEND_COOLDOWN = 30;
    const isSignupBlocked = signupCooldown > 0;
    const isOnboarding = mode === "onboarding";
    const modalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    function clearPendingVerification() {
        setOtpCooldown(0);
        setOtp("");
        setError(null);
        if ("TURBOPACK compile-time truthy", 1) {
            try {
                window.localStorage.removeItem("orya_pending_email");
                window.localStorage.removeItem("orya_pending_step");
                window.localStorage.removeItem("orya_otp_last_sent_at");
            } catch  {
            /* ignore */ }
        }
    }
    function hardResetAuthState() {
        clearPendingVerification();
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setOtp("");
        setLoginOtpSent(false);
        setLoginOtpSending(false);
        setOtpResending(false);
        setError(null);
        setMode("login");
    }
    function isUnconfirmedError(err) {
        if (!err) return false;
        const anyErr = err;
        const msg = (anyErr.message || anyErr.error_description || "").toLowerCase();
        if (!msg) return false;
        return msg.includes("not confirmed") || msg.includes("confirm your email") || msg.includes("email_not_confirmed");
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthModalContent.useEffect": ()=>{
            function handleClickOutside(e) {
                if (modalRef.current && !modalRef.current.contains(e.target) && !isOnboarding) {
                    closeModal();
                }
            }
            document.addEventListener("mousedown", handleClickOutside);
            return ({
                "AuthModalContent.useEffect": ()=>{
                    document.removeEventListener("mousedown", handleClickOutside);
                }
            })["AuthModalContent.useEffect"];
        }
    }["AuthModalContent.useEffect"], [
        closeModal,
        isOnboarding
    ]);
    // Recupera email pendente após reload
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthModalContent.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            try {
                const pendingEmail = window.localStorage.getItem("orya_pending_email");
                const pendingStep = window.localStorage.getItem("orya_pending_step");
                const lastOtp = Number(window.localStorage.getItem("orya_otp_last_sent_at") || "0");
                const elapsed = lastOtp ? Math.floor((Date.now() - lastOtp) / 1000) : RESEND_COOLDOWN;
                const remaining = Math.max(0, RESEND_COOLDOWN - elapsed);
                if (pendingEmail && !email) setEmail(pendingEmail);
                if (pendingStep === "verify") {
                    setMode("verify");
                    if (remaining > 0) setOtpCooldown(remaining);
                }
            } catch  {
            /* ignore */ }
        }
    }["AuthModalContent.useEffect"], [
        email,
        setEmail,
        setMode
    ]);
    // Se estivermos no modo verify mas o user já estiver confirmado (sessão existente),
    // limpamos o estado pendente e fechamos o modal para não bloquear o fluxo.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthModalContent.useEffect": ()=>{
            if (mode !== "verify") return;
            if (otpCooldown === 0) {
                setOtpCooldown(RESEND_COOLDOWN);
                if ("TURBOPACK compile-time truthy", 1) {
                    window.localStorage.setItem("orya_otp_last_sent_at", String(Date.now()));
                }
            }
            let cancelled = false;
            ({
                "AuthModalContent.useEffect": async ()=>{
                    try {
                        const { data } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.getUser();
                        const supaUser = data?.user ?? null;
                        const confirmed = Boolean(supaUser?.email_confirmed_at) || Boolean(supaUser?.email_confirmed) || false;
                        if (confirmed && !cancelled) {
                            clearPendingVerification();
                            setError(null);
                            closeModal();
                        }
                    } catch  {
                    /* ignore */ }
                }
            })["AuthModalContent.useEffect"]();
            return ({
                "AuthModalContent.useEffect": ()=>{
                    cancelled = true;
                }
            })["AuthModalContent.useEffect"];
        }
    }["AuthModalContent.useEffect"], [
        mode,
        closeModal
    ]);
    async function syncSessionWithServer() {
        try {
            const { data } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.getSession();
            const access_token = data.session?.access_token;
            const refresh_token = data.session?.refresh_token;
            if (!access_token || !refresh_token) return;
            await fetch("/api/auth/refresh", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    access_token,
                    refresh_token
                }),
                credentials: "include"
            });
        } catch (err) {
            console.warn("syncSessionWithServer failed", err);
        }
    }
    async function handleLoginOtp() {
        if (!email) {
            setError("Indica o email para receber o link de entrada.");
            return;
        }
        setLoginOtpSending(true);
        setError(null);
        setLoginOtpSent(false);
        try {
            const redirect = ("TURBOPACK compile-time truthy", 1) ? `${window.location.origin}/auth/callback` : "TURBOPACK unreachable";
            const { error: otpErr } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: redirect
                }
            });
            if (otpErr) {
                setError(otpErr.message ?? "Não foi possível enviar o link de login.");
                setLoginOtpSending(false);
                return;
            }
            setLoginOtpSent(true);
        } catch (err) {
            console.error("[AuthModal] login OTP error:", err);
            setError("Não foi possível enviar o link de login.");
        } finally{
            setLoginOtpSending(false);
        }
    }
    async function handleResetPassword() {
        if (!email) {
            setError("Indica o email para recuperar a password.");
            return;
        }
        setLoginOtpSending(true);
        setError(null);
        setLoginOtpSent(false);
        try {
            const res = await fetch("/api/auth/password/reset-request", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok || data?.ok === false) {
                setError(data?.error ?? "Não foi possível enviar recuperação de password.");
                setLoginOtpSending(false);
                return;
            }
            setLoginOtpSent(true);
        } catch (err) {
            console.error("[AuthModal] reset password error:", err);
            setError("Não foi possível enviar recuperação de password.");
        } finally{
            setLoginOtpSending(false);
        }
    }
    async function triggerResendOtp(emailToUse) {
        setError(null);
        setOtpResending(true);
        try {
            const res = await fetch("/api/auth/resend-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: emailToUse
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok) {
                setError(data?.error ?? "Não foi possível reenviar o código.");
                setOtpCooldown(0);
            } else {
                setLoginOtpSent(true);
                setOtpCooldown(RESEND_COOLDOWN);
                if ("TURBOPACK compile-time truthy", 1) {
                    window.localStorage.setItem("orya_otp_last_sent_at", String(Date.now()));
                    window.localStorage.setItem("orya_pending_email", emailToUse);
                    window.localStorage.setItem("orya_pending_step", "verify");
                }
            }
        } catch (err) {
            console.error("triggerResendOtp error", err);
            setError("Não foi possível reenviar o código.");
            setOtpCooldown(0);
        } finally{
            setOtpResending(false);
        }
    }
    async function finishAuthAndMaybeOnboard() {
        try {
            // Garantir que o servidor tem a sessão atualizada antes de pedir /api/auth/me
            await syncSessionWithServer();
            const res = await fetch("/api/auth/me", {
                method: "GET",
                credentials: "include"
            });
            // Se a API exigir confirmação de email, volta para o modo verify
            if (!res.ok) {
                const data = await res.json().catch(()=>null);
                const needsEmailConfirmation = data?.needsEmailConfirmation;
                if (needsEmailConfirmation) {
                    if (("TURBOPACK compile-time value", "object") !== "undefined" && email) {
                        window.localStorage.setItem("orya_pending_email", email);
                        window.localStorage.setItem("orya_pending_step", "verify");
                    }
                    setMode("verify");
                    if (email) {
                        await triggerResendOtp(email);
                    }
                    setLoading(false);
                    return;
                }
                closeModal();
                router.push(redirectTo ?? "/me");
                return;
            }
            const data = await res.json();
            const onboardingDone = data?.profile?.onboardingDone;
            // Atualiza SWR para refletir o novo estado de auth/profile imediatamente
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$_internal$2f$config$2d$context$2d$client$2d$BoS53ST9$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__j__as__mutate$3e$__["mutate"])("/api/auth/me");
            // Sessão OK: limpa qualquer estado de verificação pendente para não reabrir o passo verify
            clearPendingVerification();
            if (onboardingDone) {
                closeModal();
                router.push(redirectTo ?? "/me");
            } else {
                setMode("onboarding");
            }
        } catch (err) {
            console.error("finishAuthAndMaybeOnboard error", err);
            closeModal();
            router.push(redirectTo ?? "/me");
        }
    }
    async function handleLogin() {
        setError(null);
        setLoading(true);
        const identifier = (email || "").trim().toLowerCase();
        if (!identifier || !password) {
            setError("Preenche o email/username e a password.");
            setLoading(false);
            return;
        }
        let emailToUse = identifier;
        if (!identifier.includes("@")) {
            const res = await fetch("/api/auth/resolve-identifier", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    identifier
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok || !data?.ok || !data?.email) {
                setError("Credenciais inválidas. Confirma username/email e password.");
                setLoading(false);
                return;
            }
            emailToUse = data.email;
        }
        const { error: loginError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.signInWithPassword({
            email: emailToUse,
            password
        });
        if (loginError) {
            const message = loginError.message || "";
            if (isUnconfirmedError(loginError)) {
                if ("TURBOPACK compile-time truthy", 1) {
                    window.localStorage.setItem("orya_pending_email", emailToUse);
                    window.localStorage.setItem("orya_pending_step", "verify");
                }
                setMode("verify");
                setEmail(emailToUse);
                setError("Email ainda não confirmado. Reenviei-te um novo código.");
                await triggerResendOtp(emailToUse);
            } else {
                setError(message || "Não foi possível iniciar sessão.");
            }
            setLoading(false);
            return;
        }
        await syncSessionWithServer();
        clearPendingVerification();
        await finishAuthAndMaybeOnboard();
        setLoading(false);
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthModalContent.useEffect": ()=>{
            if (signupCooldown <= 0) return;
            const t = setInterval({
                "AuthModalContent.useEffect.t": ()=>{
                    setSignupCooldown({
                        "AuthModalContent.useEffect.t": (prev)=>prev > 0 ? prev - 1 : 0
                    }["AuthModalContent.useEffect.t"]);
                }
            }["AuthModalContent.useEffect.t"], 1000);
            return ({
                "AuthModalContent.useEffect": ()=>clearInterval(t)
            })["AuthModalContent.useEffect"];
        }
    }["AuthModalContent.useEffect"], [
        signupCooldown
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthModalContent.useEffect": ()=>{
            if (otpCooldown <= 0) return;
            const t = setInterval({
                "AuthModalContent.useEffect.t": ()=>{
                    setOtpCooldown({
                        "AuthModalContent.useEffect.t": (prev)=>prev > 0 ? prev - 1 : 0
                    }["AuthModalContent.useEffect.t"]);
                }
            }["AuthModalContent.useEffect.t"], 1000);
            return ({
                "AuthModalContent.useEffect": ()=>clearInterval(t)
            })["AuthModalContent.useEffect"];
        }
    }["AuthModalContent.useEffect"], [
        otpCooldown
    ]);
    async function handleSignup() {
        setError(null);
        setLoading(true);
        setLoginOtpSent(false);
        const emailToUse = (email || "").trim().toLowerCase();
        if (!emailToUse || !password || !confirmPassword) {
            setError("Preenche o email e ambas as passwords.");
            setLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setError("As passwords não coincidem.");
            setLoading(false);
            return;
        }
        try {
            const res = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: emailToUse,
                    password
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setError(json?.error ?? "Não foi possível enviar o código.");
                setLoading(false);
                return;
            }
            if ("TURBOPACK compile-time truthy", 1) {
                window.localStorage.setItem("orya_pending_email", emailToUse);
                window.localStorage.setItem("orya_pending_step", "verify");
                window.localStorage.setItem("orya_otp_last_sent_at", String(Date.now()));
            }
            setOtpCooldown(RESEND_COOLDOWN);
            setEmail(emailToUse);
            setMode("verify");
        } catch (err) {
            console.warn("[AuthModal] Falhou envio de OTP custom:", err);
            setError("Não foi possível enviar o código. Tenta novamente dentro de alguns minutos.");
            setMode("signup");
            setLoading(false);
            return;
        }
        setLoading(false);
    }
    async function handleVerify() {
        setError(null);
        setLoading(true);
        const emailToUse = (email || "").trim().toLowerCase();
        if (!emailToUse) {
            setError("Email em falta. Volta atrás e inicia sessão novamente.");
            setLoading(false);
            return;
        }
        const cleanOtp = otp.trim();
        if (!cleanOtp || cleanOtp.length < 6) {
            setError("Introduce o código completo (6-8 dígitos).");
            setLoading(false);
            return;
        }
        const { error: verifyError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.verifyOtp({
            type: "signup",
            email: emailToUse,
            token: cleanOtp
        });
        if (verifyError) {
            const message = verifyError.message || "Código inválido ou expirado. Verifica o email ou pede novo código.";
            setError(message);
            setOtpCooldown(0);
            setLoading(false);
            return;
        }
        await syncSessionWithServer();
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$_internal$2f$config$2d$context$2d$client$2d$BoS53ST9$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__j__as__mutate$3e$__["mutate"])("/api/auth/me");
        if ("TURBOPACK compile-time truthy", 1) {
            clearPendingVerification();
        }
        await finishAuthAndMaybeOnboard();
        setLoading(false);
    }
    async function handleOnboardingSave() {
        setError(null);
        setLoading(true);
        try {
            const usernameClean = username.replace(/[^A-Za-z]/g, "").slice(0, 16).trim();
            if (!usernameClean) {
                setError("O username só pode ter letras (sem espaços, números ou símbolos).");
                setLoading(false);
                return;
            }
            if (usernameClean.length > 16) {
                setError("O username pode ter no máximo 16 letras.");
                setLoading(false);
                return;
            }
            const res = await fetch("/api/profiles/save-basic", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fullName: fullName.trim() || null,
                    username: usernameClean
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok || data && data.ok === false) {
                const msg = data?.error || "Não foi possível guardar o perfil.";
                setError(msg);
                setLoading(false);
                return;
            }
            // Atualizar cache do utilizador para refletir onboardingDone=true (evita reabrir modal)
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$_internal$2f$config$2d$context$2d$client$2d$BoS53ST9$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__j__as__mutate$3e$__["mutate"])("/api/auth/me", (curr)=>{
                const prev = curr;
                if (prev?.profile) {
                    return {
                        ...prev,
                        profile: {
                            ...prev.profile,
                            onboardingDone: true
                        }
                    };
                }
                return prev;
            }, false);
            closeModal();
            router.push(redirectTo ?? "/me");
            setLoading(false);
        } catch (err) {
            console.error("handleOnboardingSave error", err);
            setError("Ocorreu um erro ao guardar o perfil.");
            setLoading(false);
        }
    }
    const isLogin = mode === "login";
    const isSignup = mode === "signup";
    const title = mode === "login" ? "Entrar na ORYA" : mode === "signup" ? "Criar conta na ORYA" : mode === "verify" ? "Confirmar email" : "Completar perfil";
    const subtitle = mode === "login" ? "Acede à tua conta e continua onde ficaste." : mode === "signup" ? "Demora segundos. Depois é só viver eventos." : mode === "verify" ? "Valida o código que enviámos para o teu email." : "Só falta isto para ficares pronto.";
    const isPrimaryDisabled = loading || (mode === "login" || mode === "signup") && (!email || !password) || mode === "signup" && (password !== confirmPassword || !confirmPassword) || mode === "signup" && isSignupBlocked || mode === "verify" && (!email || otp.trim().length < 6) || mode === "onboarding" && (!username.replace(/[^A-Za-z]/g, "").trim() || username.replace(/[^A-Za-z]/g, "").length > 16);
    const handleClose = ()=>{
        hardResetAuthState();
        closeModal();
        router.push(redirectTo ?? "/");
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: modalRef,
            className: "w-full max-w-md rounded-3xl border border-white/15 bg-black/80 p-6 shadow-xl",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-4 space-y-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-2xl font-semibold text-white leading-tight",
                                    children: title
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 595,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm text-white/70",
                                    children: subtitle
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 596,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 594,
                            columnNumber: 11
                        }, this),
                        (isLogin || isSignup) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-3 grid grid-cols-2 gap-1 rounded-full bg-white/5 p-1 text-sm text-white/80",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setMode("login"),
                                    className: `rounded-full px-3 py-2 transition ${isLogin ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black shadow-[0_0_16px_rgba(107,255,255,0.35)]" : "hover:bg-white/10"}`,
                                    children: "Entrar"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 601,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setMode("signup"),
                                    className: `rounded-full px-3 py-2 transition ${isSignup ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black shadow-[0_0_16px_rgba(107,255,255,0.35)]" : "hover:bg-white/10"}`,
                                    children: "Criar conta"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 612,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 600,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                    lineNumber: 593,
                    columnNumber: 9
                }, this),
                (mode === "login" || mode === "signup") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "block text-xs text-white/70 mb-1",
                            children: "Email ou username"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 629,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            type: "text",
                            value: email ?? "",
                            onChange: (e)=>{
                                setEmail(e.target.value);
                                setError(null);
                            },
                            className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                            placeholder: "nome@exemplo.com ou @username"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 630,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "mt-3 block text-xs text-white/70 mb-1",
                            children: "Palavra-passe"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 641,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: showPassword ? "text" : "password",
                                    value: password,
                                    onChange: (e)=>{
                                        setPassword(e.target.value);
                                        setError(null);
                                    },
                                    className: "flex-1 bg-transparent text-sm text-white outline-none",
                                    placeholder: "••••••••"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 645,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setShowPassword((v)=>!v),
                                    className: "text-[11px] text-white/70 hover:text-white",
                                    children: showPassword ? "Ocultar" : "Mostrar"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 655,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 644,
                            columnNumber: 13
                        }, this),
                        mode === "login" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-2 flex items-center justify-between text-[11px] text-white/65",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: handleResetPassword,
                                    disabled: loginOtpSending,
                                    className: "text-[11px] text-white/70 hover:text-white disabled:opacity-60",
                                    children: loginOtpSending ? "A enviar recuperação…" : "Esqueceste a password?"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 666,
                                    columnNumber: 17
                                }, this),
                                loginOtpSent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-emerald-300 text-[11px]",
                                    children: "Email enviado."
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 675,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 665,
                            columnNumber: 15
                        }, this),
                        mode === "signup" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "mt-3 block text-xs text-white/70 mb-1",
                                    children: "Confirmar palavra-passe"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 682,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: showConfirmPassword ? "text" : "password",
                                            value: confirmPassword,
                                            onChange: (e)=>{
                                                setConfirmPassword(e.target.value);
                                                setError(null);
                                            },
                                            className: "flex-1 bg-transparent text-sm text-white outline-none",
                                            placeholder: "••••••••"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                            lineNumber: 686,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setShowConfirmPassword((v)=>!v),
                                            className: "text-[11px] text-white/70 hover:text-white",
                                            children: showConfirmPassword ? "Ocultar" : "Mostrar"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                            lineNumber: 696,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 685,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true),
                        showGoogle && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            disabled: loading,
                            onClick: async ()=>{
                                setError(null);
                                setLoading(true);
                                try {
                                    const redirect = ("TURBOPACK compile-time truthy", 1) ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo ?? window.location.href)}` : "TURBOPACK unreachable";
                                    if ("TURBOPACK compile-time truthy", 1) {
                                        try {
                                            window.localStorage.setItem("orya_post_auth_redirect", redirectTo ?? window.location.href);
                                        } catch  {}
                                    }
                                    const { error: oauthError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.signInWithOAuth({
                                        provider: "google",
                                        options: {
                                            redirectTo: redirect
                                        }
                                    });
                                    if (oauthError) {
                                        setError(oauthError.message ?? "Não foi possível iniciar sessão com Google.");
                                    }
                                } catch (err) {
                                    console.error("[AuthModal] Google OAuth error:", err);
                                    setError("Não foi possível iniciar sessão com Google. Tenta novamente.");
                                } finally{
                                    setLoading(false);
                                }
                            },
                            className: "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow hover:border-white/40 hover:bg-white/10 transition-colors disabled:opacity-50",
                            children: "Continuar com Google"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 708,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-2 text-[10px] text-white/50 leading-snug",
                            children: "Ao continuar, aceitas os termos da ORYA."
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 755,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true),
                mode === "verify" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-white/80 mb-2",
                            children: [
                                "Enviámos um código de confirmação para ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                    children: email
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 764,
                                    columnNumber: 54
                                }, this),
                                "."
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 763,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "block text-xs text-white/70 mb-1",
                            children: "Código"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 766,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            type: "text",
                            maxLength: 8,
                            value: otp,
                            onChange: (e)=>setOtp(e.target.value),
                            className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                            placeholder: "Insere o código de 6 dígitos"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 767,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-2 flex items-center justify-between text-[12px] text-white/65",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: [
                                        "Não chegou?",
                                        " ",
                                        otpCooldown > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-white/75",
                                            children: [
                                                "Podes reenviar em ",
                                                otpCooldown,
                                                "s."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                            lineNumber: 779,
                                            columnNumber: 19
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>{
                                                if (email) triggerResendOtp(email);
                                            },
                                            disabled: !email || otpResending,
                                            className: "text-[#6BFFFF] hover:text-white transition disabled:opacity-50",
                                            children: "Reenviar código"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                            lineNumber: 781,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 776,
                                    columnNumber: 15
                                }, this),
                                otpResending && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[11px] text-white/50",
                                    children: "A enviar…"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 793,
                                    columnNumber: 32
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 775,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-2 flex items-center justify-between text-[12px] text-white/65",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>{
                                    hardResetAuthState();
                                    setMode("login");
                                },
                                className: "text-[#6BFFFF] hover:text-white transition",
                                children: "Usar outro email"
                            }, void 0, false, {
                                fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                lineNumber: 796,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 795,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true),
                mode === "onboarding" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-white/75 mb-3",
                            children: "Bem-vindo(a)! Só faltam estes dados para concluíres o teu perfil."
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 812,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "block text-xs text-white/70 mb-1",
                            children: "Nome completo"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 816,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            type: "text",
                            value: fullName,
                            onChange: (e)=>setFullName(e.target.value),
                            className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                            placeholder: "Ex.: Inês Martins"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 819,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "mt-3 block text-xs text-white/70 mb-1",
                            children: "Username público"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 827,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-white/40 mr-1",
                                    children: "@"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 831,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    inputMode: "text",
                                    pattern: "[A-Za-z]{0,16}",
                                    value: username,
                                    maxLength: 16,
                                    onChange: (e)=>{
                                        const raw = e.target.value;
                                        const cleaned = raw.replace(/[^A-Za-z]/g, "").slice(0, 16);
                                        if (raw !== cleaned) {
                                            e.target.value = cleaned;
                                        }
                                        setUsername(cleaned);
                                        setUsernameHint(raw !== cleaned ? "Só letras A-Z, sem espaços, máximo 16." : null);
                                    },
                                    className: "flex-1 bg-transparent outline-none",
                                    placeholder: "inesmartins"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 832,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 830,
                            columnNumber: 15
                        }, this),
                        usernameHint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-1 text-[10px] text-amber-300/90",
                            children: usernameHint
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 854,
                            columnNumber: 17
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-1 text-[10px] text-white/45 leading-snug",
                            children: "Podes alterar estes dados depois nas definições."
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 857,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true),
                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-3 space-y-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[12px] text-red-300 leading-snug",
                            children: error
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 865,
                            columnNumber: 13
                        }, this),
                        mode === "signup" && error.toLowerCase().includes("já tem conta") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2 text-[12px] text-white/75",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setMode("login"),
                                    className: "w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10 transition",
                                    children: "Ir para login"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 868,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    disabled: loginOtpSending,
                                    onClick: handleLoginOtp,
                                    className: "w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10 transition disabled:opacity-50",
                                    children: loginOtpSending ? "A enviar link de login…" : "Enviar link de login por email"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 875,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    disabled: loginOtpSending,
                                    onClick: handleResetPassword,
                                    className: "w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10 transition disabled:opacity-50",
                                    children: loginOtpSending ? "A enviar recuperação…" : "Recuperar password"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 883,
                                    columnNumber: 17
                                }, this),
                                loginOtpSent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-emerald-300 text-[11px]",
                                    children: "Verifica o teu email para redefinir a password."
                                }, void 0, false, {
                                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                                    lineNumber: 892,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 867,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                    lineNumber: 864,
                    columnNumber: 11
                }, this),
                mode === "signup" && isSignupBlocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-2 text-[11px] text-white/60",
                    children: [
                        "Aguardar ",
                        signupCooldown,
                        "s para tentar novamente."
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                    lineNumber: 902,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-5 flex flex-col gap-2",
                    children: [
                        (mode === "login" || mode === "signup") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            disabled: isPrimaryDisabled,
                            onClick: mode === "login" ? handleLogin : handleSignup,
                            className: "inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] disabled:opacity-50",
                            children: loading ? "A processar…" : mode === "login" ? "Entrar" : "Criar conta"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 909,
                            columnNumber: 13
                        }, this),
                        mode === "verify" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            disabled: isPrimaryDisabled,
                            onClick: handleVerify,
                            className: "inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] disabled:opacity-50",
                            children: loading ? "A validar…" : "Confirmar código"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 924,
                            columnNumber: 13
                        }, this),
                        mode === "onboarding" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            disabled: isPrimaryDisabled,
                            onClick: handleOnboardingSave,
                            className: "inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] disabled:opacity-50",
                            children: loading ? "A guardar…" : "Guardar e continuar"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 935,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: isOnboarding ? undefined : handleClose,
                            disabled: isOnboarding,
                            className: "text-[11px] text-white/50 hover:text-white disabled:opacity-60",
                            children: "Fechar"
                        }, void 0, false, {
                            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                            lineNumber: 945,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/autenticação/AuthModal.tsx",
                    lineNumber: 907,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/autenticação/AuthModal.tsx",
            lineNumber: 589,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/components/autenticação/AuthModal.tsx",
        lineNumber: 588,
        columnNumber: 5
    }, this);
}
_s1(AuthModalContent, "IJJkOhWpg79QzSYX5oM/CpKuuwY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c1 = AuthModalContent;
var _c, _c1;
__turbopack_context__.k.register(_c, "AuthModal");
__turbopack_context__.k.register(_c1, "AuthModalContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/RecoveryRedirector.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RecoveryRedirector",
    ()=>RecoveryRedirector
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
function RecoveryRedirector() {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RecoveryRedirector.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const { hash, pathname, search } = window.location;
            if (pathname === "/reset-password") return;
            const params = new URLSearchParams(hash.replace(/^#/, ""));
            const query = new URLSearchParams(search.replace(/^\?/, ""));
            const type = params.get("type") || query.get("type");
            const hasRecoveryFlag = query.get("recovery") === "1";
            const hasToken = params.has("access_token") || params.has("token") || params.has("code") || params.has("refresh_token");
            const hasError = params.has("error") || params.has("error_code") || params.has("error_description");
            // Redireciona para reset-password em qualquer cenário de recuperação (tokens ou erros)
            if ((hasRecoveryFlag || type === "recovery") && (hasToken || hasError)) {
                window.location.replace(`/reset-password${search}${hash}`);
            } else if (hasError && hasToken) {
                // fallback defensivo para hashes de recovery sem type/recovery flag
                window.location.replace(`/reset-password${search}${hash}`);
            }
        }
    }["RecoveryRedirector.useEffect"], []);
    return null;
}
_s(RecoveryRedirector, "OD7bBpZva5O2jO+Puf00hKivP7c=");
_c = RecoveryRedirector;
var _c;
__turbopack_context__.k.register(_c, "RecoveryRedirector");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_63a419a8._.js.map