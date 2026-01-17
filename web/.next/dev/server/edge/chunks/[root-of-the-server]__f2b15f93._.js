(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/[root-of-the-server]__f2b15f93._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Middleware para manter a sessão do Supabase fresca em cada request.
// Não faz redirect nem proteção de rotas — apenas refresh de sessão.
__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/server/web/exports/index.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [middleware-edge] (ecmascript)");
;
;
async function middleware(req) {
    const supabaseUrl = ("TURBOPACK compile-time value", "https://ytdegtoibuxcmmvtbgtq.supabase.co");
    const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZGVndG9pYnV4Y21tdnRiZ3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzY0MzgsImV4cCI6MjA3ODYxMjQzOH0.4LePHrbqF4AEgn9LOt0aRiPU_TOkBNqye9ywmjXFar0");
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next({
        request: {
            headers: req.headers
        }
    });
    const orgParam = req.nextUrl.searchParams.get("org") ?? req.nextUrl.searchParams.get("organizerId");
    if (orgParam && /^\d+$/.test(orgParam)) {
        res.cookies.set("orya_org", orgParam, {
            httpOnly: false,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30
        });
    }
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["createServerClient"])(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get (name) {
                const raw = req.cookies.get(name)?.value;
                return raw ?? undefined;
            },
            set (name, value, options) {
                res.cookies.set({
                    name,
                    value,
                    ...options
                });
            },
            remove (name, options) {
                res.cookies.set({
                    name,
                    value: "",
                    ...options,
                    maxAge: 0
                });
            }
        }
    });
    const { data: { user } } = await supabase.auth.getUser();
    // Auth wall para áreas privadas
    const pathname = req.nextUrl.pathname;
    const isProtected = pathname.startsWith("/me") || pathname.startsWith("/organizador");
    if (isProtected && !user) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("redirectTo", `${pathname}${req.nextUrl.search}`);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(loginUrl);
    }
    return res;
}
const config = {
    matcher: [
        "/me/:path*",
        "/organizador/:path*"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__f2b15f93._.js.map