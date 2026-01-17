module.exports = [
"[project]/lib/analytics.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
}),
];

//# sourceMappingURL=lib_analytics_ts_03aa5715._.js.map