(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/inscricoes/[id]/FormSubmissionClient.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FormSubmissionClient",
    ()=>FormSubmissionClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const formatDateTime = (value)=>{
    if (!value) return "Disponível sempre";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Data a anunciar";
    return parsed.toLocaleString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};
function FormSubmissionClient({ form }) {
    _s();
    const { isLoggedIn } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const [answers, setAnswers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [guestEmail, setGuestEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [submitting, setSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [success, setSuccess] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const hasEmailField = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "FormSubmissionClient.useMemo[hasEmailField]": ()=>form.fields.some({
                "FormSubmissionClient.useMemo[hasEmailField]": (field)=>field.fieldType === "EMAIL"
            }["FormSubmissionClient.useMemo[hasEmailField]"])
    }["FormSubmissionClient.useMemo[hasEmailField]"], [
        form.fields
    ]);
    const needsGuestEmail = !isLoggedIn && !hasEmailField;
    const capacityLabel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "FormSubmissionClient.useMemo[capacityLabel]": ()=>{
            if (typeof form.capacity !== "number") return "Sem limite de vagas";
            if (form.capacity <= 0) return "Sem vagas disponíveis";
            return `${form.capacity} vaga${form.capacity === 1 ? "" : "s"} disponíveis`;
        }
    }["FormSubmissionClient.useMemo[capacityLabel]"], [
        form.capacity
    ]);
    const hasStart = Boolean(form.startAt);
    const hasEnd = Boolean(form.endAt);
    const isOpen = form.status !== "ARCHIVED";
    const statusLabel = isOpen ? "Inscrições abertas" : "Inscrições encerradas";
    const statusTone = isOpen ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50" : "border-white/20 bg-white/10 text-white/70";
    const startLabel = hasStart ? formatDateTime(form.startAt) : null;
    const endLabel = hasEnd ? formatDateTime(form.endAt) : null;
    const dateLabel = !hasStart && !hasEnd ? "Disponível sempre" : startLabel ?? (endLabel ? `Disponível até ${endLabel}` : null);
    const updateAnswer = (fieldId, value)=>{
        setAnswers((prev)=>({
                ...prev,
                [String(fieldId)]: value
            }));
    };
    const handleSubmit = async (event)=>{
        event.preventDefault();
        setError(null);
        setSuccess(null);
        setSubmitting(true);
        try {
            const res = await fetch(`/api/inscricoes/${form.id}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    answers,
                    guestEmail: needsGuestEmail ? guestEmail : undefined
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok || data?.ok === false) {
                setError(data?.error || "Não foi possível enviar a inscrição.");
                setSubmitting(false);
                return;
            }
            const status = data?.status === "WAITLISTED" ? "Ficaste em lista de espera." : "Inscrição enviada com sucesso.";
            setSuccess(status);
            setSubmitting(false);
        } catch (err) {
            console.error("[inscricoes][submit] erro", err);
            setError("Erro inesperado ao enviar.");
            setSubmitting(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "relative orya-body-bg min-h-screen w-full overflow-hidden text-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none fixed inset-0",
                "aria-hidden": "true",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                        lineNumber: 113,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                        lineNumber: 114,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl"
                    }, void 0, false, {
                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                        lineNumber: 115,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen"
                    }, void 0, false, {
                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                        lineNumber: 116,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                lineNumber: 112,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "relative orya-page-width px-4 pb-16 pt-10 space-y-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                        className: "space-y-4 rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/80 to-[#050912]/90 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-start justify-between gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] uppercase tracking-[0.3em] text-white/60",
                                                children: "Inscrições ORYA"
                                            }, void 0, false, {
                                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                lineNumber: 123,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                className: "text-3xl font-semibold",
                                                children: form.title
                                            }, void 0, false, {
                                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                lineNumber: 124,
                                                columnNumber: 15
                                            }, this),
                                            form.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-white/70",
                                                children: form.description
                                            }, void 0, false, {
                                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                lineNumber: 125,
                                                columnNumber: 36
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 122,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: `rounded-full border px-3 py-1 text-[12px] ${statusTone}`,
                                        children: statusLabel
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 127,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 121,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center gap-3 text-[12px] text-white/70",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/15 bg-white/5 px-3 py-1",
                                        children: capacityLabel
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 130,
                                        columnNumber: 13
                                    }, this),
                                    dateLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/15 bg-white/5 px-3 py-1",
                                        children: dateLabel
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 132,
                                        columnNumber: 15
                                    }, this),
                                    hasStart && endLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/15 bg-white/5 px-3 py-1",
                                        children: [
                                            "Até ",
                                            endLabel
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 135,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/15 bg-white/5 px-3 py-1",
                                        children: form.waitlistEnabled ? "Lista de espera ativa" : "Sem lista de espera"
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 139,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 129,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[12px] text-white/60",
                                children: [
                                    "Organização:",
                                    " ",
                                    form.organizerUsername ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        href: `/${form.organizerUsername}`,
                                        className: "text-white hover:text-white/80",
                                        children: form.organizerName
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 146,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-white",
                                        children: form.organizerName
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 150,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 143,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                        lineNumber: 120,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "grid gap-4 md:grid-cols-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                        children: "O que precisas de saber"
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 157,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "mt-2 text-lg font-semibold text-white",
                                        children: "Detalhes essenciais"
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 158,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-[12px] text-white/60",
                                        children: form.description || "Preenche o formulário com atenção. A organização vai usar estes dados para gerir vagas e convocações."
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 159,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 156,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                        children: "O que acontece agora"
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 165,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "mt-2 text-lg font-semibold text-white",
                                        children: "Próximos passos"
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 166,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-3 space-y-2 text-[12px] text-white/70",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                children: "1. Preenche o formulário completo e envia a inscrição."
                                            }, void 0, false, {
                                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                lineNumber: 168,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                children: "2. Recebes confirmação imediata na página."
                                            }, void 0, false, {
                                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                lineNumber: 169,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                children: "3. A organização atualiza o teu estado (aceite, espera ou convocado)."
                                            }, void 0, false, {
                                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                lineNumber: 170,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 167,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 164,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                        lineNumber: 155,
                        columnNumber: 9
                    }, this),
                    !isLoggedIn && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-white/70",
                        children: "Estás a submeter como convidado. Se iniciares sessão, a inscrição fica ligada ao teu perfil."
                    }, void 0, false, {
                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                        lineNumber: 176,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        onSubmit: handleSubmit,
                        className: "space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6",
                        children: [
                            needsGuestEmail && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        className: "text-[12px] text-white/80",
                                        children: [
                                            "Email de contacto ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-emerald-300",
                                                children: "*"
                                            }, void 0, false, {
                                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                lineNumber: 185,
                                                columnNumber: 35
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 184,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]",
                                        type: "email",
                                        placeholder: "nome@email.com",
                                        value: guestEmail,
                                        onChange: (e)=>setGuestEmail(e.target.value)
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 187,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/50",
                                        children: "Usamos este email para confirmação e contacto."
                                    }, void 0, false, {
                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                        lineNumber: 194,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 183,
                                columnNumber: 13
                            }, this),
                            form.fields.map((field)=>{
                                const fieldKey = String(field.id);
                                const value = answers[fieldKey];
                                const baseClass = "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]";
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-[12px] text-white/80",
                                            children: [
                                                field.label,
                                                field.required && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-emerald-300",
                                                    children: " *"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                    lineNumber: 207,
                                                    columnNumber: 38
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                            lineNumber: 205,
                                            columnNumber: 17
                                        }, this),
                                        field.helpText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] text-white/50",
                                            children: field.helpText
                                        }, void 0, false, {
                                            fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                            lineNumber: 209,
                                            columnNumber: 36
                                        }, this),
                                        field.fieldType === "TEXTAREA" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                            className: `${baseClass} min-h-[96px]`,
                                            placeholder: field.placeholder ?? "",
                                            value: typeof value === "string" ? value : "",
                                            onChange: (e)=>updateAnswer(field.id, e.target.value)
                                        }, void 0, false, {
                                            fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                            lineNumber: 211,
                                            columnNumber: 19
                                        }, this) : field.fieldType === "SELECT" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            className: baseClass,
                                            value: typeof value === "string" ? value : "",
                                            onChange: (e)=>updateAnswer(field.id, e.target.value),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "",
                                                    children: "Seleciona"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                    lineNumber: 223,
                                                    columnNumber: 21
                                                }, this),
                                                (field.options ?? []).map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: opt,
                                                        children: opt
                                                    }, opt, false, {
                                                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                        lineNumber: 225,
                                                        columnNumber: 23
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                            lineNumber: 218,
                                            columnNumber: 19
                                        }, this) : field.fieldType === "CHECKBOX" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "flex items-center gap-2 text-sm text-white/80",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "checkbox",
                                                    className: "h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]",
                                                    checked: Boolean(value),
                                                    onChange: (e)=>updateAnswer(field.id, e.target.checked)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                                    lineNumber: 232,
                                                    columnNumber: 21
                                                }, this),
                                                field.placeholder || "Confirmo"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                            lineNumber: 231,
                                            columnNumber: 19
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            className: baseClass,
                                            type: field.fieldType === "EMAIL" ? "email" : field.fieldType === "PHONE" ? "tel" : field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text",
                                            placeholder: field.placeholder ?? "",
                                            value: typeof value === "string" || typeof value === "number" ? value : "",
                                            onChange: (e)=>updateAnswer(field.id, e.target.value)
                                        }, void 0, false, {
                                            fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                            lineNumber: 241,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, fieldKey, true, {
                                    fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                    lineNumber: 204,
                                    columnNumber: 15
                                }, this);
                            }),
                            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-red-300",
                                children: error
                            }, void 0, false, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 263,
                                columnNumber: 21
                            }, this),
                            success && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-emerald-300",
                                children: success
                            }, void 0, false, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 264,
                                columnNumber: 23
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "submit",
                                disabled: submitting,
                                className: "w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60",
                                children: submitting ? "A enviar..." : "Enviar inscrição"
                            }, void 0, false, {
                                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                                lineNumber: 266,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                        lineNumber: 181,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
                lineNumber: 119,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/inscricoes/[id]/FormSubmissionClient.tsx",
        lineNumber: 111,
        columnNumber: 5
    }, this);
}
_s(FormSubmissionClient, "a4wwPlCGFUKNXo+FzihpWZvDyFE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"]
    ];
});
_c = FormSubmissionClient;
var _c;
__turbopack_context__.k.register(_c, "FormSubmissionClient");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_inscricoes_%5Bid%5D_FormSubmissionClient_tsx_cc56f727._.js.map