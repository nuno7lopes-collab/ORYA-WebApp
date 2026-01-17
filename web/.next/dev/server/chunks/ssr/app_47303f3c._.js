module.exports = [
"[project]/app/components/checkin/CheckinScanner.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CheckinScanner",
    ()=>CheckinScanner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
"use client";
;
;
;
const STATUS_META = {
    OK: {
        label: "Pronto para confirmar",
        tone: "border-emerald-400/50 bg-emerald-500/10 text-emerald-50",
        canConfirm: true,
        hint: "Confirma o check-in no passo seguinte."
    },
    ALREADY_USED: {
        label: "Já usado",
        tone: "border-amber-400/50 bg-amber-500/10 text-amber-50",
        canConfirm: false,
        hint: "Este bilhete já foi validado."
    },
    INVALID: {
        label: "QR inválido",
        tone: "border-red-400/50 bg-red-500/10 text-red-50",
        canConfirm: false,
        hint: "O QR não está ativo ou expirou."
    },
    REFUNDED: {
        label: "Reembolsado",
        tone: "border-red-400/50 bg-red-500/10 text-red-50",
        canConfirm: false,
        hint: "Bilhete reembolsado — não pode entrar."
    },
    REVOKED: {
        label: "Revogado",
        tone: "border-red-400/50 bg-red-500/10 text-red-50",
        canConfirm: false,
        hint: "Bilhete revogado — não pode entrar."
    },
    SUSPENDED: {
        label: "Suspenso",
        tone: "border-red-400/50 bg-red-500/10 text-red-50",
        canConfirm: false,
        hint: "Bilhete suspenso — pede ajuda ao organizador."
    },
    NOT_ALLOWED: {
        label: "Não permitido",
        tone: "border-red-400/50 bg-red-500/10 text-red-50",
        canConfirm: false,
        hint: "Este QR não pertence a este evento."
    },
    OUTSIDE_WINDOW: {
        label: "Fora da janela",
        tone: "border-amber-400/50 bg-amber-500/10 text-amber-50",
        canConfirm: false,
        hint: "Check-in só disponível na janela do evento."
    }
};
const formatDateTime = (value)=>{
    if (!value) return "A definir";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "A definir";
    return parsed.toLocaleString("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
};
function resolveMeta(code) {
    return STATUS_META[code] ?? {
        label: "Estado desconhecido",
        tone: "border-white/20 bg-white/5 text-white/80",
        canConfirm: false,
        hint: "Revê o QR e tenta novamente."
    };
}
function CheckinScanner({ backHref, backLabel, title = "Modo Receção", subtitle = "Valida o Pass ORYA em 2 passos: pré-visualizar e confirmar.", allowOrganizerEvents = false, embedded = false, showBackLink = true, eventIdOverride = null }) {
    const search = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const eventIdRaw = search.get("eventId");
    const eventId = eventIdRaw ? Number(eventIdRaw) : Number.NaN;
    const hasQueryEvent = Number.isFinite(eventId) && eventId > 0;
    const hasOverride = Number.isFinite(eventIdOverride) && (eventIdOverride ?? 0) > 0;
    const [selectedEventId, setSelectedEventId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(hasOverride ? eventIdOverride : hasQueryEvent ? eventId : null);
    const [events, setEvents] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [eventsLoading, setEventsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [eventsError, setEventsError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (hasOverride) {
            setSelectedEventId(eventIdOverride);
            return;
        }
        if (hasQueryEvent) {
            setSelectedEventId(eventId);
        }
    }, [
        eventId,
        eventIdOverride,
        hasOverride,
        hasQueryEvent
    ]);
    const effectiveEventId = hasOverride ? eventIdOverride : hasQueryEvent ? eventId : selectedEventId ?? Number.NaN;
    const hasEvent = Number.isFinite(effectiveEventId) && effectiveEventId > 0;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!allowOrganizerEvents || hasQueryEvent || hasOverride) return;
        let active = true;
        setEventsLoading(true);
        setEventsError(null);
        fetch("/api/organizador/events/list?limit=60").then(async (res)=>{
            const data = await res.json().catch(()=>null);
            if (!res.ok || !data?.ok) {
                throw new Error(data?.error || "Erro ao carregar eventos.");
            }
            if (!active) return;
            setEvents(data.items ?? []);
        }).catch((err)=>{
            if (!active) return;
            setEventsError(err instanceof Error ? err.message : "Erro ao carregar eventos.");
        }).finally(()=>{
            if (active) setEventsLoading(false);
        });
        return ()=>{
            active = false;
        };
    }, [
        allowOrganizerEvents,
        hasQueryEvent,
        hasOverride
    ]);
    const [deviceId, setDeviceId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [qrToken, setQrToken] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [preview, setPreview] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [previewing, setPreviewing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [confirming, setConfirming] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [confirmedCode, setConfirmedCode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const existing = window.localStorage.getItem("oryaCheckinDeviceId");
        if (existing) {
            setDeviceId(existing);
            return;
        }
        const next = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `device-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem("oryaCheckinDeviceId", next);
        setDeviceId(next);
    }, []);
    const meta = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const code = confirmedCode ?? preview?.code ?? "";
        const base = resolveMeta(code);
        if (confirmedCode === "OK") {
            return {
                ...base,
                label: "Check-in confirmado",
                hint: "Entrada validada com sucesso.",
                tone: "border-emerald-400/50 bg-emerald-500/10 text-emerald-50"
            };
        }
        return base;
    }, [
        preview,
        confirmedCode
    ]);
    const handlePreview = async ()=>{
        setError(null);
        setPreview(null);
        setConfirmedCode(null);
        if (!qrToken.trim()) {
            setError("Indica o QR token.");
            return;
        }
        if (!hasEvent) {
            setError("Seleciona um evento válido.");
            return;
        }
        setPreviewing(true);
        try {
            const res = await fetch("/api/organizador/checkin/preview", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    qrToken: qrToken.trim(),
                    eventId: effectiveEventId
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok) {
                setError(data?.code ? `Erro: ${data.code}` : "Não foi possível validar o QR.");
                setPreviewing(false);
                return;
            }
            setPreview(data);
        } catch (err) {
            console.error("[checkin][preview]", err);
            setError("Erro inesperado ao validar.");
        } finally{
            setPreviewing(false);
        }
    };
    const handleConfirm = async ()=>{
        if (!preview || preview.code !== "OK") return;
        setConfirming(true);
        setError(null);
        try {
            const res = await fetch("/api/organizador/checkin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    qrToken: qrToken.trim(),
                    eventId: effectiveEventId,
                    deviceId
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok) {
                setError("Erro ao confirmar check-in.");
                setConfirming(false);
                return;
            }
            setConfirmedCode(data?.code ?? "OK");
        } catch (err) {
            console.error("[checkin][confirm]", err);
            setError("Erro inesperado ao confirmar.");
        } finally{
            setConfirming(false);
        }
    };
    const handleReset = ()=>{
        setPreview(null);
        setConfirmedCode(null);
        setQrToken("");
        setError(null);
    };
    const shellClass = embedded ? "relative w-full text-white" : "relative orya-body-bg min-h-screen w-full overflow-hidden text-white";
    const containerClass = embedded ? "relative mx-auto w-full max-w-5xl space-y-6" : "relative mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: shellClass,
        children: [
            !embedded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none fixed inset-0",
                "aria-hidden": "true",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                        lineNumber: 282,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                        lineNumber: 283,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                        lineNumber: 284,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                        lineNumber: 285,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                lineNumber: 281,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: containerClass,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl",
                        children: [
                            showBackLink && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: backHref,
                                className: "text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white",
                                children: [
                                    "← ",
                                    backLabel
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                lineNumber: 292,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-3xl font-semibold",
                                children: title
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                lineNumber: 296,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/70",
                                children: subtitle
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                lineNumber: 297,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                        lineNumber: 290,
                        columnNumber: 9
                    }, this),
                    !hasEvent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-50",
                        children: "Precisas de escolher um evento para iniciar o check-in."
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                        lineNumber: 301,
                        columnNumber: 11
                    }, this),
                    allowOrganizerEvents && !hasQueryEvent && !hasOverride && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                children: "Evento"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                lineNumber: 308,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 text-[12px] text-white/70",
                                children: "Seleciona o evento antes de validar o QR."
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                lineNumber: 309,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-3 space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        value: selectedEventId ?? "",
                                        onChange: (e)=>setSelectedEventId(e.target.value ? Number(e.target.value) : null),
                                        className: "w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "Seleciona um evento"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                lineNumber: 318,
                                                columnNumber: 17
                                            }, this),
                                            events.map((ev)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: ev.id,
                                                    children: ev.title
                                                }, ev.id, false, {
                                                    fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                    lineNumber: 320,
                                                    columnNumber: 19
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 313,
                                        columnNumber: 15
                                    }, this),
                                    eventsLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/60",
                                        children: "A carregar eventos…"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 325,
                                        columnNumber: 33
                                    }, this),
                                    eventsError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-red-300",
                                        children: eventsError
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 326,
                                        columnNumber: 31
                                    }, this),
                                    selectedEventId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/60",
                                        children: [
                                            formatDateTime(events.find((ev)=>ev.id === selectedEventId)?.startsAt ?? null),
                                            " ·",
                                            " ",
                                            events.find((ev)=>ev.id === selectedEventId)?.locationName ?? "Local a anunciar"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 328,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                lineNumber: 312,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                        lineNumber: 307,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-4 md:grid-cols-[1.15fr_0.85fr]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-4 rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.26em] text-white/60",
                                        children: "Passo 1"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 339,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-lg font-semibold",
                                        children: "Validar o QR"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 340,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] text-white/65",
                                        children: "Introduz o QR token ou lê o código. A validação não consome o bilhete."
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 341,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "text",
                                        value: qrToken,
                                        onChange: (e)=>setQrToken(e.target.value),
                                        placeholder: "QR token",
                                        className: "w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 344,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: handlePreview,
                                        disabled: previewing,
                                        className: "w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60",
                                        children: previewing ? "A validar..." : "Validar QR"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 351,
                                        columnNumber: 13
                                    }, this),
                                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-red-300",
                                        children: error
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 359,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                lineNumber: 338,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-4 rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.26em] text-white/60",
                                        children: "Passo 2"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 363,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-lg font-semibold",
                                        children: "Confirmar check-in"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 364,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] text-white/65",
                                        children: "Confirma apenas quando estiveres com a pessoa presente."
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 365,
                                        columnNumber: 13
                                    }, this),
                                    preview || confirmedCode ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: `rounded-2xl border p-4 text-sm ${meta.tone}`,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.2em] opacity-80",
                                                children: "Estado"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                lineNumber: 371,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-1 text-lg font-semibold",
                                                children: meta.label
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                lineNumber: 372,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[12px] opacity-80",
                                                children: meta.hint
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                lineNumber: 373,
                                                columnNumber: 17
                                            }, this),
                                            preview?.entitlement && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 space-y-1 text-[12px] text-white/85",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "font-semibold",
                                                        children: preview.entitlement.snapshotTitle
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                        lineNumber: 376,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: preview.entitlement.holderKey
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                        lineNumber: 377,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: preview.entitlement.snapshotVenue ?? "Local a anunciar"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                        lineNumber: 378,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: formatDateTime(preview.entitlement.snapshotStartAt)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                        lineNumber: 379,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                lineNumber: 375,
                                                columnNumber: 19
                                            }, this),
                                            preview?.checkedInAt && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-2 text-[12px] opacity-80",
                                                children: [
                                                    "Check-in feito em ",
                                                    formatDateTime(preview.checkedInAt)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                                lineNumber: 383,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 370,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-2xl border border-white/10 bg-black/30 p-4 text-[12px] text-white/70",
                                        children: "Primeiro valida um QR para veres os detalhes."
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 389,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: handleConfirm,
                                        disabled: !preview || preview.code !== "OK" || confirming || Boolean(confirmedCode),
                                        className: "w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-50",
                                        children: confirming ? "A confirmar..." : confirmedCode ? "Check-in confirmado" : "Confirmar check-in"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 394,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: handleReset,
                                        className: "w-full rounded-full border border-white/30 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10",
                                        children: "Novo check-in"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                        lineNumber: 403,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                                lineNumber: 362,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                        lineNumber: 337,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
                lineNumber: 289,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/checkin/CheckinScanner.tsx",
        lineNumber: 279,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/organizador/objectiveNav.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
    manage: "Gerir",
    promote: "Promover",
    analyze: "Analisar",
    profile: "Perfil"
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
    const active = activeId && sections.some((section)=>section.id === activeId) ? activeId : sections[0]?.id;
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
"[project]/app/organizador/(dashboard)/scan/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>OrganizerScanPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkin$2f$CheckinScanner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkin/CheckinScanner.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/ObjectiveSubnav.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function OrganizerScanPage({ embedded }) {
    const wrapperClass = embedded ? "space-y-6 text-white" : "w-full px-4 py-8 space-y-6 text-white md:px-6 lg:px-8";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: wrapperClass,
        children: [
            !embedded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                objective: "manage",
                activeId: "checkin"
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/scan/page.tsx",
                lineNumber: 15,
                columnNumber: 21
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkin$2f$CheckinScanner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CheckinScanner"], {
                backHref: "/organizador?tab=manage",
                backLabel: "Ver gestão",
                title: "Modo Receção · Organizador",
                subtitle: "Check-in em 2 passos com confirmação explícita.",
                allowOrganizerEvents: true,
                embedded: true,
                showBackLink: false
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/scan/page.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/scan/page.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=app_47303f3c._.js.map