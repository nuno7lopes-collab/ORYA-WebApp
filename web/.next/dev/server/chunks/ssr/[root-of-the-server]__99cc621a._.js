module.exports = [
"[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EventLivePrepClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
function EventLivePrepClient({ event, tournamentId }) {
    const [currentTournamentId, setCurrentTournamentId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(tournamentId ?? null);
    const [liveHubVisibility, setLiveHubVisibility] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(event.liveHubVisibility ?? "PUBLIC");
    const [liveStreamUrl, setLiveStreamUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(event.liveStreamUrl ?? "");
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [creatingTournament, setCreatingTournament] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [tournamentMessage, setTournamentMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [bracketSize, setBracketSize] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(16);
    const handleSave = async ()=>{
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/organizador/events/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    eventId: event.id,
                    liveHubVisibility,
                    liveStreamUrl: liveStreamUrl.trim() || null
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setMessage(json?.error || "Erro ao guardar LiveHub.");
                return;
            }
            setMessage("LiveHub atualizado.");
        } catch  {
            setMessage("Erro inesperado ao guardar LiveHub.");
        } finally{
            setSaving(false);
        }
    };
    const handleCreateTournament = async ()=>{
        setCreatingTournament(true);
        setTournamentMessage(null);
        try {
            const res = await fetch("/api/organizador/tournaments/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    eventId: event.id,
                    bracketSize
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setTournamentMessage(json?.error || "Erro ao criar torneio.");
                return;
            }
            setCurrentTournamentId(json.tournamentId);
            setTournamentMessage("Torneio criado.");
        } catch  {
            setTournamentMessage("Erro inesperado ao criar torneio.");
        } finally{
            setCreatingTournament(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-4 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                                children: "LiveHub"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 88,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/70",
                                children: "Define visibilidade e a livestream antes de começares."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 89,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                        lineNumber: 87,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        className: "text-sm font-medium",
                                        children: "Visibilidade"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 94,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        value: liveHubVisibility,
                                        onChange: (e)=>setLiveHubVisibility(e.target.value),
                                        className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "PUBLIC",
                                                children: "Público"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                                lineNumber: 100,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "PRIVATE",
                                                children: "Privado (só participantes)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                                lineNumber: 101,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "DISABLED",
                                                children: "Desativado"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                                lineNumber: 102,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 95,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/55",
                                        children: "Público é sempre visível; privado mostra apenas a participantes; desativado oculta o LiveHub."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 104,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 93,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1 md:col-span-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        className: "text-sm font-medium",
                                        children: "URL da livestream"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 110,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        value: liveStreamUrl,
                                        onChange: (e)=>setLiveStreamUrl(e.target.value),
                                        placeholder: "https://youtu.be/...",
                                        className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 111,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/55",
                                        children: "Se vazio, o LiveHub mostra o módulo de vídeo como indisponível."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 117,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 109,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                        lineNumber: 92,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: handleSave,
                                disabled: saving,
                                className: `${__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CTA_PRIMARY"]} disabled:opacity-60`,
                                children: saving ? "A guardar…" : "Guardar LiveHub"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 124,
                                columnNumber: 11
                            }, this),
                            message && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[12px] text-white/70",
                                children: message
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 132,
                                columnNumber: 23
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                        lineNumber: 123,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-4 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                                children: "Torneio"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 138,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/70",
                                children: "Cria a bracket quando estiveres pronto para gerir jogos."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 139,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                        lineNumber: 137,
                        columnNumber: 9
                    }, this),
                    !currentTournamentId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-[240px_1fr] md:items-end",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        className: "text-sm font-medium",
                                        children: "Tamanho da bracket"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 145,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        value: bracketSize,
                                        onChange: (e)=>setBracketSize(Number(e.target.value)),
                                        className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60",
                                        children: [
                                            2,
                                            4,
                                            8,
                                            16,
                                            32,
                                            64
                                        ].map((size)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: size,
                                                children: [
                                                    size,
                                                    " jogadores"
                                                ]
                                            }, size, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                                lineNumber: 152,
                                                columnNumber: 19
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 146,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 144,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: handleCreateTournament,
                                        disabled: creatingTournament,
                                        className: `${__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CTA_PRIMARY"]} disabled:opacity-60`,
                                        children: creatingTournament ? "A criar…" : "Criar torneio KO"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 159,
                                        columnNumber: 15
                                    }, this),
                                    tournamentMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[12px] text-white/70",
                                        children: tournamentMessage
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                        lineNumber: 167,
                                        columnNumber: 37
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                                lineNumber: 158,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                        lineNumber: 143,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] text-white/60",
                        children: "Torneio pronto. Usa o separador Bracket para gerir participantes, jogos e resultados."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                        lineNumber: 171,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
                lineNumber: 136,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, this);
}
}),
"[project]/lib/avatars.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_GUEST_AVATAR",
    ()=>DEFAULT_GUEST_AVATAR
]);
const DEFAULT_GUEST_AVATAR = "/images/guest-avatar.svg";
}),
"[project]/lib/organizerPremium.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCustomLiveHubMatchOrder",
    ()=>getCustomLiveHubMatchOrder,
    "getCustomLiveHubModules",
    ()=>getCustomLiveHubModules,
    "getCustomPremiumConfig",
    ()=>getCustomPremiumConfig,
    "getCustomPremiumKey",
    ()=>getCustomPremiumKey,
    "getCustomPremiumProfileModules",
    ()=>getCustomPremiumProfileModules,
    "isCustomPremiumActive",
    ()=>isCustomPremiumActive,
    "isCustomPremiumOrganizer",
    ()=>isCustomPremiumOrganizer
]);
const CUSTOM_PREMIUM_CONFIGS = [
    {
        key: "ONEVONE",
        organizerId: 23,
        username: "onevone",
        liveHubModules: [
            "HERO",
            "VIDEO",
            "NOW_PLAYING",
            "NEXT_MATCHES",
            "RESULTS",
            "BRACKET",
            "SPONSORS"
        ],
        profileModules: {
            inscricoes: true,
            loja: true,
            galeria: true
        },
        liveHubMatchOrder: "ONEVONE"
    }
];
const normalizeUsername = (value)=>typeof value === "string" ? value.trim().toLowerCase() : "";
function getCustomPremiumConfig(organizer) {
    if (!organizer) return null;
    const normalizedUsername = normalizeUsername(organizer.username);
    return CUSTOM_PREMIUM_CONFIGS.find((config)=>config.organizerId && organizer.id === config.organizerId || normalizedUsername && config.username === normalizedUsername) ?? null;
}
function isCustomPremiumOrganizer(organizer) {
    return Boolean(getCustomPremiumConfig(organizer));
}
function isCustomPremiumActive(organizer, premiumEnabled) {
    const config = getCustomPremiumConfig(organizer);
    if (!config) return false;
    const enabled = premiumEnabled ?? organizer?.liveHubPremiumEnabled ?? false;
    return Boolean(enabled);
}
function getCustomPremiumKey(organizer) {
    return getCustomPremiumConfig(organizer)?.key ?? null;
}
function getCustomLiveHubModules(organizer) {
    return getCustomPremiumConfig(organizer)?.liveHubModules ?? null;
}
function getCustomPremiumProfileModules(organizer) {
    return getCustomPremiumConfig(organizer)?.profileModules ?? null;
}
function getCustomLiveHubMatchOrder(organizer) {
    return getCustomPremiumConfig(organizer)?.liveHubMatchOrder ?? null;
}
}),
"[project]/app/eventos/[slug]/EventLiveClient.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EventLiveClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$avatars$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/avatars.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/organizerPremium.ts [app-ssr] (ecmascript)");
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
const fetcher = (url)=>fetch(url).then((r)=>r.json());
const LOCALE = "pt-PT";
const DEFAULT_TIMEZONE = "Europe/Lisbon";
function formatDateRange(start, end, timeZone = DEFAULT_TIMEZONE) {
    if (!start) return "";
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    const day = startDate.toLocaleDateString(LOCALE, {
        day: "2-digit",
        month: "long",
        timeZone
    });
    const time = startDate.toLocaleTimeString(LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone
    });
    if (!endDate) return `${day} · ${time}`;
    const endTime = endDate.toLocaleTimeString(LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone
    });
    return `${day} · ${time} - ${endTime}`;
}
function formatTime(value, timeZone = DEFAULT_TIMEZONE) {
    if (!value) return "Por definir";
    return new Date(value).toLocaleTimeString(LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone
    });
}
function formatCountdown(start, nowMs) {
    if (!start || !nowMs) return null;
    const diff = new Date(start).getTime() - nowMs;
    if (diff <= 0) return null;
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds % 86400 / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
}
function getEventStatusLabel(start, end) {
    if (!start) return "Por anunciar";
    const now = new Date();
    const startsAt = new Date(start);
    const endsAt = end ? new Date(end) : null;
    if (now < startsAt) return "Próximo";
    if (endsAt && now > endsAt) return "Concluído";
    return "A decorrer";
}
function escapeIcsText(value) {
    if (!value) return "";
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function formatCalendarDate(value) {
    return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function buildCalendarLinks(event, timeZone) {
    const startsAt = new Date(event.startsAt);
    const endsAt = event.endsAt ? new Date(event.endsAt) : startsAt;
    const location = [
        event.locationName,
        event.locationCity
    ].filter(Boolean).join(" · ");
    const description = event.description?.trim() || `Evento ${event.title}`;
    const dtStart = formatCalendarDate(startsAt);
    const dtEnd = formatCalendarDate(endsAt);
    const uid = `${event.slug || event.id}@orya`;
    const googleUrl = new URL("https://calendar.google.com/calendar/render");
    googleUrl.searchParams.set("action", "TEMPLATE");
    googleUrl.searchParams.set("text", event.title);
    googleUrl.searchParams.set("dates", `${dtStart}/${dtEnd}`);
    if ("TURBOPACK compile-time truthy", 1) googleUrl.searchParams.set("details", description);
    if (location) googleUrl.searchParams.set("location", location);
    if (timeZone) googleUrl.searchParams.set("ctz", timeZone);
    const icsLines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ORYA//LiveHub//PT",
        "BEGIN:VEVENT",
        `UID:${escapeIcsText(uid)}`,
        `DTSTAMP:${formatCalendarDate(new Date())}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeIcsText(event.title)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        `LOCATION:${escapeIcsText(location)}`,
        "END:VEVENT",
        "END:VCALENDAR"
    ];
    const icsUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsLines.join("\n"))}`;
    return {
        google: googleUrl.toString(),
        ics: icsUrl
    };
}
function compareMatchOrder(a, b) {
    if (a.startAt && b.startAt) {
        const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        if (diff !== 0) return diff;
    } else if (a.startAt && !b.startAt) {
        return -1;
    } else if (!a.startAt && b.startAt) {
        return 1;
    }
    const aRound = a.round ?? 0;
    const bRound = b.round ?? 0;
    if (aRound !== bRound) return aRound - bRound;
    return a.id - b.id;
}
function compareBracketOrder(a, b) {
    const aRound = a.round ?? 0;
    const bRound = b.round ?? 0;
    if (aRound !== bRound) return aRound - bRound;
    return a.id - b.id;
}
function formatScore(score) {
    if (score?.goals) return `${score.goals.a}-${score.goals.b}`;
    if (score?.sets?.length) return score.sets.map((s)=>`${s.a}-${s.b}`).join(" · ");
    return "—";
}
function getScoreSummary(score) {
    if (score?.goals) {
        return {
            a: score.goals.a,
            b: score.goals.b
        };
    }
    if (!score?.sets?.length) return null;
    let a = 0;
    let b = 0;
    score.sets.forEach((s)=>{
        if (s.a > s.b) a += 1;
        if (s.b > s.a) b += 1;
    });
    return {
        a,
        b
    };
}
function getWinnerSide(score) {
    if (score?.goals) {
        const limit = score.goals.limit;
        if (Number.isFinite(limit)) {
            if (score.goals.a === limit) return "A";
            if (score.goals.b === limit) return "B";
            return null;
        }
        if (score.goals.a === score.goals.b) return null;
        return score.goals.a > score.goals.b ? "A" : "B";
    }
    const summary = getScoreSummary(score);
    if (!summary) return null;
    if (summary.a === summary.b) return null;
    return summary.a > summary.b ? "A" : "B";
}
function resolveBracketAdvancement(matches) {
    const cloned = matches.map((match)=>({
            ...match
        }));
    const matchesByRound = cloned.reduce((acc, match)=>{
        const round = match.round ?? 0;
        if (round <= 0) return acc;
        if (!acc[round]) acc[round] = [];
        acc[round].push(match);
        return acc;
    }, {});
    const rounds = Object.keys(matchesByRound).map((round)=>Number(round)).filter((round)=>round > 0).sort((a, b)=>a - b);
    for(let idx = 0; idx < rounds.length - 1; idx += 1){
        const round = rounds[idx];
        const nextRound = rounds[idx + 1];
        const currentMatches = (matchesByRound[round] ?? []).slice().sort(compareBracketOrder);
        const nextMatches = (matchesByRound[nextRound] ?? []).slice().sort(compareBracketOrder);
        currentMatches.forEach((match, matchIdx)=>{
            if (match.status !== "DONE") return;
            const winnerSide = getWinnerSide(match.score);
            if (!winnerSide) return;
            const winnerPairingId = winnerSide === "A" ? match.pairing1Id : match.pairing2Id;
            if (!winnerPairingId) return;
            const target = nextMatches[Math.floor(matchIdx / 2)];
            if (!target) return;
            if (matchIdx % 2 === 0) {
                if (!target.pairing1Id) target.pairing1Id = winnerPairingId;
            } else if (!target.pairing2Id) {
                target.pairing2Id = winnerPairingId;
            }
        });
    }
    return cloned;
}
function buildRoundLabels(totalRounds) {
    if (totalRounds <= 1) return [
        "Final"
    ];
    if (totalRounds === 2) return [
        "Meias",
        "Final"
    ];
    if (totalRounds === 3) return [
        "Quartos",
        "Meias",
        "Final"
    ];
    if (totalRounds === 4) return [
        "Oitavos",
        "Quartos",
        "Meias",
        "Final"
    ];
    if (totalRounds === 5) return [
        "R32",
        "Oitavos",
        "Quartos",
        "Meias",
        "Final"
    ];
    return [
        "R64",
        "R32",
        "Oitavos",
        "Quartos",
        "Meias",
        "Final"
    ];
}
function normalizeGoalLimits(input) {
    if (!input) return null;
    const defaultLimit = typeof input.defaultLimit === "number" && Number.isFinite(input.defaultLimit) ? input.defaultLimit : null;
    const roundLimitsRaw = input.roundLimits ?? null;
    const roundLimits = {};
    if (roundLimitsRaw && typeof roundLimitsRaw === "object") {
        Object.entries(roundLimitsRaw).forEach(([key, value])=>{
            if (typeof value === "number" && Number.isFinite(value)) {
                roundLimits[key] = value;
            }
        });
    }
    return {
        defaultLimit,
        roundLimits: Object.keys(roundLimits).length ? roundLimits : null
    };
}
function resolveGoalLimit(round, limits) {
    const normalized = normalizeGoalLimits(limits);
    const fallback = normalized?.defaultLimit ?? 3;
    if (!round || !normalized?.roundLimits) return fallback;
    const roundKey = String(round);
    const roundLimit = normalized.roundLimits[roundKey];
    return Number.isFinite(roundLimit) ? roundLimit : fallback;
}
function getStreamEmbed(url) {
    if (!url) return {
        embedUrl: null,
        href: null,
        provider: null
    };
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "");
        const parentHost = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : (("TURBOPACK compile-time value", "http://localhost:3000") ?? process.env.NEXT_PUBLIC_APP_URL ?? "app.orya.pt").replace(/^https?:\/\//, "");
        if (host === "youtu.be") {
            const id = parsed.pathname.split("/").filter(Boolean)[0];
            return id ? {
                embedUrl: `https://www.youtube.com/embed/${id}`,
                href: url,
                provider: "youtube"
            } : {
                embedUrl: null,
                href: url,
                provider: "youtube"
            };
        }
        if (host.endsWith("youtube.com")) {
            const queryId = parsed.searchParams.get("v");
            if (queryId) {
                return {
                    embedUrl: `https://www.youtube.com/embed/${queryId}`,
                    href: url,
                    provider: "youtube"
                };
            }
            const parts = parsed.pathname.split("/").filter(Boolean);
            const pathType = parts[0];
            const pathId = parts[1];
            if (pathId && [
                "live",
                "embed",
                "shorts"
            ].includes(pathType)) {
                return {
                    embedUrl: `https://www.youtube.com/embed/${pathId}`,
                    href: url,
                    provider: "youtube"
                };
            }
            return {
                embedUrl: null,
                href: url,
                provider: "youtube"
            };
        }
        if (host.endsWith("twitch.tv") || host === "player.twitch.tv") {
            let channel = parsed.searchParams.get("channel");
            let video = parsed.searchParams.get("video");
            if (!channel && !video) {
                const parts = parsed.pathname.split("/").filter(Boolean);
                if (parts[0] === "videos" && parts[1]) {
                    video = parts[1];
                } else if (parts[0]) {
                    channel = parts[0];
                }
            }
            const embedBase = "https://player.twitch.tv/";
            if (channel) {
                return {
                    embedUrl: `${embedBase}?channel=${channel}&parent=${parentHost}`,
                    href: url,
                    provider: "twitch"
                };
            }
            if (video) {
                return {
                    embedUrl: `${embedBase}?video=${video}&parent=${parentHost}`,
                    href: url,
                    provider: "twitch"
                };
            }
            return {
                embedUrl: null,
                href: url,
                provider: "twitch"
            };
        }
        return {
            embedUrl: null,
            href: url,
            provider: "unknown"
        };
    } catch  {
        return {
            embedUrl: null,
            href: url ?? null,
            provider: null
        };
    }
}
function pairingMeta(id, pairings) {
    if (!id) return null;
    return pairings[id] ?? null;
}
function pairingLabelPlain(id, pairings) {
    if (!id) return "";
    return pairings[id]?.label ?? "";
}
function renderPairingName(id, pairings, className) {
    if (!id) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: className
    }, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 377,
        columnNumber: 19
    }, this);
    const meta = pairings[id];
    const label = meta?.label ?? `#${id}`;
    const subLabel = meta?.subLabel;
    const avatarUrl = meta?.avatarUrl || __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$avatars$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_GUEST_AVATAR"];
    const content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "inline-flex items-center gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "h-5 w-5 rounded-full border border-white/10 bg-white/10 bg-cover bg-center",
                style: {
                    backgroundImage: `url(${avatarUrl})`
                }
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 384,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: label
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 388,
                columnNumber: 7
            }, this),
            subLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-[11px] text-white/40",
                children: subLabel
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 389,
                columnNumber: 20
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 383,
        columnNumber: 5
    }, this);
    if (meta?.href) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
            href: meta.href,
            className: className ? `${className} hover:underline` : "hover:underline",
            children: content
        }, void 0, false, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 394,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: className,
        children: content
    }, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 399,
        columnNumber: 10
    }, this);
}
function RoleBadge({ role }) {
    const style = role === "ORGANIZER" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : role === "PARTICIPANT" ? "border-sky-400/40 bg-sky-500/10 text-sky-100" : "border-white/15 bg-white/5 text-white/70";
    const label = role === "ORGANIZER" ? "Organizador" : role === "PARTICIPANT" ? "Participante" : "Público";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${style}`,
        children: label
    }, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 410,
        columnNumber: 10
    }, this);
}
function SponsorsStrip({ organizer }) {
    const sponsorLabels = organizer?.publicName ? [
        organizer.publicName
    ] : [];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rounded-3xl border border-white/10 bg-white/5 p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex flex-wrap items-center justify-between gap-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-wrap items-center gap-2",
                    children: sponsorLabels.length > 0 ? sponsorLabels.map((label)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70",
                            children: label
                        }, `sponsor-${label}`, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 421,
                            columnNumber: 15
                        }, this)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-sm text-white/60",
                        children: "Sponsors em breve"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 429,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 418,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2 text-xs text-white/50",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "Powered by"
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 433,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-white/80",
                            children: "ORYA"
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 434,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 432,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 417,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 416,
        columnNumber: 5
    }, this);
}
function MatchCard({ match, pairings, highlight, timeZone, size = "md", showCourt }) {
    const titleClass = size === "lg" ? "text-base" : "text-sm";
    const metaClass = size === "lg" ? "text-xs" : "text-[11px]";
    const statusClass = size === "lg" ? "text-[11px]" : "text-[11px]";
    const scoreClass = size === "lg" ? "text-sm" : "text-xs";
    const timeLabel = formatTime(match.startAt, timeZone);
    const metaParts = [
        `Jogo #${match.id}`
    ];
    if (match.round) metaParts.push(`R${match.round}`);
    metaParts.push(timeLabel);
    if (showCourt) {
        metaParts.push(match.courtId ? `Campo ${match.courtId}` : "Campo —");
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `rounded-xl border px-3 py-2 transition ${highlight ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 bg-white/5"}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center justify-between gap-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: `text-white font-medium ${titleClass}`,
                            children: [
                                renderPairingName(match.pairing1Id, pairings),
                                " ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-white/40",
                                    children: "vs"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 476,
                                    columnNumber: 61
                                }, this),
                                " ",
                                renderPairingName(match.pairing2Id, pairings)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 475,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: `${metaClass} text-white/60`,
                            children: metaParts.join(" · ")
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 479,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 474,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-right",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: `${statusClass} uppercase tracking-[0.18em] text-white/50`,
                            children: match.statusLabel
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 484,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: `text-white/80 ${scoreClass}`,
                            children: formatScore(match.score)
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 485,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 483,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 473,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 468,
        columnNumber: 5
    }, this);
}
function EmptyCard({ title, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-white font-semibold",
                children: title
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 495,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-2 text-white/60",
                children: children
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 496,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 494,
        columnNumber: 5
    }, this);
}
function OrganizerMatchEditor({ match, tournamentId, onUpdated, goalLimit, locked = false, lockedReason, canResolveDispute = false }) {
    const [score, setScore] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>({
            a: match.score?.goals?.a ?? 0,
            b: match.score?.goals?.b ?? 0
        }));
    const [expectedUpdatedAt, setExpectedUpdatedAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(match.updatedAt ?? null);
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [undoing, setUndoing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [disputePending, setDisputePending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [info, setInfo] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const pendingScoreRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const debounceRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const expectedUpdatedAtRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(match.updatedAt ?? null);
    const savingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setScore({
            a: match.score?.goals?.a ?? 0,
            b: match.score?.goals?.b ?? 0
        });
    }, [
        match.id,
        match.updatedAt,
        match.score?.goals?.a,
        match.score?.goals?.b
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const next = match.updatedAt ?? null;
        setExpectedUpdatedAt(next);
        expectedUpdatedAtRef.current = next;
        pendingScoreRef.current = null;
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
    }, [
        match.id,
        match.updatedAt
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        return ()=>{
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);
    const flushPending = ()=>{
        if (savingRef.current || !pendingScoreRef.current) return;
        const pending = pendingScoreRef.current;
        pendingScoreRef.current = null;
        pushScore(pending.a, pending.b);
    };
    const clampScore = (value)=>Math.max(0, Math.min(goalLimit, value));
    const pushScore = async (nextA, nextB)=>{
        if (locked) {
            setError(lockedReason || "Este jogo está bloqueado.");
            return;
        }
        const expected = expectedUpdatedAtRef.current ?? match.updatedAt ?? null;
        if (!expected) {
            setError("Sem versão do jogo.");
            return;
        }
        setSaving(true);
        savingRef.current = true;
        setError(null);
        const res = await fetch(`/api/organizador/tournaments/${tournamentId}/matches/${match.id}/result`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                score: {
                    goals: {
                        a: nextA,
                        b: nextB,
                        limit: goalLimit
                    }
                },
                expectedUpdatedAt: expected
            })
        });
        const json = await res.json().catch(()=>null);
        setSaving(false);
        savingRef.current = false;
        if (!json?.ok) {
            if (json?.error === "MATCH_CONFLICT") {
                setError("Resultados atualizados noutro local. A atualizar...");
                onUpdated();
                return;
            }
            setError(json?.error || "Falha ao guardar resultado.");
            return;
        }
        if (json?.match?.updatedAt) {
            setExpectedUpdatedAt(json.match.updatedAt);
            expectedUpdatedAtRef.current = json.match.updatedAt;
        }
        if (!pendingScoreRef.current) {
            setScore({
                a: nextA,
                b: nextB
            });
        }
        onUpdated();
        flushPending();
    };
    const adjust = (side, delta)=>{
        if (locked) {
            setError(lockedReason || "Este jogo está bloqueado.");
            return;
        }
        const nextA = clampScore(side === "A" ? score.a + delta : score.a);
        const nextB = clampScore(side === "B" ? score.b + delta : score.b);
        if (nextA === score.a && nextB === score.b) return;
        setScore({
            a: nextA,
            b: nextB
        });
        pendingScoreRef.current = {
            a: nextA,
            b: nextB
        };
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(()=>{
            flushPending();
        }, 120);
    };
    const overrideWinner = async (side)=>{
        if (saving) return;
        if (locked) {
            setError(lockedReason || "Este jogo está bloqueado.");
            return;
        }
        const expected = expectedUpdatedAtRef.current ?? match.updatedAt ?? null;
        if (!expected) {
            setError("Sem versão do jogo.");
            return;
        }
        const pairingId = side === "A" ? match.pairing1Id : match.pairing2Id;
        if (!pairingId) {
            setError("Sem jogador atribuído.");
            return;
        }
        const confirmed = window.confirm("Confirmar override manual? Isto vai marcar o jogo como terminado.");
        if (!confirmed) return;
        const nextA = side === "A" ? goalLimit : 0;
        const nextB = side === "B" ? goalLimit : 0;
        setSaving(true);
        savingRef.current = true;
        setError(null);
        const res = await fetch(`/api/organizador/tournaments/${tournamentId}/matches/${match.id}/result`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                score: {
                    goals: {
                        a: nextA,
                        b: nextB,
                        limit: goalLimit
                    }
                },
                winnerPairingId: pairingId,
                status: "DONE",
                expectedUpdatedAt: expected,
                force: true
            })
        });
        const json = await res.json().catch(()=>null);
        setSaving(false);
        savingRef.current = false;
        if (!json?.ok) {
            if (json?.error === "MATCH_CONFLICT") {
                setError("Resultados atualizados noutro local. A atualizar...");
                onUpdated();
                return;
            }
            setError(json?.error || "Falha ao aplicar override.");
            return;
        }
        if (json?.match?.updatedAt) {
            setExpectedUpdatedAt(json.match.updatedAt);
            expectedUpdatedAtRef.current = json.match.updatedAt;
        }
        setScore({
            a: nextA,
            b: nextB
        });
        onUpdated();
    };
    const markDisputed = async ()=>{
        if (saving || disputePending) return;
        if (locked) {
            setError(lockedReason || "Este jogo está bloqueado.");
            return;
        }
        const expected = expectedUpdatedAtRef.current ?? match.updatedAt ?? null;
        if (!expected) {
            setError("Sem versão do jogo.");
            return;
        }
        const confirmed = window.confirm("Marcar este jogo como disputado? Isto vai bloquear o avanço automático.");
        if (!confirmed) return;
        setDisputePending(true);
        setError(null);
        setInfo(null);
        try {
            const res = await fetch(`/api/organizador/tournaments/${tournamentId}/matches/${match.id}/result`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: "DISPUTED",
                    expectedUpdatedAt: expected,
                    force: true
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setError(json?.error || "Falha ao marcar disputa.");
                return;
            }
            if (json?.match?.updatedAt) {
                setExpectedUpdatedAt(json.match.updatedAt);
                expectedUpdatedAtRef.current = json.match.updatedAt;
            }
            setInfo("Jogo marcado como disputado.");
            onUpdated();
        } finally{
            setDisputePending(false);
        }
    };
    const resolveDispute = async ()=>{
        if (saving || disputePending) return;
        if (!canResolveDispute) {
            setError("Apenas ADMIN pode resolver a disputa.");
            return;
        }
        const expected = expectedUpdatedAtRef.current ?? match.updatedAt ?? null;
        if (!expected) {
            setError("Sem versão do jogo.");
            return;
        }
        const confirmed = window.confirm("Resolver disputa e reabrir o jogo?");
        if (!confirmed) return;
        setDisputePending(true);
        setError(null);
        setInfo(null);
        const nextStatus = score.a > 0 || score.b > 0 ? "IN_PROGRESS" : "PENDING";
        try {
            const res = await fetch(`/api/organizador/tournaments/${tournamentId}/matches/${match.id}/result`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: nextStatus,
                    expectedUpdatedAt: expected,
                    force: true
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setError(json?.error || "Falha ao resolver disputa.");
                return;
            }
            if (json?.match?.updatedAt) {
                setExpectedUpdatedAt(json.match.updatedAt);
                expectedUpdatedAtRef.current = json.match.updatedAt;
            }
            setInfo("Disputa resolvida.");
            onUpdated();
        } finally{
            setDisputePending(false);
        }
    };
    const undoLast = async ()=>{
        if (undoing || saving) return;
        setUndoing(true);
        setError(null);
        setInfo(null);
        try {
            const res = await fetch(`/api/organizador/tournaments/${tournamentId}/matches/${match.id}/undo`, {
                method: "POST"
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setError(json?.error || "Undo indisponível.");
                return;
            }
            if (json?.match?.updatedAt) {
                setExpectedUpdatedAt(json.match.updatedAt);
                expectedUpdatedAtRef.current = json.match.updatedAt;
            }
            setScore({
                a: json?.match?.score?.goals?.a ?? 0,
                b: json?.match?.score?.goals?.b ?? 0
            });
            setInfo("Última ação desfeita.");
            onUpdated();
        } finally{
            setUndoing(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded-xl border border-white/10 bg-black/30 px-3 py-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "text-white text-sm",
                    children: [
                        "Golos (limite ",
                        goalLimit,
                        ")"
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 799,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 798,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2 grid gap-2 text-xs text-white/70",
                children: [
                    "A",
                    "B"
                ].map((side)=>{
                    const value = side === "A" ? score.a : score.b;
                    const finished = score.a === goalLimit || score.b === goalLimit;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-white/60",
                                children: side === "A" ? "Jogador A" : "Jogador B"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 807,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        disabled: locked || value <= 0,
                                        onClick: ()=>adjust(side, -1),
                                        className: "h-7 w-7 rounded-full border border-white/15 text-white/70 hover:border-white/40 disabled:opacity-50",
                                        children: "−"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 809,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "min-w-[24px] text-center text-sm text-white",
                                        children: value
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 817,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        disabled: locked || value >= goalLimit || finished,
                                        onClick: ()=>adjust(side, 1),
                                        className: "h-7 w-7 rounded-full border border-white/15 text-white/70 hover:border-white/40 disabled:opacity-50",
                                        children: "+"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 818,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 808,
                                columnNumber: 15
                            }, this)
                        ]
                    }, `${match.id}-score-${side}`, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 806,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 801,
                columnNumber: 7
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-2 text-[11px] text-rose-300",
                children: error
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 831,
                columnNumber: 17
            }, this),
            info && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-2 text-[11px] text-emerald-200",
                children: info
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 832,
                columnNumber: 16
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-3 flex flex-wrap gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: undoLast,
                        disabled: undoing || saving,
                        className: "rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40 disabled:opacity-60",
                        children: undoing ? "A desfazer…" : "Undo (60s)"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 834,
                        columnNumber: 9
                    }, this),
                    match.status === "DISPUTED" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: resolveDispute,
                        disabled: disputePending || saving || !canResolveDispute,
                        className: "rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60",
                        children: disputePending ? "A resolver…" : canResolveDispute ? "Resolver disputa" : "Resolver disputa (ADMIN)"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 843,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: markDisputed,
                        disabled: disputePending || saving || locked,
                        className: "rounded-full border border-rose-400/40 px-3 py-1 text-[11px] text-rose-100 hover:border-rose-200/70 disabled:opacity-60",
                        children: disputePending ? "A marcar…" : "Marcar disputa"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 852,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 833,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                className: "mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                        className: "cursor-pointer uppercase tracking-[0.18em] text-[11px]",
                        children: "Override manual"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 863,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-2 space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] text-amber-100/80",
                                children: "Usa só em casos excecionais."
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 867,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        disabled: saving || !match.pairing1Id,
                                        onClick: ()=>overrideWinner("A"),
                                        className: "rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60",
                                        children: [
                                            "Forçar ",
                                            match.pairing1Id ? `Jogador #${match.pairing1Id}` : "Jogador A"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 869,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        disabled: saving || !match.pairing2Id,
                                        onClick: ()=>overrideWinner("B"),
                                        className: "rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60",
                                        children: [
                                            "Forçar ",
                                            match.pairing2Id ? `Jogador #${match.pairing2Id}` : "Jogador B"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 877,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 868,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 866,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 862,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 797,
        columnNumber: 5
    }, this);
}
function LiveHubTv({ event, tournament, pairings, timeZone, showCourt }) {
    const matches = tournament.stages.flatMap((s)=>[
            ...s.matches,
            ...s.groups.flatMap((g)=>g.matches)
        ]);
    const upcoming = matches.filter((m)=>m.status !== "DONE" && m.status !== "IN_PROGRESS" && m.status !== "LIVE").sort((a, b)=>{
        if (a.startAt && b.startAt) {
            const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
            if (diff !== 0) return diff;
        }
        if (showCourt) {
            const aCourt = a.courtId ?? 9999;
            const bCourt = b.courtId ?? 9999;
            return aCourt - bCourt;
        }
        return 0;
    }).slice(0, 8);
    const live = matches.filter((m)=>m.status === "IN_PROGRESS" || m.status === "LIVE").slice(0, 6);
    const playoffStage = tournament.stages.find((s)=>s.stageType === "PLAYOFF" && s.matches?.length) ?? tournament.stages.find((s)=>s.matches?.length) ?? tournament.stages[0];
    const tvBracketMatches = playoffStage?.matches?.slice(0, 8) ?? [];
    const tvGroupStages = tournament.stages.filter((s)=>(s.groups ?? []).length > 0);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-8",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "flex flex-wrap items-end justify-between gap-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.4em] text-white/60",
                                children: "Modo TV"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 935,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-4xl font-semibold text-white",
                                children: event.title
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 936,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white/60",
                                children: formatDateRange(event.startsAt, event.endsAt, timeZone)
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 937,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 934,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70",
                        children: "Atualiza automaticamente"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 939,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 933,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid gap-5 lg:grid-cols-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-xl font-semibold",
                                        children: "Agora a jogar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 947,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-white/60 text-sm",
                                        children: [
                                            live.length,
                                            " ativos"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 948,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 946,
                                columnNumber: 11
                            }, this),
                            live.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white/60",
                                children: "Sem jogos em curso."
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 950,
                                columnNumber: 33
                            }, this),
                            live.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MatchCard, {
                                    match: m,
                                    pairings: pairings,
                                    timeZone: timeZone,
                                    size: "lg",
                                    showCourt: showCourt
                                }, `live-${m.id}`, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 952,
                                    columnNumber: 13
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 945,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-xl font-semibold",
                                        children: "Próximos jogos"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 958,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-white/60 text-sm",
                                        children: [
                                            upcoming.length,
                                            " agendados"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 959,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 957,
                                columnNumber: 11
                            }, this),
                            upcoming.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white/60",
                                children: "Sem jogos agendados."
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 961,
                                columnNumber: 37
                            }, this),
                            upcoming.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MatchCard, {
                                    match: m,
                                    pairings: pairings,
                                    timeZone: timeZone,
                                    size: "lg",
                                    showCourt: showCourt
                                }, `up-${m.id}`, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 963,
                                    columnNumber: 13
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 956,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 944,
                columnNumber: 7
            }, this),
            tvBracketMatches.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-xl font-semibold",
                                children: "Bracket"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 971,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-white/60 text-sm",
                                children: [
                                    tvBracketMatches.length,
                                    " jogos"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 972,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 970,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-2",
                        children: tvBracketMatches.map((match)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MatchCard, {
                                match: match,
                                pairings: pairings,
                                timeZone: timeZone,
                                size: "lg",
                                showCourt: showCourt
                            }, `tv-bracket-${match.id}`, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 976,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 974,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 969,
                columnNumber: 9
            }, this),
            tvBracketMatches.length === 0 && tvGroupStages.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-xl font-semibold",
                                children: "Tabela"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 984,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-white/60 text-sm",
                                children: "Classificações"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 985,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 983,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-4 md:grid-cols-2",
                        children: tvGroupStages.map((stage)=>stage.groups.map((group)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-white/10 bg-black/30 p-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "text-white font-semibold",
                                                    children: group.name || "Grupo"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 992,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[11px] uppercase tracking-[0.18em] text-white/50",
                                                    children: stage.stageType
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 993,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 991,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 space-y-2 text-sm",
                                            children: [
                                                (group.standings ?? []).length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-white/60",
                                                    children: "Sem classificação disponível."
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 997,
                                                    columnNumber: 23
                                                }, this),
                                                (group.standings ?? []).map((row, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between text-white/80",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex items-center gap-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "text-white/50",
                                                                        children: idx + 1
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                        lineNumber: 1002,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    renderPairingName(row.pairingId, pairings)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                lineNumber: 1001,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-white/50",
                                                                children: [
                                                                    row.wins,
                                                                    "-",
                                                                    row.losses
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                lineNumber: 1005,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, `tv-group-${group.id}-${row.pairingId}`, true, {
                                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                        lineNumber: 1000,
                                                        columnNumber: 23
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 995,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, `tv-group-${group.id}`, true, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 990,
                                    columnNumber: 17
                                }, this)))
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 987,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 982,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 932,
        columnNumber: 5
    }, this);
}
function BracketRoundsView({ matches, pairings, isOrganizerEdit, tournamentId, onUpdated, goalLimits, highlightPairingId, canResolveDispute, view = "split" }) {
    const [activeRound, setActiveRound] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const matchesByRound = matches.reduce((acc, match)=>{
        const round = match.round ?? 0;
        if (!acc[round]) acc[round] = [];
        acc[round].push(match);
        return acc;
    }, {});
    const rounds = Object.keys(matchesByRound).map((r)=>Number(r)).sort((a, b)=>a - b);
    const roundLabels = buildRoundLabels(rounds.length);
    const finalRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
    const roundLabelMap = rounds.reduce((acc, round, idx)=>{
        acc[round] = roundLabels[idx] || `Ronda ${round}`;
        return acc;
    }, {});
    const treeRowHeight = 32;
    const liveMatches = matches.filter((match)=>match.status === "IN_PROGRESS" || match.status === "LIVE");
    const liveRounds = new Set(liveMatches.map((match)=>match.round ?? 0).filter((round)=>round > 0));
    const liveRound = liveMatches[0]?.round ?? null;
    const roundIsComplete = (round)=>{
        const list = matchesByRound[round] ?? [];
        return list.length > 0 && list.every((match)=>match.status === "DONE");
    };
    const roundHasLive = (round)=>{
        const list = matchesByRound[round] ?? [];
        return list.some((match)=>match.status === "IN_PROGRESS" || match.status === "LIVE");
    };
    const currentRound = (liveRound && rounds.includes(liveRound) ? liveRound : null) ?? rounds.find((round)=>!roundIsComplete(round)) ?? finalRound;
    const roundIsLocked = (round)=>{
        const idx = rounds.indexOf(round);
        if (idx <= 0) return false;
        return rounds.slice(0, idx).some((r)=>!roundIsComplete(r));
    };
    const desktopTreeStartIndex = Math.max(0, rounds.length - 3);
    const mobileTreeStartIndex = Math.max(0, rounds.length - 2);
    const activeRoundIndex = activeRound ? rounds.indexOf(activeRound) : -1;
    const desktopTreeRounds = rounds.slice(desktopTreeStartIndex);
    const mobileTreeRounds = rounds.slice(mobileTreeStartIndex);
    const showDesktopTree = activeRoundIndex >= desktopTreeStartIndex;
    const showMobileTree = activeRoundIndex >= mobileTreeStartIndex;
    const renderRow = (side, match, winnerSide, summary, compact, final)=>{
        const pairingId = side === "A" ? match.pairing1Id : match.pairing2Id;
        const isWinner = winnerSide === side;
        const isLoser = winnerSide && winnerSide !== side;
        const score = summary ? side === "A" ? summary.a : summary.b : 0;
        const scoreTone = isWinner ? "text-emerald-300" : isLoser ? "text-rose-300" : "text-white/70";
        const nameTone = isLoser ? "text-white/50" : "text-white/85";
        const textClass = compact ? "text-[11px]" : "text-sm";
        const paddingClass = compact ? "py-1" : "py-2";
        if (compact) {
            const meta = pairingMeta(pairingId, pairings);
            const fallbackLabel = pairingId ? `#${pairingId}` : "A definir";
            const label = meta?.label ?? fallbackLabel;
            const displayLabel = label.length > 16 ? label.slice(0, 16) : label;
            const avatarUrl = meta?.avatarUrl || __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$avatars$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_GUEST_AVATAR"];
            const avatarClass = final ? "h-14 w-14" : "h-12 w-12";
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `flex items-center justify-between gap-3 ${paddingClass}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-center gap-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: `${avatarClass} rounded-full border border-white/10 bg-white/10 bg-cover bg-center`,
                                    style: {
                                        backgroundImage: `url(${avatarUrl})`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1113,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: `max-w-[120px] truncate text-[11px] ${nameTone}`,
                                    title: label,
                                    children: displayLabel
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1117,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1112,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1111,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: `min-w-[22px] text-right text-base font-semibold tabular-nums ${final ? "text-lg" : ""} ${scoreTone}`,
                        children: score
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1122,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1110,
                columnNumber: 9
            }, this);
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `flex items-center justify-between gap-2 ${paddingClass}`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `min-w-0 ${textClass} ${nameTone}`,
                    children: renderPairingName(pairingId, pairings, "truncate")
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1132,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: `${textClass} min-w-[24px] text-right font-semibold tabular-nums ${scoreTone}`,
                    children: score
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1133,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 1131,
            columnNumber: 7
        }, this);
    };
    const renderListMatch = (match, options)=>{
        const summary = getScoreSummary(match.score);
        const winnerSide = match.status === "DONE" ? getWinnerSide(match.score) : null;
        const isLive = match.status === "IN_PROGRESS" || match.status === "LIVE";
        const isDisputed = match.status === "DISPUTED";
        const isLocked = Boolean(options?.locked || isDisputed);
        const lockedReason = isDisputed ? "Jogo em disputa. Resolve antes de editar." : options?.locked ? "Esta fase ainda não está ativa." : null;
        const useCompact = Boolean(options?.compact);
        const isHighlighted = typeof highlightPairingId === "number" && (match.pairing1Id === highlightPairingId || match.pairing2Id === highlightPairingId);
        const wrapperTone = useCompact ? "border-transparent bg-transparent" : isDisputed ? "border-rose-400/60 bg-rose-500/10" : isLive ? "border-emerald-400/70 bg-emerald-500/15" : isHighlighted ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-black/30";
        const isFinal = Boolean(options?.final);
        const paddingClass = isFinal ? "p-3" : useCompact ? "p-2" : "p-3";
        const accentClass = options?.accent ? "ring-1 ring-white/25 shadow-[0_10px_24px_rgba(0,0,0,0.35)]" : "";
        const liveClass = isLive ? "ring-1 ring-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.25)]" : "";
        const disputeClass = isDisputed ? "ring-1 ring-rose-400/60 shadow-[0_0_16px_rgba(244,63,94,0.28)]" : "";
        const finalClass = isFinal ? "ring-1 ring-amber-300/70 shadow-[0_18px_40px_rgba(0,0,0,0.45)]" : "";
        const needsRelative = Boolean(options?.withConnector || options?.connectorSide || isLive);
        const lockedClass = isLocked ? "opacity-70" : "";
        const wrapperClass = `${needsRelative ? "relative" : ""} rounded-2xl border ${wrapperTone} ${paddingClass} ${accentClass} ${liveClass} ${disputeClass} ${finalClass} ${lockedClass}`;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: wrapperClass,
            style: options?.style,
            children: [
                isLive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "absolute -top-2 left-3 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-100",
                    children: "Live"
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1189,
                    columnNumber: 11
                }, this),
                isDisputed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "absolute -top-2 left-3 rounded-full border border-rose-400/60 bg-rose-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-rose-100",
                    children: "Disputa"
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1194,
                    columnNumber: 11
                }, this),
                isFinal && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "absolute -top-2 right-3 rounded-full border border-amber-300/70 bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-100",
                    children: "Final"
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1199,
                    columnNumber: 11
                }, this),
                isFinal ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-2 gap-4",
                    children: [
                        renderRow("A", match, winnerSide, summary, useCompact, isFinal),
                        renderRow("B", match, winnerSide, summary, useCompact, isFinal)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1204,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: useCompact ? "space-y-1" : "space-y-2",
                    children: [
                        renderRow("A", match, winnerSide, summary, useCompact, isFinal),
                        renderRow("B", match, winnerSide, summary, useCompact, isFinal)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1209,
                    columnNumber: 11
                }, this),
                (options?.withConnector || options?.connectorSide) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `pointer-events-none absolute top-1/2 h-px w-6 bg-white/15 ${options?.connectorSide === "left" ? "left-[-18px]" : "right-[-18px]"}`
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1215,
                    columnNumber: 11
                }, this),
                options?.connectorHeight && options?.connectorDirection && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `pointer-events-none absolute w-px bg-white/15 ${options?.connectorSide === "left" ? "left-[-18px]" : "right-[-18px]"} ${options?.connectorDirection === "up" ? "bottom-1/2" : "top-1/2"}`,
                    style: {
                        height: options.connectorHeight
                    }
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1222,
                    columnNumber: 11
                }, this),
                isOrganizerEdit && tournamentId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "pt-1",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(OrganizerMatchEditor, {
                        match: match,
                        tournamentId: tournamentId,
                        onUpdated: onUpdated,
                        goalLimit: resolveGoalLimit(match.round ?? null, goalLimits),
                        locked: isLocked,
                        lockedReason: lockedReason,
                        canResolveDispute: canResolveDispute
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1231,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1230,
                    columnNumber: 11
                }, this)
            ]
        }, `list-${match.id}`, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 1187,
            columnNumber: 7
        }, this);
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (rounds.length === 0) return;
        if (!activeRound || !rounds.includes(activeRound)) {
            setActiveRound(currentRound ?? rounds[0]);
        }
    }, [
        activeRound,
        currentRound,
        rounds.join(",")
    ]);
    const activeMatches = activeRound ? matchesByRound[activeRound] ?? [] : [];
    const activeMatchesSorted = activeMatches.slice().sort((a, b)=>a.id - b.id);
    const splitIndex = Math.ceil(activeMatchesSorted.length / 2);
    const leftMatches = activeMatchesSorted.slice(0, splitIndex);
    const rightMatches = activeMatchesSorted.slice(splitIndex);
    const renderSymmetricTreeGrid = (treeRounds, options)=>{
        if (treeRounds.length === 0) return null;
        const lastRound = treeRounds[treeRounds.length - 1];
        const leftRounds = treeRounds.filter((round)=>round !== lastRound);
        const leftCount = leftRounds.length;
        const columns = leftCount * 2 + 1;
        const rowHeight = options?.rowHeight ?? treeRowHeight;
        const minColWidth = options?.minColWidth ?? 160;
        const treeRows = leftCount > 0 ? 2 ** leftCount : 1;
        const leftIndexMap = leftRounds.reduce((acc, round, idx)=>{
            acc[round] = idx;
            return acc;
        }, {});
        const rightRounds = [
            ...leftRounds
        ].reverse();
        const columnLabels = [
            ...leftRounds.map((round)=>roundLabelMap[round] || `Ronda ${round}`),
            roundLabelMap[lastRound] || `Ronda ${lastRound}`,
            ...rightRounds.map((round)=>roundLabelMap[round] || `Ronda ${round}`)
        ];
        const roundMatches = (round)=>(matchesByRound[round] ?? []).slice().sort((a, b)=>compareBracketOrder(a, b));
        const roundSplit = (round)=>{
            const list = roundMatches(round);
            const half = Math.ceil(list.length / 2);
            return {
                left: list.slice(0, half),
                right: list.slice(half)
            };
        };
        const finalMatch = roundMatches(lastRound)[0] ?? null;
        const finalRow = leftCount > 0 ? 2 ** (leftCount - 1) : 1;
        const accentRound = options?.accentRound ?? null;
        const columnTemplate = options?.minColWidth && options.minColWidth > 0 ? `repeat(${columns}, minmax(${options.minColWidth}px, 1fr))` : `repeat(${columns}, minmax(0, 1fr))`;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid gap-4",
                    style: {
                        gridTemplateColumns: columnTemplate
                    },
                    children: columnLabels.map((label, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.24em] text-white/50",
                            children: label
                        }, `sym-label-${idx}`, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1300,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1298,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid gap-x-6 gap-y-2",
                    style: {
                        gridTemplateColumns: columnTemplate,
                        gridTemplateRows: `repeat(${treeRows}, minmax(${rowHeight}px, 1fr))`,
                        minHeight: treeRows ? `${treeRows * rowHeight}px` : undefined
                    },
                    children: [
                        leftRounds.flatMap((round, colIdx)=>{
                            const { left } = roundSplit(round);
                            const roundIndex = leftIndexMap[round] ?? colIdx;
                            const connectorHeight = left.length > 1 ? rowHeight * 2 ** roundIndex : 0;
                            return left.map((match, matchIdx)=>{
                                const row = 2 ** roundIndex * (2 * matchIdx + 1);
                                const connectorDirection = matchIdx % 2 === 0 ? "down" : "up";
                                return renderListMatch(match, {
                                    connectorSide: "right",
                                    connectorDirection: connectorHeight ? connectorDirection : undefined,
                                    connectorHeight: connectorHeight || undefined,
                                    compact: options?.compact,
                                    locked: roundIsLocked(round),
                                    style: {
                                        gridColumn: colIdx + 1,
                                        gridRow: row
                                    }
                                });
                            });
                        }),
                        finalMatch && renderListMatch(finalMatch, {
                            compact: options?.compact,
                            accent: accentRound === lastRound,
                            final: true,
                            locked: roundIsLocked(lastRound),
                            style: {
                                gridColumn: leftCount + 1,
                                gridRow: finalRow
                            }
                        }),
                        rightRounds.flatMap((round, idx)=>{
                            const { right } = roundSplit(round);
                            const roundIndex = leftIndexMap[round] ?? 0;
                            const col = leftCount + 2 + idx;
                            const connectorHeight = right.length > 1 ? rowHeight * 2 ** roundIndex : 0;
                            return right.map((match, matchIdx)=>{
                                const row = 2 ** roundIndex * (2 * matchIdx + 1);
                                const connectorDirection = matchIdx % 2 === 0 ? "down" : "up";
                                return renderListMatch(match, {
                                    connectorSide: "left",
                                    connectorDirection: connectorHeight ? connectorDirection : undefined,
                                    connectorHeight: connectorHeight || undefined,
                                    compact: options?.compact,
                                    locked: roundIsLocked(round),
                                    style: {
                                        gridColumn: col,
                                        gridRow: row
                                    }
                                });
                            });
                        })
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1305,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 1297,
            columnNumber: 7
        }, this);
    };
    const renderMobileFinalTree = (treeRounds)=>{
        if (treeRounds.length === 0) return null;
        const finalRound = treeRounds[treeRounds.length - 1];
        const semiRound = treeRounds.length > 1 ? treeRounds[treeRounds.length - 2] : null;
        const finalMatch = (matchesByRound[finalRound] ?? []).slice().sort(compareBracketOrder)[0] ?? null;
        const semiMatches = semiRound ? (matchesByRound[semiRound] ?? []).slice().sort(compareBracketOrder) : [];
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-4",
            children: [
                semiRound && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.2em] text-white/50",
                            children: roundLabelMap[semiRound] || `Ronda ${semiRound}`
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1373,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid gap-3 sm:grid-cols-2",
                            children: semiMatches.map((match)=>renderListMatch(match, {
                                    locked: roundIsLocked(match.round ?? 0)
                                }))
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1376,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1372,
                    columnNumber: 11
                }, this),
                finalMatch && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.2em] text-white/50",
                            children: roundLabelMap[finalRound] || `Ronda ${finalRound}`
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1385,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto max-w-sm",
                            children: renderListMatch(finalMatch, {
                                final: true,
                                accent: true,
                                locked: roundIsLocked(finalRound)
                            })
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1388,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1384,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 1370,
            columnNumber: 7
        }, this);
    };
    if (view === "full") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-4",
            children: rounds.map((round, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.2em] text-white/50",
                            children: roundLabels[idx] || `Ronda ${round}`
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1402,
                            columnNumber: 13
                        }, this),
                        (matchesByRound[round] ?? []).slice().sort((a, b)=>a.id - b.id).map((match)=>renderListMatch(match, {
                                locked: roundIsLocked(match.round ?? 0)
                            }))
                    ]
                }, `full-round-${round}`, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1401,
                    columnNumber: 11
                }, this))
        }, void 0, false, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 1399,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-3",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1",
                    children: rounds.map((round)=>{
                        const isActive = activeRound === round;
                        const isLiveRound = roundHasLive(round);
                        const isCompleted = roundIsComplete(round);
                        const isLocked = roundIsLocked(round);
                        const isCurrent = round === currentRound;
                        const tone = isCompleted ? "border-purple-400/60 bg-purple-500/15 text-purple-100" : isLiveRound || isCurrent ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100" : isLocked ? "border-white/10 bg-white/5 text-white/40" : "border-white/15 bg-white/5 text-white/60";
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>{
                                if (!isLocked) setActiveRound(round);
                            },
                            disabled: isLocked,
                            className: `shrink-0 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${tone} ${isLocked ? "cursor-not-allowed" : "hover:border-white/40"} ${isActive ? "ring-1 ring-white/30" : ""}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: roundLabelMap[round] || `Ronda ${round}`
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1444,
                                    columnNumber: 17
                                }, this),
                                isCompleted && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "ml-2 rounded-full border border-purple-400/50 bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-100",
                                    children: "Concluida"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1446,
                                    columnNumber: 19
                                }, this),
                                !isCompleted && isLiveRound && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "ml-2 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-100",
                                    children: "Live"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1451,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, `round-tab-${round}`, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1433,
                            columnNumber: 15
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1418,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1417,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "hidden md:block",
                children: showDesktopTree ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3",
                    children: renderSymmetricTreeGrid(desktopTreeRounds, {
                        compact: true,
                        rowHeight: 32,
                        minColWidth: 140,
                        accentRound: activeRound === finalRound ? finalRound : null
                    })
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1463,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid gap-3 md:grid-cols-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-3",
                            children: leftMatches.map((match)=>renderListMatch(match, {
                                    locked: roundIsLocked(match.round ?? 0)
                                }))
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1473,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-3",
                            children: rightMatches.map((match)=>renderListMatch(match, {
                                    locked: roundIsLocked(match.round ?? 0)
                                }))
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1478,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1472,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1461,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "md:hidden",
                children: showMobileTree ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3",
                    children: renderMobileFinalTree(mobileTreeRounds)
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1489,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3",
                    children: activeMatchesSorted.map((match)=>renderListMatch(match, {
                            locked: roundIsLocked(match.round ?? 0)
                        }))
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1491,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1487,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 1416,
        columnNumber: 5
    }, this);
}
function OneVOneBracket({ stage, pairings, eventStatus, isOrganizerEdit, tournamentId, onUpdated, goalLimits, canResolveDispute }) {
    if (!stage || !stage.matches || stage.matches.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
            className: "rounded-3xl border border-white/10 bg-white/5 p-5 text-white/70",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[11px] uppercase tracking-[0.3em] text-white/50",
                    children: "Bracket"
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1524,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    className: "mt-2 text-xl font-semibold text-white",
                    children: "Chave em preparação"
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1525,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-white/60",
                    children: "Em breve os jogos vão aparecer aqui."
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1526,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 1523,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.3em] text-white/50",
                                children: "Bracket"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1535,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-xl font-semibold text-white",
                                children: stage.name || "Eliminatórias 1v1"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1536,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1534,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs text-white/50",
                        children: eventStatus === "Próximo" ? "Pré-evento" : "Ao vivo"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1538,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1533,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(BracketRoundsView, {
                matches: stage.matches,
                pairings: pairings,
                isOrganizerEdit: isOrganizerEdit,
                tournamentId: tournamentId,
                onUpdated: onUpdated,
                goalLimits: goalLimits,
                canResolveDispute: canResolveDispute
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1540,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 1532,
        columnNumber: 5
    }, this);
}
function OneVOneLiveLayout({ event, organizer, tournament, pairings, timeZone, eventStatus, countdownLabel, nowMatch, championLabel, sponsors, onToggleFollow, followPending, isFollowing, showSponsors, isOrganizerEdit, canManageLiveConfig, canResolveDispute, onRefresh: onRefresh1, variant = "full" }) {
    const streamEmbed = getStreamEmbed(event.liveStreamUrl);
    const embedUrl = streamEmbed.embedUrl;
    const streamHref = streamEmbed.href;
    const streamLabel = streamEmbed.provider === "youtube" ? "Abrir no YouTube" : streamEmbed.provider === "twitch" ? "Abrir na Twitch" : "Abrir stream";
    const [streamUrl, setStreamUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(event.liveStreamUrl ?? "");
    const [savingConfig, setSavingConfig] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [configMessage, setConfigMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [sponsorDraft, setSponsorDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(sponsors ?? {});
    const [goalLimitsDraft, setGoalLimitsDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(normalizeGoalLimits(tournament?.goalLimits));
    const [activeTab, setActiveTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("chat");
    const featuredMatchId = typeof tournament?.featuredMatchId === "number" ? tournament.featuredMatchId : null;
    const bracketStage = tournament?.stages?.find((s)=>s.stageType === "PLAYOFF" && s.matches?.length) ?? tournament?.stages?.find((s)=>s.matches?.length) ?? null;
    const flatMatches = tournament?.stages ? tournament.stages.flatMap((s)=>[
            ...s.matches,
            ...(s.groups ?? []).flatMap((g)=>g.matches)
        ]) : [];
    const firstRoundMatches = bracketStage?.matches?.filter((m)=>(m.round ?? 0) === 1) ?? [];
    const playerCount = firstRoundMatches.length ? firstRoundMatches.length * 2 : null;
    const locationLabel = [
        event.locationCity,
        event.locationName
    ].filter(Boolean).join(" · ");
    const nowLabelParts = nowMatch ? [
        pairingLabelPlain(nowMatch.pairing1Id, pairings),
        pairingLabelPlain(nowMatch.pairing2Id, pairings)
    ].filter(Boolean) : [];
    const nowLabel = nowLabelParts.length ? nowLabelParts.join(" vs ") : null;
    const scoreLabel = nowMatch ? formatScore(nowMatch.score) : null;
    const heroStatus = eventStatus === "A decorrer" ? `Ao vivo${nowLabel ? ` · Agora a jogar: ${nowLabel}${scoreLabel && scoreLabel !== "—" ? ` (${scoreLabel})` : ""}` : ""}` : eventStatus === "Concluído" ? championLabel ? `Concluído · Campeão: ${championLabel}` : "Concluído" : "A live começa em breve";
    const hasHeroSponsor = Boolean(sponsors?.hero?.logoUrl || sponsors?.hero?.label);
    const nowSponsor = sponsors?.nowPlaying ?? null;
    const sideSponsors = [
        sponsors?.sideA,
        sponsors?.sideB
    ].filter((slot)=>slot && (slot.logoUrl || slot.label));
    const goalLimits = normalizeGoalLimits(tournament?.goalLimits);
    const goalDefaultLimit = goalLimits?.defaultLimit ?? 3;
    const goalRoundOverrides = goalLimits?.roundLimits ?? null;
    const roundNumbers = bracketStage?.matches ? Array.from(new Set(bracketStage.matches.map((m)=>m.round ?? 0))).filter((r)=>r > 0).sort((a, b)=>a - b) : [];
    const roundLabels = buildRoundLabels(roundNumbers.length);
    const roundLabelMap = roundNumbers.reduce((acc, round, idx)=>{
        acc[round] = roundLabels[idx] || `Ronda ${round}`;
        return acc;
    }, {});
    const nowSummary = nowMatch ? getScoreSummary(nowMatch.score) : null;
    const nowWinnerSide = nowMatch && nowMatch.status === "DONE" ? getWinnerSide(nowMatch.score) : null;
    const nowIsLive = nowMatch ? nowMatch.status === "IN_PROGRESS" || nowMatch.status === "LIVE" : false;
    const nowMetaA = nowMatch ? pairingMeta(nowMatch.pairing1Id, pairings) : null;
    const nowMetaB = nowMatch ? pairingMeta(nowMatch.pairing2Id, pairings) : null;
    const nowLabelA = nowMetaA?.label ?? "";
    const nowLabelB = nowMetaB?.label ?? "";
    const nowDisplayLabelA = nowLabelA.length > 16 ? nowLabelA.slice(0, 16) : nowLabelA;
    const nowDisplayLabelB = nowLabelB.length > 16 ? nowLabelB.slice(0, 16) : nowLabelB;
    const nowAvatarA = nowMetaA?.avatarUrl || __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$avatars$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_GUEST_AVATAR"];
    const nowAvatarB = nowMetaB?.avatarUrl || __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$avatars$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_GUEST_AVATAR"];
    const nowScoreA = nowSummary ? nowSummary.a : 0;
    const nowScoreB = nowSummary ? nowSummary.b : 0;
    const overrideActive = Boolean(featuredMatchId && nowMatch?.id === featuredMatchId);
    const [featuredDraft, setFeaturedDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(featuredMatchId);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setStreamUrl(event.liveStreamUrl ?? "");
    }, [
        event.liveStreamUrl
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setSponsorDraft(sponsors ?? {});
    }, [
        sponsors
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setGoalLimitsDraft(normalizeGoalLimits(tournament?.goalLimits));
    }, [
        tournament?.goalLimits
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setFeaturedDraft(featuredMatchId);
    }, [
        featuredMatchId
    ]);
    const saveFeaturedMatch = async (matchId)=>{
        if (!tournament?.id) return;
        setSavingConfig(true);
        setConfigMessage(null);
        try {
            await fetch(`/api/organizador/tournaments/${tournament.id}/featured-match`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    matchId
                })
            });
            setConfigMessage(matchId ? "Override aplicado." : "Override removido.");
            onRefresh1();
        } catch  {
            setConfigMessage("Erro ao atualizar override.");
        } finally{
            setSavingConfig(false);
            setTimeout(()=>setConfigMessage(null), 2000);
        }
    };
    const saveLiveConfig = async ()=>{
        setSavingConfig(true);
        setConfigMessage(null);
        try {
            if (streamUrl.trim() !== (event.liveStreamUrl ?? "")) {
                await fetch("/api/organizador/events/update", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        eventId: event.id,
                        liveStreamUrl: streamUrl.trim() || null
                    })
                });
            }
            if (tournament?.id) {
                await fetch(`/api/organizador/tournaments/${tournament.id}/sponsors`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        hero: sponsorDraft?.hero ?? null,
                        sideA: sponsorDraft?.sideA ?? null,
                        sideB: sponsorDraft?.sideB ?? null,
                        nowPlaying: sponsorDraft?.nowPlaying ?? null
                    })
                });
                await fetch(`/api/organizador/tournaments/${tournament.id}/rules`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        defaultLimit: goalLimitsDraft?.defaultLimit ?? null,
                        roundLimits: goalLimitsDraft?.roundLimits ?? {}
                    })
                });
            }
            setConfigMessage("Configuração guardada.");
            onRefresh1();
        } catch  {
            setConfigMessage("Erro ao guardar configuração.");
        } finally{
            setSavingConfig(false);
            setTimeout(()=>setConfigMessage(null), 2000);
        }
    };
    const updateDefaultLimit = (value)=>{
        const next = value === "" ? null : Number(value);
        if (value !== "" && !Number.isFinite(next)) return;
        setGoalLimitsDraft((prev)=>({
                ...prev ?? {},
                defaultLimit: next,
                roundLimits: prev?.roundLimits ?? null
            }));
    };
    const updateRoundLimit = (round, value)=>{
        const next = value === "" ? null : Number(value);
        if (value !== "" && !Number.isFinite(next)) return;
        setGoalLimitsDraft((prev)=>{
            const roundLimits = {
                ...prev?.roundLimits ?? {}
            };
            if (next === null) {
                delete roundLimits[String(round)];
            } else {
                roundLimits[String(round)] = next;
            }
            return {
                ...prev ?? {},
                roundLimits: Object.keys(roundLimits).length ? roundLimits : null
            };
        });
    };
    const heroSponsorSection = hasHeroSponsor ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rounded-3xl border border-white/10 bg-white/5 p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
            href: sponsors?.hero?.url || undefined,
            target: sponsors?.hero?.url ? "_blank" : undefined,
            rel: sponsors?.hero?.url ? "noreferrer" : undefined,
            className: "flex items-center justify-between gap-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                            children: "Sponsor principal"
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1785,
                            columnNumber: 11
                        }, this),
                        sponsors?.hero?.label && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-white/80",
                            children: sponsors.hero.label
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1786,
                            columnNumber: 37
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1784,
                    columnNumber: 9
                }, this),
                sponsors?.hero?.logoUrl && // eslint-disable-next-line @next/next/no-img-element
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                    src: sponsors.hero.logoUrl,
                    alt: sponsors.hero.label || "Sponsor",
                    className: "h-10 w-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2 object-contain"
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1790,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 1778,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 1777,
        columnNumber: 5
    }, this) : null;
    const nowPlayingSection = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-lg font-semibold text-white",
                        children: "Agora a jogar"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1803,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 text-xs text-white/50",
                        children: [
                            overrideActive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70",
                                children: "Override"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1806,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: nowMatch ? nowIsLive ? "Ao vivo" : "Ultimo resultado" : "Sem destaque"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1810,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1804,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1802,
                columnNumber: 7
            }, this),
            nowSponsor && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/70",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "uppercase tracking-[0.2em] text-white/50",
                        children: "Sponsor do jogo"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1815,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            nowSponsor.logoUrl && // eslint-disable-next-line @next/next/no-img-element
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                src: nowSponsor.logoUrl,
                                alt: nowSponsor.label || "Sponsor",
                                className: "h-7 w-auto rounded-lg border border-white/10 bg-white/5 px-2 py-1 object-contain"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1819,
                                columnNumber: 15
                            }, this),
                            nowSponsor.label && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: nowSponsor.label
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1825,
                                columnNumber: 34
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1816,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1814,
                columnNumber: 9
            }, this),
            !nowMatch && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-white/60",
                children: "Sem jogos em curso."
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1829,
                columnNumber: 21
            }, this),
            nowMatch && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `rounded-2xl border p-4 ${nowIsLive ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-black/20"}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `h-20 w-20 rounded-full border border-white/10 bg-white/10 bg-cover bg-center ${nowWinnerSide === "A" ? "ring-2 ring-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]" : ""}`,
                                    style: {
                                        backgroundImage: `url(${nowAvatarA})`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1838,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "max-w-[140px] truncate text-sm text-white/85",
                                    title: nowLabelA,
                                    children: nowDisplayLabelA
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1844,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: `text-3xl font-semibold ${nowWinnerSide === "A" ? "text-emerald-300" : nowWinnerSide ? "text-rose-300" : "text-white/70"}`,
                                    children: nowScoreA
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1847,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1837,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-center gap-2 text-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[11px] uppercase tracking-[0.3em] text-white/50",
                                    children: nowIsLive ? "Agora a jogar" : "Resultado"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1856,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-sm font-semibold text-white/80",
                                    children: "VS"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1859,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1855,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `h-20 w-20 rounded-full border border-white/10 bg-white/10 bg-cover bg-center ${nowWinnerSide === "B" ? "ring-2 ring-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]" : ""}`,
                                    style: {
                                        backgroundImage: `url(${nowAvatarB})`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1862,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "max-w-[140px] truncate text-sm text-white/85",
                                    title: nowLabelB,
                                    children: nowDisplayLabelB
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1868,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: `text-3xl font-semibold ${nowWinnerSide === "B" ? "text-emerald-300" : nowWinnerSide ? "text-rose-300" : "text-white/70"}`,
                                    children: nowScoreB
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1871,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 1861,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 1836,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1831,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 1801,
        columnNumber: 5
    }, this);
    if (variant === "inline") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-4",
            children: [
                heroSponsorSection,
                nowPlayingSection
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 1887,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-8",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_55%),linear-gradient(135deg,rgba(6,8,20,0.9),rgba(15,18,35,0.8))] p-6 text-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] uppercase tracking-[0.45em] text-white/50",
                        children: "Live"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1897,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "mt-2 text-3xl font-semibold text-white md:text-4xl",
                        children: [
                            event.title,
                            " — Live"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1898,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-2 text-sm text-white/60",
                        children: [
                            locationLabel,
                            playerCount ? ` · ${playerCount} jogadores` : "",
                            " · Eliminatórias 1v1"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1899,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-2 text-sm text-white/70",
                        children: heroStatus
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1904,
                        columnNumber: 9
                    }, this),
                    eventStatus === "Próximo" && countdownLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto mt-4 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[11px] uppercase tracking-[0.2em] text-white/50",
                                children: "O evento começa em"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1907,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-lg font-semibold text-white",
                                children: countdownLabel
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1908,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1906,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1896,
                columnNumber: 7
            }, this),
            nowPlayingSection,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `grid gap-6 ${hasHeroSponsor ? "lg:grid-cols-[1.6fr_1fr]" : ""}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                                                children: "Live stream"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 1919,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-lg font-semibold text-white",
                                                children: embedUrl ? "Em direto" : "Live em breve"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 1920,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 1918,
                                        columnNumber: 13
                                    }, this),
                                    eventStatus === "A decorrer" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-200",
                                        children: "Live"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 1923,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1917,
                                columnNumber: 11
                            }, this),
                            embedUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                                    src: embedUrl,
                                    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                                    allowFullScreen: true,
                                    className: "h-full w-full",
                                    title: "Live stream"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 1930,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1929,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/70",
                                children: "A live vai começar em breve. Assim que o link estiver ativo aparece aqui."
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1939,
                                columnNumber: 13
                            }, this),
                            !embedUrl && streamHref && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: streamHref,
                                target: "_blank",
                                rel: "noreferrer",
                                className: "rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:border-white/40",
                                children: streamLabel
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1944,
                                columnNumber: 13
                            }, this),
                            !embedUrl && organizer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                disabled: followPending,
                                onClick: onToggleFollow,
                                className: "rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-60",
                                children: followPending ? "A atualizar…" : isFollowing ? "A seguir" : "Segue para receber notificação"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1954,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 pt-2 text-[11px] uppercase tracking-[0.18em] text-white/50",
                                children: [
                                    "chat",
                                    "stats",
                                    "rules"
                                ].map((tab)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setActiveTab(tab),
                                        className: `rounded-full border px-3 py-1 ${activeTab === tab ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100" : "border-white/15 bg-white/5 text-white/60"}`,
                                        children: tab === "chat" ? "Chat" : tab === "stats" ? "Stats" : "Regras"
                                    }, tab, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 1965,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1963,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70",
                                children: [
                                    activeTab === "chat" && "Chat disponível em breve.",
                                    activeTab === "stats" && "Stats do torneio em breve.",
                                    activeTab === "rules" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "space-y-1 text-sm text-white/70",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: "Jogo a eliminar direto (1v1)."
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 1984,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: "Vence quem chega primeiro ao limite de golos."
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 1985,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: [
                                                    "Limite padrão: ",
                                                    goalDefaultLimit,
                                                    " golos."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 1986,
                                                columnNumber: 17
                                            }, this),
                                            goalRoundOverrides && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: "Existem limites por ronda configurados pelo organizador."
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 1988,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: "Fair play obrigatório."
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 1990,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: "Decisões do staff são finais."
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 1991,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 1983,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 1979,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 1916,
                        columnNumber: 9
                    }, this),
                    heroSponsorSection
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 1915,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(OneVOneBracket, {
                stage: bracketStage,
                pairings: pairings,
                eventStatus: eventStatus,
                isOrganizerEdit: isOrganizerEdit,
                tournamentId: tournament?.id ?? null,
                onUpdated: onRefresh1,
                goalLimits: tournament?.goalLimits,
                canResolveDispute: canResolveDispute
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 2000,
                columnNumber: 7
            }, this),
            sideSponsors.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-3xl border border-white/10 bg-white/5 p-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid gap-2 md:grid-cols-2",
                    children: sideSponsors.map((slot, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                            href: slot.url || undefined,
                            target: slot.url ? "_blank" : undefined,
                            rel: slot.url ? "noreferrer" : undefined,
                            className: "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70",
                            children: [
                                slot.logoUrl && // eslint-disable-next-line @next/next/no-img-element
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                    src: slot.logoUrl,
                                    alt: slot.label || "Sponsor",
                                    className: "h-8 w-auto object-contain"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2024,
                                    columnNumber: 19
                                }, this),
                                slot.label && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: slot.label
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2026,
                                    columnNumber: 32
                                }, this)
                            ]
                        }, `side-sponsor-${idx}`, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2015,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2013,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 2012,
                columnNumber: 9
            }, this),
            showSponsors && !hasHeroSponsor && sideSponsors.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SponsorsStrip, {
                organizer: organizer
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 2033,
                columnNumber: 72
            }, this),
            isOrganizerEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "text-base font-semibold text-white",
                                children: "Live Ops (overlay)"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2038,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-white/50",
                                children: "Organizador"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2039,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2037,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.2em] text-white/50",
                                children: "Agora a jogar"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2042,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        value: featuredDraft ?? "",
                                        onChange: (e)=>{
                                            const value = e.target.value;
                                            setFeaturedDraft(value ? Number(value) : null);
                                        },
                                        className: "min-w-[220px] flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "Automático"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2052,
                                                columnNumber: 17
                                            }, this),
                                            flatMatches.filter((m)=>m.pairing1Id && m.pairing2Id).sort(compareMatchOrder).map((match)=>{
                                                const label = `${pairingLabelPlain(match.pairing1Id, pairings)} vs ${pairingLabelPlain(match.pairing2Id, pairings)}`;
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: match.id,
                                                    children: [
                                                        "#",
                                                        match.id,
                                                        " · ",
                                                        label || "Jogo"
                                                    ]
                                                }, `featured-${match.id}`, true, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 2059,
                                                    columnNumber: 23
                                                }, this);
                                            })
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2044,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        disabled: savingConfig,
                                        onClick: ()=>saveFeaturedMatch(featuredDraft ?? null),
                                        className: "rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/80 hover:border-white/40 disabled:opacity-60",
                                        children: savingConfig ? "A guardar…" : "Aplicar override"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2065,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        disabled: savingConfig,
                                        onClick: ()=>saveFeaturedMatch(null),
                                        className: "rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/60 hover:border-white/40 disabled:opacity-60",
                                        children: "Reset automático"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2073,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2043,
                                columnNumber: 13
                            }, this),
                            featuredMatchId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] text-white/50",
                                children: [
                                    "Override ativo no jogo #",
                                    featuredMatchId,
                                    "."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2083,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2041,
                        columnNumber: 11
                    }, this),
                    configMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-white/60",
                        children: configMessage
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2086,
                        columnNumber: 29
                    }, this),
                    canManageLiveConfig ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-3 md:grid-cols-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "text-sm text-white/70",
                                                children: "URL da livestream"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2091,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: streamUrl,
                                                onChange: (e)=>setStreamUrl(e.target.value),
                                                placeholder: "https://youtube.com/...",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2092,
                                                columnNumber: 19
                                            }, this),
                                            streamUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: streamUrl,
                                                target: "_blank",
                                                rel: "noreferrer",
                                                className: "text-xs text-white/60 hover:text-white",
                                                children: "Testar embed ↗"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2099,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2090,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "text-sm text-white/70",
                                                children: "Sponsor principal"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2110,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: sponsorDraft?.hero?.label ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            hero: {
                                                                ...prev?.hero ?? {},
                                                                label: e.target.value
                                                            }
                                                        })),
                                                placeholder: "Nome do sponsor",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2111,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: sponsorDraft?.hero?.logoUrl ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            hero: {
                                                                ...prev?.hero ?? {},
                                                                logoUrl: e.target.value
                                                            }
                                                        })),
                                                placeholder: "URL do logo",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2122,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: sponsorDraft?.hero?.url ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            hero: {
                                                                ...prev?.hero ?? {},
                                                                url: e.target.value
                                                            }
                                                        })),
                                                placeholder: "Link (site/Instagram)",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2133,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2109,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "text-sm text-white/70",
                                                children: "Sponsor agora a jogar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2146,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: sponsorDraft?.nowPlaying?.label ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            nowPlaying: {
                                                                ...prev?.nowPlaying ?? {},
                                                                label: e.target.value
                                                            }
                                                        })),
                                                placeholder: "Nome do sponsor",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2147,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: sponsorDraft?.nowPlaying?.logoUrl ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            nowPlaying: {
                                                                ...prev?.nowPlaying ?? {},
                                                                logoUrl: e.target.value
                                                            }
                                                        })),
                                                placeholder: "URL do logo",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2158,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: sponsorDraft?.nowPlaying?.url ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            nowPlaying: {
                                                                ...prev?.nowPlaying ?? {},
                                                                url: e.target.value
                                                            }
                                                        })),
                                                placeholder: "Link (site/Instagram)",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2169,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2145,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2089,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-3 md:grid-cols-2",
                                children: [
                                    "sideA",
                                    "sideB"
                                ].map((slotKey)=>{
                                    const slot = sponsorDraft?.[slotKey] ?? null;
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "text-sm text-white/70",
                                                children: [
                                                    "Sponsor ",
                                                    slotKey === "sideA" ? "secundário A" : "secundário B"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2188,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: slot?.label ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            [slotKey]: {
                                                                ...slot ?? {},
                                                                label: e.target.value
                                                            }
                                                        })),
                                                placeholder: "Nome",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2191,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: slot?.logoUrl ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            [slotKey]: {
                                                                ...slot ?? {},
                                                                logoUrl: e.target.value
                                                            }
                                                        })),
                                                placeholder: "URL do logo",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2202,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: slot?.url ?? "",
                                                onChange: (e)=>setSponsorDraft((prev)=>({
                                                            ...prev ?? {},
                                                            [slotKey]: {
                                                                ...slot ?? {},
                                                                url: e.target.value
                                                            }
                                                        })),
                                                placeholder: "Link (site/Instagram)",
                                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2213,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, slotKey, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2187,
                                        columnNumber: 21
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2183,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                                                children: "Regras de golos"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2231,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                                className: "text-sm font-semibold text-white",
                                                children: "Limite por ronda"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2232,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2230,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid gap-2 sm:grid-cols-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "space-y-1 text-sm text-white/70",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Limite padrão"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                        lineNumber: 2236,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "number",
                                                        min: 1,
                                                        value: goalLimitsDraft?.defaultLimit ?? "",
                                                        onChange: (e)=>updateDefaultLimit(e.target.value),
                                                        placeholder: "Ex: 3",
                                                        className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                        lineNumber: 2237,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2235,
                                                columnNumber: 19
                                            }, this),
                                            roundNumbers.map((round)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "space-y-1 text-sm text-white/70",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: roundLabelMap[round] || `Ronda ${round}`
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                            lineNumber: 2248,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "number",
                                                            min: 1,
                                                            value: goalLimitsDraft?.roundLimits?.[String(round)] ?? "",
                                                            onChange: (e)=>updateRoundLimit(round, e.target.value),
                                                            placeholder: `${goalDefaultLimit}`,
                                                            className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                            lineNumber: 2249,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, `round-limit-${round}`, true, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 2247,
                                                    columnNumber: 21
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2234,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2229,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-3",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    disabled: savingConfig,
                                    onClick: saveLiveConfig,
                                    className: "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:border-emerald-300/70 disabled:opacity-60",
                                    children: savingConfig ? "A guardar…" : "Guardar configuração"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2263,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2262,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-white/50",
                        children: "Configuração avançada reservada a ADMIN."
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2274,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 2036,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 1895,
        columnNumber: 5
    }, this);
}
function EventLiveClient({ slug, variant = "full" }) {
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])();
    const { isLoggedIn } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useUser"])();
    const { openModal } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthModal"])();
    const [showFullBracket, setShowFullBracket] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [followPending, setFollowPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isFollowing, setIsFollowing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [startingMatchId, setStartingMatchId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [startMessage, setStartMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const isTv = searchParams?.get("tv") === "1";
    const isOrganizerRoute = Boolean(pathname && pathname.startsWith("/organizador/"));
    const [nowMs, setNowMs] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>Date.now());
    const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>`/api/livehub/${slug}`, [
        slug
    ]);
    const { data, error, mutate } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(url, fetcher, {
        refreshInterval: 10000
    });
    const organizer = data?.organizer ?? null;
    const access = data?.access;
    const tournament = data?.tournament ?? null;
    const tournamentStages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!tournament?.stages) return [];
        return tournament.stages.map((stage)=>{
            const shouldResolve = stage.stageType === "PLAYOFF";
            const matches = Array.isArray(stage.matches) ? shouldResolve ? resolveBracketAdvancement(stage.matches) : stage.matches : [];
            return {
                ...stage,
                matches
            };
        });
    }, [
        tournament
    ]);
    const tournamentView = tournament ? {
        ...tournament,
        stages: tournamentStages
    } : null;
    const pairings = data?.pairings || {};
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setIsFollowing(Boolean(organizer?.isFollowed));
    }, [
        organizer?.isFollowed
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const interval = setInterval(()=>setNowMs(Date.now()), 1000);
        return ()=>clearInterval(interval);
    }, []);
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-4 text-white/70",
            children: "Erro a carregar live."
        }, void 0, false, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 2347,
            columnNumber: 12
        }, this);
    }
    if (!data) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-4 text-white/70",
            children: "A carregar…"
        }, void 0, false, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 2350,
            columnNumber: 12
        }, this);
    }
    if (!data?.ok) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-4 text-white/70",
            children: "Live indisponível para este evento."
        }, void 0, false, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 2353,
            columnNumber: 12
        }, this);
    }
    const event = data.event;
    const viewerRole = data.viewerRole;
    const canEditMatches = Boolean(data?.canEditMatches);
    const organizerRole = typeof data?.organizerRole === "string" ? data.organizerRole : null;
    const canManageLiveConfig = organizerRole === "OWNER" || organizerRole === "CO_OWNER" || organizerRole === "ADMIN";
    const canResolveDispute = canManageLiveConfig;
    const liveHub = data.liveHub;
    const pairingIdFromQuery = searchParams?.get("pairingId");
    const showCourt = event.templateType === "PADEL";
    if (access?.liveHubAllowed === false) {
        const visibility = access?.liveHubVisibility ?? "PUBLIC";
        const message = visibility === "DISABLED" ? "O LiveHub foi desativado pelo organizador." : visibility === "PRIVATE" ? "O LiveHub está reservado para participantes." : "O LiveHub está indisponível.";
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-3xl border border-white/10 bg-black/40 p-6 text-white/70 space-y-2",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[11px] uppercase tracking-[0.3em] text-white/50",
                    children: "Acesso reservado"
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2377,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    className: "text-xl font-semibold text-white",
                    children: "Este LiveHub não está disponível agora."
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2378,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-white/60",
                    children: message
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2379,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 2376,
            columnNumber: 7
        }, this);
    }
    const timeZone = event.timezone || DEFAULT_TIMEZONE;
    const ensureAuthForFollow = ()=>{
        if (isLoggedIn) return true;
        const redirectTo = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : "/";
        openModal({
            mode: "login",
            redirectTo
        });
        return false;
    };
    const toggleFollow = async ()=>{
        if (!organizer) return;
        if (!ensureAuthForFollow()) return;
        const next = !isFollowing;
        setFollowPending(true);
        setIsFollowing(next);
        try {
            const res = await fetch(next ? "/api/social/follow-organizer" : "/api/social/unfollow-organizer", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    organizerId: organizer.id
                })
            });
            if (!res.ok) {
                setIsFollowing(!next);
            }
        } catch  {
            setIsFollowing(!next);
        } finally{
            setFollowPending(false);
        }
    };
    if (isTv && tournamentView) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LiveHubTv, {
            event: event,
            tournament: tournamentView,
            pairings: pairings,
            timeZone: timeZone,
            showCourt: showCourt
        }, void 0, false, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 2418,
            columnNumber: 7
        }, this);
    }
    const flatMatches = tournamentView ? tournamentView.stages.flatMap((s)=>[
            ...s.matches,
            ...s.groups.flatMap((g)=>g.matches)
        ]) : [];
    const roundsGlobal = Array.from(new Set(flatMatches.map((m)=>m.round ?? 0))).filter((r)=>r > 0).sort((a, b)=>a - b);
    const roundIsCompleteGlobal = (round)=>{
        const list = flatMatches.filter((m)=>(m.round ?? 0) === round);
        return list.length > 0 && list.every((m)=>m.status === "DONE");
    };
    const roundIsLockedGlobal = (round)=>{
        const idx = roundsGlobal.indexOf(round);
        if (idx <= 0) return false;
        return roundsGlobal.slice(0, idx).some((r)=>!roundIsCompleteGlobal(r));
    };
    const liveMatches = flatMatches.filter((m)=>m.status === "IN_PROGRESS" || m.status === "LIVE");
    const completedMatches = flatMatches.filter((m)=>m.status === "DONE");
    const byUpdatedAtDesc = (a, b)=>a.updatedAt && b.updatedAt ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : 0;
    const latestCompletedMatch = completedMatches.slice().sort(byUpdatedAtDesc)[0] ?? null;
    const defaultNowMatch = liveMatches.sort(compareMatchOrder)[0] ?? latestCompletedMatch;
    const oneVOneOrderedMatches = flatMatches.slice().sort(compareBracketOrder);
    const oneVOneLiveMatches = oneVOneOrderedMatches.filter((m)=>m.status === "IN_PROGRESS" || m.status === "LIVE");
    const oneVOneLatestCompleted = oneVOneOrderedMatches.filter((m)=>m.status === "DONE").sort(byUpdatedAtDesc)[0] ?? null;
    const oneVOneNowMatch = oneVOneLiveMatches[0] ?? oneVOneLatestCompleted;
    const usePremium = liveHub?.mode === "PREMIUM";
    const matchOrder = usePremium ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$organizerPremium$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getCustomLiveHubMatchOrder"])(organizer) : null;
    const useOneVOneOrdering = matchOrder === "ONEVONE";
    const isOneVOne = useOneVOneOrdering;
    const featuredMatchId = typeof tournamentView?.featuredMatchId === "number" ? tournamentView.featuredMatchId : null;
    const featuredMatch = featuredMatchId ? flatMatches.find((m)=>m.id === featuredMatchId) ?? null : null;
    const featuredActive = featuredMatch && featuredMatch.status !== "DONE" && featuredMatch.status !== "CANCELLED" ? featuredMatch : null;
    const autoNowMatch = useOneVOneOrdering ? oneVOneNowMatch : defaultNowMatch;
    const nowMatch = featuredActive ?? autoNowMatch;
    const upcomingMatches = flatMatches.filter((m)=>m.status !== "DONE" && m.id !== (nowMatch?.id ?? -1)).sort(compareMatchOrder).slice(0, 4);
    const recentResults = flatMatches.filter((m)=>m.status === "DONE").sort((a, b)=>a.updatedAt && b.updatedAt ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : 0).slice(0, 6);
    const modules = liveHub?.modules ?? [];
    const resolvedModules = event.liveStreamUrl && !modules.includes("VIDEO") ? [
        "VIDEO",
        ...modules
    ] : modules;
    const eventStatus = getEventStatusLabel(event.startsAt, event.endsAt);
    const calendarLinks = event.startsAt ? buildCalendarLinks(event, timeZone) : null;
    const countdownLabel = formatCountdown(event.startsAt, nowMs);
    const goalLimits = normalizeGoalLimits(tournamentView?.goalLimits);
    const sponsors = tournamentView?.sponsors ?? null;
    const derivedChampionPairingId = (()=>{
        if (!tournamentView?.stages?.length) return null;
        const playoffStages = tournamentView.stages.filter((stage)=>stage.stageType === "PLAYOFF" && stage.matches?.length);
        const bracketStage = playoffStages[playoffStages.length - 1] ?? tournamentView.stages.find((stage)=>stage.matches?.length);
        if (!bracketStage?.matches?.length) return null;
        const maxRound = Math.max(...bracketStage.matches.map((match)=>match.round ?? 0));
        if (!Number.isFinite(maxRound) || maxRound <= 0) return null;
        const finalMatch = bracketStage.matches.filter((match)=>(match.round ?? 0) === maxRound).sort((a, b)=>b.id - a.id)[0];
        if (!finalMatch || finalMatch.status !== "DONE") return null;
        const winnerSide = getWinnerSide(finalMatch.score);
        if (!winnerSide) return null;
        return winnerSide === "A" ? finalMatch.pairing1Id ?? null : finalMatch.pairing2Id ?? null;
    })();
    const championLabel = tournamentView?.championPairingId ? pairingLabelPlain(tournamentView.championPairingId, pairings) || null : derivedChampionPairingId ? pairingLabelPlain(derivedChampionPairingId, pairings) || null : null;
    const isOrganizerEdit = viewerRole === "ORGANIZER" && canEditMatches && isOrganizerRoute && searchParams?.get("edit") === "1";
    const organizerEditHref = (()=>{
        const base = isOrganizerRoute && pathname ? pathname : `/organizador/eventos/${event.id}/live`;
        const params = new URLSearchParams(searchParams?.toString());
        params.set("tab", "preview");
        params.set("edit", "1");
        return `${base}?${params.toString()}`;
    })();
    const pendingMatches = flatMatches.filter((match)=>match.status === "PENDING" || match.status === "SCHEDULED").sort(compareMatchOrder);
    const firstPlayableMatch = pendingMatches.find((match)=>match.pairing1Id && match.pairing2Id) ?? null;
    const startFirstMatch = async ()=>{
        if (!tournamentView || !firstPlayableMatch) {
            setStartMessage("Sem jogos completos para iniciar.");
            return;
        }
        if (!firstPlayableMatch.updatedAt) {
            setStartMessage("Sem versão do jogo.");
            return;
        }
        setStartingMatchId(firstPlayableMatch.id);
        setStartMessage(null);
        try {
            const res = await fetch(`/api/organizador/tournaments/${tournamentView.id}/matches/${firstPlayableMatch.id}/result`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: "IN_PROGRESS",
                    expectedUpdatedAt: firstPlayableMatch.updatedAt
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setStartMessage(json?.error || "Erro ao começar o jogo.");
                return;
            }
            setStartMessage("Jogo iniciado.");
            mutate();
        } catch  {
            setStartMessage("Erro ao começar o jogo.");
        } finally{
            setStartingMatchId(null);
        }
    };
    const nextPendingLabel = firstPlayableMatch ? [
        pairingLabelPlain(firstPlayableMatch.pairing1Id, pairings),
        pairingLabelPlain(firstPlayableMatch.pairing2Id, pairings)
    ].filter(Boolean).join(" vs ") : null;
    if (variant === "inline" && !isOneVOne) {
        const hero = sponsors?.hero;
        const inlineStatus = nowMatch ? nowMatch.status === "IN_PROGRESS" || nowMatch.status === "LIVE" ? "Ao vivo" : "Ultimo resultado" : "Sem destaque";
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-4",
            children: [
                hero && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "rounded-3xl border border-white/10 bg-white/5 p-4",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: hero.url || undefined,
                        target: hero.url ? "_blank" : undefined,
                        rel: hero.url ? "noreferrer" : undefined,
                        className: "flex items-center justify-between gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                                        children: "Sponsor principal"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2577,
                                        columnNumber: 17
                                    }, this),
                                    hero.label && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/80",
                                        children: hero.label
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2578,
                                        columnNumber: 32
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2576,
                                columnNumber: 15
                            }, this),
                            hero.logoUrl && // eslint-disable-next-line @next/next/no-img-element
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                src: hero.logoUrl,
                                alt: hero.label || "Sponsor",
                                className: "h-10 w-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2 object-contain"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2582,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2570,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2569,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-lg font-semibold text-white",
                                    children: "Agora a jogar"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2593,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs text-white/50",
                                    children: inlineStatus
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2594,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2592,
                            columnNumber: 11
                        }, this),
                        !nowMatch && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-white/60",
                            children: "Sem jogos em curso."
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2596,
                            columnNumber: 25
                        }, this),
                        nowMatch && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MatchCard, {
                            match: nowMatch,
                            pairings: pairings,
                            timeZone: timeZone,
                            size: "lg",
                            showCourt: showCourt
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2598,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2591,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 2567,
            columnNumber: 7
        }, this);
    }
    if (isOneVOne) {
        const showSponsors = resolvedModules.includes("SPONSORS");
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-6",
            children: [
                variant === "full" && viewerRole === "ORGANIZER" && canEditMatches && isOrganizerRoute && !isOrganizerEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70",
                    children: [
                        "Estás em modo público.",
                        " ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            href: organizerEditHref,
                            className: "text-white underline",
                            children: "Ativar overlay do organizador"
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2618,
                            columnNumber: 13
                        }, this),
                        "."
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2616,
                    columnNumber: 11
                }, this),
                variant === "full" && viewerRole === "ORGANIZER" && canEditMatches && isOrganizerRoute && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "rounded-3xl border border-white/10 bg-white/5 p-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center justify-between gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.2em] text-white/50",
                                            children: "Arranque"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2628,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm text-white/70",
                                            children: "Começa o primeiro jogo pendente."
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2629,
                                            columnNumber: 17
                                        }, this),
                                        nextPendingLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] text-white/50",
                                            children: [
                                                "Próximo: ",
                                                nextPendingLabel
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2631,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2627,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: startFirstMatch,
                                    disabled: !firstPlayableMatch || Boolean(startingMatchId),
                                    className: "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-[12px] font-semibold text-emerald-100 hover:border-emerald-300/70 disabled:opacity-60",
                                    children: startingMatchId ? "A iniciar…" : "Começar jogos"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2634,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2626,
                            columnNumber: 13
                        }, this),
                        startMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-2 text-[11px] text-white/60",
                            children: startMessage
                        }, void 0, false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2643,
                            columnNumber: 30
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2625,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(OneVOneLiveLayout, {
                    event: event,
                    organizer: organizer,
                    tournament: tournamentView,
                    pairings: pairings,
                    timeZone: timeZone,
                    eventStatus: eventStatus,
                    countdownLabel: countdownLabel,
                    nowMatch: nowMatch,
                    championLabel: championLabel,
                    sponsors: sponsors,
                    onToggleFollow: toggleFollow,
                    followPending: followPending,
                    isFollowing: isFollowing,
                    showSponsors: showSponsors,
                    isOrganizerEdit: isOrganizerEdit,
                    canManageLiveConfig: canManageLiveConfig,
                    canResolveDispute: canResolveDispute,
                    onRefresh: ()=>mutate(),
                    variant: variant
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                    lineNumber: 2646,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
            lineNumber: 2614,
            columnNumber: 7
        }, this);
    }
    const renderModule = (mod)=>{
        switch(mod){
            case "HERO":
                {
                    const statusTone = eventStatus === "A decorrer" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : eventStatus === "Próximo" ? "border-sky-400/40 bg-sky-500/10 text-sky-100" : eventStatus === "Concluído" ? "border-amber-300/40 bg-amber-400/10 text-amber-100" : "border-white/15 bg-white/5 text-white/70";
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-black/40 p-5 space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-start justify-between gap-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.3em] text-white/60",
                                                children: "LiveHub"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2687,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                className: "text-2xl font-semibold text-white md:text-3xl",
                                                children: event.title
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2688,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/70 text-sm",
                                                children: formatDateRange(event.startsAt, event.endsAt, timeZone)
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2689,
                                                columnNumber: 17
                                            }, this),
                                            event.locationName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/50 text-sm",
                                                children: [
                                                    event.locationName,
                                                    event.locationCity ? ` · ${event.locationCity}` : ""
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2691,
                                                columnNumber: 19
                                            }, this),
                                            eventStatus === "Próximo" && countdownLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-white/60",
                                                children: [
                                                    "Começa em ",
                                                    countdownLabel
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2696,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2686,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(RoleBadge, {
                                                role: viewerRole
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2700,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${statusTone}`,
                                                children: eventStatus
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2701,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                children: "Modo automático"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2704,
                                                columnNumber: 17
                                            }, this),
                                            calendarLinks && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: calendarLinks.ics,
                                                download: `${event.slug || "evento"}.ics`,
                                                className: "rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70 hover:border-white/40",
                                                children: "Adicionar ao calendário"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2708,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2699,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2685,
                                columnNumber: 13
                            }, this),
                            organizer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/10",
                                        children: organizer.brandingAvatarUrl ? // eslint-disable-next-line @next/next/no-img-element
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                            src: organizer.brandingAvatarUrl,
                                            alt: "Organizador",
                                            className: "h-full w-full object-cover"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2724,
                                            columnNumber: 21
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex h-full w-full items-center justify-center text-xs text-white/60",
                                            children: organizer.publicName?.slice(0, 2) ?? "OR"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2726,
                                            columnNumber: 21
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2721,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/50",
                                                children: "Organizado por"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2732,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white font-medium",
                                                children: organizer.publicName
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2733,
                                                columnNumber: 19
                                            }, this),
                                            organizer.username && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/50 text-xs",
                                                children: [
                                                    "@",
                                                    organizer.username
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2734,
                                                columnNumber: 42
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2731,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2720,
                                columnNumber: 15
                            }, this)
                        ]
                    }, "hero", true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2684,
                        columnNumber: 11
                    }, this);
                }
            case "VIDEO":
                {
                    const streamEmbed = getStreamEmbed(event.liveStreamUrl);
                    const embedUrl = streamEmbed.embedUrl;
                    const streamHref = streamEmbed.href;
                    const streamLabel = streamEmbed.provider === "youtube" ? "Abrir no YouTube" : streamEmbed.provider === "twitch" ? "Abrir na Twitch" : "Abrir stream";
                    if (!embedUrl) {
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.25em] text-white/60",
                                            children: "Live"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2755,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "text-lg font-semibold text-white",
                                            children: "Live stream em breve"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2756,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2754,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm text-white/60",
                                    children: "Ainda não existe uma livestream ativa. Assim que o link estiver disponível, aparece aqui."
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2758,
                                    columnNumber: 15
                                }, this),
                                streamHref && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: streamHref,
                                    target: "_blank",
                                    rel: "noreferrer",
                                    className: "rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40",
                                    children: streamLabel
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2762,
                                    columnNumber: 17
                                }, this),
                                organizer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    disabled: followPending,
                                    onClick: toggleFollow,
                                    className: "rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-60",
                                    children: followPending ? "A atualizar…" : isFollowing ? "A seguir" : "Segue para receber notificação"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2772,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, "video", true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2753,
                            columnNumber: 13
                        }, this);
                    }
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.25em] text-white/60",
                                                children: "Live"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2788,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-lg font-semibold text-white",
                                                children: "Assistir agora"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2789,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2787,
                                        columnNumber: 15
                                    }, this),
                                    streamHref && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: streamHref,
                                        target: "_blank",
                                        rel: "noreferrer",
                                        className: "rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40",
                                        children: streamLabel
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2792,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2786,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                                    src: embedUrl,
                                    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                                    allowFullScreen: true,
                                    className: "h-full w-full",
                                    title: "Live stream"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2803,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2802,
                                columnNumber: 13
                            }, this)
                        ]
                    }, "video", true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2785,
                        columnNumber: 11
                    }, this);
                }
            case "NOW_PLAYING":
                {
                    if (!tournamentView) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyCard, {
                        title: "Agora a jogar",
                        children: "Sem torneio associado."
                    }, "now", false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2815,
                        columnNumber: 37
                    }, this);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-lg font-semibold text-white",
                                        children: "Agora a jogar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2819,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs text-white/50",
                                        children: [
                                            liveMatches.length,
                                            " em jogo"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2820,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2818,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-3 md:grid-cols-2",
                                children: [
                                    liveMatches.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/60",
                                        children: "Sem jogos em curso."
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2823,
                                        columnNumber: 44
                                    }, this),
                                    liveMatches.map((match)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MatchCard, {
                                            match: match,
                                            pairings: pairings,
                                            timeZone: timeZone,
                                            highlight: true,
                                            showCourt: showCourt
                                        }, `now-${match.id}`, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2825,
                                            columnNumber: 17
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2822,
                                columnNumber: 13
                            }, this)
                        ]
                    }, "now", true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2817,
                        columnNumber: 11
                    }, this);
                }
            case "NEXT_MATCHES":
                {
                    if (!tournamentView) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyCard, {
                        title: "Próximos jogos",
                        children: "Sem torneio associado."
                    }, "next", false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2832,
                        columnNumber: 37
                    }, this);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-lg font-semibold text-white",
                                        children: "Próximos jogos"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2836,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs text-white/50",
                                        children: [
                                            upcomingMatches.length,
                                            " previstos"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2837,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2835,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-3 md:grid-cols-2",
                                children: [
                                    upcomingMatches.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/60",
                                        children: "Sem jogos agendados."
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2840,
                                        columnNumber: 48
                                    }, this),
                                    upcomingMatches.map((match)=>{
                                        const highlight = pairingIdFromQuery && (`${match.pairing1Id}` === pairingIdFromQuery || `${match.pairing2Id}` === pairingIdFromQuery) || tournamentView?.userPairingId && (match.pairing1Id === tournamentView.userPairingId || match.pairing2Id === tournamentView.userPairingId);
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MatchCard, {
                                            match: match,
                                            pairings: pairings,
                                            highlight: highlight,
                                            timeZone: timeZone,
                                            showCourt: showCourt
                                        }, `next-${match.id}`, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2848,
                                            columnNumber: 19
                                        }, this);
                                    })
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2839,
                                columnNumber: 13
                            }, this)
                        ]
                    }, "next", true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2834,
                        columnNumber: 11
                    }, this);
                }
            case "RESULTS":
                {
                    if (!tournamentView) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyCard, {
                        title: "Resultados",
                        children: "Sem torneio associado."
                    }, "results", false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2863,
                        columnNumber: 37
                    }, this);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-lg font-semibold text-white",
                                        children: "Resultados recentes"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2867,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs text-white/50",
                                        children: [
                                            recentResults.length,
                                            " jogos"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2868,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2866,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-3 md:grid-cols-2",
                                children: [
                                    recentResults.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/60",
                                        children: "Sem resultados registados."
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 2871,
                                        columnNumber: 46
                                    }, this),
                                    recentResults.map((match)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MatchCard, {
                                            match: match,
                                            pairings: pairings,
                                            timeZone: timeZone,
                                            showCourt: showCourt
                                        }, `res-${match.id}`, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2873,
                                            columnNumber: 17
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 2870,
                                columnNumber: 13
                            }, this)
                        ]
                    }, "results", true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2865,
                        columnNumber: 11
                    }, this);
                }
            case "BRACKET":
                {
                    if (!tournamentView) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyCard, {
                        title: "Bracket",
                        children: "Sem torneio associado."
                    }, "bracket", false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2880,
                        columnNumber: 37
                    }, this);
                    const stages = tournamentView.stages ?? [];
                    const playoffStages = stages.filter((stage)=>stage.stageType === "PLAYOFF" && stage.matches?.length);
                    const bracketStages = playoffStages.length > 0 ? playoffStages : stages.filter((stage)=>stage.matches?.length);
                    const hasBracket = bracketStages.length > 0;
                    const hasGroups = stages.some((stage)=>stage.groups?.length);
                    if (hasBracket) {
                        const bracketHasEarlyRounds = bracketStages.some((stage)=>{
                            const roundCount = new Set(stage.matches.map((m)=>m.round ?? 0)).size;
                            return roundCount > 3;
                        });
                        const highlightPairingId = (()=>{
                            if (pairingIdFromQuery) {
                                const parsed = Number(pairingIdFromQuery);
                                return Number.isFinite(parsed) ? parsed : null;
                            }
                            return tournamentView?.userPairingId ?? null;
                        })();
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap items-center justify-between gap-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] uppercase tracking-[0.25em] text-white/60",
                                                    children: "Bracket"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 2903,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                    className: "text-lg font-semibold text-white",
                                                    children: "Chave completa"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 2904,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2902,
                                            columnNumber: 17
                                        }, this),
                                        bracketHasEarlyRounds && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setShowFullBracket((prev)=>!prev),
                                            className: "hidden md:inline-flex rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40",
                                            children: showFullBracket ? "Mostrar menos" : "Ver bracket completo"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2907,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2901,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-4",
                                    children: bracketStages.map((stage)=>{
                                        if (!stage.matches.length) return null;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center justify-between",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                            className: "text-white font-semibold",
                                                            children: stage.name || "Playoffs"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                            lineNumber: 2922,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-[11px] uppercase tracking-[0.18em] text-white/50",
                                                            children: stage.stageType
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                            lineNumber: 2923,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 2921,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(BracketRoundsView, {
                                                    matches: stage.matches,
                                                    pairings: pairings,
                                                    isOrganizerEdit: isOrganizerEdit,
                                                    tournamentId: tournamentView?.id ?? null,
                                                    onUpdated: onRefresh,
                                                    goalLimits: goalLimits,
                                                    highlightPairingId: highlightPairingId,
                                                    canResolveDispute: canResolveDispute,
                                                    view: showFullBracket ? "full" : "split"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                    lineNumber: 2925,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, stage.id, true, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2920,
                                            columnNumber: 21
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2916,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, "bracket", true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2900,
                            columnNumber: 13
                        }, this);
                    }
                    if (hasGroups) {
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.25em] text-white/60",
                                            children: "Tabela"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2948,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "text-lg font-semibold text-white",
                                            children: "Classificação dos grupos"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2949,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2947,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid gap-4 md:grid-cols-2",
                                    children: stages.map((stage)=>stage.groups?.map((group)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-2xl border border-white/10 bg-black/30 p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                className: "text-white font-semibold",
                                                                children: group.name || "Grupo"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                lineNumber: 2956,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[11px] uppercase tracking-[0.18em] text-white/50",
                                                                children: stage.stageType
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                lineNumber: 2957,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                        lineNumber: 2955,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "mt-3 space-y-2",
                                                        children: [
                                                            (group.standings ?? []).length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-sm text-white/60",
                                                                children: "Sem classificação disponível."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                lineNumber: 2961,
                                                                columnNumber: 27
                                                            }, this),
                                                            (group.standings ?? []).map((row, idx)=>{
                                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center justify-between text-sm text-white/80",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex items-center gap-3",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "text-white/50",
                                                                                    children: idx + 1
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                                    lineNumber: 2967,
                                                                                    columnNumber: 33
                                                                                }, this),
                                                                                renderPairingName(row.pairingId, pairings)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                            lineNumber: 2966,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "text-white/50",
                                                                            children: [
                                                                                row.wins,
                                                                                "-",
                                                                                row.losses
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                            lineNumber: 2970,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, `group-${group.id}-row-${row.pairingId}`, true, {
                                                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                                    lineNumber: 2965,
                                                                    columnNumber: 29
                                                                }, this);
                                                            })
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                        lineNumber: 2959,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, `group-${group.id}`, true, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 2954,
                                                columnNumber: 21
                                            }, this)))
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2951,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, "bracket", true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2946,
                            columnNumber: 13
                        }, this);
                    }
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyCard, {
                        title: "Bracket",
                        children: "Sem chave definida."
                    }, "bracket", false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2983,
                        columnNumber: 16
                    }, this);
                }
            case "CHAMPION":
                {
                    if (!tournamentView) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyCard, {
                        title: "Campeão",
                        children: "Sem torneio associado."
                    }, "champ", false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2986,
                        columnNumber: 37
                    }, this);
                    const championId = tournamentView.championPairingId ?? derivedChampionPairingId;
                    const meta = pairingMeta(championId, pairings);
                    if (!championId || !meta) {
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyCard, {
                            title: "Campeão",
                            children: "Ainda não existe campeão definido."
                        }, "champ", false, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2990,
                            columnNumber: 18
                        }, this);
                    }
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-amber-300/30 bg-[linear-gradient(135deg,rgba(255,215,120,0.12),rgba(20,20,20,0.8))] p-5",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/40 bg-amber-300/10 text-2xl",
                                    children: "🏆"
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2995,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.3em] text-amber-100/70",
                                            children: "Campeão"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 2999,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xl font-semibold text-white",
                                            children: renderPairingName(championId, pairings)
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 3000,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 2998,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 2994,
                            columnNumber: 13
                        }, this)
                    }, "champ", false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 2993,
                        columnNumber: 11
                    }, this);
                }
            case "SUMMARY":
                {
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.25em] text-white/60",
                                children: "Resumo"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 3011,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-lg font-semibold text-white",
                                children: "Sobre este evento"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 3012,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white/70 text-sm leading-relaxed",
                                children: event.description?.trim() || "Descrição em breve."
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 3013,
                                columnNumber: 13
                            }, this)
                        ]
                    }, "summary", true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 3010,
                        columnNumber: 11
                    }, this);
                }
            case "CTA":
                {
                    const ctaCopy = viewerRole === "PUBLIC" ? "Queres aparecer como participante? Garante o teu bilhete." : "Já tens acesso como participante. Aproveita o LiveHub.";
                    const ctaLabel = viewerRole === "PUBLIC" ? "Garantir lugar" : "Ver o meu bilhete";
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rounded-3xl border border-white/10 bg-white/5 p-4",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center justify-between gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.25em] text-white/60",
                                            children: "Participação"
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 3029,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-white/80",
                                            children: ctaCopy
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 3030,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 3028,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    href: `/eventos/${event.slug}`,
                                    className: "rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40",
                                    children: ctaLabel
                                }, void 0, false, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 3032,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                            lineNumber: 3027,
                            columnNumber: 13
                        }, this)
                    }, "cta", false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 3026,
                        columnNumber: 11
                    }, this);
                }
            case "SPONSORS":
                {
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SponsorsStrip, {
                        organizer: organizer
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 3043,
                        columnNumber: 16
                    }, this);
                }
            default:
                return null;
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-6",
        children: [
            resolvedModules.map((mod)=>renderModule(mod)),
            viewerRole === "ORGANIZER" && canEditMatches && tournamentView && isOrganizerRoute && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-lg font-semibold text-white",
                                children: "Gestão rápida"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 3057,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-white/50",
                                children: "Organizador"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 3058,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 3056,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-white/10 bg-black/30 px-4 py-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center justify-between gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] text-white/50",
                                                children: "Arranque"
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 3063,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-white/70",
                                                children: "Começa o primeiro jogo pendente."
                                            }, void 0, false, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 3064,
                                                columnNumber: 17
                                            }, this),
                                            nextPendingLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/50",
                                                children: [
                                                    "Próximo: ",
                                                    nextPendingLabel
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                                lineNumber: 3066,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 3062,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: startFirstMatch,
                                        disabled: !firstPlayableMatch || Boolean(startingMatchId),
                                        className: "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-[12px] font-semibold text-emerald-100 hover:border-emerald-300/70 disabled:opacity-60",
                                        children: startingMatchId ? "A iniciar…" : "Começar jogos"
                                    }, void 0, false, {
                                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                        lineNumber: 3069,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 3061,
                                columnNumber: 13
                            }, this),
                            startMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-2 text-[11px] text-white/60",
                                children: startMessage
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 3078,
                                columnNumber: 30
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 3060,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-3",
                        children: [
                            flatMatches.filter((m)=>m.status !== "DONE").slice(0, 6).map((match)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MatchCard, {
                                            match: match,
                                            pairings: pairings,
                                            timeZone: timeZone,
                                            showCourt: showCourt
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 3086,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(OrganizerMatchEditor, {
                                            match: match,
                                            tournamentId: tournamentView.id,
                                            onUpdated: ()=>mutate(),
                                            goalLimit: resolveGoalLimit(match.round ?? null, goalLimits),
                                            locked: roundIsLockedGlobal(match.round ?? 0) || match.status === "DISPUTED",
                                            lockedReason: match.status === "DISPUTED" ? "Jogo em disputa. Resolve antes de editar." : roundIsLockedGlobal(match.round ?? 0) ? "Esta fase ainda não está ativa." : null,
                                            canResolveDispute: canResolveDispute
                                        }, void 0, false, {
                                            fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                            lineNumber: 3087,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, `edit-${match.id}`, true, {
                                    fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                    lineNumber: 3085,
                                    columnNumber: 17
                                }, this)),
                            flatMatches.filter((m)=>m.status !== "DONE").length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white/60",
                                children: "Sem jogos pendentes para editar."
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                                lineNumber: 3105,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                        lineNumber: 3080,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
                lineNumber: 3055,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventLiveClient.tsx",
        lineNumber: 3051,
        columnNumber: 5
    }, this);
}
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[project]/domain/tournaments/standings.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeGroupStandings",
    ()=>computeGroupStandings
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$seedrandom$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/seedrandom/index.js [app-ssr] (ecmascript)");
;
function computeGroupStandings(pairings, matches, rules, seed) {
    const rng = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$seedrandom$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(seed || `${Date.now()}`);
    const map = new Map();
    pairings.forEach((p)=>map.set(p, {
            pairingId: p,
            wins: 0,
            losses: 0,
            setDiff: 0,
            gameDiff: 0,
            headToHead: {}
        }));
    const finished = matches.filter((m)=>m.status === "DONE");
    for (const m of finished){
        const s1 = map.get(m.pairing1Id);
        const s2 = map.get(m.pairing2Id);
        if (!s1 || !s2) continue;
        const sets = m.score?.sets ?? [];
        let aSets = 0;
        let bSets = 0;
        let aGames = 0;
        let bGames = 0;
        for (const set of sets){
            aSets += set.a;
            bSets += set.b;
            aGames += set.a;
            bGames += set.b;
        }
        if (aSets > bSets) {
            s1.wins += 1;
            s2.losses += 1;
            s1.headToHead[m.pairing2Id] = (s1.headToHead[m.pairing2Id] ?? 0) + 1;
        } else if (bSets > aSets) {
            s2.wins += 1;
            s1.losses += 1;
            s2.headToHead[m.pairing1Id] = (s2.headToHead[m.pairing1Id] ?? 0) + 1;
        }
        s1.setDiff += aSets - bSets;
        s2.setDiff += bSets - aSets;
        s1.gameDiff += aGames - bGames;
        s2.gameDiff += bGames - aGames;
    }
    const standings = Array.from(map.values());
    const comparator = (a, b)=>{
        for (const rule of rules){
            if (rule === "WINS") {
                if (a.wins !== b.wins) return b.wins - a.wins;
            } else if (rule === "SET_DIFF") {
                if (a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
            } else if (rule === "GAME_DIFF") {
                if (a.gameDiff !== b.gameDiff) return b.gameDiff - a.gameDiff;
            } else if (rule === "HEAD_TO_HEAD") {
                const aHH = a.headToHead[b.pairingId] ?? 0;
                const bHH = b.headToHead[a.pairingId] ?? 0;
                if (aHH !== bHH) return bHH - aHH;
            } else if (rule === "RANDOM") {
                const r = rng() - 0.5;
                if (r !== 0) return r > 0 ? 1 : -1;
            }
        }
        return 0;
    };
    return standings.sort(comparator);
}
}),
"[project]/domain/tournaments/structure.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeStandingsForGroup",
    ()=>computeStandingsForGroup,
    "summarizeMatchStatus",
    ()=>summarizeMatchStatus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$standings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/standings.ts [app-ssr] (ecmascript)");
;
function summarizeMatchStatus(status) {
    if (status === "IN_PROGRESS") return "Em jogo";
    if (status === "DONE") return "Terminado";
    if (status === "DISPUTED") return "Em disputa";
    if (status === "SCHEDULED") return "Agendado";
    if (status === "CANCELLED") return "Cancelado";
    return "Pendente";
}
function computeStandingsForGroup(matches, rules, seed) {
    const pairings = Array.from(new Set(matches.flatMap((m)=>[
            m.pairing1Id,
            m.pairing2Id
        ]).filter((v)=>typeof v === "number")));
    if (pairings.length === 0) return [];
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$standings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["computeGroupStandings"])(pairings, matches.filter((m)=>m.pairing1Id && m.pairing2Id).map((m)=>({
            pairing1Id: m.pairing1Id,
            pairing2Id: m.pairing2Id,
            status: m.status,
            score: m.score
        })), rules, seed);
}
}),
"[externals]/@prisma/client [external] (@prisma/client, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("@prisma/client", () => require("@prisma/client"));

module.exports = mod;
}),
"[project]/domain/tournaments/matchRules.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "canEditMatch",
    ()=>canEditMatch,
    "getWinnerSideFromScore",
    ()=>getWinnerSideFromScore,
    "validateGoalScore",
    ()=>validateGoalScore,
    "validateScore",
    ()=>validateScore
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs)");
;
const WIN_BY = 2;
const MAX_SETS = 3; // BO3
const MIN_GAMES_TO_WIN = 6;
const TIEBREAK_GAMES = 7;
function isValidSet(set) {
    const a = Number(set.a);
    const b = Number(set.b);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return false;
    const max = Math.max(a, b);
    const diff = Math.abs(a - b);
    // tiebreak 7-6 é aceite
    if (max === TIEBREAK_GAMES && diff === 1) return true;
    if (max >= MIN_GAMES_TO_WIN) return diff >= WIN_BY;
    return false;
}
function validateScore(score) {
    if (!score || !Array.isArray(score.sets) || score.sets.length === 0) {
        return {
            ok: false,
            code: "INVALID_SCORE",
            message: "Score vazio ou inválido."
        };
    }
    if (score.sets.length > MAX_SETS) {
        return {
            ok: false,
            code: "TOO_MANY_SETS",
            message: "Máximo de 3 sets (BO3)."
        };
    }
    let winsA = 0;
    let winsB = 0;
    for (const s of score.sets){
        if (!isValidSet(s)) return {
            ok: false,
            code: "INVALID_SET",
            message: "Set inválido."
        };
        if (s.a > s.b) winsA += 1;
        else winsB += 1;
    }
    if (winsA === winsB) return {
        ok: false,
        code: "NO_WINNER",
        message: "Empate não permitido no BO3."
    };
    if (winsA > MAX_SETS || winsB > MAX_SETS) {
        return {
            ok: false,
            code: "TOO_MANY_WINS",
            message: "Vitórias a mais para BO3."
        };
    }
    if (winsA > winsB && winsA > MAX_SETS - 1) {
        return {
            ok: true,
            winner: "A",
            normalized: score
        };
    }
    if (winsB > winsA && winsB > MAX_SETS - 1) {
        return {
            ok: true,
            winner: "B",
            normalized: score
        };
    }
    return {
        ok: false,
        code: "NO_WINNER",
        message: "Score não determina vencedor."
    };
}
function validateGoalScore(score) {
    const a = Number(score?.a);
    const b = Number(score?.b);
    const limit = Number(score?.limit);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
        return {
            ok: false,
            code: "INVALID_SCORE",
            message: "Score inválido."
        };
    }
    if (!Number.isFinite(limit) || limit <= 0) {
        return {
            ok: false,
            code: "INVALID_LIMIT",
            message: "Limite de golos inválido."
        };
    }
    if (a > limit || b > limit) {
        return {
            ok: false,
            code: "LIMIT_EXCEEDED",
            message: "Score ultrapassa o limite."
        };
    }
    if (a === limit && b === limit) {
        return {
            ok: false,
            code: "TIE_NOT_ALLOWED",
            message: "Empate não permitido."
        };
    }
    if (a === limit) {
        return {
            ok: true,
            winner: "A",
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].DONE,
            normalized: {
                a,
                b,
                limit
            }
        };
    }
    if (b === limit) {
        return {
            ok: true,
            winner: "B",
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].DONE,
            normalized: {
                a,
                b,
                limit
            }
        };
    }
    if (a > 0 || b > 0) {
        return {
            ok: true,
            winner: null,
            status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].IN_PROGRESS,
            normalized: {
                a,
                b,
                limit
            }
        };
    }
    return {
        ok: true,
        winner: null,
        status: __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$29$__["TournamentMatchStatus"].PENDING,
        normalized: {
            a,
            b,
            limit
        }
    };
}
function getWinnerSideFromScore(score) {
    if (!score) return null;
    if (score.goals) {
        const res = validateGoalScore(score.goals);
        return res.ok ? res.winner : null;
    }
    if (Array.isArray(score.sets) && score.sets.length > 0) {
        const res = validateScore({
            sets: score.sets
        });
        return res.ok ? res.winner : null;
    }
    return null;
}
function canEditMatch(status, force) {
    if (force) return true;
    // não permite editar DONE se não for force
    return status !== "DONE" && status !== "DISPUTED";
}
}),
"[project]/domain/tournaments/liveWarnings.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeLiveWarnings",
    ()=>computeLiveWarnings
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$matchRules$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/matchRules.ts [app-ssr] (ecmascript)");
;
function computeLiveWarnings(opts) {
    const { matches, pairings, startThresholdMinutes = 60 } = opts;
    const warnings = [];
    // guarantee REQUIRES_ACTION
    pairings.forEach((p)=>{
        if ((p.guaranteeStatus || "").toUpperCase() === "REQUIRES_ACTION") {
            warnings.push({
                type: "REQUIRES_ACTION",
                pairingId: p.id
            });
        }
    });
    // matches: missing court/start + score inválido
    const threshold = new Date(Date.now() + startThresholdMinutes * 60 * 1000);
    matches.forEach((m)=>{
        if (!m.courtId) warnings.push({
            type: "MISSING_COURT",
            matchId: m.id
        });
        if (!m.startAt || m.startAt < threshold) warnings.push({
            type: "MISSING_START",
            matchId: m.id
        });
        if ((m.status || "").toUpperCase() === "DONE") {
            const sets = Array.isArray(m.score?.sets) ? m.score.sets : [];
            if (sets.length === 0) return;
            const res = (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$matchRules$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateScore"])({
                sets
            });
            if (!res.ok) warnings.push({
                type: "INVALID_SCORE",
                matchId: m.id
            });
        }
    });
    return warnings;
}
}),
"[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TournamentLiveManager",
    ()=>TournamentLiveManager,
    "default",
    ()=>OrganizerTournamentLivePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/structure.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$liveWarnings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/domain/tournaments/liveWarnings.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$avatars$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/avatars.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
const fetcher = (url)=>fetch(url).then((r)=>r.json());
function Filters({ stages, setFilters }) {
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [stageId, setStageId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [court, setCourt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [todayOnly, setTodayOnly] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [search, setSearch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-wrap items-center gap-2 text-sm",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                value: status,
                onChange: (e)=>{
                    setStatus(e.target.value);
                    setFilters((prev)=>({
                            ...prev,
                            status: e.target.value || null
                        }));
                },
                className: "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: "",
                        children: "Todos os estados"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 57,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: "PENDING",
                        children: "Pendente"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: "IN_PROGRESS",
                        children: "Em jogo"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: "DONE",
                        children: "Terminado"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 60,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                lineNumber: 49,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                value: stageId,
                onChange: (e)=>{
                    setStageId(e.target.value);
                    setFilters((prev)=>({
                            ...prev,
                            stageId: e.target.value ? Number(e.target.value) : null
                        }));
                },
                className: "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: "",
                        children: "Todas as fases"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 70,
                        columnNumber: 9
                    }, this),
                    stages.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: s.id,
                            children: s.name || s.stageType
                        }, s.id, false, {
                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                            lineNumber: 72,
                            columnNumber: 11
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                lineNumber: 62,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                value: court,
                onChange: (e)=>{
                    setCourt(e.target.value);
                    setFilters((prev)=>({
                            ...prev,
                            court: e.target.value || null
                        }));
                },
                placeholder: "Campo #",
                className: "w-24 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80"
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                lineNumber: 77,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "flex items-center gap-1 text-white/75",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "checkbox",
                        checked: todayOnly,
                        onChange: (e)=>{
                            setTodayOnly(e.target.checked);
                            setFilters((prev)=>({
                                    ...prev,
                                    todayOnly: e.target.checked
                                }));
                        }
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 87,
                        columnNumber: 9
                    }, this),
                    "Só hoje"
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                value: search,
                onChange: (e)=>{
                    setSearch(e.target.value);
                    setFilters((prev)=>({
                            ...prev,
                            search: e.target.value
                        }));
                },
                placeholder: "Pesquisar jogador #",
                className: "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80"
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                lineNumber: 97,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
        lineNumber: 48,
        columnNumber: 5
    }, this);
}
function TournamentLiveManager({ tournamentId }) {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const isValidTournamentId = Number.isFinite(tournamentId);
    const [authError, setAuthError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [slots, setSlots] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [bracketSize, setBracketSize] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(16);
    const [participantsMessage, setParticipantsMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [savingParticipants, setSavingParticipants] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [generating, setGenerating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [generationMessage, setGenerationMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [activeSlotIndex, setActiveSlotIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [slotDraft, setSlotDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        name: "",
        username: "",
        email: "",
        avatarUrl: null
    });
    const [slotMode, setSlotMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("guest");
    const [searchTerm, setSearchTerm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [searchResults, setSearchResults] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [searching, setSearching] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [uploadingAvatar, setUploadingAvatar] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const autoSaveTimerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const slotDraftTimerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const hasLoadedParticipantsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const lastSavedKeyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (authError === "login") router.replace("/login");
        if (authError === "organizador") router.replace("/organizador");
    }, [
        authError,
        router
    ]);
    const { data, error } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(isValidTournamentId ? `/api/organizador/tournaments/${tournamentId}/live` : null, fetcher);
    const { data: participantsRes, mutate: mutateParticipants } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(isValidTournamentId ? `/api/organizador/tournaments/${tournamentId}/participants` : null, fetcher);
    const buildParticipantsPayload = (items)=>items.map((slot, idx)=>slot ? {
                id: slot.id,
                name: slot.name,
                username: slot.username ?? null,
                email: slot.email ?? null,
                avatarUrl: slot.avatarUrl ?? null,
                seed: idx + 1
            } : null).filter(Boolean);
    const buildParticipantsKey = (items, size)=>JSON.stringify({
            size,
            participants: buildParticipantsPayload(items)
        });
    const buildSlotsFromParticipants = (list, size)=>{
        const nextSlots = Array.from({
            length: size
        }, ()=>null);
        const seeded = [];
        const unseeded = [];
        list.forEach((p)=>{
            const seed = Number.isFinite(p.seed) ? Number(p.seed) : null;
            if (seed && seed >= 1 && seed <= size) seeded.push(p);
            else unseeded.push(p);
        });
        seeded.sort((a, b)=>(Number(a.seed) || 0) - (Number(b.seed) || 0)).forEach((p)=>{
            const idx = Number(p.seed) - 1;
            if (idx >= 0 && idx < size && !nextSlots[idx]) nextSlots[idx] = p;
        });
        let cursor = 0;
        unseeded.forEach((p)=>{
            while(cursor < nextSlots.length && nextSlots[cursor])cursor += 1;
            if (cursor < nextSlots.length) {
                nextSlots[cursor] = p;
                cursor += 1;
            }
        });
        return nextSlots;
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!participantsRes?.ok) return;
        const list = Array.isArray(participantsRes.participants) ? participantsRes.participants : [];
        const nextSize = Number.isFinite(participantsRes.bracketSize) ? Number(participantsRes.bracketSize) : bracketSize;
        const resolvedSize = Number.isFinite(nextSize) ? nextSize : bracketSize;
        const nextSlots = buildSlotsFromParticipants(list, resolvedSize);
        if (Number.isFinite(resolvedSize)) setBracketSize(resolvedSize);
        setSlots(nextSlots);
        lastSavedKeyRef.current = buildParticipantsKey(nextSlots, resolvedSize);
        hasLoadedParticipantsRef.current = true;
    }, [
        participantsRes
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setSlots((prev)=>{
            if (prev.length === bracketSize) return prev;
            if (bracketSize > prev.length) {
                return [
                    ...prev,
                    ...Array.from({
                        length: bracketSize - prev.length
                    }, ()=>null)
                ];
            }
            return prev.slice(0, bracketSize);
        });
    }, [
        bracketSize
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (activeSlotIndex !== null && activeSlotIndex >= bracketSize) {
            closeSlotEditor();
        }
    }, [
        activeSlotIndex,
        bracketSize
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!data?.error) return;
        if (data.error === "UNAUTHENTICATED") setAuthError("login");
        if (data.error === "FORBIDDEN") setAuthError("organizador");
    }, [
        data?.error
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (slotMode !== "user") {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        if (!searchTerm.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        let active = true;
        setSearching(true);
        const term = searchTerm.trim();
        const timer = setTimeout(async ()=>{
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}&limit=6`);
                const json = await res.json().catch(()=>null);
                if (!active) return;
                if (!res.ok || !json?.ok) {
                    setSearchResults([]);
                    return;
                }
                setSearchResults(Array.isArray(json.results) ? json.results : []);
            } catch  {
                if (active) setSearchResults([]);
            } finally{
                if (active) setSearching(false);
            }
        }, 250);
        return ()=>{
            active = false;
            clearTimeout(timer);
        };
    }, [
        searchTerm,
        slotMode
    ]);
    const nextNegativeId = ()=>{
        const min = slots.reduce((acc, item)=>{
            if (item && item.id < acc) return item.id;
            return acc;
        }, 0);
        return min <= -1 ? min - 1 : -1;
    };
    const openSlotEditor = (index)=>{
        const current = slots[index];
        setActiveSlotIndex(index);
        setSlotMode(current?.username ? "user" : "guest");
        setSlotDraft({
            id: current?.id ?? nextNegativeId(),
            name: current?.name ?? "",
            username: current?.username ?? "",
            email: current?.email ?? "",
            avatarUrl: current?.avatarUrl ?? null
        });
        setSearchTerm("");
        setSearchResults([]);
    };
    const closeSlotEditor = ()=>{
        setActiveSlotIndex(null);
        setSlotDraft({
            name: "",
            username: "",
            email: "",
            avatarUrl: null
        });
        setSearchTerm("");
        setSearchResults([]);
    };
    const applyUserToDraft = (user)=>{
        const displayName = user.fullName || (user.username ? `@${user.username}` : "");
        setSlotDraft((prev)=>({
                ...prev,
                name: displayName,
                username: user.username ?? "",
                avatarUrl: user.avatarUrl ?? null,
                email: ""
            }));
        setSlotMode("user");
    };
    const handleSlotAvatarUpload = async (file)=>{
        if (!file) return;
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.url) {
                setParticipantsMessage(json?.error || "Falha no upload da imagem.");
                return;
            }
            setSlotDraft((prev)=>({
                    ...prev,
                    avatarUrl: json.url
                }));
        } catch  {
            setParticipantsMessage("Erro ao carregar imagem.");
        } finally{
            setUploadingAvatar(false);
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (activeSlotIndex === null) return;
        const name = slotDraft.name.trim();
        if (!name) return;
        if (slotDraftTimerRef.current) clearTimeout(slotDraftTimerRef.current);
        slotDraftTimerRef.current = setTimeout(()=>{
            const next = {
                id: slotDraft.id ?? nextNegativeId(),
                name,
                username: slotMode === "user" ? slotDraft.username.trim().replace(/^@/, "") || null : null,
                email: slotMode === "guest" ? slotDraft.email.trim().toLowerCase() || null : null,
                avatarUrl: slotDraft.avatarUrl?.trim() || null,
                seed: activeSlotIndex + 1
            };
            setSlots((prev)=>{
                const current = prev[activeSlotIndex];
                if (current && current.id === next.id && current.name === next.name && (current.username ?? null) === (next.username ?? null) && (current.email ?? null) === (next.email ?? null) && (current.avatarUrl ?? null) === (next.avatarUrl ?? null)) {
                    return prev;
                }
                const copy = [
                    ...prev
                ];
                copy[activeSlotIndex] = next;
                return copy;
            });
        }, 400);
        return ()=>{
            if (slotDraftTimerRef.current) clearTimeout(slotDraftTimerRef.current);
        };
    }, [
        activeSlotIndex,
        slotDraft,
        slotMode
    ]);
    const clearSlot = ()=>{
        if (activeSlotIndex === null) return;
        setSlots((prev)=>{
            const copy = [
                ...prev
            ];
            copy[activeSlotIndex] = null;
            return copy;
        });
        setParticipantsMessage(null);
        closeSlotEditor();
    };
    const moveSlot = (from, to)=>{
        setSlots((prev)=>{
            if (to < 0 || to >= prev.length) return prev;
            const copy = [
                ...prev
            ];
            const temp = copy[from];
            copy[from] = copy[to];
            copy[to] = temp;
            return copy;
        });
    };
    const tournament = data?.tournament;
    const tieBreakRules = Array.isArray(tournament?.tieBreakRules) ? tournament.tieBreakRules : [
        "WINS",
        "SET_DIFF",
        "GAME_DIFF",
        "HEAD_TO_HEAD",
        "RANDOM"
    ];
    const stages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>tournament ? tournament.stages.map((s)=>({
                ...s,
                groups: s.groups.map((g)=>({
                        ...g,
                        standings: (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["computeStandingsForGroup"])(g.matches, tieBreakRules, tournament.generationSeed || undefined),
                        matches: g.matches.map((m)=>({
                                ...m,
                                statusLabel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["summarizeMatchStatus"])(m.status)
                            }))
                    })),
                matches: s.matches.map((m)=>({
                        ...m,
                        statusLabel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$structure$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["summarizeMatchStatus"])(m.status)
                    }))
            })) : [], [
        tournament,
        tieBreakRules
    ]);
    const flatMatches = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>stages.flatMap((s)=>[
                ...s.matches,
                ...s.groups.flatMap((g)=>g.matches)
            ]), [
        stages
    ]);
    const warnings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>tournament ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$domain$2f$tournaments$2f$liveWarnings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["computeLiveWarnings"])({
            matches: flatMatches,
            pairings: data?.pairings ?? [],
            startThresholdMinutes: 60
        }) : [], [
        tournament,
        flatMatches,
        data?.pairings
    ]);
    const [filters, setFilters] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        status: null,
        stageId: null,
        court: null,
        todayOnly: false,
        search: ""
    });
    const filledCount = slots.filter(Boolean).length;
    const saveParticipants = async (options)=>{
        if (savingParticipants) return;
        const filled = slots.filter((p)=>Boolean(p));
        if (filled.length > bracketSize) {
            setParticipantsMessage("Há mais participantes do que o tamanho da bracket.");
            return;
        }
        setSavingParticipants(true);
        setParticipantsMessage(null);
        try {
            const payload = buildParticipantsPayload(slots);
            const res = await fetch(`/api/organizador/tournaments/${tournamentId}/participants`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    participants: payload,
                    bracketSize
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setParticipantsMessage(json?.error || "Erro ao guardar participantes.");
                return;
            }
            const list = Array.isArray(json.participants) ? json.participants : [];
            const nextSize = Number.isFinite(json.bracketSize) ? Number(json.bracketSize) : bracketSize;
            const nextSlots = buildSlotsFromParticipants(list, nextSize);
            setBracketSize(nextSize);
            setSlots(nextSlots);
            lastSavedKeyRef.current = buildParticipantsKey(nextSlots, nextSize);
            if (!options?.silent) {
                setParticipantsMessage("Participantes guardados.");
            }
            mutateParticipants();
        } catch  {
            setParticipantsMessage("Erro inesperado ao guardar participantes.");
        } finally{
            setSavingParticipants(false);
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!hasLoadedParticipantsRef.current) return;
        const nextKey = buildParticipantsKey(slots, bracketSize);
        if (nextKey === lastSavedKeyRef.current) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(()=>{
            saveParticipants({
                silent: true
            });
        }, 700);
        return ()=>{
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [
        slots,
        bracketSize
    ]);
    const generateBracket = async ()=>{
        const count = slots.filter(Boolean).length;
        if (count === 0) {
            setGenerationMessage("Adiciona participantes antes de gerar a bracket.");
            return;
        }
        if (count > bracketSize) {
            setGenerationMessage("Há mais participantes do que o tamanho da bracket.");
            return;
        }
        const shouldRegenerate = flatMatches.length > 0;
        if (shouldRegenerate) {
            const confirmed = window.confirm("Já existem jogos. Gerar novamente vai apagar resultados e reagendar a bracket. Queres continuar?");
            if (!confirmed) return;
        }
        setGenerating(true);
        setGenerationMessage(null);
        try {
            const res = await fetch(`/api/organizador/tournaments/${tournamentId}/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    source: "manual",
                    bracketSize,
                    forceGenerate: shouldRegenerate
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                setGenerationMessage(json?.error || "Erro ao gerar bracket.");
                return;
            }
            setGenerationMessage("Bracket gerada.");
        } catch  {
            setGenerationMessage("Erro inesperado ao gerar bracket.");
        } finally{
            setGenerating(false);
        }
    };
    const filteredMatches = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const now = new Date();
        return flatMatches.filter((m)=>{
            if (filters.status && m.status !== filters.status) return false;
            if (filters.stageId && m.stageId !== filters.stageId) return false;
            if (filters.court && `${m.courtId ?? ""}` !== filters.court) return false;
            if (filters.todayOnly && m.startAt) {
                const d = new Date(m.startAt);
                if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth() || d.getDate() !== now.getDate()) return false;
            }
            if (filters.search) {
                const term = filters.search.trim();
                if (!term) return true;
                return `${m.pairing1Id ?? ""}`.includes(term) || `${m.pairing2Id ?? ""}`.includes(term);
            }
            return true;
        });
    }, [
        flatMatches,
        filters
    ]);
    if (!isValidTournamentId) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-4 text-white/70",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: "ID de torneio inválido."
                }, void 0, false, {
                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                    lineNumber: 549,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: ()=>router.back(),
                    className: "mt-3 rounded-full border border-white/20 px-3 py-1 text-sm text-white hover:border-white/40",
                    children: "Voltar"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                    lineNumber: 550,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
            lineNumber: 548,
            columnNumber: 7
        }, this);
    }
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-4 text-white/70",
            children: "Erro a carregar dados do torneio."
        }, void 0, false, {
            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
            lineNumber: 561,
            columnNumber: 12
        }, this);
    }
    if (!tournament) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-4 text-white/70",
        children: "A carregar…"
    }, void 0, false, {
        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
        lineNumber: 564,
        columnNumber: 27
    }, this);
    const summary = {
        pending: flatMatches.filter((m)=>m.status === "PENDING").length,
        inProgress: flatMatches.filter((m)=>m.status === "IN_PROGRESS").length,
        done: flatMatches.filter((m)=>m.status === "DONE").length
    };
    const showLivePanel = tournament?.event?.isFree === false;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center justify-between gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                        children: "Preparação"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 578,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-lg font-semibold text-white",
                                        children: "Bracket & participantes"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 579,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/60",
                                        children: "Define o tamanho e prepara a lista de jogadores."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 580,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 577,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/15 px-3 py-1 text-xs text-white/60",
                                        children: savingParticipants ? "A guardar…" : "Auto-guardar ativo"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 583,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: generateBracket,
                                        disabled: generating,
                                        className: "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100 hover:border-emerald-300/60 disabled:opacity-60",
                                        children: generating ? "A gerar…" : "Gerar bracket"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 586,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 582,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 576,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-4 lg:grid-cols-[240px_1fr]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "text-sm font-medium text-white/80",
                                                children: "Tamanho da bracket"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                lineNumber: 600,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: bracketSize,
                                                onChange: (e)=>{
                                                    const nextSize = Number(e.target.value);
                                                    if (filledCount > nextSize) {
                                                        const ok = window.confirm("A bracket vai ficar menor do que o numero de jogadores. Continuar?");
                                                        if (!ok) return;
                                                    }
                                                    setBracketSize(nextSize);
                                                },
                                                className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80",
                                                children: [
                                                    2,
                                                    4,
                                                    8,
                                                    16,
                                                    32,
                                                    64
                                                ].map((size)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: size,
                                                        children: [
                                                            size,
                                                            " jogadores"
                                                        ]
                                                    }, size, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                        lineNumber: 614,
                                                        columnNumber: 19
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                lineNumber: 601,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/50",
                                                children: [
                                                    filledCount,
                                                    " participantes · ordem top-down/left-right"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                lineNumber: 619,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 599,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/60",
                                        children: "Preenche os slots na ordem desejada. Cada slot corresponde a uma posicao no bracket."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 623,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 598,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-4",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
                                    children: slots.map((slot, idx)=>{
                                        const isActive = activeSlotIndex === idx;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-xl border border-white/10 bg-white/5 p-3 space-y-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center justify-between text-[11px] text-white/60",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: [
                                                                "Seed ",
                                                                idx + 1
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 635,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-1",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>moveSlot(idx, idx - 1),
                                                                    disabled: !slot || idx === 0,
                                                                    className: "rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/70 hover:border-white/40 disabled:opacity-50",
                                                                    children: "Subir"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 637,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>moveSlot(idx, idx + 1),
                                                                    disabled: !slot || idx === slots.length - 1,
                                                                    className: "rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/70 hover:border-white/40 disabled:opacity-50",
                                                                    children: "Descer"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 645,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 636,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                    lineNumber: 634,
                                                    columnNumber: 21
                                                }, this),
                                                slot ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-3",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/10",
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                        src: slot.avatarUrl || __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$avatars$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_GUEST_AVATAR"],
                                                                        alt: slot.name,
                                                                        className: "h-full w-full object-cover"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                        lineNumber: 660,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 658,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "min-w-0",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "truncate text-sm font-medium text-white",
                                                                            children: slot.name
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 667,
                                                                            columnNumber: 29
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-[11px] text-white/50",
                                                                            children: [
                                                                                slot.username ? `@${slot.username}` : "Convidado",
                                                                                slot.email ? ` · ${slot.email}` : ""
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 668,
                                                                            columnNumber: 29
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 666,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 657,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>isActive ? closeSlotEditor() : openSlotEditor(idx),
                                                                    className: "rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40",
                                                                    children: isActive ? "Fechar" : "Editar"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 675,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>{
                                                                        setSlots((prev)=>{
                                                                            const copy = [
                                                                                ...prev
                                                                            ];
                                                                            copy[idx] = null;
                                                                            return copy;
                                                                        });
                                                                    },
                                                                    className: "rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50 hover:border-white/30",
                                                                    children: "Limpar"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 682,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 674,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-2 text-sm text-white/60",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            children: "Slot vazio"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 699,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>isActive ? closeSlotEditor() : openSlotEditor(idx),
                                                            className: "rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40",
                                                            children: isActive ? "Fechar" : "Adicionar jogador"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 700,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                    lineNumber: 698,
                                                    columnNumber: 23
                                                }, this),
                                                isActive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-xl border border-white/10 bg-black/40 p-3 space-y-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center justify-between",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                                            children: [
                                                                                "Slot ",
                                                                                idx + 1
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 714,
                                                                            columnNumber: 29
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                            className: "text-base font-semibold text-white",
                                                                            children: "Editar jogador"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 717,
                                                                            columnNumber: 29
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 713,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: closeSlotEditor,
                                                                    className: "rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40",
                                                                    children: "Fechar"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 719,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 712,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap gap-2 text-xs",
                                                            children: [
                                                                "user",
                                                                "guest"
                                                            ].map((mode)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>{
                                                                        if (mode === slotMode) return;
                                                                        setSlotMode(mode);
                                                                        if (mode === "guest") {
                                                                            setSlotDraft((prev)=>({
                                                                                    ...prev,
                                                                                    username: "",
                                                                                    avatarUrl: null
                                                                                }));
                                                                        }
                                                                        if (mode === "user") {
                                                                            setSlotDraft((prev)=>({
                                                                                    ...prev,
                                                                                    email: "",
                                                                                    avatarUrl: null
                                                                                }));
                                                                        }
                                                                    },
                                                                    className: `rounded-full border px-3 py-1 ${slotMode === mode ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100" : "border-white/15 bg-white/5 text-white/60"}`,
                                                                    children: mode === "user" ? "Utilizador ORYA" : "Convidado"
                                                                }, mode, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 730,
                                                                    columnNumber: 29
                                                                }, this))
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 728,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "grid gap-3 md:grid-cols-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                    className: "text-sm text-white/70",
                                                                    children: [
                                                                        "Nome",
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            value: slotDraft.name,
                                                                            onChange: (e)=>setSlotDraft((prev)=>({
                                                                                        ...prev,
                                                                                        name: e.target.value
                                                                                    })),
                                                                            placeholder: "Nome publico",
                                                                            className: "mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 757,
                                                                            columnNumber: 29
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 755,
                                                                    columnNumber: 27
                                                                }, this),
                                                                slotMode === "guest" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                    className: "text-sm text-white/70",
                                                                    children: [
                                                                        "Email (para reclamar)",
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            value: slotDraft.email,
                                                                            onChange: (e)=>setSlotDraft((prev)=>({
                                                                                        ...prev,
                                                                                        email: e.target.value
                                                                                    })),
                                                                            placeholder: "email@dominio.com",
                                                                            className: "mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 767,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 765,
                                                                    columnNumber: 29
                                                                }, this),
                                                                slotMode === "user" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                    className: "text-sm text-white/70",
                                                                    children: [
                                                                        "Username",
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            value: slotDraft.username,
                                                                            onChange: (e)=>setSlotDraft((prev)=>({
                                                                                        ...prev,
                                                                                        username: e.target.value
                                                                                    })),
                                                                            placeholder: "@username",
                                                                            className: "mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 778,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 776,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 754,
                                                            columnNumber: 25
                                                        }, this),
                                                        slotMode === "user" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "space-y-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                    className: "text-sm text-white/70",
                                                                    children: [
                                                                        "Procurar utilizador",
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            value: searchTerm,
                                                                            onChange: (e)=>setSearchTerm(e.target.value),
                                                                            placeholder: "Nome ou @username",
                                                                            className: "mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 792,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 790,
                                                                    columnNumber: 29
                                                                }, this),
                                                                searching && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-[11px] text-white/50",
                                                                    children: "A procurar..."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 799,
                                                                    columnNumber: 43
                                                                }, this),
                                                                !searching && searchTerm && searchResults.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-[11px] text-white/50",
                                                                    children: "Sem resultados."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 801,
                                                                    columnNumber: 31
                                                                }, this),
                                                                searchResults.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "grid gap-2 md:grid-cols-2",
                                                                    children: searchResults.map((user)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>applyUserToDraft(user),
                                                                            className: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 hover:border-white/30",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-white/10",
                                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                        src: user.avatarUrl || __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$avatars$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_GUEST_AVATAR"],
                                                                                        alt: user.fullName ?? "",
                                                                                        className: "h-full w-full object-cover"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                                        lineNumber: 814,
                                                                                        columnNumber: 39
                                                                                    }, this)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                                    lineNumber: 812,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "min-w-0",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "truncate text-sm",
                                                                                            children: user.fullName || user.username || "Utilizador"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                                            lineNumber: 821,
                                                                                            columnNumber: 39
                                                                                        }, this),
                                                                                        user.username && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                            className: "text-[11px] text-white/50",
                                                                                            children: [
                                                                                                "@",
                                                                                                user.username
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                                            lineNumber: 822,
                                                                                            columnNumber: 57
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                                    lineNumber: 820,
                                                                                    columnNumber: 37
                                                                                }, this)
                                                                            ]
                                                                        }, user.id, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 806,
                                                                            columnNumber: 35
                                                                        }, this))
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 804,
                                                                    columnNumber: 31
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 789,
                                                            columnNumber: 27
                                                        }, this),
                                                        slotMode === "guest" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "space-y-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-sm text-white/70",
                                                                    children: "Avatar (upload)"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 833,
                                                                    columnNumber: 29
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex flex-wrap items-center gap-3 text-[11px] text-white/60",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                            className: "cursor-pointer rounded-full border border-white/15 px-3 py-1 hover:border-white/40",
                                                                            children: [
                                                                                uploadingAvatar ? "A carregar..." : "Upload imagem",
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                                    type: "file",
                                                                                    accept: "image/*",
                                                                                    className: "hidden",
                                                                                    disabled: uploadingAvatar,
                                                                                    onChange: (e)=>handleSlotAvatarUpload(e.target.files?.[0] ?? null)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                                    lineNumber: 837,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 835,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        slotDraft.avatarUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>setSlotDraft((prev)=>({
                                                                                        ...prev,
                                                                                        avatarUrl: null
                                                                                    })),
                                                                            className: "rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50 hover:border-white/30",
                                                                            children: "Remover imagem"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 846,
                                                                            columnNumber: 33
                                                                        }, this),
                                                                        !slotDraft.avatarUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "text-white/50",
                                                                            children: "Se não fizer upload, usa o avatar default."
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                            lineNumber: 855,
                                                                            columnNumber: 33
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 834,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 832,
                                                            columnNumber: 27
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[11px] text-white/50",
                                                            children: "Usa o avatar do utilizador ORYA."
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 860,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap items-center gap-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-[11px] text-white/50",
                                                                    children: "Guarda automaticamente."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 864,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: clearSlot,
                                                                    className: "rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 hover:border-white/30",
                                                                    children: "Limpar slot"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                    lineNumber: 865,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                            lineNumber: 863,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                    lineNumber: 711,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, `slot-${idx}`, true, {
                                            fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                            lineNumber: 633,
                                            columnNumber: 19
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                    lineNumber: 629,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 628,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 597,
                        columnNumber: 9
                    }, this),
                    (participantsMessage || generationMessage) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] text-white/70",
                        children: participantsMessage || generationMessage
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 883,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                lineNumber: 575,
                columnNumber: 7
            }, this),
            showLivePanel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                        children: "Live Torneio"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 893,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                        className: "text-xl font-semibold text-white",
                                        children: tournament?.event?.title ?? "Torneio"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 894,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/70 text-sm",
                                        children: [
                                            "Formato: ",
                                            tournament.format
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 895,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 892,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: [
                                            "Jogos: ",
                                            flatMatches.length
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 898,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: [
                                            "Pendentes ",
                                            summary.pending,
                                            " · Em jogo ",
                                            summary.inProgress,
                                            " · Terminados ",
                                            summary.done
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 899,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 897,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 891,
                        columnNumber: 11
                    }, this),
                    warnings.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "font-semibold",
                                children: "Avisos"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 905,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "list-disc pl-4 space-y-1",
                                children: warnings.map((w, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: [
                                            w.type === "REQUIRES_ACTION" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    "Jogador #",
                                                    w.pairingId,
                                                    " exige ação"
                                                ]
                                            }, void 0, true),
                                            w.type === "MISSING_COURT" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    "Jogo #",
                                                    w.matchId,
                                                    ": sem court"
                                                ]
                                            }, void 0, true),
                                            w.type === "MISSING_START" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    "Jogo #",
                                                    w.matchId,
                                                    ": sem horário definido"
                                                ]
                                            }, void 0, true),
                                            w.type === "INVALID_SCORE" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    "Jogo #",
                                                    w.matchId,
                                                    ": score inválido"
                                                ]
                                            }, void 0, true)
                                        ]
                                    }, `${w.type}-${w.matchId ?? w.pairingId}-${idx}`, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 908,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 906,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 904,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Filters, {
                        stages: stages,
                        setFilters: setFilters
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 919,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-4 md:grid-cols-2",
                        children: stages.map((stage)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-xl border border-white/10 bg-white/5 p-3 space-y-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                        children: stage.name || stage.stageType
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                        lineNumber: 926,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-white/75 text-sm",
                                                        children: [
                                                            stage.matches.length,
                                                            " jogos"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                        lineNumber: 929,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                lineNumber: 925,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70",
                                                children: stage.stageType
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                lineNumber: 931,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 924,
                                        columnNumber: 15
                                    }, this),
                                    stage.groups.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-2",
                                        children: stage.groups.map((group)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-lg border border-white/10 bg-black/40 p-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[12px] text-white/70 mb-1",
                                                        children: group.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                        lineNumber: 940,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-1",
                                                        children: group.standings.map((row, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex items-center justify-between text-[12px] text-white/80",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: [
                                                                            "#",
                                                                            idx + 1,
                                                                            " · Jogador ",
                                                                            row.pairingId ?? "—"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                        lineNumber: 944,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: [
                                                                            row.points,
                                                                            " pts"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                        lineNumber: 947,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, row.pairingId ?? idx, true, {
                                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                lineNumber: 943,
                                                                columnNumber: 27
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                        lineNumber: 941,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "mt-2 space-y-1",
                                                        children: group.matches.map((match)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/75",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center justify-between",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: [
                                                                                    "Jogo #",
                                                                                    match.id
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                                lineNumber: 958,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: match.statusLabel
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                                lineNumber: 959,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                        lineNumber: 957,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-white/60",
                                                                        children: [
                                                                            match.pairing1Id ?? "—",
                                                                            " vs ",
                                                                            match.pairing2Id ?? "—"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                        lineNumber: 961,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, match.id, true, {
                                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                lineNumber: 953,
                                                                columnNumber: 27
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                        lineNumber: 951,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, group.id, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                lineNumber: 939,
                                                columnNumber: 21
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 937,
                                        columnNumber: 17
                                    }, this),
                                    stage.matches.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-1",
                                        children: stage.matches.map((match)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: [
                                                                    "Jogo #",
                                                                    match.id
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                lineNumber: 980,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: match.statusLabel
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                                lineNumber: 981,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                        lineNumber: 979,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-white/60",
                                                        children: [
                                                            match.pairing1Id ?? "—",
                                                            " vs ",
                                                            match.pairing2Id ?? "—"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                        lineNumber: 983,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, match.id, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                                lineNumber: 975,
                                                columnNumber: 21
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                        lineNumber: 973,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, stage.id, true, {
                                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                                lineNumber: 923,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                        lineNumber: 921,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
                lineNumber: 890,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
        lineNumber: 574,
        columnNumber: 5
    }, this);
}
function OrganizerTournamentLivePage({ params }) {
    const resolvedParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["use"])(params);
    const tournamentId = Number(resolvedParams.id);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const isValidTournamentId = Number.isFinite(tournamentId);
    const { data } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(isValidTournamentId ? `/api/organizador/tournaments/${tournamentId}/live` : null, fetcher);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const eventId = data?.tournament?.event?.id;
        if (Number.isFinite(eventId)) {
            router.replace(`/organizador/eventos/${eventId}/live?tab=bracket`);
        }
    }, [
        data?.tournament?.event?.id,
        router
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-4 text-white/70",
        children: "A redirecionar para a preparação do evento..."
    }, void 0, false, {
        fileName: "[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx",
        lineNumber: 1017,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EventLiveDashboardClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$eventos$2f$EventLivePrepClient$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/(dashboard)/eventos/EventLivePrepClient.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventLiveClient$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/EventLiveClient.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$tournaments$2f5b$id$5d2f$live$2f$page$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/(dashboard)/tournaments/[id]/live/page.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
const TABS = [
    {
        id: "setup",
        label: "LiveHub"
    },
    {
        id: "bracket",
        label: "Bracket"
    },
    {
        id: "preview",
        label: "Preview"
    }
];
function EventLiveDashboardClient({ event, tournamentId, canManageLiveConfig }) {
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const tabs = TABS.filter((item)=>canManageLiveConfig ? true : item.id === "preview");
    const requestedTab = searchParams?.get("tab") || (canManageLiveConfig ? "setup" : "preview");
    const tab = tabs.find((item)=>item.id === requestedTab)?.id ?? tabs[0]?.id ?? "preview";
    const basePath = `/organizador/eventos/${event.id}/live`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1226]/70 to-[#050912]/90 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center justify-between gap-3",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] uppercase tracking-[0.24em] text-white/60",
                                    children: "Gerir · Preparar live"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                                    lineNumber: 43,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                    className: "text-2xl font-semibold text-white",
                                    children: event.title
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                                    lineNumber: 44,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm text-white/60",
                                    children: "Configura LiveHub, bracket e preview no mesmo lugar."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                                    lineNumber: 45,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                            lineNumber: 42,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                        lineNumber: 41,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 flex flex-wrap gap-2",
                        children: tabs.map((item)=>{
                            const params = new URLSearchParams(searchParams?.toString());
                            params.set("tab", item.id);
                            if (item.id === "preview") {
                                params.set("edit", "1");
                            } else {
                                params.delete("edit");
                            }
                            const href = `${basePath}?${params.toString()}`;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                href: href,
                                className: `rounded-full border px-4 py-1 text-[11px] uppercase tracking-[0.2em] ${tab === item.id ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-100" : "border-white/15 bg-white/5 text-white/60"}`,
                                children: item.label
                            }, item.id, false, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                                lineNumber: 59,
                                columnNumber: 15
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                        lineNumber: 48,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                lineNumber: 40,
                columnNumber: 7
            }, this),
            tab === "setup" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$eventos$2f$EventLivePrepClient$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                event: {
                    id: event.id,
                    slug: event.slug,
                    title: event.title,
                    liveHubVisibility: event.liveHubVisibility,
                    liveStreamUrl: event.liveStreamUrl
                },
                tournamentId: tournamentId
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                lineNumber: 76,
                columnNumber: 9
            }, this),
            tab === "bracket" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    !tournamentId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100",
                        children: "Ainda não existe um torneio associado. Cria o torneio no separador LiveHub para começar a preparar a bracket."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                        lineNumber: 91,
                        columnNumber: 13
                    }, this),
                    tournamentId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$tournaments$2f5b$id$5d2f$live$2f$page$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TournamentLiveManager"], {
                        tournamentId: tournamentId
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                        lineNumber: 95,
                        columnNumber: 28
                    }, this)
                ]
            }, void 0, true),
            tab === "preview" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70",
                        children: [
                            "Preview do LiveHub com overlay do organizador. Usa ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-white",
                                children: "Editar"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                                lineNumber: 102,
                                columnNumber: 64
                            }, this),
                            " nos jogos para atualizar resultados."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                        lineNumber: 101,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$EventLiveClient$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                        slug: event.slug
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                        lineNumber: 105,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
                lineNumber: 100,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/eventos/EventLiveDashboardClient.tsx",
        lineNumber: 39,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__99cc621a._.js.map