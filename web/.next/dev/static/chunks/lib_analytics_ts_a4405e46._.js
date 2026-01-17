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
]);

//# sourceMappingURL=lib_analytics_ts_a4405e46._.js.map