(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/organizador/(dashboard)/updates/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>UpdatesPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/ObjectiveSubnav.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const fetcher = (url)=>fetch(url).then((res)=>res.json());
const CATEGORY_LABELS = {
    TODAY: "Hoje",
    CHANGES: "Alterações",
    RESULTS: "Resultados",
    CALL_UPS: "Convocatórias"
};
const STATUS_LABELS = {
    DRAFT: "Rascunho",
    PUBLISHED: "Publicado",
    ARCHIVED: "Arquivado"
};
function UpdatesPage({ embedded }) {
    _s();
    const { data, mutate, isLoading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])("/api/organizador/updates", fetcher);
    const { data: eventsData } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])("/api/organizador/events/list?limit=80", fetcher);
    const updates = data?.items ?? [];
    const events = eventsData?.items ?? [];
    const [editingId, setEditingId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [title, setTitle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [body, setBody] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [category, setCategory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("TODAY");
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("DRAFT");
    const [isPinned, setIsPinned] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [eventId, setEventId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [success, setSuccess] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const resetForm = ()=>{
        setEditingId(null);
        setTitle("");
        setBody("");
        setCategory("TODAY");
        setStatus("DRAFT");
        setIsPinned(false);
        setEventId("");
    };
    const handleEdit = (update)=>{
        setEditingId(update.id);
        setTitle(update.title);
        setBody(update.body ?? "");
        setCategory(update.category);
        setStatus(update.status);
        setIsPinned(update.isPinned);
        setEventId(update.event?.id ?? "");
    };
    const handleSave = async ()=>{
        setError(null);
        setSuccess(null);
        if (!title.trim()) {
            setError("Indica um título curto para o update.");
            return;
        }
        setSaving(true);
        const payload = {
            title: title.trim(),
            body: body.trim(),
            category,
            status,
            isPinned,
            eventId: eventId === "" ? null : eventId
        };
        try {
            const res = await fetch(editingId ? `/api/organizador/updates/${editingId}` : "/api/organizador/updates", {
                method: editingId ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setError(json?.error || "Erro ao guardar update.");
                setSaving(false);
                return;
            }
            setSuccess(editingId ? "Update atualizado." : "Update criado.");
            resetForm();
            mutate();
        } catch (err) {
            console.error("[updates][save]", err);
            setError("Erro inesperado ao guardar.");
        } finally{
            setSaving(false);
        }
    };
    const togglePin = async (update)=>{
        await fetch(`/api/organizador/updates/${update.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                isPinned: !update.isPinned
            })
        });
        mutate();
    };
    const archiveUpdate = async (update)=>{
        await fetch(`/api/organizador/updates/${update.id}`, {
            method: "DELETE"
        });
        mutate();
    };
    const publishQuick = async (update)=>{
        await fetch(`/api/organizador/updates/${update.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: "PUBLISHED"
            })
        });
        mutate();
    };
    const formattedUpdates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "UpdatesPage.useMemo[formattedUpdates]": ()=>{
            return updates.map({
                "UpdatesPage.useMemo[formattedUpdates]": (update)=>{
                    const date = update.publishedAt || update.createdAt;
                    const dateLabel = date ? new Date(date).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                    }) : "A definir";
                    return {
                        ...update,
                        dateLabel
                    };
                }
            }["UpdatesPage.useMemo[formattedUpdates]"]);
        }
    }["UpdatesPage.useMemo[formattedUpdates]"], [
        updates
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "relative w-full overflow-hidden text-white",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
            className: embedded ? "relative flex flex-col gap-6" : "relative w-full flex flex-col gap-6 px-4 py-8 md:px-6 lg:px-8",
            children: [
                !embedded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    objective: "promote",
                    activeId: "updates"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                    lineNumber: 175,
                    columnNumber: 23
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 px-6 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.3em] text-white/60",
                                children: "Canal oficial"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                lineNumber: 178,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-2xl font-semibold",
                                children: "Atualizações da organização"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                lineNumber: 179,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/65",
                                children: "Comunicados curtos, objetivos e sempre com estado claro."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                lineNumber: 180,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                        lineNumber: 177,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                    lineNumber: 176,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center justify-between gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-lg font-semibold",
                                    children: editingId ? "Editar update" : "Novo update"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 188,
                                    columnNumber: 13
                                }, this),
                                editingId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: resetForm,
                                    className: "text-[12px] text-white/60 hover:text-white",
                                    children: "Cancelar edição"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 190,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 187,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-4 grid gap-4 md:grid-cols-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-[12px] text-white/70",
                                            children: "Título"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 202,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                            value: title,
                                            onChange: (e)=>setTitle(e.target.value),
                                            placeholder: "Ex: Alteração de horários"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 203,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 201,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-[12px] text-white/70",
                                            children: "Categoria"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 211,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                            value: category,
                                            onChange: (e)=>setCategory(e.target.value),
                                            children: Object.entries(CATEGORY_LABELS).map(([key, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: key,
                                                    children: label
                                                }, key, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 218,
                                                    columnNumber: 19
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 212,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 210,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-[12px] text-white/70",
                                            children: "Estado"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 225,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                            value: status,
                                            onChange: (e)=>setStatus(e.target.value),
                                            children: Object.entries(STATUS_LABELS).map(([key, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: key,
                                                    children: label
                                                }, key, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 232,
                                                    columnNumber: 19
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 226,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 224,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-[12px] text-white/70",
                                            children: "Evento (opcional)"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 239,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            className: "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                            value: eventId,
                                            onChange: (e)=>setEventId(e.target.value ? Number(e.target.value) : ""),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "",
                                                    children: "Sem evento"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 245,
                                                    columnNumber: 17
                                                }, this),
                                                events.map((ev)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: ev.id,
                                                        children: ev.title
                                                    }, ev.id, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                        lineNumber: 247,
                                                        columnNumber: 19
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 240,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 238,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 200,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-4 space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-[12px] text-white/70",
                                    children: "Mensagem"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 256,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    className: "w-full min-h-[120px] rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                    value: body,
                                    onChange: (e)=>setBody(e.target.value),
                                    placeholder: "Mensagem curta, direta e objetiva."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 257,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 255,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "mt-4 flex items-center gap-2 text-sm text-white/80",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "checkbox",
                                    checked: isPinned,
                                    onChange: (e)=>setIsPinned(e.target.checked),
                                    className: "h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 266,
                                    columnNumber: 13
                                }, this),
                                "Fixar no topo"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 265,
                            columnNumber: 11
                        }, this),
                        error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-3 text-sm text-red-300",
                            children: error
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 275,
                            columnNumber: 21
                        }, this),
                        success && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-3 text-sm text-emerald-300",
                            children: success
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 276,
                            columnNumber: 23
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: handleSave,
                            disabled: saving,
                            className: "mt-4 w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60",
                            children: saving ? "A guardar..." : editingId ? "Guardar alterações" : "Publicar update"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 278,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                    lineNumber: 186,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-lg font-semibold",
                                    children: "Atualizações recentes"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 290,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[12px] text-white/60",
                                    children: [
                                        updates.length,
                                        " total"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 291,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 289,
                            columnNumber: 11
                        }, this),
                        isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70",
                            children: "A carregar atualizações…"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 295,
                            columnNumber: 13
                        }, this),
                        !isLoading && formattedUpdates.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70",
                            children: "Ainda não publicaste nenhuma atualização."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 301,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid gap-3",
                            children: formattedUpdates.map((update)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center justify-between gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                            children: [
                                                                CATEGORY_LABELS[update.category] || update.category,
                                                                update.isPinned ? " · Fixado" : ""
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                            lineNumber: 314,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                            className: "text-base font-semibold text-white",
                                                            children: update.title
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                            lineNumber: 318,
                                                            columnNumber: 21
                                                        }, this),
                                                        update.event && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] text-white/60",
                                                            children: [
                                                                "Evento: ",
                                                                update.event.title
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                            lineNumber: 320,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 313,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "text-[11px] text-white/50",
                                                    children: update.dateLabel
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 323,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 312,
                                            columnNumber: 17
                                        }, this),
                                        update.body && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-2 text-[12px] text-white/70",
                                            children: update.body
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 325,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 flex flex-wrap gap-2 text-[11px]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "rounded-full border border-white/20 bg-white/10 px-2 py-1",
                                                    children: STATUS_LABELS[update.status] || update.status
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 327,
                                                    columnNumber: 19
                                                }, this),
                                                update.status !== "PUBLISHED" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>publishQuick(update),
                                                    className: "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-emerald-100",
                                                    children: "Publicar"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 331,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>togglePin(update),
                                                    className: "rounded-full border border-white/20 bg-white/10 px-2 py-1",
                                                    children: update.isPinned ? "Desafixar" : "Fixar"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 339,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>handleEdit(update),
                                                    className: "rounded-full border border-white/20 bg-white/10 px-2 py-1",
                                                    children: "Editar"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 346,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>archiveUpdate(update),
                                                    className: "rounded-full border border-white/20 bg-white/10 px-2 py-1",
                                                    children: "Arquivar"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                                    lineNumber: 353,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                            lineNumber: 326,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, update.id, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                                    lineNumber: 308,
                                    columnNumber: 15
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                            lineNumber: 306,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
                    lineNumber: 288,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
            lineNumber: 170,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/organizador/(dashboard)/updates/page.tsx",
        lineNumber: 168,
        columnNumber: 5
    }, this);
}
_s(UpdatesPage, "5GW23WlZAkdl2TwjpZboh+X1FWs=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = UpdatesPage;
var _c;
__turbopack_context__.k.register(_c, "UpdatesPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PadelHubClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ConfirmDestructiveActionDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/ConfirmDestructiveActionDialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/analytics.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$config$2f$cities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/config/cities.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
const PADEL_TABS = [
    "calendar",
    "clubs",
    "players",
    "rankings"
];
const DEFAULT_FORM = {
    id: null,
    name: "",
    city: "",
    address: "",
    courtsCount: "1",
    isActive: true,
    slug: "",
    isDefault: false
};
const DEFAULT_COURT_FORM = {
    id: null,
    name: "",
    description: "",
    indoor: false,
    isActive: true,
    displayOrder: 0
};
const DEFAULT_STAFF_FORM = {
    id: null,
    email: "",
    staffMemberId: "",
    role: "STAFF",
    inheritToEvents: true
};
const badge = (tone = "slate")=>`rounded-full border px-2 py-[4px] text-[11px] ${tone === "green" ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100" : tone === "amber" ? "border-amber-300/40 bg-amber-400/10 text-amber-100" : "border-white/15 bg-white/10 text-white/70"}`;
const toast = (msg, tone = "ok")=>{
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const el = document.createElement("div");
    el.textContent = msg;
    el.className = `fixed right-4 top-4 z-[9999] rounded-full px-4 py-2 text-sm font-semibold shadow-lg transition ${tone === "ok" ? "bg-emerald-500 text-black" : tone === "warn" ? "bg-amber-400 text-black" : "bg-red-500 text-white"}`;
    document.body.appendChild(el);
    setTimeout(()=>{
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(()=>el.remove(), 180);
    }, 1800);
};
const fetcher = (url)=>fetch(url).then((r)=>r.json());
const SkeletonBlock = ({ className = "" })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-[#0b1124]/50 to-[#050810]/70 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl ${className}`
    }, void 0, false, {
        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
        lineNumber: 133,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c = SkeletonBlock;
const PadelTabSkeleton = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                        className: "h-9 w-32"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 141,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                        className: "h-9 w-24"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 142,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                        className: "h-9 w-24"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 143,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 140,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid gap-3 lg:grid-cols-[1fr_320px]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                        className: "h-[360px]"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 146,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                                className: "h-16"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 148,
                                columnNumber: 9
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                                className: "h-14"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 149,
                                columnNumber: 9
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                                className: "h-24"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 150,
                                columnNumber: 9
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 147,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 145,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid gap-2 md:grid-cols-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                        className: "h-20"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 154,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                        className: "h-20"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 155,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SkeletonBlock, {
                        className: "h-20"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 156,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 153,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
        lineNumber: 139,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c1 = PadelTabSkeleton;
const formatDateTimeLocal = (value)=>{
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
};
const formatZoned = (value, timeZone)=>{
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    try {
        return new Intl.DateTimeFormat("pt-PT", {
            timeZone,
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }).format(d);
    } catch  {
        return d.toLocaleString("pt-PT");
    }
};
const TimelineView = ({ blocks, availabilities, matches, timezone, dayStart, onDrop, laneHints = [], conflictMap, slotMinutes })=>{
    if (!dayStart) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "text-[12px] text-white/60",
            children: "Seleciona uma data válida."
        }, void 0, false, {
            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
            lineNumber: 220,
            columnNumber: 12
        }, ("TURBOPACK compile-time value", void 0));
    }
    const laneWidth = 100; // percent
    const dayLength = 24 * 60 * 60 * 1000;
    const startDay = new Date(dayStart);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(startDay.getTime() + dayLength);
    const toDate = (value)=>{
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    };
    const items = [];
    const lanesSeed = laneHints.reduce((acc, hint)=>{
        acc[hint.key] = {
            ...hint,
            items: []
        };
        return acc;
    }, {});
    for (const b of blocks){
        const s = toDate(b.startAt);
        const e = toDate(b.endAt);
        if (!s || !e) continue;
        const laneKey = b.courtId ? `court-${b.courtId}` : "block-generic";
        const laneLabel = b.courtName || (b.courtId ? `Court ${b.courtId}` : "Court");
        items.push({
            id: `block-${b.id}`,
            kind: "block",
            label: b.label || "Bloqueio",
            start: s,
            end: e,
            laneKey,
            laneLabel,
            courtId: b.courtId ?? null,
            version: b.updatedAt,
            color: "from-[#7b7bff]/25 to-[#7cf2ff]/30 border-white/20"
        });
    }
    for (const av of availabilities){
        const s = toDate(av.startAt);
        const e = toDate(av.endAt);
        if (!s || !e) continue;
        const laneKey = "player-availability";
        const laneLabel = "Jogadores";
        items.push({
            id: `av-${av.id}`,
            kind: "availability",
            label: av.playerName || av.playerEmail || "Jogador",
            start: s,
            end: e,
            laneKey,
            laneLabel,
            version: av.updatedAt,
            color: "from-[#f59e0b]/25 to-[#fde68a]/20 border-amber-200/40"
        });
    }
    for (const m of matches){
        const s = toDate(m.startTime || m.plannedStartAt);
        if (!s) continue;
        const plannedEnd = toDate(m.plannedEndAt);
        const durationMinutes = Number.isFinite(m.plannedDurationMinutes) ? m.plannedDurationMinutes : 60;
        const e = plannedEnd || new Date(s.getTime() + (durationMinutes || 60) * 60 * 1000); // assume 1h se não houver fim
        const laneKey = m.courtId ? `court-${m.courtId}` : m.courtName ? `court-name-${m.courtName}` : m.courtNumber ? `court-num-${m.courtNumber}` : "match-generic";
        const laneLabel = m.courtName || (m.courtNumber ? `Court ${m.courtNumber}` : m.courtId ? `Court ${m.courtId}` : "Court");
        items.push({
            id: `match-${m.id}`,
            kind: "match",
            label: `Jogo #${m.id}`,
            start: s,
            end: e,
            laneKey,
            laneLabel,
            courtId: m.courtId ?? null,
            version: m.updatedAt,
            color: "from-[#34d399]/25 to-[#059669]/25 border-emerald-200/40"
        });
    }
    const grouped = items.reduce((acc, item)=>{
        const existing = acc[item.laneKey] || lanesSeed[item.laneKey];
        if (!existing) {
            acc[item.laneKey] = {
                key: item.laneKey,
                label: item.laneLabel,
                courtId: item.courtId,
                items: [
                    item
                ]
            };
        } else {
            acc[item.laneKey] = {
                ...existing,
                items: [
                    ...existing.items || [],
                    item
                ]
            };
        }
        return acc;
    }, lanesSeed);
    const lanes = Object.values(grouped).map((lane)=>({
            court: lane.label,
            courtId: lane.courtId,
            key: lane.key,
            items: (lane.items || []).sort((a, b)=>a.start.getTime() - b.start.getTime())
        }));
    const clampPercent = (value)=>Math.min(100, Math.max(0, value));
    const snapToSlot = (date)=>{
        const minutes = date.getMinutes();
        const snapped = Math.round(minutes / slotMinutes) * slotMinutes;
        date.setMinutes(snapped, 0, 0);
        return date;
    };
    const formatTime = (d)=>new Intl.DateTimeFormat("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: timezone
        }).format(d);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            lanes.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[12px] text-white/60",
                children: "Sem registos para hoje."
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 331,
                columnNumber: 30
            }, ("TURBOPACK compile-time value", void 0)),
            lanes.map((lane)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1 rounded-xl border border-white/10 bg-white/5 p-3",
                    onDragOver: (e)=>e.preventDefault(),
                    onDrop: (e)=>{
                        if (!onDrop) return;
                        e.preventDefault();
                        const payload = e.dataTransfer.getData("application/json");
                        try {
                            const parsed = JSON.parse(payload);
                            const duration = parsed.durationMs ?? 0;
                            const rect = e.currentTarget.querySelector(".timeline-lane")?.getBoundingClientRect();
                            if (!rect) return;
                            const relX = (e.clientX - rect.left) / rect.width;
                            const newStart = snapToSlot(new Date(startDay.getTime() + relX * (endDay.getTime() - startDay.getTime())));
                            const newEnd = new Date(newStart.getTime() + duration);
                            onDrop({
                                id: parsed.id,
                                kind: parsed.kind,
                                start: newStart,
                                end: newEnd,
                                courtId: lane.courtId
                            });
                        } catch  {
                        // ignore
                        }
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between text-[12px] text-white/70",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "font-semibold",
                                    children: lane.court
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 362,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-white/50",
                                    children: "Hoje"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 363,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 361,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "timeline-lane relative h-16 overflow-hidden rounded-lg border border-white/10 bg-black/30",
                            children: lane.items.map((item)=>{
                                const left = clampPercent((item.start.getTime() - startDay.getTime()) / (endDay.getTime() - startDay.getTime()) * laneWidth);
                                const width = clampPercent((item.end.getTime() - item.start.getTime()) / (endDay.getTime() - startDay.getTime()) * laneWidth);
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `absolute top-1 h-12 rounded-lg border px-2 py-1 text-[11px] text-white shadow ${item.color} bg-gradient-to-r ${lane.items.length > 1 && lane.items.some((other)=>other !== item && other.laneKey === item.laneKey && overlaps(item, other)) ? "ring-2 ring-red-400/70" : ""} ${conflictMap.get(item.id)?.length ? "border-red-300/70 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]" : ""}`,
                                    style: {
                                        left: `${left}%`,
                                        width: `${Math.max(width, 6)}%`
                                    },
                                    title: `${item.label} · ${formatTime(item.start)} - ${formatTime(item.end)}`,
                                    draggable: true,
                                    onDragStart: (e)=>{
                                        e.dataTransfer.setData("application/json", JSON.stringify({
                                            id: item.id,
                                            kind: item.kind,
                                            durationMs: item.end.getTime() - item.start.getTime(),
                                            version: item.version
                                        }));
                                    },
                                    onDragOver: (e)=>e.preventDefault(),
                                    onDrop: (e)=>{
                                        if (!onDrop) return;
                                        e.preventDefault();
                                        const payload = e.dataTransfer.getData("application/json");
                                        try {
                                            const parsed = JSON.parse(payload);
                                            if (parsed.id !== item.id) return;
                                            // simple drop keeps duration, aligns start to cursor
                                            const rect = e.currentTarget.parentElement.getBoundingClientRect();
                                            const relX = (e.clientX - rect.left) / rect.width;
                                            const newStart = snapToSlot(new Date(startDay.getTime() + relX * (endDay.getTime() - startDay.getTime())));
                                            const duration = item.end.getTime() - item.start.getTime();
                                            const newEnd = new Date(newStart.getTime() + duration);
                                            onDrop({
                                                id: item.id,
                                                kind: item.kind,
                                                start: newStart,
                                                end: newEnd,
                                                courtId: lane.courtId
                                            });
                                        } catch  {
                                        // ignore
                                        }
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "font-semibold leading-tight",
                                            children: item.label
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 419,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-white/70",
                                            children: [
                                                formatTime(item.start),
                                                " - ",
                                                formatTime(item.end)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 420,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, item.id, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 372,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0));
                            })
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 365,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex justify-between text-[11px] text-white/50",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "00:00"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 426,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "12:00"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 427,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "24:00"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 428,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 425,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, lane.key || lane.court, true, {
                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                    lineNumber: 333,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)))
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
        lineNumber: 330,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c2 = TimelineView;
const normalizeSlug = (value)=>{
    const base = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "clube";
    return base;
};
const buildSlugCandidates = (value, limit = 15)=>{
    const base = normalizeSlug(value || "clube");
    const list = [];
    for(let i = 0; i < limit; i += 1){
        list.push(i === 0 ? base : `${base}${i}`);
    }
    return list;
};
const fetchCourtsForClub = async (clubId)=>{
    try {
        const res = await fetch(`/api/padel/clubs/${clubId}/courts`);
        const json = await res.json().catch(()=>null);
        if (res.ok && Array.isArray(json?.items)) {
            return json.items;
        }
    } catch (err) {
        console.error("[padel/clubs] fetchCourtsForClub", err);
    }
    return [];
};
function PadelHubClient({ organizerId, organizationKind, initialClubs, initialPlayers }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const padelSectionParam = searchParams?.get("padel") || null;
    const eventIdParam = searchParams?.get("eventId") || null;
    const eventId = eventIdParam && Number.isFinite(Number(eventIdParam)) ? Number(eventIdParam) : null;
    const initialTab = PADEL_TABS.includes(padelSectionParam) ? padelSectionParam : "clubs";
    const [activeTab, setActiveTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialTab);
    const [switchingTab, setSwitchingTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [clubs, setClubs] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialClubs);
    const [players, setPlayers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialPlayers);
    const [search, setSearch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [calendarScope, setCalendarScope] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("week");
    const [calendarFilter, setCalendarFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("all");
    const [calendarError, setCalendarError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [calendarMessage, setCalendarMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [calendarWarning, setCalendarWarning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [slotMinutes, setSlotMinutes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(15);
    const [lastAction, setLastAction] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [blockForm, setBlockForm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        start: "",
        end: "",
        label: "",
        note: ""
    });
    const [editingBlockId, setEditingBlockId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [editingBlockVersion, setEditingBlockVersion] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [availabilityForm, setAvailabilityForm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        start: "",
        end: "",
        playerName: "",
        playerEmail: "",
        note: ""
    });
    const [editingAvailabilityId, setEditingAvailabilityId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [editingAvailabilityVersion, setEditingAvailabilityVersion] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [savingCalendar, setSavingCalendar] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [clubForm, setClubForm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(DEFAULT_FORM);
    const [slugError, setSlugError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [clubModalOpen, setClubModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [savingClub, setSavingClub] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [clubError, setClubError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [clubMessage, setClubMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [drawerClubId, setDrawerClubId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialClubs[0]?.id ?? null);
    const [courts, setCourts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [staff, setStaff] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loadingDrawer, setLoadingDrawer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [courtForm, setCourtForm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(DEFAULT_COURT_FORM);
    const [courtMessage, setCourtMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [courtError, setCourtError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [savingCourt, setSavingCourt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [courtDialog, setCourtDialog] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [staffForm, setStaffForm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(DEFAULT_STAFF_FORM);
    const [staffMode, setStaffMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("existing");
    const [staffSearch, setStaffSearch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [staffMessage, setStaffMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [staffError, setStaffError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [staffInviteNotice, setStaffInviteNotice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [draggingCourtId, setDraggingCourtId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [clubDialog, setClubDialog] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [deleteClubDialog, setDeleteClubDialog] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [deleteCourtDialog, setDeleteCourtDialog] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const { data: organizerStaff } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(organizerId ? `/api/organizador/organizations/members?organizerId=${organizerId}` : null, fetcher, {
        revalidateOnFocus: false
    });
    const { data: calendarData, isLoading: isCalendarLoading, mutate: mutateCalendar } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(eventId ? `/api/padel/calendar?eventId=${eventId}` : null, fetcher, {
        revalidateOnFocus: false
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PadelHubClient.useEffect": ()=>{
            if (padelSectionParam && PADEL_TABS.includes(padelSectionParam) && padelSectionParam !== activeTab) {
                setActiveTab(padelSectionParam);
                setSwitchingTab(false);
            }
        }
    }["PadelHubClient.useEffect"], [
        padelSectionParam,
        activeTab
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PadelHubClient.useEffect": ()=>{
            const timer = switchingTab ? setTimeout({
                "PadelHubClient.useEffect": ()=>setSwitchingTab(false)
            }["PadelHubClient.useEffect"], 280) : null;
            return ({
                "PadelHubClient.useEffect": ()=>{
                    if (timer) clearTimeout(timer);
                }
            })["PadelHubClient.useEffect"];
        }
    }["PadelHubClient.useEffect"], [
        switchingTab
    ]);
    const setPadelSection = (section)=>{
        setSwitchingTab(true);
        setActiveTab(section);
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set("tab", "manage");
        params.set("section", "padel-hub");
        params.set("padel", section);
        router.replace(`/organizador?${params.toString()}`, {
            scroll: false
        });
        setLastAction(null);
    };
    const hasActiveClub = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[hasActiveClub]": ()=>clubs.some({
                "PadelHubClient.useMemo[hasActiveClub]": (c)=>c.isActive
            }["PadelHubClient.useMemo[hasActiveClub]"])
    }["PadelHubClient.useMemo[hasActiveClub]"], [
        clubs
    ]);
    const sortedClubs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[sortedClubs]": ()=>{
            return [
                ...clubs
            ].sort({
                "PadelHubClient.useMemo[sortedClubs]": (a, b)=>{
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
            }["PadelHubClient.useMemo[sortedClubs]"]);
        }
    }["PadelHubClient.useMemo[sortedClubs]"], [
        clubs
    ]);
    const selectedClub = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[selectedClub]": ()=>clubs.find({
                "PadelHubClient.useMemo[selectedClub]": (c)=>c.id === drawerClubId
            }["PadelHubClient.useMemo[selectedClub]"]) || null
    }["PadelHubClient.useMemo[selectedClub]"], [
        clubs,
        drawerClubId
    ]);
    const filteredPlayers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[filteredPlayers]": ()=>{
            const term = search.trim().toLowerCase();
            if (!term) return players;
            return players.filter({
                "PadelHubClient.useMemo[filteredPlayers]": (p)=>p.fullName.toLowerCase().includes(term) || (p.email || "").toLowerCase().includes(term)
            }["PadelHubClient.useMemo[filteredPlayers]"]);
        }
    }["PadelHubClient.useMemo[filteredPlayers]"], [
        players,
        search
    ]);
    const activeCourtsCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[activeCourtsCount]": ()=>courts.filter({
                "PadelHubClient.useMemo[activeCourtsCount]": (c)=>c.isActive
            }["PadelHubClient.useMemo[activeCourtsCount]"]).length
    }["PadelHubClient.useMemo[activeCourtsCount]"], [
        courts
    ]);
    const staffOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[staffOptions]": ()=>{
            const list = organizerStaff?.items ?? [];
            const term = staffSearch.trim().toLowerCase();
            const filtered = term ? list.filter({
                "PadelHubClient.useMemo[staffOptions]": (m)=>(m.fullName || "").toLowerCase().includes(term) || (m.email || "").toLowerCase().includes(term) || (m.username || "").toLowerCase().includes(term)
            }["PadelHubClient.useMemo[staffOptions]"]) : list;
            return filtered;
        }
    }["PadelHubClient.useMemo[staffOptions]"], [
        organizerStaff?.items,
        staffSearch
    ]);
    const inheritedStaffCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[inheritedStaffCount]": ()=>staff.filter({
                "PadelHubClient.useMemo[inheritedStaffCount]": (s)=>s.inheritToEvents
            }["PadelHubClient.useMemo[inheritedStaffCount]"]).length
    }["PadelHubClient.useMemo[inheritedStaffCount]"], [
        staff
    ]);
    // Mantém a ordem recebida e renumera sequencialmente
    const renumberCourts = (list)=>list.map((c, idx)=>({
                ...c,
                displayOrder: idx + 1
            }));
    const computeActiveCount = (list)=>list.filter((c)=>c.isActive).length;
    const syncActiveCountOnClub = (clubId, list)=>{
        const activeCount = computeActiveCount(list);
        setClubs((prev)=>prev.map((c)=>c.id === clubId ? {
                    ...c,
                    courtsCount: activeCount
                } : c));
        return activeCount;
    };
    const refreshActiveCounts = async (clubList)=>{
        if (!clubList.length) return;
        try {
            const updates = await Promise.all(clubList.map(async (club)=>{
                const courts = await fetchCourtsForClub(club.id);
                return {
                    id: club.id,
                    count: computeActiveCount(courts)
                };
            }));
            setClubs((prev)=>prev.map((club)=>{
                    const found = updates.find((u)=>u.id === club.id);
                    return found ? {
                        ...club,
                        courtsCount: found.count
                    } : club;
                }));
        } catch (err) {
            console.error("[padel/clubs] refreshActiveCounts", err);
        }
    };
    const createDefaultCourts = async (clubId, desired, startIndex = 1)=>{
        const created = [];
        for(let i = 0; i < desired; i += 1){
            const idx = startIndex + i;
            try {
                const res = await fetch(`/api/padel/clubs/${clubId}/courts`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: `Court ${idx}`,
                        description: "",
                        indoor: false,
                        isActive: true,
                        displayOrder: idx,
                        surface: null
                    })
                });
                const json = await res.json().catch(()=>null);
                if (res.ok && json?.court) {
                    created.push(json.court);
                }
            } catch (err) {
                console.error("[padel/clubs/courts] auto-create", err);
            }
        }
        return renumberCourts(created);
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PadelHubClient.useEffect": ()=>{
            if (!drawerClubId) {
                setCourts([]);
                setStaff([]);
                return;
            }
            loadCourtsAndStaff(drawerClubId);
        }
    }["PadelHubClient.useEffect"], [
        drawerClubId
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PadelHubClient.useEffect": ()=>{
            setClubs(initialClubs);
        }
    }["PadelHubClient.useEffect"], [
        initialClubs
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PadelHubClient.useEffect": ()=>{
            setPlayers(initialPlayers);
        }
    }["PadelHubClient.useEffect"], [
        initialPlayers
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PadelHubClient.useEffect": ()=>{
            if (drawerClubId) return;
            if (clubs.length === 0) return;
            const preferred = clubs.find({
                "PadelHubClient.useEffect": (c)=>c.isActive
            }["PadelHubClient.useEffect"]) ?? clubs[0];
            setDrawerClubId(preferred.id);
        }
    }["PadelHubClient.useEffect"], [
        clubs,
        drawerClubId
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PadelHubClient.useEffect": ()=>{
            if (initialClubs.length) {
                refreshActiveCounts(initialClubs);
            }
        }
    }["PadelHubClient.useEffect"], []);
    const persistCourtOrder = async (list)=>{
        if (!selectedClub) return;
        const payload = renumberCourts(list);
        const updates = payload.map((c)=>fetch(`/api/padel/clubs/${selectedClub.id}/courts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...c,
                    name: c.name,
                    description: c.description || "",
                    surface: null
                })
            }).catch((err)=>{
                console.error("[padel/clubs/reorder] failed", err);
                return null;
            }));
        await Promise.all(updates);
    };
    const reorderCourts = (targetId)=>{
        if (!draggingCourtId || draggingCourtId === targetId) return null;
        const current = [
            ...courts
        ];
        const from = current.findIndex((ct)=>ct.id === draggingCourtId);
        const to = current.findIndex((ct)=>ct.id === targetId);
        if (from === -1 || to === -1) return null;
        const [moved] = current.splice(from, 1);
        current.splice(to, 0, moved);
        const renumbered = renumberCourts(current);
        setCourts(renumbered);
        return renumbered;
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PadelHubClient.useEffect": ()=>{
            if (courtForm.id) return;
            const nextOrder = Math.max(1, activeCourtsCount + 1);
            if (courtForm.displayOrder !== nextOrder) {
                setCourtForm({
                    "PadelHubClient.useEffect": (prev)=>({
                            ...prev,
                            displayOrder: nextOrder
                        })
                }["PadelHubClient.useEffect"]);
            }
        }
    }["PadelHubClient.useEffect"], [
        activeCourtsCount,
        courtForm.id
    ]);
    const openNewClubModal = ()=>{
        setClubForm(DEFAULT_FORM);
        setClubError(null);
        setClubMessage(null);
        setSlugError(null);
        setClubModalOpen(true);
    };
    const openEditClubModal = (club)=>{
        setClubForm({
            id: club.id,
            name: club.name,
            city: club.city || "",
            address: club.address || "",
            courtsCount: club.courtsCount ? String(club.courtsCount) : "1",
            isActive: club.isActive,
            slug: club.slug || "",
            isDefault: Boolean(club.isDefault)
        });
        setClubError(null);
        setClubMessage(null);
        setSlugError(null);
        setClubModalOpen(true);
    };
    const loadCourtsAndStaff = async (clubId)=>{
        setLoadingDrawer(true);
        setCourtMessage(null);
        setCourtError(null);
        setStaffMessage(null);
        setStaffError(null);
        try {
            const [courtsRes, staffRes] = await Promise.all([
                fetch(`/api/padel/clubs/${clubId}/courts`),
                fetch(`/api/padel/clubs/${clubId}/staff`)
            ]);
            const courtsJson = await courtsRes.json().catch(()=>null);
            const staffJson = await staffRes.json().catch(()=>null);
            if (courtsRes.ok && Array.isArray(courtsJson?.items)) {
                const list = renumberCourts(courtsJson.items);
                setCourts(list);
                syncActiveCountOnClub(clubId, list);
            } else setCourtError(courtsJson?.error || "Erro ao carregar courts.");
            if (staffRes.ok && Array.isArray(staffJson?.items)) setStaff(staffJson.items);
            else setStaffError(staffJson?.error || "Erro ao carregar equipa.");
        } catch (err) {
            console.error("[padel/clubs] load courts/staff", err);
            setCourtError("Erro ao carregar courts.");
            setStaffError("Erro ao carregar equipa.");
        } finally{
            setLoadingDrawer(false);
        }
    };
    const handleSubmitClub = async ()=>{
        setClubError(null);
        setSlugError(null);
        setClubMessage(null);
        if (!clubForm.name.trim()) {
            setClubError("Nome do clube é obrigatório.");
            return;
        }
        if (!clubForm.address.trim()) {
            setClubError("Morada é obrigatória.");
            return;
        }
        const courtsNum = Number(clubForm.courtsCount);
        const courtsCount = Number.isFinite(courtsNum) ? Math.min(1000, Math.max(1, Math.floor(courtsNum))) : 1;
        setSavingClub(true);
        const slugCandidates = buildSlugCandidates(clubForm.slug || clubForm.name, 15);
        let savedClub = null;
        let lastError = null;
        try {
            for (const candidate of slugCandidates){
                const res = await fetch("/api/padel/clubs", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        id: clubForm.id,
                        organizerId,
                        name: clubForm.name.trim(),
                        city: clubForm.city.trim(),
                        address: clubForm.address.trim(),
                        courtsCount,
                        isActive: clubForm.isActive,
                        slug: candidate,
                        isDefault: clubForm.isDefault
                    })
                });
                const json = await res.json().catch(()=>null);
                if (res.ok && json?.club) {
                    savedClub = json.club;
                    break;
                }
                const errMsg = json?.error || "Erro ao guardar clube.";
                lastError = errMsg;
                const lower = errMsg.toLowerCase();
                if (lower.includes("slug") || lower.includes("já existe") || lower.includes("duplic")) {
                    continue;
                } else {
                    break;
                }
            }
            if (!savedClub) {
                setSlugError(lastError || "Slug em uso. Tentámos alternativas automáticas.");
                setClubError(lastError || "Erro ao guardar clube.");
                return;
            }
            const club = savedClub;
            setClubs((prev)=>{
                const existing = prev.some((c)=>c.id === club.id);
                if (existing) return prev.map((c)=>c.id === club.id ? club : c);
                return [
                    club,
                    ...prev
                ];
            });
            setClubMessage(clubForm.id ? "Clube atualizado." : "Clube criado.");
            setClubModalOpen(false);
            setClubForm({
                ...DEFAULT_FORM,
                courtsCount: String(courtsCount)
            });
            setDrawerClubId(club.id);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trackEvent"])(clubForm.id ? "padel_club_updated" : "padel_club_created", {
                clubId: club.id
            });
            const existingList = await fetchCourtsForClub(club.id);
            const existingCount = existingList.length;
            if (courtsCount > existingCount) {
                const missing = courtsCount - existingCount;
                const createdCourts = await createDefaultCourts(club.id, missing, existingCount + 1);
                const merged = renumberCourts([
                    ...existingList,
                    ...createdCourts
                ]);
                if (club.id === selectedClub?.id) setCourts(merged);
                setCourtMessage(`Criados ${createdCourts.length} courts por omissão.`);
                const activeCount = syncActiveCountOnClub(club.id, merged);
                if (club.id !== selectedClub?.id) {
                    setClubs((prev)=>prev.map((c)=>c.id === club.id ? {
                                ...c,
                                courtsCount: activeCount
                            } : c));
                }
            } else {
                const normalized = renumberCourts(existingList);
                const activeCount = syncActiveCountOnClub(club.id, normalized);
                if (club.id === selectedClub?.id && existingCount > 0) setCourts(normalized);
                if (club.id !== selectedClub?.id) {
                    setClubs((prev)=>prev.map((c)=>c.id === club.id ? {
                                ...c,
                                courtsCount: activeCount
                            } : c));
                }
            }
        } catch (err) {
            console.error("[padel/clubs] save", err);
            setClubError("Erro inesperado ao guardar clube.");
        } finally{
            setSavingClub(false);
        }
    };
    const markDefaultClub = async (club)=>{
        setClubError(null);
        setClubMessage(null);
        try {
            const res = await fetch("/api/padel/clubs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: club.id,
                    organizerId,
                    name: club.name,
                    city: club.city,
                    address: club.address,
                    courtsCount: club.courtsCount,
                    isActive: club.isActive,
                    slug: club.slug,
                    isDefault: true
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setClubError(json?.error || "Erro ao definir default.");
            } else {
                const saved = json.club;
                setClubs((prev)=>prev.map((c)=>({
                            ...c,
                            isDefault: c.id === saved.id
                        })));
                setClubMessage("Clube definido como predefinido.");
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trackEvent"])("padel_club_marked_default", {
                    clubId: saved.id
                });
            }
        } catch (err) {
            console.error("[padel/clubs] default", err);
            setClubError("Erro inesperado ao definir default.");
        }
    };
    const resetCourtForm = ()=>{
        setCourtForm(DEFAULT_COURT_FORM);
        setCourtMessage(null);
        setCourtError(null);
    };
    const handleEditCourt = (court)=>{
        setCourtForm({
            id: court.id,
            name: court.name,
            description: court.description || "",
            indoor: court.indoor,
            isActive: court.isActive,
            displayOrder: court.displayOrder
        });
    };
    const handleSubmitCourt = async ()=>{
        if (!selectedClub) return;
        const fallbackName = courtForm.name.trim() || `Court ${courts.length + 1}`;
        const desiredOrder = Number.isFinite(courtForm.displayOrder) ? Math.max(1, Math.floor(courtForm.displayOrder)) : 1;
        const maxOrder = Math.max(1, activeCourtsCount + (courtForm.id ? 0 : courtForm.isActive ? 1 : 0));
        const normalizedOrder = Math.min(maxOrder, desiredOrder);
        setSavingCourt(true);
        setCourtError(null);
        setCourtMessage(null);
        try {
            const res = await fetch(`/api/padel/clubs/${selectedClub.id}/courts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...courtForm,
                    name: fallbackName,
                    description: courtForm.description.trim(),
                    surface: null,
                    displayOrder: normalizedOrder
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setCourtError(json?.error || "Erro ao guardar court.");
            } else {
                const court = json.court;
                setCourts((prev)=>{
                    const exists = prev.some((c)=>c.id === court.id);
                    const updated = exists ? prev.map((c)=>c.id === court.id ? court : c) : [
                        ...prev,
                        court
                    ];
                    const normalized = renumberCourts(updated);
                    syncActiveCountOnClub(selectedClub.id, normalized);
                    return normalized;
                });
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trackEvent"])(courtForm.id ? "padel_court_updated" : "padel_court_created", {
                    clubId: selectedClub.id,
                    indoor: court.indoor
                });
                setCourtMessage(courtForm.id ? "Court atualizado." : "Court criado.");
                resetCourtForm();
            }
        } catch (err) {
            console.error("[padel/clubs/courts] save", err);
            setCourtError("Erro inesperado ao guardar court.");
        } finally{
            setSavingCourt(false);
        }
    };
    const handleConfirmCourtToggle = async ()=>{
        if (!courtDialog || !selectedClub) return;
        await handleToggleCourtActive(courtDialog.court, courtDialog.nextActive);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trackEvent"])(courtDialog.nextActive ? "padel_court_reactivated" : "padel_court_deactivated", {
            clubId: selectedClub.id,
            courtId: courtDialog.court.id
        });
        setCourtDialog(null);
    };
    const handleToggleClubActive = async (club, next)=>{
        setClubError(null);
        setClubMessage(null);
        setClubDialog(null);
        try {
            const res = await fetch("/api/padel/clubs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: club.id,
                    organizerId,
                    name: club.name,
                    city: club.city,
                    address: club.address,
                    courtsCount: club.courtsCount,
                    isActive: next,
                    slug: club.slug,
                    isDefault: club.isDefault
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setClubError(json?.error || "Erro ao atualizar estado do clube.");
            } else {
                const saved = json.club;
                setClubs((prev)=>prev.map((c)=>c.id === saved.id ? saved : c));
                setClubMessage(saved.isActive ? "Clube reativado." : "Clube arquivado.");
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$analytics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trackEvent"])(saved.isActive ? "padel_club_reactivated" : "padel_club_archived", {
                    clubId: saved.id
                });
            }
        } catch (err) {
            console.error("[padel/clubs] toggle active", err);
            setClubError("Erro inesperado ao atualizar clube.");
        } finally{
            setClubDialog(null);
        }
    };
    const handleDeleteClub = async (club)=>{
        setClubError(null);
        setClubMessage(null);
        try {
            const res = await fetch(`/api/padel/clubs?id=${club.id}`, {
                method: "DELETE"
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setClubError(json?.error || "Erro ao apagar clube.");
            } else {
                setClubs((prev)=>prev.filter((c)=>c.id !== club.id));
                if (drawerClubId === club.id) {
                    setDrawerClubId(null);
                    setCourts([]);
                    setStaff([]);
                }
                setClubMessage("Clube apagado.");
            }
        } catch (err) {
            console.error("[padel/clubs] delete", err);
            setClubError("Erro inesperado ao apagar clube.");
        } finally{
            setDeleteClubDialog(null);
        }
    };
    const handleToggleCourtActive = async (court, next)=>{
        if (!selectedClub) return;
        setSavingCourt(true);
        try {
            const res = await fetch(`/api/padel/clubs/${selectedClub.id}/courts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...court,
                    isActive: next
                })
            });
            const json = await res.json().catch(()=>null);
            if (res.ok && json?.court) {
                const updated = json.court;
                setCourts((prev)=>{
                    const nextList = renumberCourts(prev.map((c)=>c.id === updated.id ? updated : c));
                    syncActiveCountOnClub(selectedClub.id, nextList);
                    return nextList;
                });
            }
        } catch (err) {
            console.error("[padel/clubs/courts] toggle", err);
        } finally{
            setSavingCourt(false);
        }
    };
    const handleDeleteCourt = async (court)=>{
        if (!selectedClub) return;
        setSavingCourt(true);
        try {
            const res = await fetch(`/api/padel/clubs/${selectedClub.id}/courts?courtId=${court.id}`, {
                method: "DELETE"
            });
            const json = await res.json().catch(()=>null);
            if (res.ok && json?.ok !== false) {
                setCourts((prev)=>{
                    const nextList = renumberCourts(prev.filter((c)=>c.id !== court.id));
                    syncActiveCountOnClub(selectedClub.id, nextList);
                    return nextList;
                });
            } else {
                setCourtError(json?.error || "Erro ao apagar court.");
            }
        } catch (err) {
            console.error("[padel/clubs/courts] delete", err);
            setCourtError("Erro inesperado ao apagar court.");
        } finally{
            setSavingCourt(false);
            setDeleteCourtDialog(null);
        }
    };
    const resetStaffForm = ()=>{
        setStaffForm(DEFAULT_STAFF_FORM);
        setStaffMode("existing");
        setStaffSearch("");
        setStaffError(null);
        setStaffMessage(null);
        setStaffInviteNotice(null);
    };
    const handleEditStaff = (member)=>{
        setStaffForm({
            id: member.id,
            email: member.email || "",
            staffMemberId: member.userId || "",
            role: member.role,
            inheritToEvents: member.inheritToEvents
        });
        setStaffMode(member.userId ? "existing" : "external");
    };
    const handleSubmitStaff = async ()=>{
        if (!selectedClub) return;
        const selectedMember = staffMode === "existing" ? staffOptions.find((m)=>m.userId === staffForm.staffMemberId) : null;
        const emailToSend = staffMode === "existing" ? selectedMember?.email ?? "" : staffForm.email.trim();
        if (staffMode === "existing" && !selectedMember) {
            setStaffError("Escolhe um membro do staff global.");
            return;
        }
        if (staffMode === "external" && !emailToSend) {
            setStaffError("Indica o email do contacto externo.");
            return;
        }
        const duplicate = staffMode === "existing" ? staff.some((s)=>s.userId && s.userId === selectedMember?.userId && s.id !== staffForm.id) : staff.some((s)=>s.email && s.email.toLowerCase() === emailToSend.toLowerCase() && s.id !== staffForm.id);
        if (duplicate) {
            setStaffError("Já tens este contacto associado ao clube.");
            return;
        }
        setStaffError(null);
        setStaffMessage(null);
        setStaffInviteNotice(null);
        try {
            const res = await fetch(`/api/padel/clubs/${selectedClub.id}/staff`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: staffForm.id,
                    email: emailToSend,
                    userId: staffMode === "existing" ? selectedMember?.userId : null,
                    role: staffForm.role,
                    padelRole: staffForm.role,
                    inheritToEvents: staffForm.inheritToEvents
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setStaffError(json?.error || "Erro ao guardar membro.");
            } else {
                const member = json.staff;
                setStaff((prev)=>{
                    const exists = prev.some((s)=>s.id === member.id);
                    if (exists) return prev.map((s)=>s.id === member.id ? member : s);
                    return [
                        member,
                        ...prev
                    ];
                });
                setStaffMessage(staffForm.id ? "Membro atualizado." : "Membro adicionado.");
                if (staffMode === "external" && emailToSend && organizerId) {
                    // Tentar enviar convite de organização (viewer) para criar conta
                    const inviteRes = await fetch("/api/organizador/organizations/members/invites", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            organizerId,
                            identifier: emailToSend,
                            role: "VIEWER"
                        })
                    }).catch(()=>null);
                    if (inviteRes && inviteRes.ok) {
                        setStaffInviteNotice("Convite enviado para criar conta. Ao registar-se, fica ligado como staff do clube.");
                    }
                }
                resetStaffForm();
            }
        } catch (err) {
            console.error("[padel/clubs/staff] save", err);
            setStaffError("Erro inesperado ao guardar membro.");
        }
    };
    const compactAddress = (club)=>{
        const bits = [
            club.city,
            club.address
        ].filter(Boolean);
        return bits.join(" · ") || "Morada por definir";
    };
    const activeCourtsForClub = (club)=>{
        if (!club) return 0;
        if (club.id === selectedClub?.id && courts.length > 0) return computeActiveCount(courts);
        return club.courtsCount || 0;
    };
    const totalActiveCourts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[totalActiveCourts]": ()=>clubs.reduce({
                "PadelHubClient.useMemo[totalActiveCourts]": (acc, c)=>acc + (c.courtsCount || 0)
            }["PadelHubClient.useMemo[totalActiveCourts]"], 0)
    }["PadelHubClient.useMemo[totalActiveCourts]"], [
        clubs
    ]);
    const calendarBlocksRaw = calendarData?.blocks ?? [];
    const calendarAvailabilitiesRaw = calendarData?.availabilities ?? [];
    const calendarMatchesRaw = calendarData?.matches ?? [];
    const calendarConflicts = calendarData?.conflicts ?? [];
    const calendarTimezone = calendarData?.eventTimezone ?? "Europe/Lisbon";
    const calendarBuffer = calendarData?.bufferMinutes ?? 5;
    const calendarDayLengthMinutes = 24 * 60;
    const [selectedDay, setSelectedDay] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "PadelHubClient.useState": ()=>{
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.toISOString().slice(0, 10);
        }
    }["PadelHubClient.useState"]);
    const startOfDay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[startOfDay]": ()=>{
            const d = new Date(selectedDay);
            if (Number.isNaN(d.getTime())) return null;
            d.setHours(0, 0, 0, 0);
            return d;
        }
    }["PadelHubClient.useMemo[startOfDay]"], [
        selectedDay
    ]);
    const endOfDay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[endOfDay]": ()=>{
            if (!startOfDay) return null;
            const d = new Date(startOfDay);
            d.setHours(23, 59, 59, 999);
            return d;
        }
    }["PadelHubClient.useMemo[endOfDay]"], [
        startOfDay
    ]);
    const isWithinDay = (date)=>{
        if (!startOfDay || !endOfDay) return true;
        const d = new Date(date);
        return d >= startOfDay && d <= endOfDay;
    };
    const calendarBlocks = calendarScope === "day" ? calendarBlocksRaw.filter((b)=>isWithinDay(b.startAt)) : calendarBlocksRaw;
    const calendarAvailabilities = calendarScope === "day" ? calendarAvailabilitiesRaw.filter((b)=>isWithinDay(b.startAt)) : calendarAvailabilitiesRaw;
    const matchStartsWithinDay = (m)=>isWithinDay(m.startTime || m.plannedStartAt);
    const calendarMatches = calendarScope === "day" ? calendarMatchesRaw.filter((m)=>matchStartsWithinDay(m)) : calendarMatchesRaw;
    const matchesById = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PadelHubClient.useMemo[matchesById]": ()=>{
            const map = new Map();
            calendarMatchesRaw.forEach({
                "PadelHubClient.useMemo[matchesById]": (m)=>map.set(m.id, m)
            }["PadelHubClient.useMemo[matchesById]"]);
            return map;
        }
    }["PadelHubClient.useMemo[matchesById]"], [
        calendarMatchesRaw
    ]);
    const getItemVersion = (kind, id)=>{
        if (kind === "block") return calendarBlocks.find((b)=>b.id === id)?.updatedAt;
        if (kind === "availability") return calendarAvailabilities.find((a)=>a.id === id)?.updatedAt;
        return calendarMatchesRaw.find((m)=>m.id === id)?.updatedAt;
    };
    const resetCalendarForms = ()=>{
        setBlockForm({
            start: "",
            end: "",
            label: "",
            note: ""
        });
        setAvailabilityForm({
            start: "",
            end: "",
            playerName: "",
            playerEmail: "",
            note: ""
        });
        setEditingBlockId(null);
        setEditingAvailabilityId(null);
        setEditingBlockVersion(null);
        setEditingAvailabilityVersion(null);
        setCalendarMessage(null);
    };
    const saveCalendarItem = async (type)=>{
        if (!eventId) {
            setCalendarError("Abre a partir de um torneio para editar o calendário.");
            return;
        }
        const isBlock = type === "block";
        const editingId = isBlock ? editingBlockId : editingAvailabilityId;
        const start = isBlock ? blockForm.start : availabilityForm.start;
        const end = isBlock ? blockForm.end : availabilityForm.end;
        if (!start || !end) {
            setCalendarError("Indica início e fim.");
            return;
        }
        setSavingCalendar(true);
        setCalendarError(null);
        setCalendarMessage(null);
        setCalendarWarning(null);
        try {
            const payload = type === "block" ? {
                type: "block",
                id: editingId ?? undefined,
                eventId,
                startAt: blockForm.start,
                endAt: blockForm.end,
                label: blockForm.label || undefined,
                note: blockForm.note || undefined,
                ...editingBlockVersion ? {
                    version: editingBlockVersion
                } : {}
            } : {
                type: "availability",
                id: editingId ?? undefined,
                eventId,
                startAt: availabilityForm.start,
                endAt: availabilityForm.end,
                playerName: availabilityForm.playerName || undefined,
                playerEmail: availabilityForm.playerEmail || undefined,
                note: availabilityForm.note || undefined,
                ...editingAvailabilityVersion ? {
                    version: editingAvailabilityVersion
                } : {}
            };
            const res = await fetch("/api/padel/calendar", {
                method: editingId ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setCalendarError(json?.error || "Não foi possível guardar.");
            } else {
                const prev = type === "block" ? calendarBlocks.find((b)=>b.id === editingId) : calendarAvailabilities.find((a)=>a.id === editingId);
                if (prev && editingId) {
                    setLastAction({
                        type,
                        id: editingId,
                        prevStart: prev.startAt,
                        prevEnd: prev.endAt,
                        prevCourtId: prev.courtId ?? null,
                        version: prev.updatedAt ?? null
                    });
                } else {
                    setLastAction(null);
                }
                setCalendarMessage(editingId ? "Atualizado." : "Guardado.");
                toast(editingId ? "Atualizado" : "Guardado", "ok");
                resetCalendarForms();
                mutateCalendar();
            }
        } catch (err) {
            console.error("[padel/calendar] save", err);
            setCalendarError("Erro inesperado ao guardar.");
        } finally{
            setSavingCalendar(false);
        }
    };
    const handleEditBlock = (block)=>{
        setEditingAvailabilityId(null);
        setEditingBlockId(block.id);
        setEditingBlockVersion(block.updatedAt || null);
        setBlockForm({
            start: formatDateTimeLocal(block.startAt),
            end: formatDateTimeLocal(block.endAt),
            label: block.label || "",
            note: block.note || ""
        });
    };
    const handleEditAvailability = (av)=>{
        setEditingBlockId(null);
        setEditingAvailabilityId(av.id);
        setEditingAvailabilityVersion(av.updatedAt || null);
        setAvailabilityForm({
            start: formatDateTimeLocal(av.startAt),
            end: formatDateTimeLocal(av.endAt),
            playerName: av.playerName || "",
            playerEmail: av.playerEmail || "",
            note: av.note || ""
        });
    };
    const handleDeleteCalendarItem = async (type, id)=>{
        if (!eventId || !Number.isFinite(id)) return;
        const sure = window.confirm("Remover este registo?");
        if (!sure) return;
        setSavingCalendar(true);
        setCalendarError(null);
        setCalendarMessage(null);
        setCalendarWarning(null);
        try {
            const res = await fetch(`/api/padel/calendar?type=${type}&id=${id}`, {
                method: "DELETE"
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setCalendarError(json?.error || "Não foi possível remover.");
            } else {
                setCalendarMessage("Removido.");
                resetCalendarForms();
                mutateCalendar();
                setLastAction(null);
            }
        } catch (err) {
            console.error("[padel/calendar] delete", err);
            setCalendarError("Erro inesperado ao remover.");
        } finally{
            setSavingCalendar(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-5 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 px-4 py-6 shadow-[0_30px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl md:px-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/12 bg-gradient-to-r from-white/10 via-[#0f1c3d]/70 to-[#0b1021]/85 px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.55)]",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
                            children: "Padel Hub"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 1414,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-3xl font-semibold text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]",
                            children: "Operação de Padel"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 1417,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-white/70",
                            children: "Calendário, clubes, courts, staff e jogadores num só hub."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 1418,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                    lineNumber: 1413,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 1412,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 gap-3 rounded-2xl border border-white/12 bg-gradient-to-r from-white/8 via-[#0c1328]/70 to-[#050912]/90 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)] sm:grid-cols-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                children: "Calendário"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1424,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-2xl font-semibold",
                                children: "Slots & conflitos"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1425,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[12px] text-white/60",
                                children: "Bloqueios, jogos e indisponibilidades."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1426,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 1423,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                children: "Clubes"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1429,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-2xl font-semibold",
                                children: clubs.length
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1430,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[12px] text-white/60",
                                children: hasActiveClub ? "Ativos e prontos a usar." : "Ativa pelo menos um."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1431,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 1428,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                children: "Courts ativos"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1434,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-2xl font-semibold",
                                children: Number.isFinite(totalActiveCourts) ? totalActiveCourts : "—"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1435,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[12px] text-white/60",
                                children: "Usados como sugestão no wizard."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1436,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 1433,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                children: "Jogadores"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1439,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-2xl font-semibold",
                                children: players.length
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1440,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[12px] text-white/60",
                                children: "Roster auto-alimentado pelos registos de jogadores."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1441,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 1438,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 1422,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap gap-2 border-b border-white/15 pb-3",
                children: [
                    {
                        key: "calendar",
                        label: "Calendário"
                    },
                    {
                        key: "clubs",
                        label: "Clubes"
                    },
                    {
                        key: "players",
                        label: "Jogadores"
                    },
                    {
                        key: "rankings",
                        label: "Rankings (em breve)"
                    }
                ].map((tab)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: `rounded-full border px-3 py-1 text-[12px] ${activeTab === tab.key ? "border-white/80 bg-white text-black" : "border-white/10 bg-white/5 text-white/75 hover:border-white/25"}`,
                        onClick: ()=>setPadelSection(tab.key),
                        children: tab.label
                    }, tab.key, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 1452,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 1445,
                columnNumber: 7
            }, this),
            switchingTab && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PadelTabSkeleton, {}, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 1464,
                columnNumber: 24
            }, this),
            !switchingTab && activeTab === "calendar" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center justify-between gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] uppercase tracking-[0.2em] text-white/60",
                                        children: "Calendário"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1470,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/70",
                                        children: "Visual por court com jogos, bloqueios e indisponibilidades (padel only)."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1471,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1469,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/75",
                                        children: [
                                            "Fuso: ",
                                            calendarTimezone
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1474,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/75",
                                        children: [
                                            "Buffer: ",
                                            calendarBuffer,
                                            " min"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1477,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]",
                                        children: [
                                            "week",
                                            "day"
                                        ].map((scope)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>setCalendarScope(scope),
                                                className: `rounded-full px-3 py-1 font-semibold transition ${calendarScope === scope ? "bg-white text-black shadow" : "text-white/75"}`,
                                                disabled: switchingTab,
                                                children: scope === "week" ? "Semana" : "Dia"
                                            }, scope, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1482,
                                                columnNumber: 19
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1480,
                                        columnNumber: 15
                                    }, this),
                                    calendarScope === "day" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "date",
                                        value: selectedDay,
                                        onChange: (e)=>setSelectedDay(e.target.value),
                                        className: "rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/80 outline-none focus:border-white/60 focus:ring-2 focus:ring-cyan-400/40"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1495,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]",
                                        children: [
                                            {
                                                key: "all",
                                                label: "Todos os clubes"
                                            },
                                            {
                                                key: "club",
                                                label: "Clube ativo"
                                            }
                                        ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>setCalendarFilter(opt.key),
                                                className: `rounded-full px-3 py-1 font-semibold transition ${calendarFilter === opt.key ? "bg-white text-black shadow" : "text-white/75"}`,
                                                disabled: switchingTab,
                                                children: opt.label
                                            }, opt.key, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1507,
                                                columnNumber: 19
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1502,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]",
                                        children: [
                                            15,
                                            30
                                        ].map((slot)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>setSlotMinutes(slot),
                                                className: `rounded-full px-3 py-1 font-semibold transition ${slotMinutes === slot ? "bg-white text-black shadow" : "text-white/75"}`,
                                                disabled: switchingTab,
                                                children: [
                                                    "Slot ",
                                                    slot,
                                                    "m"
                                                ]
                                            }, slot, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1521,
                                                columnNumber: 19
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1519,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1473,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 1468,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 lg:grid-cols-[1fr_320px]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-[420px] rounded-2xl border border-dashed border-white/15 bg-black/25 p-4 text-white/70",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm font-semibold text-white",
                                                children: "Timeline"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1539,
                                                columnNumber: 17
                                            }, this),
                                            isCalendarLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[11px] text-white/60 animate-pulse",
                                                children: "A carregar…"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1540,
                                                columnNumber: 39
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1538,
                                        columnNumber: 15
                                    }, this),
                                    !eventId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-[12px] text-white/60",
                                        children: "Abre este hub a partir de um torneio de padel para ver o calendário (precisa de eventId no URL)."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1543,
                                        columnNumber: 17
                                    }, this),
                                    eventId && !isCalendarLoading && calendarError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-[12px] text-red-200",
                                        children: calendarError
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1548,
                                        columnNumber: 17
                                    }, this),
                                    eventId && !isCalendarLoading && calendarWarning && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-[12px] text-amber-200",
                                        children: calendarWarning
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1551,
                                        columnNumber: 17
                                    }, this),
                                    eventId && !isCalendarLoading && calendarMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-[12px] text-emerald-200",
                                        children: calendarMessage
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1554,
                                        columnNumber: 17
                                    }, this),
                                    eventId && calendarScope === "day" && !isCalendarLoading && !calendarError && startOfDay && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-[12px] text-white/60",
                                        children: [
                                            "A mostrar registos de ",
                                            selectedDay,
                                            " (",
                                            formatZoned(startOfDay, calendarTimezone),
                                            ")."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1557,
                                        columnNumber: 17
                                    }, this),
                                    eventId && !isCalendarLoading && !calendarError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-3 space-y-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "mb-2 text-[12px] uppercase tracking-[0.16em] text-white/55",
                                                        children: "Visão rápida (timeline)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 1564,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TimelineView, {
                                                        blocks: calendarBlocks,
                                                        availabilities: calendarAvailabilities,
                                                        matches: calendarMatches,
                                                        timezone: calendarTimezone,
                                                        dayStart: startOfDay,
                                                        conflictMap: new Map(calendarConflicts.map((c)=>[
                                                                `${c.type === "block_block" || c.type === "block_match" ? "block" : c.type === "availability_match" ? "availability" : "match"}-${c.aId}`,
                                                                [
                                                                    c.type
                                                                ]
                                                            ])),
                                                        slotMinutes: slotMinutes,
                                                        onDrop: async (payload)=>{
                                                            // Persistir drop no servidor (mantendo duração). Usa PATCH no tipo certo.
                                                            if (!eventId) return;
                                                            const [kind, rawId] = payload.id.split("-");
                                                            const parsedId = Number(rawId);
                                                            if (!Number.isFinite(parsedId)) return;
                                                            if (kind === "match") {
                                                                const match = matchesById.get(parsedId);
                                                                if (!match?.courtId) {
                                                                    setCalendarWarning("Define primeiro o court do jogo para o mover.");
                                                                    toast("Define o court do jogo antes de mover", "warn");
                                                                    return;
                                                                }
                                                            }
                                                            setSavingCalendar(true);
                                                            setCalendarError(null);
                                                            setCalendarMessage(null);
                                                            setCalendarWarning(null);
                                                            try {
                                                                const currentVersion = getItemVersion(kind, parsedId);
                                                                const prevMatch = kind === "match" ? matchesById.get(parsedId) : null;
                                                                const res = await fetch("/api/padel/calendar", {
                                                                    method: "PATCH",
                                                                    headers: {
                                                                        "Content-Type": "application/json"
                                                                    },
                                                                    body: JSON.stringify({
                                                                        type: kind === "block" ? "block" : kind === "availability" ? "availability" : kind === "match" ? "match" : null,
                                                                        id: parsedId,
                                                                        startAt: payload.start.toISOString(),
                                                                        endAt: payload.end.toISOString(),
                                                                        ...currentVersion ? {
                                                                            version: currentVersion
                                                                        } : {},
                                                                        ...payload.courtId ? {
                                                                            courtId: payload.courtId
                                                                        } : {}
                                                                    })
                                                                });
                                                                const json = await res.json().catch(()=>null);
                                                                if (!res.ok || json?.ok === false) {
                                                                    const errMsg = json?.error || "Não foi possível mover.";
                                                                    if (res.status === 409 || errMsg.toLowerCase().includes("conflito")) {
                                                                        setCalendarWarning(errMsg);
                                                                        toast(errMsg, "warn");
                                                                    } else if (res.status === 423 || errMsg.toLowerCase().includes("lock")) {
                                                                        setCalendarWarning("Outro admin está a editar este slot.");
                                                                        toast("Outro admin a editar este slot.", "warn");
                                                                    } else if (res.status === 409 && errMsg.toLowerCase().includes("stale")) {
                                                                        setCalendarWarning("Atualiza a página, houve edição em paralelo.");
                                                                        toast("Edição desatualizada, atualiza a página.", "warn");
                                                                    } else {
                                                                        setCalendarError(errMsg);
                                                                        toast(errMsg, "err");
                                                                    }
                                                                } else {
                                                                    setCalendarMessage("Atualizado via drag & drop.");
                                                                    toast("Atualizado via drag & drop", "ok");
                                                                    if (kind === "block") {
                                                                        const prev = calendarBlocks.find((b)=>b.id === parsedId);
                                                                        if (prev) {
                                                                            setLastAction({
                                                                                type: "block",
                                                                                id: parsedId,
                                                                                prevStart: prev.startAt,
                                                                                prevEnd: prev.endAt,
                                                                                prevCourtId: prev.courtId ?? null,
                                                                                version: prev.updatedAt ?? null
                                                                            });
                                                                        }
                                                                    } else if (kind === "availability") {
                                                                        const prev = calendarAvailabilities.find((a)=>a.id === parsedId);
                                                                        if (prev) {
                                                                            setLastAction({
                                                                                type: "availability",
                                                                                id: parsedId,
                                                                                prevStart: prev.startAt,
                                                                                prevEnd: prev.endAt,
                                                                                version: prev.updatedAt ?? null
                                                                            });
                                                                        }
                                                                    } else if (kind === "match" && prevMatch) {
                                                                        const start = prevMatch.startTime || prevMatch.plannedStartAt;
                                                                        const end = prevMatch.plannedEndAt || (start && prevMatch.plannedDurationMinutes ? new Date(new Date(start).getTime() + prevMatch.plannedDurationMinutes * 60 * 1000).toISOString() : prevMatch.startTime);
                                                                        setLastAction({
                                                                            type: "match",
                                                                            id: parsedId,
                                                                            prevStart: start,
                                                                            prevEnd: end,
                                                                            prevCourtId: prevMatch.courtId ?? null,
                                                                            prevDuration: prevMatch.plannedDurationMinutes ?? null,
                                                                            version: prevMatch.updatedAt ?? null
                                                                        });
                                                                    }
                                                                    mutateCalendar();
                                                                }
                                                            } catch (err) {
                                                                console.error("[padel/calendar] drag-drop update", err);
                                                                setCalendarError("Erro ao mover.");
                                                                toast("Erro ao mover", "err");
                                                            } finally{
                                                                setSavingCalendar(false);
                                                            }
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 1565,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1563,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid gap-2 lg:grid-cols-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] uppercase tracking-[0.16em] text-white/55",
                                                                children: "Bloqueios"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 1681,
                                                                columnNumber: 25
                                                            }, this),
                                                            calendarBlocks.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] text-white/55",
                                                                children: "Sem bloqueios."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 1683,
                                                                columnNumber: 27
                                                            }, this),
                                                            [
                                                                ...calendarBlocks
                                                            ].sort((a, b)=>new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).slice(0, 6).map((block)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] space-y-1",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "font-semibold text-white",
                                                                            children: [
                                                                                "Bloqueio ",
                                                                                block.label || `#${block.id}`
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1693,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-white/65",
                                                                            children: [
                                                                                formatZoned(block.startAt, calendarTimezone),
                                                                                " → ",
                                                                                formatZoned(block.endAt, calendarTimezone)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1694,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        block.note && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-white/55",
                                                                            children: [
                                                                                "Nota: ",
                                                                                block.note
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1697,
                                                                            columnNumber: 46
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex flex-wrap gap-2",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                    type: "button",
                                                                                    onClick: ()=>handleEditBlock(block),
                                                                                    className: "rounded-full border border-white/20 px-2 py-[5px] text-[11px] text-white hover:border-white/35",
                                                                                    children: "Editar"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1699,
                                                                                    columnNumber: 33
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                    type: "button",
                                                                                    onClick: ()=>handleDeleteCalendarItem("block", block.id),
                                                                                    className: "rounded-full border border-red-300/60 bg-red-500/15 px-2 py-[5px] text-[11px] text-red-50 hover:border-red-200/70",
                                                                                    children: "Apagar"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1706,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1698,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, `block-${block.id}`, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                    lineNumber: 1689,
                                                                    columnNumber: 29
                                                                }, this))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 1680,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] uppercase tracking-[0.16em] text-white/55",
                                                                children: "Indisponibilidades"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 1718,
                                                                columnNumber: 25
                                                            }, this),
                                                            calendarAvailabilities.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] text-white/55",
                                                                children: "Sem indisponibilidades."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 1720,
                                                                columnNumber: 27
                                                            }, this),
                                                            [
                                                                ...calendarAvailabilities
                                                            ].sort((a, b)=>new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).slice(0, 6).map((av)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-[12px] text-white space-y-1",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "font-semibold",
                                                                            children: av.playerName || av.playerEmail || "Jogador"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1730,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-white/70",
                                                                            children: [
                                                                                formatZoned(av.startAt, calendarTimezone),
                                                                                " → ",
                                                                                formatZoned(av.endAt, calendarTimezone)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1731,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        av.note && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-white/65",
                                                                            children: [
                                                                                "Nota: ",
                                                                                av.note
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1734,
                                                                            columnNumber: 43
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex flex-wrap gap-2",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                    type: "button",
                                                                                    onClick: ()=>handleEditAvailability(av),
                                                                                    className: "rounded-full border border-white/30 px-2 py-[5px] text-[11px] text-white hover:border-white/45",
                                                                                    children: "Editar"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1736,
                                                                                    columnNumber: 33
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                    type: "button",
                                                                                    onClick: ()=>handleDeleteCalendarItem("availability", av.id),
                                                                                    className: "rounded-full border border-red-300/60 bg-red-500/15 px-2 py-[5px] text-[11px] text-red-50 hover:border-red-200/70",
                                                                                    children: "Apagar"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1743,
                                                                                    columnNumber: 33
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1735,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, `av-${av.id}`, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                    lineNumber: 1726,
                                                                    columnNumber: 29
                                                                }, this))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 1717,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2 lg:col-span-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] uppercase tracking-[0.16em] text-white/55",
                                                                children: "Jogos agendados"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 1755,
                                                                columnNumber: 17
                                                            }, this),
                                                            calendarMatches.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] text-white/55",
                                                                children: "Sem jogos com horário definido."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 1757,
                                                                columnNumber: 19
                                                            }, this),
                                                            [
                                                                ...calendarMatches
                                                            ].sort((a, b)=>new Date(a.startTime || a.plannedStartAt || 0).getTime() - new Date(b.startTime || b.plannedStartAt || 0).getTime()).slice(0, 6).map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: `flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] text-white shadow-[0_12px_35px_rgba(0,0,0,0.35)] ${calendarConflicts.some((c)=>c.aId === m.id && c.type !== "outside_event_window") ? "border-red-400/70 bg-red-500/10" : calendarConflicts.some((c)=>c.aId === m.id && c.type === "outside_event_window") ? "border-amber-300/60 bg-amber-500/10" : "border-white/12 bg-gradient-to-r from-white/8 via-[#0f1c3d]/50 to-[#050912]/80"}`,
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "space-y-1",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "font-semibold",
                                                                                    children: [
                                                                                        "Jogo #",
                                                                                        m.id
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1778,
                                                                                    columnNumber: 25
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-white/70",
                                                                                    children: [
                                                                                        formatZoned(m.startTime || m.plannedStartAt, calendarTimezone),
                                                                                        " · Court ",
                                                                                        m.courtName || m.courtNumber || m.courtId || "—"
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1779,
                                                                                    columnNumber: 25
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-white/60",
                                                                                    children: m.roundLabel || m.groupLabel || "Fase"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1782,
                                                                                    columnNumber: 25
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    className: "flex flex-wrap gap-1",
                                                                                    children: [
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                            type: "button",
                                                                                            onClick: async ()=>{
                                                                                                const start = m.startTime || m.plannedStartAt;
                                                                                                const end = m.plannedEndAt || (start && m.plannedDurationMinutes ? new Date(new Date(start).getTime() + m.plannedDurationMinutes * 60 * 1000).toISOString() : null);
                                                                                                if (!start || !end) return;
                                                                                                const newEnd = new Date(new Date(end).getTime() - slotMinutes * 60 * 1000);
                                                                                                setSavingCalendar(true);
                                                                                                try {
                                                                                                    const res = await fetch("/api/padel/calendar", {
                                                                                                        method: "PATCH",
                                                                                                        headers: {
                                                                                                            "Content-Type": "application/json"
                                                                                                        },
                                                                                                        body: JSON.stringify({
                                                                                                            type: "match",
                                                                                                            id: m.id,
                                                                                                            startAt: start,
                                                                                                            endAt: newEnd.toISOString(),
                                                                                                            version: m.updatedAt
                                                                                                        })
                                                                                                    });
                                                                                                    const json = await res.json().catch(()=>null);
                                                                                                    if (!res.ok || json?.ok === false) {
                                                                                                        setCalendarError(json?.error || "Não foi possível ajustar.");
                                                                                                        toast(json?.error || "Não foi possível ajustar.", "err");
                                                                                                    } else {
                                                                                                        setLastAction({
                                                                                                            type: "match",
                                                                                                            id: m.id,
                                                                                                            prevStart: start,
                                                                                                            prevEnd: end,
                                                                                                            prevCourtId: m.courtId ?? null,
                                                                                                            prevDuration: m.plannedDurationMinutes ?? null,
                                                                                                            version: m.updatedAt ?? null
                                                                                                        });
                                                                                                        toast("Ajustado -1 slot", "ok");
                                                                                                        mutateCalendar();
                                                                                                    }
                                                                                                } finally{
                                                                                                    setSavingCalendar(false);
                                                                                                }
                                                                                            },
                                                                                            className: "rounded-full border border-white/20 px-2 py-[2px] text-[11px] text-white hover:border-white/35",
                                                                                            children: [
                                                                                                "-",
                                                                                                slotMinutes,
                                                                                                "m"
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                            lineNumber: 1784,
                                                                                            columnNumber: 27
                                                                                        }, this),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                            type: "button",
                                                                                            onClick: async ()=>{
                                                                                                const start = m.startTime || m.plannedStartAt;
                                                                                                const end = m.plannedEndAt || (start && m.plannedDurationMinutes ? new Date(new Date(start).getTime() + m.plannedDurationMinutes * 60 * 1000).toISOString() : null);
                                                                                                if (!start || !end) return;
                                                                                                const newEnd = new Date(new Date(end).getTime() + slotMinutes * 60 * 1000);
                                                                                                setSavingCalendar(true);
                                                                                                try {
                                                                                                    const res = await fetch("/api/padel/calendar", {
                                                                                                        method: "PATCH",
                                                                                                        headers: {
                                                                                                            "Content-Type": "application/json"
                                                                                                        },
                                                                                                        body: JSON.stringify({
                                                                                                            type: "match",
                                                                                                            id: m.id,
                                                                                                            startAt: start,
                                                                                                            endAt: newEnd.toISOString(),
                                                                                                            version: m.updatedAt
                                                                                                        })
                                                                                                    });
                                                                                                    const json = await res.json().catch(()=>null);
                                                                                                    if (!res.ok || json?.ok === false) {
                                                                                                        setCalendarError(json?.error || "Não foi possível ajustar.");
                                                                                                        toast(json?.error || "Não foi possível ajustar.", "err");
                                                                                                    } else {
                                                                                                        setLastAction({
                                                                                                            type: "match",
                                                                                                            id: m.id,
                                                                                                            prevStart: start,
                                                                                                            prevEnd: end,
                                                                                                            prevCourtId: m.courtId ?? null,
                                                                                                            prevDuration: m.plannedDurationMinutes ?? null,
                                                                                                            version: m.updatedAt ?? null
                                                                                                        });
                                                                                                        toast("Ajustado +1 slot", "ok");
                                                                                                        mutateCalendar();
                                                                                                    }
                                                                                                } finally{
                                                                                                    setSavingCalendar(false);
                                                                                                }
                                                                                            },
                                                                                            className: "rounded-full border border-white/20 px-2 py-[2px] text-[11px] text-white hover:border-white/35",
                                                                                            children: [
                                                                                                "+",
                                                                                                slotMinutes,
                                                                                                "m"
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                            lineNumber: 1833,
                                                                                            columnNumber: 27
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1783,
                                                                                    columnNumber: 25
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1777,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/75",
                                                                            children: m.status
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1884,
                                                                            columnNumber: 23
                                                                        }, this)
                                                                    ]
                                                                }, `match-${m.id}`, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                    lineNumber: 1767,
                                                                    columnNumber: 21
                                                                }, this))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 1754,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2 lg:col-span-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] uppercase tracking-[0.16em] text-white/55",
                                                                children: "Conflitos"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 1891,
                                                                columnNumber: 23
                                                            }, this),
                                                            calendarConflicts.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] text-emerald-200/80",
                                                                children: "Sem conflitos detetados."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 1893,
                                                                columnNumber: 25
                                                            }, this),
                                                            calendarConflicts.slice(0, 6).map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: `flex items-center justify-between rounded-lg px-3 py-2 text-[12px] shadow-[0_12px_35px_rgba(0,0,0,0.35)] ${c.type === "outside_event_window" || c.type === "availability_match" ? "border border-amber-300/40 bg-amber-500/10 text-amber-50" : "border border-red-300/40 bg-red-500/10 text-red-50"}`,
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "space-y-1",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "font-semibold",
                                                                                    children: c.summary
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1905,
                                                                                    columnNumber: 29
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-red-100/80",
                                                                                    children: [
                                                                                        "Registos #",
                                                                                        c.aId,
                                                                                        " e #",
                                                                                        c.bId
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1906,
                                                                                    columnNumber: 29
                                                                                }, this),
                                                                                c.type === "player_match" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-[11px] text-red-100/70",
                                                                                    children: "Dupla/jogador duplicado no mesmo horário."
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1908,
                                                                                    columnNumber: 31
                                                                                }, this),
                                                                                c.type === "outside_event_window" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-[11px] text-amber-100/80",
                                                                                    children: "Fora da janela do evento."
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 1911,
                                                                                    columnNumber: 31
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1904,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "rounded-full border border-red-200/40 bg-red-200/15 px-2 py-[6px] text-[11px] text-red-50",
                                                                            children: c.type
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 1914,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, `${c.type}-${c.aId}-${c.bId}`, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                    lineNumber: 1896,
                                                                    columnNumber: 25
                                                                }, this))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 1890,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1679,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1562,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1537,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4 text-white/80 shadow-[0_16px_50px_rgba(0,0,0,0.45)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm font-semibold text-white",
                                        children: "Legenda & próximos passos"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1925,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "space-y-2 text-[13px] text-white/70",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: "• Bloqueios de court e indisponibilidades de jogador."
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1927,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: "• Conflitos: sobreposição, jogador em dois jogos, fora de horário."
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1928,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: "• Vista por clube ou todos os clubes ativos do torneio."
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1929,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: [
                                                    "• Horas em ",
                                                    calendarTimezone,
                                                    " com buffer de ",
                                                    calendarBuffer,
                                                    " min entre registos."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1930,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1926,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0f1c3d]/50 to-[#050912]/90 p-3 text-[13px] text-white/75",
                                        children: "A seguir: endpoints de indisponibilidade + slots de bloqueio; depois ligamos o drag & drop."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1932,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1924,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0f1c3d]/55 to-[#050912]/90 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm font-semibold text-white",
                                        children: "Novo bloqueio"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1937,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid gap-2 sm:grid-cols-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "datetime-local",
                                                value: blockForm.start,
                                                onChange: (e)=>setBlockForm((p)=>({
                                                            ...p,
                                                            start: e.target.value
                                                        })),
                                                className: "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                placeholder: "Início",
                                                disabled: !eventId || savingCalendar
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1939,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "datetime-local",
                                                value: blockForm.end,
                                                onChange: (e)=>setBlockForm((p)=>({
                                                            ...p,
                                                            end: e.target.value
                                                        })),
                                                className: "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                placeholder: "Fim",
                                                disabled: !eventId || savingCalendar
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 1947,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1938,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "text",
                                        value: blockForm.label,
                                        onChange: (e)=>setBlockForm((p)=>({
                                                    ...p,
                                                    label: e.target.value
                                                })),
                                        className: "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                        placeholder: "Título do bloqueio (opcional)",
                                        disabled: !eventId || savingCalendar
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1956,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "text",
                                        value: blockForm.note,
                                        onChange: (e)=>setBlockForm((p)=>({
                                                    ...p,
                                                    note: e.target.value
                                                })),
                                        className: "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                        placeholder: "Nota (opcional)",
                                        disabled: !eventId || savingCalendar
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1964,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>saveCalendarItem("block"),
                                        disabled: !eventId || savingCalendar,
                                        className: "inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01] disabled:opacity-60",
                                        children: savingCalendar ? "A guardar…" : editingBlockId ? "Atualizar bloqueio" : "Guardar bloqueio"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1972,
                                        columnNumber: 15
                                    }, this),
                                    lastAction && lastAction.type === "block" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>{
                                            if (!lastAction) return;
                                            setCalendarMessage(null);
                                            setCalendarWarning(null);
                                            setCalendarError(null);
                                            setSavingCalendar(true);
                                            fetch("/api/padel/calendar", {
                                                method: "PATCH",
                                                headers: {
                                                    "Content-Type": "application/json"
                                                },
                                                body: JSON.stringify({
                                                    type: "block",
                                                    id: lastAction.id,
                                                    startAt: lastAction.prevStart,
                                                    endAt: lastAction.prevEnd,
                                                    courtId: lastAction.prevCourtId ?? undefined,
                                                    version: lastAction.version ?? undefined
                                                })
                                            }).then((res)=>res.json().then((json)=>({
                                                        res,
                                                        json
                                                    }))).then(({ res, json })=>{
                                                if (!res.ok || json?.ok === false) {
                                                    setCalendarError(json?.error || "Não foi possível desfazer.");
                                                    toast(json?.error || "Não foi possível desfazer.", "err");
                                                } else {
                                                    setCalendarMessage("Desfeito.");
                                                    toast("Desfeito", "ok");
                                                    setLastAction(null);
                                                    mutateCalendar();
                                                }
                                            }).catch(()=>{
                                                setCalendarError("Erro ao desfazer.");
                                            }).finally(()=>setSavingCalendar(false));
                                        },
                                        className: "inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40",
                                        children: "Desfazer último"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 1981,
                                        columnNumber: 17
                                    }, this),
                                    editingBlockId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: resetCalendarForms,
                                        className: "inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40",
                                        children: "Cancelar edição"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2024,
                                        columnNumber: 17
                                    }, this),
                                    !eventId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] text-white/55",
                                        children: "Precisas de eventId no URL."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2032,
                                        columnNumber: 28
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 1936,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#130c24]/55 to-[#050912]/90 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm font-semibold text-white",
                                        children: "Nova indisponibilidade"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2035,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid gap-2 sm:grid-cols-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "datetime-local",
                                                value: availabilityForm.start,
                                                onChange: (e)=>setAvailabilityForm((p)=>({
                                                            ...p,
                                                            start: e.target.value
                                                        })),
                                                className: "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                placeholder: "Início",
                                                disabled: !eventId || savingCalendar
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2037,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "datetime-local",
                                                value: availabilityForm.end,
                                                onChange: (e)=>setAvailabilityForm((p)=>({
                                                            ...p,
                                                            end: e.target.value
                                                        })),
                                                className: "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                placeholder: "Fim",
                                                disabled: !eventId || savingCalendar
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2045,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2036,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "text",
                                        value: availabilityForm.playerName,
                                        onChange: (e)=>setAvailabilityForm((p)=>({
                                                    ...p,
                                                    playerName: e.target.value
                                                })),
                                        className: "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                        placeholder: "Nome do jogador (opcional)",
                                        disabled: !eventId || savingCalendar
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2054,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "email",
                                        value: availabilityForm.playerEmail,
                                        onChange: (e)=>setAvailabilityForm((p)=>({
                                                    ...p,
                                                    playerEmail: e.target.value
                                                })),
                                        className: "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                        placeholder: "Email (opcional)",
                                        disabled: !eventId || savingCalendar
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2062,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "text",
                                        value: availabilityForm.note,
                                        onChange: (e)=>setAvailabilityForm((p)=>({
                                                    ...p,
                                                    note: e.target.value
                                                })),
                                        className: "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                        placeholder: "Nota (opcional)",
                                        disabled: !eventId || savingCalendar
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2070,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>saveCalendarItem("availability"),
                                        disabled: !eventId || savingCalendar,
                                        className: "inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01] disabled:opacity-60",
                                        children: savingCalendar ? "A guardar…" : editingAvailabilityId ? "Atualizar indisponibilidade" : "Guardar indisponibilidade"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2078,
                                        columnNumber: 15
                                    }, this),
                                    lastAction && lastAction.type === "availability" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>{
                                            if (!lastAction) return;
                                            setCalendarMessage(null);
                                            setCalendarWarning(null);
                                            setCalendarError(null);
                                            setSavingCalendar(true);
                                            fetch("/api/padel/calendar", {
                                                method: "PATCH",
                                                headers: {
                                                    "Content-Type": "application/json"
                                                },
                                                body: JSON.stringify({
                                                    type: "availability",
                                                    id: lastAction.id,
                                                    startAt: lastAction.prevStart,
                                                    endAt: lastAction.prevEnd,
                                                    version: lastAction.version ?? undefined
                                                })
                                            }).then((res)=>res.json().then((json)=>({
                                                        res,
                                                        json
                                                    }))).then(({ res, json })=>{
                                                if (!res.ok || json?.ok === false) {
                                                    setCalendarError(json?.error || "Não foi possível desfazer.");
                                                    toast(json?.error || "Não foi possível desfazer.", "err");
                                                } else {
                                                    setCalendarMessage("Desfeito.");
                                                    toast("Desfeito", "ok");
                                                    setLastAction(null);
                                                    mutateCalendar();
                                                }
                                            }).catch(()=>{
                                                setCalendarError("Erro ao desfazer.");
                                            }).finally(()=>setSavingCalendar(false));
                                        },
                                        className: "inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40",
                                        children: "Desfazer último"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2087,
                                        columnNumber: 17
                                    }, this),
                                    editingAvailabilityId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: resetCalendarForms,
                                        className: "inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40",
                                        children: "Cancelar edição"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2129,
                                        columnNumber: 17
                                    }, this),
                                    !eventId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] text-white/55",
                                        children: "Precisas de eventId no URL."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2137,
                                        columnNumber: 28
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2034,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 1536,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 1467,
                columnNumber: 9
            }, this),
            !switchingTab && activeTab === "clubs" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-4 transition-all duration-250 ease-out opacity-100 translate-y-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center justify-between gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-sm font-semibold text-white",
                                        children: "Clubes"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2147,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] text-white/65",
                                        children: "Morada, courts e default para o wizard."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2148,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2146,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: openNewClubModal,
                                className: "rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01]",
                                children: "Novo clube"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2150,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 2145,
                        columnNumber: 11
                    }, this),
                    sortedClubs.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-dashed border-white/20 bg-black/35 p-6 text-white",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-lg font-semibold",
                                children: "Ainda sem clubes."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2160,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-white/70",
                                children: "Adiciona o primeiro para preencher morada e courts no wizard."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2161,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-3 flex gap-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: openNewClubModal,
                                    className: "rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow",
                                    children: "Criar clube"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2163,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2162,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 2159,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3",
                        children: sortedClubs.map((club)=>{
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `rounded-2xl p-4 shadow-[0_16px_60px_rgba(0,0,0,0.45)] ${club.isActive ? "border border-emerald-400/40 bg-emerald-500/5" : "border border-red-500/40 bg-red-500/8"} ${drawerClubId === club.id ? "ring-2 ring-cyan-400/40" : ""}`,
                                role: "button",
                                tabIndex: 0,
                                onClick: ()=>{
                                    setDrawerClubId(club.id);
                                    loadCourtsAndStaff(club.id);
                                },
                                onKeyDown: (e)=>{
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setDrawerClubId(club.id);
                                        loadCourtsAndStaff(club.id);
                                    }
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-base font-semibold text-white",
                                                        children: club.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2199,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[12px] text-white/65",
                                                        children: compactAddress(club)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2200,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[12px] text-white/55",
                                                        children: [
                                                            "Courts ativos: ",
                                                            activeCourtsForClub(club)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2201,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2198,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: club.isActive ? badge("green") : "rounded-full border border-red-400/50 bg-red-500/15 px-3 py-1 text-[12px] text-red-100",
                                                children: club.isActive ? "Ativo" : "Inativo"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2203,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2197,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-3 flex flex-wrap items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: (e)=>{
                                                    e.stopPropagation();
                                                    setDrawerClubId(club.id);
                                                    loadCourtsAndStaff(club.id);
                                                },
                                                className: "rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/30",
                                                children: "Courts & equipa"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2214,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>openEditClubModal(club),
                                                className: "rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/30",
                                                children: "Editar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2225,
                                                columnNumber: 23
                                            }, this),
                                            !club.isDefault && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>markDefaultClub(club),
                                                className: "rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30",
                                                children: "Tornar default"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2233,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>setClubDialog({
                                                        club,
                                                        nextActive: !club.isActive
                                                    }),
                                                className: `rounded-full border px-3 py-1.5 text-[12px] ${club.isActive ? "border-amber-300/60 bg-amber-400/15 text-amber-50 hover:border-amber-200/80" : "border-emerald-400/60 bg-emerald-500/15 text-emerald-50 hover:border-emerald-300/80"}`,
                                                children: club.isActive ? "Arquivar" : "Reativar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2241,
                                                columnNumber: 23
                                            }, this),
                                            !club.isActive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>setDeleteClubDialog(club),
                                                className: "rounded-full border border-red-400/60 bg-red-500/15 px-3 py-1.5 text-[12px] text-red-50 hover:border-red-300/80",
                                                children: "Apagar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2253,
                                                columnNumber: 25
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2213,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, club.id, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2176,
                                columnNumber: 19
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 2173,
                        columnNumber: 13
                    }, this),
                    drawerClubId && selectedClub && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/65 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center justify-between gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[12px] uppercase tracking-[0.18em] text-white/60",
                                                children: "Courts & equipa"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2272,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-white/70",
                                                children: "Courts ativos e staff herdável vão para o wizard de torneio."
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2273,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2271,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "sr-only",
                                                htmlFor: "club-switcher",
                                                children: "Trocar clube"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2276,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                id: "club-switcher",
                                                value: drawerClubId ?? "",
                                                onChange: (e)=>{
                                                    const nextId = Number(e.target.value);
                                                    if (Number.isFinite(nextId)) {
                                                        setDrawerClubId(nextId);
                                                    }
                                                },
                                                className: "rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[12px] text-white shadow-inner outline-none transition focus:border-white/60 focus:ring-2 focus:ring-cyan-400/40",
                                                children: sortedClubs.map((club)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: club.id,
                                                        children: club.name
                                                    }, club.id, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2291,
                                                        columnNumber: 23
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2279,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: badge("slate"),
                                                children: selectedClub.name
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2296,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>setDrawerClubId(null),
                                                className: "rounded-full border border-white/15 px-3 py-1 text-[12px] text-white hover:border-white/30",
                                                children: "Fechar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2297,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2275,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2270,
                                columnNumber: 15
                            }, this),
                            loadingDrawer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-4 w-32 rounded bg-white/10 animate-pulse"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2309,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid gap-3 lg:grid-cols-2",
                                        children: [
                                            ...Array(2)
                                        ].map((_, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-2 rounded-xl border border-white/12 bg-white/5 p-3 animate-pulse",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-4 w-1/2 rounded bg-white/10"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2313,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-10 rounded bg-white/5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2314,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-10 rounded bg-white/5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2315,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-3 w-24 rounded bg-white/10"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2316,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, idx, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2312,
                                                columnNumber: 23
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2310,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2308,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-4 lg:grid-cols-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-3 rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.45)]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-sm font-semibold text-white",
                                                        children: "Courts do clube"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2326,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: badge("slate"),
                                                        children: [
                                                            courts.filter((c)=>c.isActive).length,
                                                            " ativos"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2327,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2325,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid gap-2 sm:grid-cols-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        value: courtForm.name,
                                                        onChange: (e)=>setCourtForm((p)=>({
                                                                    ...p,
                                                                    name: e.target.value
                                                                })),
                                                        className: "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                        placeholder: "Nome do court"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2330,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        value: courtForm.description,
                                                        onChange: (e)=>setCourtForm((p)=>({
                                                                    ...p,
                                                                    description: e.target.value
                                                                })),
                                                        className: "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                        placeholder: "Descrição / patrocinador (opcional)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2336,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "col-span-2 flex flex-wrap items-center gap-2 text-sm text-white/80",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[12px] uppercase tracking-[0.2em] text-white/60",
                                                                children: "Tipo"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2343,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]",
                                                                children: [
                                                                    {
                                                                        key: false,
                                                                        label: "Outdoor"
                                                                    },
                                                                    {
                                                                        key: true,
                                                                        label: "Indoor"
                                                                    }
                                                                ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        type: "button",
                                                                        onClick: ()=>setCourtForm((p)=>({
                                                                                    ...p,
                                                                                    indoor: opt.key
                                                                                })),
                                                                        className: `rounded-full px-3 py-1 transition ${courtForm.indoor === opt.key ? "bg-white text-black font-semibold shadow" : "text-white/75 hover:bg-white/5"}`,
                                                                        children: opt.label
                                                                    }, String(opt.key), false, {
                                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                        lineNumber: 2349,
                                                                        columnNumber: 27
                                                                    }, this))
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2344,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]",
                                                                children: [
                                                                    {
                                                                        key: true,
                                                                        label: "Ativo"
                                                                    },
                                                                    {
                                                                        key: false,
                                                                        label: "Inativo"
                                                                    }
                                                                ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        type: "button",
                                                                        onClick: ()=>setCourtForm((p)=>({
                                                                                    ...p,
                                                                                    isActive: opt.key
                                                                                })),
                                                                        className: `rounded-full px-3 py-1 transition ${courtForm.isActive === opt.key ? opt.key ? "bg-emerald-400 text-black font-semibold" : "bg-white text-black font-semibold" : "text-white/75 hover:bg-white/5"}`,
                                                                        children: opt.label
                                                                    }, String(opt.key), false, {
                                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                        lineNumber: 2368,
                                                                        columnNumber: 27
                                                                    }, this))
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2363,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2342,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2329,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-wrap gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: handleSubmitCourt,
                                                        disabled: savingCourt,
                                                        className: "rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black shadow disabled:opacity-60",
                                                        children: savingCourt ? "A guardar…" : courtForm.id ? "Atualizar court" : "Guardar court"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2387,
                                                        columnNumber: 21
                                                    }, this),
                                                    courtForm.id && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: resetCourtForm,
                                                        className: "rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/35",
                                                        children: "Cancelar"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2396,
                                                        columnNumber: 23
                                                    }, this),
                                                    (courtError || courtMessage) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[12px] text-white/70",
                                                        children: courtError || courtMessage
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2405,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2386,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-2 rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] text-white/80",
                                                children: [
                                                    courts.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-white/60",
                                                        children: "Sem courts ainda."
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2409,
                                                        columnNumber: 41
                                                    }, this),
                                                    courts.map((c, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            draggable: true,
                                                            onDragStart: ()=>setDraggingCourtId(c.id),
                                                            onDragOver: (e)=>e.preventDefault(),
                                                            onDrop: (e)=>{
                                                                e.preventDefault();
                                                                const updated = reorderCourts(c.id);
                                                                if (updated) {
                                                                    persistCourtOrder(updated);
                                                                }
                                                                setDraggingCourtId(null);
                                                            },
                                                            onDragEnd: ()=>setDraggingCourtId(null),
                                                            className: `flex items-center justify-between gap-3 rounded-md px-3 py-2 transition ${c.isActive ? "border border-emerald-400/35 bg-emerald-500/5" : "border border-red-500/40 bg-red-500/8"} ${draggingCourtId === c.id ? "opacity-60" : "opacity-100"}`,
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-3",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: `flex h-10 w-10 items-center justify-center rounded-full border text-lg font-bold ${c.isActive ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50" : "border-red-400/40 bg-red-500/10 text-red-100"}`,
                                                                            children: idx + 1
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 2432,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "text-sm font-semibold text-white",
                                                                                    children: c.name
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 2442,
                                                                                    columnNumber: 25
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: `text-[11px] ${c.isActive ? "text-emerald-100/80" : "text-red-100/80"}`,
                                                                                    children: [
                                                                                        c.indoor ? "Indoor" : "Outdoor",
                                                                                        " · Ordem ",
                                                                                        c.displayOrder,
                                                                                        " · ",
                                                                                        c.isActive ? "Ativo" : "Inativo"
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 2443,
                                                                                    columnNumber: 25
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 2441,
                                                                            columnNumber: 23
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                    lineNumber: 2431,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-2",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>handleEditCourt(c),
                                                                            className: "rounded-full border border-white/15 px-2 py-1 text-[11px] text-white hover:border-white/30",
                                                                            children: "Editar"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 2449,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>setCourtDialog({
                                                                                    court: c,
                                                                                    nextActive: !c.isActive
                                                                                }),
                                                                            className: `rounded-full border px-2 py-1 text-[11px] ${c.isActive ? "border-amber-300/60 bg-amber-400/15 text-amber-50 hover:border-amber-200/80" : "border-emerald-400/60 bg-emerald-500/15 text-emerald-50 hover:border-emerald-300/80"}`,
                                                                            children: c.isActive ? "Desativar" : "Reativar"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 2456,
                                                                            columnNumber: 23
                                                                        }, this),
                                                                        !c.isActive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>setDeleteCourtDialog(c),
                                                                            className: "rounded-full border border-red-400/60 bg-red-500/15 px-2 py-1 text-[11px] text-red-50 hover:border-red-300/80",
                                                                            children: "Apagar"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 2468,
                                                                            columnNumber: 25
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                    lineNumber: 2448,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, c.id, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                            lineNumber: 2411,
                                                            columnNumber: 19
                                                        }, this))
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2408,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2324,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-3 rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.45)]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-sm font-semibold text-white",
                                                                children: "Staff do clube"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2485,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] text-white/60",
                                                                children: [
                                                                    staff.length,
                                                                    " membros · ",
                                                                    inheritedStaffCount,
                                                                    " herdam para torneios"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2486,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2484,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: badge("slate"),
                                                        children: [
                                                            "Herdam: ",
                                                            inheritedStaffCount
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2490,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2483,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid gap-2 sm:grid-cols-2",
                                                children: [
                                                    {
                                                        key: "existing",
                                                        label: "Staff do organizador",
                                                        desc: "Reaproveita quem já tens no staff global e herda para torneios."
                                                    },
                                                    {
                                                        key: "external",
                                                        label: "Contacto externo",
                                                        desc: "Email + role só para este clube. Podes convidar depois."
                                                    }
                                                ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: ()=>setStaffMode(opt.key),
                                                        className: `rounded-xl border p-3 text-left transition ${staffMode === opt.key ? "border-white/60 bg-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.45)]" : "border-white/15 bg-white/5 hover:border-white/30"}`,
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "font-semibold text-white",
                                                                children: opt.label
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2516,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[12px] text-white/65",
                                                                children: opt.desc
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2517,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, opt.key, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2506,
                                                        columnNumber: 23
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2493,
                                                columnNumber: 19
                                            }, this),
                                            staffMode === "existing" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-2 rounded-xl border border-white/12 bg-black/30 p-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "grid gap-2 sm:grid-cols-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                value: staffSearch,
                                                                onChange: (e)=>setStaffSearch(e.target.value),
                                                                className: "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                                placeholder: "Pesquisar membro (nome, email, username)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2525,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                                value: staffForm.staffMemberId,
                                                                onChange: (e)=>setStaffForm((p)=>({
                                                                            ...p,
                                                                            staffMemberId: e.target.value
                                                                        })),
                                                                className: "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                        value: "",
                                                                        children: "Escolhe membro"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                        lineNumber: 2536,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    staffOptions.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                            value: m.userId,
                                                                            children: [
                                                                                (m.fullName || m.username || m.email || "Membro").trim(),
                                                                                " ",
                                                                                m.email ? `· ${m.email}` : ""
                                                                            ]
                                                                        }, m.userId, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 2538,
                                                                            columnNumber: 29
                                                                        }, this))
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2531,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2524,
                                                        columnNumber: 23
                                                    }, this),
                                                    staffForm.staffMemberId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "rounded-lg border border-white/15 bg-white/5 p-3 text-[12px] text-white/75",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "font-semibold text-white/90",
                                                                children: "Resumo rápido"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2546,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-white/70",
                                                                children: "Herdado do staff global; ficará marcado como herdado neste clube e nos torneios."
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2547,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2545,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2523,
                                                columnNumber: 21
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-2 rounded-xl border border-white/12 bg-black/30 p-3",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "grid gap-2 sm:grid-cols-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            value: staffForm.email,
                                                            onChange: (e)=>setStaffForm((p)=>({
                                                                        ...p,
                                                                        email: e.target.value
                                                                    })),
                                                            className: "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                            placeholder: "Email do contacto"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                            lineNumber: 2556,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-[12px] text-white/70",
                                                            children: "Sem conta ORYA: guardamos só email + role. Podes convidar mais tarde."
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                            lineNumber: 2562,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                    lineNumber: 2555,
                                                    columnNumber: 23
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2554,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid gap-2 sm:grid-cols-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                        value: staffForm.role,
                                                        onChange: (e)=>setStaffForm((p)=>({
                                                                    ...p,
                                                                    role: e.target.value
                                                                })),
                                                        className: "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                value: "ADMIN_CLUBE",
                                                                children: "Admin clube"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2575,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                value: "DIRETOR_PROVA",
                                                                children: "Diretor / Árbitro"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2576,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                value: "STAFF",
                                                                children: "Staff de campo"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2577,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2570,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]",
                                                        children: [
                                                            {
                                                                key: true,
                                                                label: "Herdar para torneios"
                                                            },
                                                            {
                                                                key: false,
                                                                label: "Só neste clube"
                                                            }
                                                        ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                type: "button",
                                                                onClick: ()=>setStaffForm((p)=>({
                                                                            ...p,
                                                                            inheritToEvents: opt.key
                                                                        })),
                                                                className: `rounded-full px-3 py-1 transition ${staffForm.inheritToEvents === opt.key ? "bg-white text-black font-semibold shadow" : "text-white/75 hover:bg-white/5"}`,
                                                                children: opt.label
                                                            }, String(opt.key), false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2584,
                                                                columnNumber: 25
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2579,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2569,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-wrap gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: handleSubmitStaff,
                                                        className: "rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black shadow",
                                                        children: staffForm.id ? "Atualizar" : "Adicionar"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2601,
                                                        columnNumber: 21
                                                    }, this),
                                                    staffForm.id && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: resetStaffForm,
                                                        className: "rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/35",
                                                        children: "Cancelar"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2609,
                                                        columnNumber: 23
                                                    }, this),
                                                    (staffError || staffMessage || staffInviteNotice) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[12px] text-white/70",
                                                        children: staffError || staffMessage || staffInviteNotice
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2618,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2600,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-2 rounded-lg border border-white/12 bg-white/5 p-2 text-[12px] text-white/80",
                                                children: [
                                                    staff.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-white/60",
                                                        children: "Sem staff ainda."
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2625,
                                                        columnNumber: 44
                                                    }, this),
                                                    staff.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-2 py-1.5",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "space-y-0.5",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                            className: "text-sm text-white",
                                                                            children: s.email || s.userId || "Sem contacto"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 2629,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex flex-wrap items-center gap-2 text-[11px] text-white/60",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "rounded-full border border-white/20 bg-white/5 px-2 py-[2px]",
                                                                                    children: s.role
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 2631,
                                                                                    columnNumber: 29
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: `rounded-full border px-2 py-[2px] ${s.inheritToEvents ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-100" : "border-white/20 bg-white/5 text-white/70"}`,
                                                                                    children: s.inheritToEvents ? "Herdado p/ torneios" : "Só no clube"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 2632,
                                                                                    columnNumber: 29
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "rounded-full border border-white/15 bg-white/5 px-2 py-[2px]",
                                                                                    children: s.userId ? "Staff global" : "Externo"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 2641,
                                                                                    columnNumber: 29
                                                                                }, this),
                                                                                !s.userId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "rounded-full border border-amber-300/50 bg-amber-400/10 px-2 py-[2px] text-amber-50",
                                                                                    children: "Pendente (sem conta)"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                                    lineNumber: 2644,
                                                                                    columnNumber: 43
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                            lineNumber: 2630,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                    lineNumber: 2628,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>handleEditStaff(s),
                                                                    className: "rounded-full border border-white/15 px-2 py-1 text-[11px] text-white hover:border-white/30",
                                                                    children: "Editar"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                    lineNumber: 2647,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, s.id, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                            lineNumber: 2627,
                                                            columnNumber: 23
                                                        }, this))
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2624,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2482,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2323,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 2269,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2144,
                columnNumber: 9
            }, this),
            !switchingTab && activeTab === "players" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center justify-between gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] uppercase tracking-[0.2em] text-white/60",
                                        children: "Jogadores"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2668,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/70",
                                        children: "Roster automático. Sem criação manual nesta fase."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2669,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2667,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                value: search,
                                onChange: (e)=>setSearch(e.target.value),
                                placeholder: "Procurar por nome ou email",
                                className: "w-60 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                lineNumber: 2671,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 2666,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "overflow-auto rounded-xl border border-white/10",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                            className: "min-w-full text-left text-sm text-white/80",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                    className: "bg-white/5 text-[12px] uppercase tracking-[0.12em] text-white/60",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "px-3 py-2",
                                                children: "Jogador"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2682,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "px-3 py-2",
                                                children: "Email"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2683,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "px-3 py-2",
                                                children: "Telefone"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2684,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "px-3 py-2",
                                                children: "Torneios"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2685,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                        lineNumber: 2681,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2680,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                    children: [
                                        filteredPlayers.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-3 py-3 text-[13px] text-white/60",
                                                colSpan: 4,
                                                children: "Sem jogadores ainda. Quando houver registos de jogadores em Padel, a lista aparece aqui."
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2691,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2690,
                                            columnNumber: 19
                                        }, this),
                                        filteredPlayers.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                className: "border-t border-white/10",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        className: "px-3 py-2 font-semibold text-white",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: p.fullName
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2699,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-[11px] text-white/60",
                                                                children: p.level || "Nível não definido"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                                lineNumber: 2700,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2698,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        className: "px-3 py-2",
                                                        children: p.email || "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2702,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        className: "px-3 py-2",
                                                        children: p.phone || "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2703,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        className: "px-3 py-2",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: badge("slate"),
                                                            children: [
                                                                p.tournamentsCount ?? 0,
                                                                " torneios"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                            lineNumber: 2705,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                        lineNumber: 2704,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, p.id, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                lineNumber: 2697,
                                                columnNumber: 19
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2688,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 2679,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 2678,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2665,
                columnNumber: 9
            }, this),
            !switchingTab && activeTab === "rankings" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 text-sm text-white/75 space-y-2 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] uppercase tracking-[0.2em] text-white/60",
                        children: "Rankings"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 2717,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Rankings multi-torneio chegam numa próxima versão."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                        lineNumber: 2718,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2716,
                columnNumber: 9
            }, this),
            organizationKind !== "CLUBE_PADEL" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 text-[12px] text-white/70 shadow-[0_16px_50px_rgba(0,0,0,0.45)]",
                children: "Ferramentas de Padel disponíveis mesmo sem seres clube. Usa quando precisares."
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2723,
                columnNumber: 9
            }, this),
            clubModalOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c142b] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-start justify-between gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] uppercase tracking-[0.2em] text-white/60",
                                            children: clubForm.id ? "Editar clube" : "Novo clube"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2733,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-xl font-semibold text-white",
                                            children: "Só o essencial."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2736,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2732,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setClubModalOpen(false),
                                    className: "rounded-full border border-white/20 px-3 py-1 text-[12px] text-white hover:border-white/35",
                                    children: "Fechar"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2738,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 2731,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-4 space-y-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    value: clubForm.name,
                                    onChange: (e)=>setClubForm((p)=>({
                                                ...p,
                                                name: e.target.value
                                            })),
                                    placeholder: "Nome do clube",
                                    className: "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2748,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid gap-3 sm:grid-cols-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    list: "pt-cities",
                                                    value: clubForm.city,
                                                    onChange: (e)=>setClubForm((p)=>({
                                                                ...p,
                                                                city: e.target.value
                                                            })),
                                                    placeholder: "Cidade",
                                                    className: "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                    lineNumber: 2756,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("datalist", {
                                                    id: "pt-cities",
                                                    children: __TURBOPACK__imported__module__$5b$project$5d2f$config$2f$cities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PORTUGAL_CITIES"].map((city)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                            value: city
                                                        }, city, false, {
                                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                            lineNumber: 2765,
                                                            columnNumber: 23
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                                    lineNumber: 2763,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2755,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            value: clubForm.address,
                                            onChange: (e)=>setClubForm((p)=>({
                                                        ...p,
                                                        address: e.target.value
                                                    })),
                                            placeholder: "Morada",
                                            className: "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2769,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2754,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid gap-3 sm:grid-cols-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            value: clubForm.slug ?? "",
                                            onChange: (e)=>{
                                                setSlugError(null);
                                                setClubForm((p)=>({
                                                        ...p,
                                                        slug: e.target.value
                                                    }));
                                            },
                                            placeholder: "Slug / código curto (opcional)",
                                            className: "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2777,
                                            columnNumber: 17
                                        }, this),
                                        slugError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-1 text-[12px] font-semibold text-red-300",
                                            children: slugError
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2786,
                                            columnNumber: 31
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "number",
                                            min: 1,
                                            max: 1000,
                                            value: clubForm.courtsCount,
                                            onChange: (e)=>setClubForm((p)=>({
                                                        ...p,
                                                        courtsCount: e.target.value
                                                    })),
                                            placeholder: "Nº de courts",
                                            className: "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2787,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2776,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "flex items-center gap-2 text-sm text-white/80",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "checkbox",
                                            checked: clubForm.isActive,
                                            onChange: (e)=>setClubForm((p)=>({
                                                        ...p,
                                                        isActive: e.target.checked
                                                    })),
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2798,
                                            columnNumber: 17
                                        }, this),
                                        "Ativo (disponível no wizard)"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2797,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap items-center gap-2 text-[12px] text-white/70",
                                    children: [
                                        clubError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-red-300",
                                            children: clubError
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2807,
                                            columnNumber: 31
                                        }, this),
                                        clubMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: clubMessage
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2808,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2806,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: handleSubmitClub,
                                            disabled: savingClub,
                                            className: "rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60",
                                            children: savingClub ? "A guardar…" : clubForm.id ? "Guardar alterações" : "Criar clube"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2811,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setClubModalOpen(false),
                                            className: "rounded-full border border-white/20 px-3 py-2 text-[12px] text-white hover:border-white/35",
                                            children: "Cancelar"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                            lineNumber: 2819,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                                    lineNumber: 2810,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                            lineNumber: 2747,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                    lineNumber: 2730,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2729,
                columnNumber: 9
            }, this),
            clubDialog && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ConfirmDestructiveActionDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConfirmDestructiveActionDialog"], {
                open: true,
                title: clubDialog.nextActive ? "Reativar clube?" : "Arquivar clube?",
                description: clubDialog.nextActive ? "O clube volta a aparecer no wizard e sugestões." : "O clube ficará inativo e deixa de aparecer nas sugestões do wizard.",
                consequences: clubDialog.nextActive ? [
                    "Courts ativos continuam disponíveis."
                ] : [
                    "Não aparecerá ao criar torneios.",
                    "Podes reativar mais tarde."
                ],
                confirmLabel: clubDialog.nextActive ? "Reativar" : "Arquivar",
                dangerLevel: "medium",
                onClose: ()=>setClubDialog(null),
                onConfirm: ()=>handleToggleClubActive(clubDialog.club, clubDialog.nextActive)
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2833,
                columnNumber: 9
            }, this),
            deleteClubDialog && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ConfirmDestructiveActionDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConfirmDestructiveActionDialog"], {
                open: true,
                title: "Apagar clube?",
                description: "Remove definitivamente este clube e os courts associados. Não aparecerá mais no hub ou no wizard.",
                consequences: [
                    "Ação permanente.",
                    "Court e staff associados deixam de estar disponíveis."
                ],
                confirmLabel: "Apagar",
                dangerLevel: "high",
                onClose: ()=>setDeleteClubDialog(null),
                onConfirm: ()=>handleDeleteClub(deleteClubDialog)
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2854,
                columnNumber: 9
            }, this),
            courtDialog && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ConfirmDestructiveActionDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConfirmDestructiveActionDialog"], {
                open: true,
                title: courtDialog.nextActive ? "Reativar court?" : "Desativar court?",
                description: courtDialog.nextActive ? "O court volta a ser sugerido no wizard." : "O court fica inativo e deixa de ser sugerido.",
                consequences: courtDialog.nextActive ? [
                    "Mantém a ordem e atributos."
                ] : [
                    "Sai das sugestões do wizard.",
                    "Podes reativar mais tarde."
                ],
                confirmLabel: courtDialog.nextActive ? "Reativar" : "Desativar",
                dangerLevel: "medium",
                onClose: ()=>setCourtDialog(null),
                onConfirm: handleConfirmCourtToggle
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2867,
                columnNumber: 9
            }, this),
            deleteCourtDialog && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ConfirmDestructiveActionDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConfirmDestructiveActionDialog"], {
                open: true,
                title: "Apagar court?",
                description: "Remove definitivamente este court. Não aparecerá mais no hub ou no wizard.",
                consequences: [
                    "Ação permanente.",
                    "Podes criar outro mais tarde."
                ],
                confirmLabel: "Apagar",
                dangerLevel: "high",
                onClose: ()=>setDeleteCourtDialog(null),
                onConfirm: ()=>handleDeleteCourt(deleteCourtDialog)
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
                lineNumber: 2888,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx",
        lineNumber: 1411,
        columnNumber: 5
    }, this);
}
_s(PadelHubClient, "uxNgtHyXOKqX0tfgTRuIdqdnL80=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c3 = PadelHubClient;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "SkeletonBlock");
__turbopack_context__.k.register(_c1, "PadelTabSkeleton");
__turbopack_context__.k.register(_c2, "TimelineView");
__turbopack_context__.k.register(_c3, "PadelHubClient");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PadelHubSection
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$padel$2f$PadelHubClient$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/(dashboard)/padel/PadelHubClient.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const fetcher = (url)=>fetch(url).then((res)=>res.json());
function PadelHubSection({ organizerId, organizationKind }) {
    _s();
    const clubsUrl = organizerId ? `/api/padel/clubs?includeInactive=1&organizerId=${organizerId}` : null;
    const playersUrl = organizerId ? `/api/padel/players?organizerId=${organizerId}` : null;
    const { data: clubsRes, isLoading: clubsLoading, error: clubsError, mutate: mutateClubs } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(clubsUrl, fetcher);
    const { data: playersRes, isLoading: playersLoading, error: playersError, mutate: mutatePlayers } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(playersUrl, fetcher);
    const clubs = Array.isArray(clubsRes?.items) ? clubsRes.items : [];
    const players = Array.isArray(playersRes?.items) ? playersRes.items : [];
    const isLoading = clubsLoading || playersLoading;
    const hasError = Boolean(clubsError || playersError || clubsRes?.ok === false || playersRes?.ok === false);
    if (isLoading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] animate-pulse space-y-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-4 w-44 rounded-full bg-white/10"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
                    lineNumber: 68,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-8 w-72 rounded-2xl bg-white/10"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
                    lineNumber: 69,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-40 rounded-2xl bg-white/5"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
                    lineNumber: 70,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
            lineNumber: 67,
            columnNumber: 7
        }, this);
    }
    if (hasError) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-100 flex flex-wrap items-center justify-between gap-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "font-semibold",
                            children: "Não foi possível carregar o Hub Padel."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
                            lineNumber: 79,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[12px] text-red-100/80",
                            children: "Tenta novamente ou recarrega a página."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
                            lineNumber: 80,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
                    lineNumber: 78,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    onClick: ()=>{
                        mutateClubs();
                        mutatePlayers();
                    },
                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                    children: "Tentar novamente"
                }, void 0, false, {
                    fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
                    lineNumber: 82,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
            lineNumber: 77,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f28$dashboard$292f$padel$2f$PadelHubClient$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        organizerId: organizerId,
        organizationKind: organizationKind,
        initialClubs: clubs,
        initialPlayers: players
    }, void 0, false, {
        fileName: "[project]/app/organizador/(dashboard)/padel/PadelHubSection.tsx",
        lineNumber: 97,
        columnNumber: 5
    }, this);
}
_s(PadelHubSection, "OKXUpVfgN1zn4mdr1j8hqwXGymI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = PadelHubSection;
var _c;
__turbopack_context__.k.register(_c, "PadelHubSection");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/(dashboard)/inscricoes/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>InscricoesPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/ObjectiveSubnav.tsx [app-client] (ecmascript)");
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
const fetcher = (url)=>fetch(url).then((res)=>res.json());
const statusLabel = {
    DRAFT: "Rascunho",
    PUBLISHED: "Publicado",
    ARCHIVED: "Arquivado"
};
const formatDate = (value)=>{
    if (!value) return "Disponível sempre";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Disponível sempre";
    return parsed.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};
function InscricoesPage({ embedded }) {
    _s();
    const { user, isLoading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const { openModal } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const orgParam = searchParams?.get("org");
    const orgMeUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InscricoesPage.useMemo[orgMeUrl]": ()=>{
            if (!user) return null;
            return orgParam ? `/api/organizador/me?org=${orgParam}` : "/api/organizador/me";
        }
    }["InscricoesPage.useMemo[orgMeUrl]"], [
        user,
        orgParam
    ]);
    const { data: organizerData } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(orgMeUrl, fetcher);
    const { data, mutate, isLoading: loadingForms } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(user ? "/api/organizador/inscricoes" : null, fetcher);
    const [title, setTitle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [description, setDescription] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [creating, setCreating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InscricoesPage.useMemo[items]": ()=>data?.ok ? data.items : []
    }["InscricoesPage.useMemo[items]"], [
        data
    ]);
    const moduleDisabled = data?.ok === false && data?.error?.includes("Módulo");
    const loadError = data?.ok === false && !moduleDisabled ? data?.error : null;
    const orgCategory = organizerData?.organizer?.organizationCategory ?? null;
    const isPadelOrg = orgCategory?.toUpperCase() === "PADEL";
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InscricoesPage.useEffect": ()=>{
            if (!isPadelOrg) return;
            const orgSuffix = orgParam ? `&org=${orgParam}` : "";
            router.replace(`/organizador?tab=manage&section=eventos${orgSuffix}`);
        }
    }["InscricoesPage.useEffect"], [
        isPadelOrg,
        orgParam,
        router
    ]);
    const handleCreate = async ()=>{
        if (!user) {
            openModal({
                mode: "login",
                redirectTo: embedded ? "/organizador?tab=manage&section=inscricoes" : "/organizador/inscricoes",
                showGoogle: true
            });
            return;
        }
        setCreating(true);
        setError(null);
        try {
            const res = await fetch("/api/organizador/inscricoes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title,
                    description
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.ok === false) {
                setError(json?.error || "Não foi possível criar a inscrição.");
                setCreating(false);
                return;
            }
            setTitle("");
            setDescription("");
            mutate();
            if (json?.form?.id) {
                router.push(`/organizador/inscricoes/${json.form.id}`);
            }
            setCreating(false);
        } catch (err) {
            console.error("[inscricoes][create] erro", err);
            setError("Erro inesperado ao criar inscrição.");
            setCreating(false);
        }
    };
    if (isLoading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: embedded ? "text-sm text-white/70" : "px-6 py-10 text-sm text-white/70",
            children: "A carregar..."
        }, void 0, false, {
            fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
            lineNumber: 119,
            columnNumber: 7
        }, this);
    }
    if (isPadelOrg) return null;
    const wrapperClass = embedded ? "space-y-6 text-white" : "px-6 py-8 space-y-6 text-white";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: wrapperClass,
        children: [
            !embedded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$ObjectiveSubnav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                objective: "manage",
                activeId: "inscricoes"
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                lineNumber: 130,
                columnNumber: 21
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.3em] text-white/60",
                            children: "Inscrições"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                            lineNumber: 133,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-2xl font-semibold",
                            children: "Inscrições e formulários"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                            lineNumber: 134,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-white/60",
                            children: "Cria inscrições ou formulários simples para recolher informação e vagas."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                            lineNumber: 135,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                    lineNumber: 132,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                lineNumber: 131,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-lg font-semibold",
                                children: "Criar nova inscrição"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 143,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[12px] text-white/60",
                                children: "Começa pelo nome e depois ajusta campos, datas e capacidade."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 144,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 142,
                        columnNumber: 9
                    }, this),
                    moduleDisabled && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100",
                        children: "O módulo de Inscrições está desativado para esta organização."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 149,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-3 md:grid-cols-[1.2fr_1.8fr]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                placeholder: "Título da inscrição",
                                value: title,
                                onChange: (e)=>setTitle(e.target.value)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 154,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]",
                                placeholder: "Descrição curta (opcional) · também pode ser só um formulário",
                                value: description,
                                onChange: (e)=>setDescription(e.target.value)
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 160,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 153,
                        columnNumber: 9
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-red-300",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 167,
                        columnNumber: 19
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: creating || !title.trim() || moduleDisabled,
                        onClick: handleCreate,
                        className: "rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-110 disabled:opacity-60",
                        children: creating ? "A criar..." : "Criar inscrição"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 168,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                lineNumber: 141,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-lg font-semibold",
                                children: "As tuas inscrições"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 180,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[12px] text-white/60",
                                children: [
                                    items.length,
                                    " total"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 181,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 179,
                        columnNumber: 9
                    }, this),
                    loadingForms && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-white/60",
                        children: "A carregar inscrições..."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 184,
                        columnNumber: 26
                    }, this),
                    loadError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-red-300",
                        children: loadError
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 185,
                        columnNumber: 23
                    }, this),
                    !loadingForms && !loadError && items.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70",
                        children: "Ainda não criaste nenhuma inscrição ou formulário. Usa o botão acima para começar."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 188,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-4 lg:grid-cols-2",
                        children: items.map((form)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-lg font-semibold",
                                                        children: form.title
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                        lineNumber: 201,
                                                        columnNumber: 19
                                                    }, this),
                                                    form.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-[12px] text-white/70",
                                                        children: form.description
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                        lineNumber: 202,
                                                        columnNumber: 40
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 200,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70",
                                                children: statusLabel[form.status]
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 204,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                        lineNumber: 199,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap gap-2 text-[11px] text-white/60",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5",
                                                children: formatDate(form.startAt)
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 209,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5",
                                                children: form.capacity ? `${form.capacity} vagas` : "Sem limite"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 212,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5",
                                                children: [
                                                    form.submissionsCount,
                                                    " inscrito",
                                                    form.submissionsCount === 1 ? "" : "s"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 215,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                        lineNumber: 208,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center gap-3 text-[12px]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                href: `/organizador/inscricoes/${form.id}`,
                                                className: "rounded-full bg-white px-3 py-1 text-black",
                                                children: "Gerir"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 220,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                href: `/inscricoes/${form.id}`,
                                                className: "rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10",
                                                children: "Ver público"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                                lineNumber: 226,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                        lineNumber: 219,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, form.id, true, {
                                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                                lineNumber: 195,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                        lineNumber: 193,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
                lineNumber: 178,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/(dashboard)/inscricoes/page.tsx",
        lineNumber: 129,
        columnNumber: 5
    }, this);
}
_s(InscricoesPage, "BsIjbUOL+qn8D7NmOFaesWsr30g=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = InscricoesPage;
var _c;
__turbopack_context__.k.register(_c, "InscricoesPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_organizador_%28dashboard%29_416737fe._.js.map