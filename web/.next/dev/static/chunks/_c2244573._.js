(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/components/forms/InlineDateTimePicker.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InlineDateTimePicker",
    ()=>InlineDateTimePicker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function formatToLocalInput(date) {
    const pad = (n)=>n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function roundUpToQuarter(date) {
    const d = new Date(date);
    const minutes = d.getMinutes();
    const rounded = Math.ceil(minutes / 15) * 15;
    d.setMinutes(rounded, 0, 0);
    return d;
}
function InlineDateTimePicker({ label, value, onChange, minDateTime, required }) {
    _s();
    const parsedValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InlineDateTimePicker.useMemo[parsedValue]": ()=>{
            if (!value) return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
    }["InlineDateTimePicker.useMemo[parsedValue]"], [
        value
    ]);
    const minDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InlineDateTimePicker.useMemo[minDate]": ()=>startOfDay(minDateTime ?? new Date())
    }["InlineDateTimePicker.useMemo[minDate]"], [
        minDateTime
    ]);
    const minDateTimeRounded = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InlineDateTimePicker.useMemo[minDateTimeRounded]": ()=>minDateTime ? roundUpToQuarter(minDateTime) : roundUpToQuarter(new Date())
    }["InlineDateTimePicker.useMemo[minDateTimeRounded]"], [
        minDateTime
    ]);
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [viewMonth, setViewMonth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(parsedValue ?? new Date());
    const [selectedDate, setSelectedDate] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(parsedValue ?? null);
    const [selectedTime, setSelectedTime] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "InlineDateTimePicker.useState": ()=>{
            if (!parsedValue) return "";
            const pad = {
                "InlineDateTimePicker.useState.pad": (n)=>n.toString().padStart(2, "0")
            }["InlineDateTimePicker.useState.pad"];
            return `${pad(parsedValue.getHours())}:${pad(parsedValue.getMinutes())}`;
        }
    }["InlineDateTimePicker.useState"]);
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InlineDateTimePicker.useEffect": ()=>{
            setMounted(true);
        }
    }["InlineDateTimePicker.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InlineDateTimePicker.useEffect": ()=>{
            if (parsedValue) {
                setSelectedDate(parsedValue);
                const pad = {
                    "InlineDateTimePicker.useEffect.pad": (n)=>n.toString().padStart(2, "0")
                }["InlineDateTimePicker.useEffect.pad"];
                setSelectedTime(`${pad(parsedValue.getHours())}:${pad(parsedValue.getMinutes())}`);
                setViewMonth(parsedValue);
            }
        }
    }["InlineDateTimePicker.useEffect"], [
        parsedValue
    ]);
    const days = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InlineDateTimePicker.useMemo[days]": ()=>{
            const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
            const startWeekday = firstOfMonth.getDay(); // 0-6
            const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
            const list = [];
            for(let i = 0; i < startWeekday; i++){
                list.push({
                    date: new Date(NaN),
                    disabled: true
                });
            }
            for(let d = 1; d <= daysInMonth; d++){
                const dayDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
                const disabled = dayDate < minDate;
                list.push({
                    date: dayDate,
                    disabled
                });
            }
            return list;
        }
    }["InlineDateTimePicker.useMemo[days]"], [
        viewMonth,
        minDate
    ]);
    const timeOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InlineDateTimePicker.useMemo[timeOptions]": ()=>{
            const options = [];
            const baseDate = selectedDate ?? minDate;
            for(let h = 0; h < 24; h++){
                for(let m = 0; m < 60; m += 15){
                    const label = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                    const optionDate = new Date(baseDate);
                    optionDate.setHours(h, m, 0, 0);
                    let disabled = false;
                    if (minDateTimeRounded && selectedDate && isSameDay(selectedDate, minDateTimeRounded)) {
                        disabled = optionDate < minDateTimeRounded;
                    } else if (!selectedDate && minDateTimeRounded) {
                        disabled = optionDate < minDateTimeRounded;
                    }
                    options.push({
                        label,
                        value: label,
                        disabled
                    });
                }
            }
            return options;
        }
    }["InlineDateTimePicker.useMemo[timeOptions]"], [
        selectedDate,
        minDateTimeRounded,
        minDate
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InlineDateTimePicker.useEffect": ()=>{
            if (!selectedDate || !selectedTime) return;
            const [h, m] = selectedTime.split(":").map({
                "InlineDateTimePicker.useEffect": (v)=>Number(v)
            }["InlineDateTimePicker.useEffect"]);
            const next = new Date(selectedDate);
            next.setHours(h || 0, m || 0, 0, 0);
            if (minDateTimeRounded && next < minDateTimeRounded && isSameDay(next, minDateTimeRounded)) {
                return;
            }
            const nextValue = formatToLocalInput(next);
            if (nextValue === value) return;
            onChange(nextValue);
        }
    }["InlineDateTimePicker.useEffect"], [
        selectedDate,
        selectedTime,
        minDateTimeRounded,
        onChange,
        value
    ]);
    const monthLabel = viewMonth.toLocaleString("pt-PT", {
        month: "long",
        year: "numeric"
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "block text-sm font-medium mb-1",
                children: label
            }, void 0, false, {
                fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                lineNumber: 135,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setOpen(true),
                className: "flex w-full items-center justify-between rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: parsedValue ? parsedValue.toLocaleString("pt-PT") : "Escolher data e hora"
                    }, void 0, false, {
                        fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                        lineNumber: 141,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-[11px] text-white/60",
                        children: "📅"
                    }, void 0, false, {
                        fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                        lineNumber: 142,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                lineNumber: 136,
                columnNumber: 7
            }, this),
            open && mounted && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createPortal"])(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 px-4",
                onClick: ()=>setOpen(false),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full max-w-3xl rounded-2xl border border-white/15 bg-[#040712]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.7)] space-y-4",
                    onClick: (e)=>e.stopPropagation(),
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between text-sm text-white/80",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>{
                                        const prev = new Date(viewMonth);
                                        prev.setMonth(prev.getMonth() - 1);
                                        if (startOfDay(prev) < minDate) return;
                                        setViewMonth(prev);
                                    },
                                    className: "rounded-full px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40",
                                    children: "←"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                    lineNumber: 154,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "font-semibold capitalize",
                                    children: monthLabel
                                }, void 0, false, {
                                    fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                    lineNumber: 166,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>{
                                        const next = new Date(viewMonth);
                                        next.setMonth(next.getMonth() + 1);
                                        setViewMonth(next);
                                    },
                                    className: "rounded-full px-2 py-1 text-xs hover:bg-white/10",
                                    children: "→"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                    lineNumber: 167,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                            lineNumber: 153,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-7 gap-1 text-[11px] text-white/60",
                            children: [
                                [
                                    "D",
                                    "S",
                                    "T",
                                    "Q",
                                    "Q",
                                    "S",
                                    "S"
                                ].map((d, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-center py-1",
                                        children: d
                                    }, `${d}-${idx}`, false, {
                                        fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                        lineNumber: 181,
                                        columnNumber: 17
                                    }, this)),
                                days.map((d, idx)=>{
                                    if (Number.isNaN(d.date.getTime())) {
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {}, `blank-${idx}`, false, {
                                            fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                            lineNumber: 187,
                                            columnNumber: 26
                                        }, this);
                                    }
                                    const isSelected = selectedDate ? isSameDay(selectedDate, d.date) : false;
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        disabled: d.disabled,
                                        onClick: ()=>{
                                            setSelectedDate(d.date);
                                        },
                                        className: `h-9 w-9 rounded-full text-[12px] ${d.disabled ? "text-white/25 cursor-not-allowed" : isSelected ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold shadow-[0_0_14px_rgba(107,255,255,0.6)]" : "text-white/80 hover:bg-white/10"}`,
                                        children: d.date.getDate()
                                    }, d.date.toISOString(), false, {
                                        fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                        lineNumber: 191,
                                        columnNumber: 19
                                    }, this);
                                })
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                            lineNumber: 179,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] text-white/60",
                                    children: "Hora (15 em 15 min)"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                    lineNumber: 213,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1",
                                    children: timeOptions.map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            disabled: opt.disabled,
                                            onClick: ()=>setSelectedTime(opt.value),
                                            className: `rounded-lg px-2 py-1 text-xs ${opt.disabled ? "text-white/30 cursor-not-allowed" : selectedTime === opt.value ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold shadow-[0_0_12px_rgba(107,255,255,0.5)]" : "bg-white/5 text-white/80 hover:bg-white/10"}`,
                                            children: opt.label
                                        }, opt.value, false, {
                                            fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                            lineNumber: 216,
                                            columnNumber: 19
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                    lineNumber: 214,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                            lineNumber: 212,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex justify-end",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setOpen(false),
                                className: "rounded-full border border-white/20 px-4 py-2 text-[12px] text-white hover:bg-white/10",
                                children: "Confirmar"
                            }, void 0, false, {
                                fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                                lineNumber: 235,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                            lineNumber: 234,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                    lineNumber: 149,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                lineNumber: 145,
                columnNumber: 9
            }, this), document.body),
            required && !value && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-red-400",
                children: "Obrigatório"
            }, void 0, false, {
                fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
                lineNumber: 247,
                columnNumber: 30
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/forms/InlineDateTimePicker.tsx",
        lineNumber: 134,
        columnNumber: 5
    }, this);
}
_s(InlineDateTimePicker, "vKSYs3V6QIDYI1hNY5ddsvmps4k=");
_c = InlineDateTimePicker;
var _c;
__turbopack_context__.k.register(_c, "InlineDateTimePicker");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/flows/FlowStickyFooter.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FlowStickyFooter",
    ()=>FlowStickyFooter
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-client] (ecmascript)");
"use client";
;
;
function FlowStickyFooter({ backLabel = "Voltar", nextLabel, helper, disabledReason, loading, loadingLabel, showLoadingHint, disableBack, disableNext, onBack, onNext }) {
    const nextIsDisabled = disableNext || Boolean(disabledReason);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "sticky bottom-0 left-0 right-0 z-[var(--z-footer)] pt-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative overflow-hidden border-t border-white/10 bg-black/30 px-4 py-3 md:px-5 md:py-4 backdrop-blur-xl shadow-[0_-18px_45px_rgba(0,0,0,0.45)]",
            children: [
                loading && showLoadingHint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "absolute left-0 right-0 top-0 h-[3px] overflow-hidden",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-full w-full animate-pulse bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
                    }, void 0, false, {
                        fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                        lineNumber: 38,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                    lineNumber: 37,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-[12px] text-white/70 leading-snug",
                            children: [
                                helper ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    children: helper
                                }, void 0, false, {
                                    fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                                    lineNumber: 43,
                                    columnNumber: 23
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    children: "Guarda e revê no final. Navega sem perder contexto."
                                }, void 0, false, {
                                    fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                                    lineNumber: 43,
                                    columnNumber: 41
                                }, this),
                                disabledReason && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-white/55",
                                    children: disabledReason
                                }, void 0, false, {
                                    fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                                    lineNumber: 44,
                                    columnNumber: 32
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                            lineNumber: 42,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: onBack,
                                    disabled: disableBack,
                                    className: `${__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"]} disabled:opacity-55`,
                                    children: backLabel
                                }, void 0, false, {
                                    fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                                    lineNumber: 47,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: onNext,
                                    disabled: nextIsDisabled || loading,
                                    className: `${__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"]} px-6 text-sm font-semibold shadow-none disabled:opacity-60`,
                                    title: disabledReason ?? "",
                                    children: loading ? loadingLabel || "A processar..." : nextLabel
                                }, void 0, false, {
                                    fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                                    lineNumber: 55,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                            lineNumber: 46,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
                    lineNumber: 41,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
            lineNumber: 35,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/components/flows/FlowStickyFooter.tsx",
        lineNumber: 34,
        columnNumber: 5
    }, this);
}
_c = FlowStickyFooter;
var _c;
__turbopack_context__.k.register(_c, "FlowStickyFooter");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/organizador/eventos/wizard/StepperDots.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StepperDots",
    ()=>StepperDots
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
"use client";
;
function CheckIcon(props) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        viewBox: "0 0 24 24",
        fill: "none",
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M20 6L9 17l-5-5",
            stroke: "currentColor",
            strokeWidth: "2.2",
            strokeLinecap: "round",
            strokeLinejoin: "round"
        }, void 0, false, {
            fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
            lineNumber: 12,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
        lineNumber: 11,
        columnNumber: 5
    }, this);
}
_c = CheckIcon;
function StepperDots({ steps, current, maxUnlockedIndex, onGoTo }) {
    const currentIndex = Math.max(0, steps.findIndex((s)=>s.id === current));
    const progress = steps.length > 1 ? Math.min(100, Math.max(0, currentIndex / (steps.length - 1) * 100)) : 0;
    const dotSize = 36; // px
    const lineTop = dotSize / 2; // center of the dot
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "w-full",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative py-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "absolute left-0 right-0 h-px bg-white/10",
                    style: {
                        top: lineTop
                    },
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
                    lineNumber: 46,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "absolute left-0 h-px bg-gradient-to-r from-[var(--orya-blue)] via-[var(--orya-cyan)] to-[var(--orya-pink)]",
                    style: {
                        width: `${progress}%`,
                        top: lineTop
                    },
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
                    lineNumber: 51,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                    className: "relative flex items-start justify-between gap-4 px-1",
                    children: steps.map((s, i)=>{
                        const clickable = i <= maxUnlockedIndex;
                        const status = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
                        const isLockedFuture = i > maxUnlockedIndex;
                        const isUnlockedFuture = i > currentIndex && !isLockedFuture;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            className: "group min-w-0 flex flex-1 flex-col items-center text-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>clickable && onGoTo?.(s.id),
                                    disabled: !clickable,
                                    className: [
                                        "relative grid place-items-center rounded-full outline-none",
                                        "transition-all duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)] transform",
                                        clickable ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--orya-cyan)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent" : "cursor-not-allowed",
                                        status === "done" && "bg-emerald-400/10 border border-emerald-300/25 backdrop-blur-md shadow-[0_0_0_1px_rgba(16,185,129,.12),0_0_18px_rgba(16,185,129,.14)]",
                                        status === "current" && "bg-white/8 border border-white/25 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,.10),0_0_26px_rgba(255,255,255,.16)] scale-100",
                                        status === "todo" && (isLockedFuture ? "bg-white/4 border border-white/10 opacity-35" : "bg-white/5 border border-white/14 opacity-70 hover:opacity-90"),
                                        clickable && "hover:border-white/20 hover:shadow-[0_0_18px_rgba(255,255,255,0.1)]",
                                        status !== "current" && "scale-[0.98]"
                                    ].join(" "),
                                    "aria-current": status === "current" ? "step" : undefined,
                                    title: clickable ? "Editar este passo" : undefined,
                                    style: {
                                        width: dotSize,
                                        height: dotSize
                                    },
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: [
                                            "text-xs font-semibold",
                                            status === "done" ? "text-emerald-200" : status === "current" ? "text-white/90" : "text-white/80"
                                        ].join(" "),
                                        children: i + 1
                                    }, void 0, false, {
                                        fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
                                        lineNumber: 91,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
                                    lineNumber: 68,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: [
                                        "mt-2 text-[11px] font-semibold tracking-[0.18em] uppercase leading-tight transition-colors",
                                        status === "done" ? "text-emerald-200/80" : status === "current" ? "text-white" : isUnlockedFuture ? "text-white/65 group-hover:text-white/85" : "text-white/40"
                                    ].join(" "),
                                    children: s.title
                                }, void 0, false, {
                                    fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
                                    lineNumber: 101,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, s.id, true, {
                            fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
                            lineNumber: 64,
                            columnNumber: 15
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
                    lineNumber: 57,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
            lineNumber: 45,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/organizador/eventos/wizard/StepperDots.tsx",
        lineNumber: 44,
        columnNumber: 5
    }, this);
}
_c1 = StepperDots;
var _c, _c1;
__turbopack_context__.k.register(_c, "CheckIcon");
__turbopack_context__.k.register(_c1, "StepperDots");
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
"[project]/lib/fees.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeCombinedFees",
    ()=>computeCombinedFees
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$2f$index$2d$browser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@prisma/client/index-browser.js [app-client] (ecmascript)");
;
function computeCombinedFees(params) {
    const { amountCents, discountCents, feeMode: rawFeeMode, platformFeeBps, platformFeeFixedCents, stripeFeeBps, stripeFeeFixedCents } = params;
    const netSubtotal = Math.max(0, Math.round(amountCents) - Math.max(0, Math.round(discountCents)));
    const feeMode = rawFeeMode === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$2f$index$2d$browser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FeeMode"].ON_TOP ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$2f$index$2d$browser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FeeMode"].ADDED : rawFeeMode;
    const oryaFeeCents = netSubtotal === 0 ? 0 : Math.max(0, Math.round(netSubtotal * Math.max(0, platformFeeBps) / 10_000) + Math.max(0, platformFeeFixedCents));
    const stripeRate = Math.max(0, stripeFeeBps) / 10_000;
    const stripeFixed = Math.max(0, stripeFeeFixedCents);
    if (netSubtotal === 0) {
        return {
            subtotalCents: netSubtotal,
            feeMode,
            oryaFeeCents,
            stripeFeeCentsEstimate: 0,
            combinedFeeCents: 0,
            totalCents: 0
        };
    }
    if (feeMode === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$2f$index$2d$browser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FeeMode"].INCLUDED) {
        const totalCents = netSubtotal;
        const stripeFeeCentsEstimate = Math.max(0, Math.round(totalCents * stripeRate) + stripeFixed);
        const combinedFeeCents = Math.max(0, oryaFeeCents + stripeFeeCentsEstimate);
        return {
            subtotalCents: netSubtotal,
            feeMode,
            oryaFeeCents,
            stripeFeeCentsEstimate,
            combinedFeeCents,
            totalCents
        };
    }
    // ADDED: resolver total para que (total - orya - stripe(total)) ~= subtotal.
    const denom = 1 - stripeRate;
    const totalRaw = denom > 0 ? (netSubtotal + oryaFeeCents + stripeFixed) / denom : netSubtotal + oryaFeeCents + stripeFixed;
    const totalCents = Math.max(0, Math.round(totalRaw));
    const stripeFeeCentsEstimate = Math.max(0, Math.round(totalCents * stripeRate) + stripeFixed);
    const combinedFeeCents = Math.max(0, oryaFeeCents + stripeFeeCentsEstimate);
    return {
        subtotalCents: netSubtotal,
        feeMode,
        oryaFeeCents,
        stripeFeeCentsEstimate,
        combinedFeeCents,
        totalCents
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/organizador/eventos/novo/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>NewOrganizerEventPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$forms$2f$InlineDateTimePicker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/forms/InlineDateTimePicker.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$flows$2f$FlowStickyFooter$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/flows/FlowStickyFooter.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/hooks/useUser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/autenticação/AuthModalContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/organizador/dashboardUi.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$organizador$2f$eventos$2f$wizard$2f$StepperDots$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/organizador/eventos/wizard/StepperDots.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants/ptCities.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$fees$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/fees.ts [app-client] (ecmascript)");
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
;
;
;
;
;
const DRAFT_KEY = "orya-organizer-new-event-draft";
const normalizeOrganizationCategory = (category)=>{
    const normalized = category?.toUpperCase() ?? "";
    if (normalized === "PADEL") return "PADEL";
    if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
    return "EVENTOS";
};
const CATEGORY_OPTIONS = [
    {
        key: "padel",
        value: "PADEL",
        label: "Padel / Torneio",
        accent: "from-[#6BFFFF] to-[#22c55e]",
        copy: "Setup rápido com courts, rankings e lógica de torneio.",
        categories: [
            "PADEL"
        ]
    },
    {
        key: "voluntariado",
        value: "VOLUNTEERING",
        label: "Voluntariado",
        accent: "from-[#FCD34D] to-[#34D399]",
        copy: "Ações, impacto e participação com um fluxo simples.",
        categories: [
            "VOLUNTARIADO"
        ]
    },
    {
        key: "default",
        value: "DEFAULT",
        label: "Evento",
        accent: "from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]",
        copy: "Fluxo base com tudo o que precisas para publicar.",
        categories: [
            "OUTRO"
        ]
    }
];
const DEFAULT_PLATFORM_FEE_BPS = 800; // 8%
const DEFAULT_PLATFORM_FEE_FIXED_CENTS = 30; // €0.30
const DEFAULT_STRIPE_FEE_BPS = 140; // 1.4%
const DEFAULT_STRIPE_FEE_FIXED_CENTS = 25; // €0.25
const fetcher = (url)=>fetch(url).then((res)=>res.json());
function computeFeePreview(priceEuro, mode, platformFees, stripeFees) {
    const baseCents = Math.round(Math.max(0, priceEuro) * 100);
    const combined = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$fees$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeCombinedFees"])({
        amountCents: baseCents,
        discountCents: 0,
        feeMode: mode,
        platformFeeBps: platformFees.feeBps,
        platformFeeFixedCents: platformFees.feeFixedCents,
        stripeFeeBps: stripeFees.feeBps,
        stripeFeeFixedCents: stripeFees.feeFixedCents
    });
    const recebeOrganizador = Math.max(0, combined.totalCents - combined.oryaFeeCents - combined.stripeFeeCentsEstimate);
    return {
        baseCents,
        feeCents: combined.oryaFeeCents,
        totalCliente: combined.totalCents,
        recebeOrganizador,
        stripeFeeCents: combined.stripeFeeCentsEstimate,
        combinedFeeCents: combined.combinedFeeCents
    };
}
function NewOrganizerEventPage() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const { user, profile, isLoading: isUserLoading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const { openModal } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"])();
    const { data: platformFeeData } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])("/api/platform/fees", fetcher, {
        revalidateOnFocus: false
    });
    const { data: organizerStatus } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(user ? "/api/organizador/me" : null, fetcher, {
        revalidateOnFocus: false
    });
    const [title, setTitle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [description, setDescription] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [startsAt, setStartsAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [endsAt, setEndsAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [locationName, setLocationName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [locationCity, setLocationCity] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PT_CITIES"][0]);
    const [locationManuallySet, setLocationManuallySet] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [address, setAddress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [ticketTypes, setTicketTypes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([
        {
            name: "Geral",
            price: "",
            totalQuantity: ""
        }
    ]);
    const [feeMode, setFeeMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("ADDED");
    const [coverUrl, setCoverUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [uploadingCover, setUploadingCover] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isTest, setIsTest] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedPreset, setSelectedPreset] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const orgCategoryValue = organizerStatus?.organizer?.organizationCategory ?? null;
    const orgCategory = normalizeOrganizationCategory(orgCategoryValue);
    const isPadelOrg = orgCategory === "PADEL";
    const resolvedPreset = selectedPreset ?? (isPadelOrg ? "padel" : null);
    const isPadelPreset = resolvedPreset === "padel";
    const isPadelContext = isPadelOrg || isPadelPreset;
    const eventLabel = isPadelContext ? "torneio de padel" : "evento";
    const eventLabelPlural = isPadelContext ? "torneios de padel" : "eventos";
    const ticketLabel = isPadelContext ? "inscrição" : "bilhete";
    const ticketLabelPlural = isPadelContext ? "inscrições" : "bilhetes";
    const ticketLabelTitle = isPadelContext ? "Inscrição" : "Bilhete";
    const ticketLabelPluralTitle = isPadelContext ? "Inscrições" : "Bilhetes";
    const ticketLabelIndefinite = isPadelContext ? "uma inscrição" : "um bilhete";
    const ticketLabelPluralAll = isPadelContext ? "Todas as inscrições" : "Todos os bilhetes";
    const [isFreeEvent, setIsFreeEvent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [advancedAccessEnabled, setAdvancedAccessEnabled] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [publicAccessMode, setPublicAccessMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("OPEN");
    const [participantAccessMode, setParticipantAccessMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("NONE");
    const [publicTicketScope, setPublicTicketScope] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("ALL");
    const [participantTicketScope, setParticipantTicketScope] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("ALL");
    const [liveHubVisibility, setLiveHubVisibility] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("PUBLIC");
    const [freeTicketName, setFreeTicketName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("Inscrição");
    const [freeCapacity, setFreeCapacity] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [currentStep, setCurrentStep] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [maxStepReached, setMaxStepReached] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [selectedPadelClubId, setSelectedPadelClubId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [selectedPadelCourtIds, setSelectedPadelCourtIds] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [selectedPadelStaffIds, setSelectedPadelStaffIds] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isSubmitting, setIsSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [showLoadingHint, setShowLoadingHint] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [errorMessage, setErrorMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [stripeAlert, setStripeAlert] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [validationAlert, setValidationAlert] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [backendAlert, setBackendAlert] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [draftLoaded, setDraftLoaded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [draftSavedAt, setDraftSavedAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [toasts, setToasts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [fieldErrors, setFieldErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [errorSummary, setErrorSummary] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [showLocationSuggestions, setShowLocationSuggestions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pendingFocusField, setPendingFocusField] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [creationSuccess, setCreationSuccess] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const prevStepIndexRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const ctaAlertRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const errorSummaryRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const titleRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const startsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const endsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const locationNameRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const cityRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const ticketsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const suggestionBlurTimeout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const roles = Array.isArray(profile?.roles) ? profile?.roles : [];
    const isOrganizer = roles.includes("organizer") || Boolean(organizerStatus?.organizer?.id) || Boolean(organizerStatus?.membershipRole);
    const isAdmin = roles.some((r)=>r?.toLowerCase() === "admin");
    const paymentsStatus = isAdmin ? "READY" : organizerStatus?.paymentsStatus ?? "NO_STRIPE";
    const platformFees = platformFeeData && platformFeeData.ok ? platformFeeData.orya : {
        feeBps: DEFAULT_PLATFORM_FEE_BPS,
        feeFixedCents: DEFAULT_PLATFORM_FEE_FIXED_CENTS
    };
    const stripeFees = platformFeeData && platformFeeData.ok ? platformFeeData.stripe : {
        feeBps: DEFAULT_STRIPE_FEE_BPS,
        feeFixedCents: DEFAULT_STRIPE_FEE_FIXED_CENTS,
        region: "UE"
    };
    const hasPaidTicket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[hasPaidTicket]": ()=>!isFreeEvent && ticketTypes.some({
                "NewOrganizerEventPage.useMemo[hasPaidTicket]": (t)=>Number(t.price.replace(",", ".")) > 0
            }["NewOrganizerEventPage.useMemo[hasPaidTicket]"])
    }["NewOrganizerEventPage.useMemo[hasPaidTicket]"], [
        isFreeEvent,
        ticketTypes
    ]);
    const publicAccessLabel = publicAccessMode === "OPEN" ? "Aberto" : publicAccessMode === "TICKET" ? `Por ${ticketLabel}` : "Por convite";
    const participantAccessLabel = participantAccessMode === "NONE" ? "Sem participantes" : participantAccessMode === "TICKET" ? `Por ${ticketLabel}` : participantAccessMode === "INSCRIPTION" ? "Por inscrição" : "Por convite";
    const publicAccessDescription = publicAccessMode === "OPEN" ? isPadelContext ? `Qualquer pessoa pode ver o ${eventLabel} e inscrever-se.` : `Qualquer pessoa pode ver o ${eventLabel} e comprar ${ticketLabel}.` : publicAccessMode === "TICKET" ? isPadelContext ? "Qualquer inscrição criada dá acesso ao público (podes refinar depois)." : "Qualquer bilhete criado dá acesso ao público (podes refinar depois)." : "Apenas convidados conseguem aceder ao checkout e ao LiveHub.";
    const participantAccessDescription = participantAccessMode === "NONE" ? "Não existe distinção de participantes." : participantAccessMode === "INSCRIPTION" ? `Participantes são definidos por inscrição do ${eventLabel}.` : participantAccessMode === "TICKET" ? isPadelContext ? "Qualquer inscrição criada marca o utilizador como participante." : "Qualquer bilhete criado marca o utilizador como participante." : "Participantes são escolhidos por convite.";
    const organizerOfficialEmail = organizerStatus?.organizer?.officialEmail ?? null;
    const organizerOfficialEmailVerified = Boolean(organizerStatus?.organizer?.officialEmailVerifiedAt);
    const needsOfficialEmailVerification = !isAdmin && (!organizerOfficialEmail || !organizerOfficialEmailVerified);
    const stripeNotReady = !isAdmin && paymentsStatus !== "READY";
    const paidTicketsBlocked = stripeNotReady || needsOfficialEmailVerification;
    const paidTicketsBlockedMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[paidTicketsBlockedMessage]": ()=>{
            if (!paidTicketsBlocked) return null;
            const reasons = [];
            if (stripeNotReady) reasons.push("ligares o Stripe em Finanças & Payouts");
            if (needsOfficialEmailVerification) {
                reasons.push(organizerOfficialEmail ? "verificares o email oficial da organização em Definições" : "definires o email oficial da organização e o verificares em Definições");
            }
            const reasonsText = reasons.join(" e ");
            return isPadelContext ? `Torneios pagos só ficam ativos depois de ${reasonsText}. Até lá podes criar torneios gratuitos (preço = 0 €).` : `Eventos pagos só ficam ativos depois de ${reasonsText}. Até lá podes criar eventos gratuitos (preço = 0 €).`;
        }
    }["NewOrganizerEventPage.useMemo[paidTicketsBlockedMessage]"], [
        paidTicketsBlocked,
        stripeNotReady,
        needsOfficialEmailVerification,
        organizerOfficialEmail,
        isPadelContext
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (advancedAccessEnabled) return;
            setPublicAccessMode("OPEN");
            setParticipantAccessMode("NONE");
            setPublicTicketScope("ALL");
            setParticipantTicketScope("ALL");
            setTicketTypes({
                "NewOrganizerEventPage.useEffect": (prev)=>prev.map({
                        "NewOrganizerEventPage.useEffect": (row)=>({
                                ...row,
                                publicAccess: undefined,
                                participantAccess: undefined
                            })
                    }["NewOrganizerEventPage.useEffect"])
            }["NewOrganizerEventPage.useEffect"]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        advancedAccessEnabled
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!advancedAccessEnabled) return;
            if (publicAccessMode !== "TICKET" || publicTicketScope !== "SPECIFIC") {
                setTicketTypes({
                    "NewOrganizerEventPage.useEffect": (prev)=>prev.map({
                            "NewOrganizerEventPage.useEffect": (row)=>({
                                    ...row,
                                    publicAccess: undefined
                                })
                        }["NewOrganizerEventPage.useEffect"])
                }["NewOrganizerEventPage.useEffect"]);
                return;
            }
            setTicketTypes({
                "NewOrganizerEventPage.useEffect": (prev)=>prev.map({
                        "NewOrganizerEventPage.useEffect": (row)=>({
                                ...row,
                                publicAccess: row.publicAccess ?? true
                            })
                    }["NewOrganizerEventPage.useEffect"])
            }["NewOrganizerEventPage.useEffect"]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        advancedAccessEnabled,
        publicAccessMode,
        publicTicketScope
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!advancedAccessEnabled) return;
            if (participantAccessMode !== "TICKET" || participantTicketScope !== "SPECIFIC") {
                setTicketTypes({
                    "NewOrganizerEventPage.useEffect": (prev)=>prev.map({
                            "NewOrganizerEventPage.useEffect": (row)=>({
                                    ...row,
                                    participantAccess: undefined
                                })
                        }["NewOrganizerEventPage.useEffect"])
                }["NewOrganizerEventPage.useEffect"]);
                return;
            }
            setTicketTypes({
                "NewOrganizerEventPage.useEffect": (prev)=>prev.map({
                        "NewOrganizerEventPage.useEffect": (row)=>({
                                ...row,
                                participantAccess: row.participantAccess ?? true
                            })
                    }["NewOrganizerEventPage.useEffect"])
            }["NewOrganizerEventPage.useEffect"]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        advancedAccessEnabled,
        participantAccessMode,
        participantTicketScope
    ]);
    const presetOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[presetOptions]": ()=>isPadelOrg ? CATEGORY_OPTIONS.filter({
                "NewOrganizerEventPage.useMemo[presetOptions]": (opt)=>opt.key === "padel"
            }["NewOrganizerEventPage.useMemo[presetOptions]"]) : CATEGORY_OPTIONS
    }["NewOrganizerEventPage.useMemo[presetOptions]"], [
        isPadelOrg
    ]);
    const presetMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[presetMap]": ()=>{
            const map = new Map();
            presetOptions.forEach({
                "NewOrganizerEventPage.useMemo[presetMap]": (opt)=>map.set(opt.key, opt)
            }["NewOrganizerEventPage.useMemo[presetMap]"]);
            return map;
        }
    }["NewOrganizerEventPage.useMemo[presetMap]"], [
        presetOptions
    ]);
    const { data: recentVenues } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(user ? `/api/organizador/venues/recent?q=${encodeURIComponent(locationName.trim())}` : null, fetcher, {
        revalidateOnFocus: false
    });
    const { data: padelClubs } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(isPadelPreset ? "/api/padel/clubs" : null, fetcher, {
        revalidateOnFocus: false
    });
    const { data: padelCourts } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(isPadelPreset && selectedPadelClubId ? `/api/padel/clubs/${selectedPadelClubId}/courts` : null, fetcher, {
        revalidateOnFocus: false
    });
    const { data: padelStaff } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(isPadelPreset && selectedPadelClubId ? `/api/padel/clubs/${selectedPadelClubId}/staff` : null, fetcher, {
        revalidateOnFocus: false
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (draftLoaded) return;
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const raw = window.localStorage.getItem(DRAFT_KEY);
            if (!raw) {
                setDraftLoaded(true);
                return;
            }
            try {
                const draft = JSON.parse(raw);
                setTitle(draft.title ?? "");
                setDescription(draft.description ?? "");
                setStartsAt(draft.startsAt ?? "");
                setEndsAt(draft.endsAt ?? "");
                setLocationName(draft.locationName ?? "");
                setLocationCity(draft.locationCity && __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PT_CITIES"].includes(draft.locationCity) ? draft.locationCity : __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PT_CITIES"][0]);
                setAddress(draft.address ?? "");
                setTicketTypes(Array.isArray(draft.ticketTypes) && draft.ticketTypes.length > 0 ? draft.ticketTypes : [
                    {
                        name: "Geral",
                        price: "",
                        totalQuantity: ""
                    }
                ]);
                setFeeMode(draft.feeMode ?? "ADDED");
                setCoverUrl(draft.coverUrl ?? null);
                setSelectedPreset(draft.selectedPreset ?? null);
                setIsFreeEvent(Boolean(draft.isFreeEvent));
                setAdvancedAccessEnabled(Boolean(draft.advancedAccessEnabled));
                const legacyInviteOnly = typeof draft.inviteOnly === "boolean" ? Boolean(draft.inviteOnly) : null;
                setPublicAccessMode(draft.publicAccessMode ?? (legacyInviteOnly ? "INVITE" : "OPEN"));
                setParticipantAccessMode(draft.participantAccessMode ?? "NONE");
                setPublicTicketScope(draft.publicTicketScope ?? "ALL");
                setParticipantTicketScope(draft.participantTicketScope ?? "ALL");
                setLiveHubVisibility(draft.liveHubVisibility ?? "PUBLIC");
                const fallbackFreeName = draft.selectedPreset === "padel" ? "Inscrição" : "Bilhete";
                setFreeTicketName(draft.freeTicketName || fallbackFreeName);
                setFreeCapacity(draft.freeCapacity || "");
                const draftCurrentStep = typeof draft.currentStep === "number" && Number.isFinite(draft.currentStep) ? draft.currentStep : 0;
                const draftMaxStep = typeof draft.maxStepReached === "number" && Number.isFinite(draft.maxStepReached) ? draft.maxStepReached : draftCurrentStep;
                setCurrentStep(Math.min(draftCurrentStep, 4));
                setMaxStepReached(Math.min(draftMaxStep, 4));
                setDraftSavedAt(draft.savedAt ?? null);
            } catch (err) {
                console.warn("Falha ao carregar rascunho local", err);
            } finally{
                setDraftLoaded(true);
            }
        }
    }["NewOrganizerEventPage.useEffect"], [
        draftLoaded
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!draftLoaded) return;
            const typeParam = searchParams?.get("type");
            const keyParam = searchParams?.get("category") ?? searchParams?.get("preset");
            if (selectedPreset || !typeParam && !keyParam) return;
            const match = presetOptions.find({
                "NewOrganizerEventPage.useEffect.match": (opt)=>opt.value === typeParam || opt.key === keyParam
            }["NewOrganizerEventPage.useEffect.match"]);
            if (match) {
                setSelectedPreset(match.key);
            }
        }
    }["NewOrganizerEventPage.useEffect"], [
        draftLoaded,
        searchParams,
        selectedPreset,
        presetOptions
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!isPadelOrg) return;
            if (selectedPreset !== "padel") {
                setSelectedPreset("padel");
            }
        }
    }["NewOrganizerEventPage.useEffect"], [
        isPadelOrg,
        selectedPreset
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!isPadelOrg) return;
            const presetParam = searchParams?.get("preset") ?? searchParams?.get("category") ?? searchParams?.get("type");
            if (presetParam && presetParam.toLowerCase() === "padel") return;
            const params = new URLSearchParams(searchParams?.toString());
            params.set("preset", "padel");
            router.replace(`/organizador/eventos/novo?${params.toString()}`);
        }
    }["NewOrganizerEventPage.useEffect"], [
        isPadelOrg,
        router,
        searchParams
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!isPadelOrg) return;
            setFreeTicketName({
                "NewOrganizerEventPage.useEffect": (prev)=>{
                    const trimmed = prev.trim().toLowerCase();
                    if (!trimmed || trimmed === "bilhete" || trimmed === "bilhetes") return "Inscrição";
                    return prev;
                }
            }["NewOrganizerEventPage.useEffect"]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        isPadelOrg
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!isFreeEvent) return;
            setTicketTypes([
                {
                    name: freeTicketName.trim() || ticketLabelTitle,
                    price: "0",
                    totalQuantity: freeCapacity
                }
            ]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        isFreeEvent,
        freeTicketName,
        freeCapacity,
        ticketLabelTitle
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            clearErrorsForFields([
                "tickets"
            ]);
            setStripeAlert(null);
        }
    }["NewOrganizerEventPage.useEffect"], [
        isFreeEvent
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!isPadelPreset) {
                setSelectedPadelClubId(null);
                setSelectedPadelCourtIds([]);
                setSelectedPadelStaffIds([]);
                setLocationManuallySet(false);
                return;
            }
            if (padelClubs?.items && padelClubs.items.length > 0 && !selectedPadelClubId) {
                const firstActive = padelClubs.items.find({
                    "NewOrganizerEventPage.useEffect": (c)=>c.isActive
                }["NewOrganizerEventPage.useEffect"]) ?? padelClubs.items[0];
                setSelectedPadelClubId(firstActive.id);
            }
        }
    }["NewOrganizerEventPage.useEffect"], [
        isPadelPreset,
        padelClubs,
        selectedPadelClubId
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!padelCourts?.items) return;
            const activeCourts = padelCourts.items.filter({
                "NewOrganizerEventPage.useEffect.activeCourts": (c)=>c.isActive
            }["NewOrganizerEventPage.useEffect.activeCourts"]).map({
                "NewOrganizerEventPage.useEffect.activeCourts": (c)=>c.id
            }["NewOrganizerEventPage.useEffect.activeCourts"]);
            if (activeCourts.length > 0) setSelectedPadelCourtIds(activeCourts);
        }
    }["NewOrganizerEventPage.useEffect"], [
        padelCourts
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!padelStaff?.items) return;
            const inherited = padelStaff.items.filter({
                "NewOrganizerEventPage.useEffect.inherited": (s)=>s.inheritToEvents
            }["NewOrganizerEventPage.useEffect.inherited"]).map({
                "NewOrganizerEventPage.useEffect.inherited": (s)=>s.id
            }["NewOrganizerEventPage.useEffect.inherited"]);
            if (inherited.length > 0) setSelectedPadelStaffIds(inherited);
        }
    }["NewOrganizerEventPage.useEffect"], [
        padelStaff
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!isPadelPreset) return;
            if (!selectedPadelClubId) return;
            const club = padelClubs?.items?.find({
                "NewOrganizerEventPage.useEffect": (c)=>c.id === selectedPadelClubId
            }["NewOrganizerEventPage.useEffect"]);
            if (!club) return;
            const composed = [
                club.address?.trim(),
                club.city?.trim()
            ].filter(Boolean).join(", ");
            if (!locationManuallySet) {
                if (composed) setLocationName(composed);
                else if (!locationName) setLocationName(club.name ?? "");
            }
            if (club.city && __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PT_CITIES"].includes(club.city)) {
                // Preenche cidade a partir do clube, mas não sobrepõe escolha manual já feita.
                if (!locationManuallySet || !locationCity) {
                    setLocationCity(club.city);
                }
            }
        }
    }["NewOrganizerEventPage.useEffect"], [
        isPadelPreset,
        selectedPadelClubId,
        padelClubs?.items,
        locationManuallySet,
        locationName
    ]);
    const stepOrder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[stepOrder]": ()=>[
                {
                    key: "preset",
                    title: "Formato",
                    subtitle: isPadelContext ? "Escolhe o tipo de torneio" : "Escolhe o tipo de evento"
                },
                {
                    key: "details",
                    title: "Essenciais",
                    subtitle: "Imagem, título e descrição"
                },
                {
                    key: "schedule",
                    title: "Datas",
                    subtitle: "Início, fim e local"
                },
                {
                    key: "tickets",
                    title: ticketLabelPluralTitle,
                    subtitle: isFreeEvent ? "Capacidade e vagas" : "Preços e stock"
                },
                {
                    key: "review",
                    title: "Rever",
                    subtitle: "Confirma & cria"
                }
            ]
    }["NewOrganizerEventPage.useMemo[stepOrder]"], [
        isFreeEvent,
        isPadelContext,
        ticketLabelPluralTitle
    ]);
    const stepIndexMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[stepIndexMap]": ()=>{
            const map = new Map();
            stepOrder.forEach({
                "NewOrganizerEventPage.useMemo[stepIndexMap]": (step, idx)=>map.set(step.key, idx)
            }["NewOrganizerEventPage.useMemo[stepIndexMap]"]);
            return map;
        }
    }["NewOrganizerEventPage.useMemo[stepIndexMap]"], [
        stepOrder
    ]);
    const wizardSteps = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[wizardSteps]": ()=>[
                {
                    id: "formato",
                    title: "Formato"
                },
                {
                    id: "essenciais",
                    title: "Essenciais"
                },
                {
                    id: "datas_local",
                    title: "Datas"
                },
                {
                    id: "bilhetes",
                    title: ticketLabelPluralTitle
                },
                {
                    id: "revisao",
                    title: "Rever"
                }
            ]
    }["NewOrganizerEventPage.useMemo[wizardSteps]"], [
        ticketLabelPluralTitle
    ]);
    const stepIdByKey = {
        preset: "formato",
        details: "essenciais",
        schedule: "datas_local",
        tickets: "bilhetes",
        review: "revisao"
    };
    const baseInputClasses = "w-full rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/90 placeholder:text-white/45 outline-none transition backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.35)] focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)] focus:ring-offset-0 focus:ring-offset-transparent";
    const errorInputClasses = "border-[rgba(255,0,200,0.45)] focus:border-[rgba(255,0,200,0.6)] focus:ring-[rgba(255,0,200,0.4)]";
    const inputClass = (errored)=>`${baseInputClasses} ${errored ? errorInputClasses : ""}`;
    const labelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 flex items-center gap-1";
    const helperClass = "text-[12px] text-white/60 min-h-[18px]";
    const errorTextClass = "flex items-center gap-2 text-[12px] font-semibold text-pink-200 min-h-[18px]";
    const breadcrumbs = wizardSteps.map((s)=>s.title).join(" · ");
    const dateOrderWarning = startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime();
    const currentStepLabel = wizardSteps[currentStep]?.title ?? "";
    const pushToast = (message, tone = "success")=>{
        const id = Date.now() + Math.random();
        setToasts((prev)=>[
                ...prev,
                {
                    id,
                    message,
                    tone
                }
            ]);
        setTimeout(()=>setToasts((prev)=>prev.filter((t)=>t.id !== id)), 3800);
    };
    const saveDraft = ()=>{
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        const payload = {
            title,
            description,
            startsAt,
            endsAt,
            locationName,
            locationCity,
            address,
            ticketTypes,
            feeMode,
            coverUrl,
            selectedPreset: resolvedPreset,
            isFreeEvent,
            advancedAccessEnabled,
            publicAccessMode,
            participantAccessMode,
            publicTicketScope,
            participantTicketScope,
            liveHubVisibility,
            freeTicketName,
            freeCapacity,
            currentStep,
            maxStepReached,
            savedAt: Date.now()
        };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        setDraftSavedAt(Date.now());
        pushToast("Rascunho guardado.", "success");
    };
    const handleRequireLogin = ()=>{
        openModal({
            mode: "login",
            redirectTo: "/organizador/eventos/novo"
        });
    };
    const handleSelectPreset = (key)=>{
        const preset = presetMap.get(key);
        if (!preset) return;
        setSelectedPreset(preset.key);
        setValidationAlert(null);
        setErrorMessage(null);
        clearErrorsForFields([
            "preset"
        ]);
    };
    const handleSelectLocationSuggestion = (suggestion)=>{
        setLocationName(suggestion.name);
        if (suggestion.city && __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PT_CITIES"].includes(suggestion.city)) {
            setLocationCity(suggestion.city);
        }
        setLocationManuallySet(true);
        clearErrorsForFields([
            "locationName",
            "locationCity"
        ]);
        setShowLocationSuggestions(false);
    };
    const handleAddTicketType = ()=>{
        clearErrorsForFields([
            "tickets"
        ]);
        setStripeAlert(null);
        setTicketTypes((prev)=>[
                ...prev,
                {
                    name: "",
                    price: "",
                    totalQuantity: "",
                    publicAccess: advancedAccessEnabled && publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC" ? true : undefined,
                    participantAccess: advancedAccessEnabled && participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC" ? true : undefined
                }
            ]);
    };
    const handleRemoveTicketType = (index)=>{
        clearErrorsForFields([
            "tickets"
        ]);
        setStripeAlert(null);
        setTicketTypes((prev)=>prev.filter((_, i)=>i !== index));
    };
    const handleTicketChange = (index, field, value)=>{
        setTicketTypes((prev)=>prev.map((row, i)=>i === index ? {
                    ...row,
                    [field]: value
                } : row));
        clearErrorsForFields([
            "tickets"
        ]);
        setStripeAlert(null);
    };
    const toggleTicketFlag = (index, field)=>{
        setTicketTypes((prev)=>prev.map((row, i)=>i === index ? {
                    ...row,
                    [field]: !row[field]
                } : row));
    };
    const handleCoverUpload = async (file)=>{
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        setUploadingCover(true);
        setErrorMessage(null);
        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });
            const json = await res.json();
            if (!res.ok || !json?.url) {
                throw new Error(json?.error || "Falha no upload da imagem.");
            }
            setCoverUrl(json.url);
        } catch (err) {
            console.error("Erro no upload de capa", err);
            setErrorMessage("Não foi possível carregar a imagem de capa.");
        } finally{
            setUploadingCover(false);
        }
    };
    const buildTicketsPayload = ()=>{
        if (isFreeEvent) {
            const totalQuantityRaw = freeCapacity ? Number(freeCapacity) : null;
            const parsedQuantity = typeof totalQuantityRaw === "number" && Number.isFinite(totalQuantityRaw) && totalQuantityRaw > 0 ? totalQuantityRaw : null;
            return [
                {
                    name: freeTicketName.trim() || ticketLabelTitle,
                    price: 0,
                    totalQuantity: parsedQuantity,
                    publicAccess: advancedAccessEnabled && publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC" ? true : undefined,
                    participantAccess: advancedAccessEnabled && participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC" ? true : undefined
                }
            ];
        }
        return ticketTypes.map((row)=>{
            const parsedPrice = Number(row.price.replace(",", "."));
            const price = Number.isFinite(parsedPrice) ? parsedPrice : 0;
            return {
                name: row.name.trim(),
                price,
                totalQuantity: row.totalQuantity ? Number(row.totalQuantity) : null,
                publicAccess: advancedAccessEnabled && publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC" ? Boolean(row.publicAccess) : undefined,
                participantAccess: advancedAccessEnabled && participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC" ? Boolean(row.participantAccess) : undefined
            };
        }).filter((t)=>t.name);
    };
    const preparedTickets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[preparedTickets]": ()=>buildTicketsPayload()
    }["NewOrganizerEventPage.useMemo[preparedTickets]"], [
        isFreeEvent,
        freeTicketName,
        freeCapacity,
        ticketTypes,
        advancedAccessEnabled,
        publicAccessMode,
        participantAccessMode,
        publicTicketScope,
        participantTicketScope
    ]);
    const accessNotes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[accessNotes]": ()=>{
            const notes = [];
            if (!advancedAccessEnabled) {
                return notes;
            }
            if (publicAccessMode === "TICKET" && preparedTickets.length === 0) {
                notes.push(`Define pelo menos ${ticketLabelIndefinite} para controlar o acesso do público.`);
            }
            if (participantAccessMode === "TICKET" && preparedTickets.length === 0) {
                notes.push(`Define ${ticketLabelPlural} para marcar participantes.`);
            }
            if (publicAccessMode === "INVITE" || participantAccessMode === "INVITE") {
                notes.push(`Convites são adicionados depois de criares o ${eventLabel}.`);
            }
            return notes;
        }
    }["NewOrganizerEventPage.useMemo[accessNotes]"], [
        advancedAccessEnabled,
        publicAccessMode,
        participantAccessMode,
        preparedTickets.length,
        eventLabel,
        ticketLabelIndefinite,
        ticketLabelPlural
    ]);
    const fieldsByStep = {
        preset: [
            "preset"
        ],
        details: [
            "title",
            "description"
        ],
        schedule: [
            "startsAt",
            "endsAt",
            "locationName",
            "locationCity",
            "address"
        ],
        tickets: [
            "tickets"
        ],
        review: []
    };
    function collectStepErrors(stepKey) {
        const keys = stepKey === "all" ? [
            "preset",
            "details",
            "schedule",
            "tickets"
        ] : [
            stepKey
        ];
        const issues = [];
        keys.forEach((key)=>{
            if (key === "preset" && !resolvedPreset) {
                issues.push({
                    field: "preset",
                    message: "Escolhe um formato."
                });
            }
            if (key === "details") {
                if (!title.trim()) {
                    issues.push({
                        field: "title",
                        message: "Título obrigatório."
                    });
                }
            }
            if (key === "schedule") {
                if (!startsAt) issues.push({
                    field: "startsAt",
                    message: "Data/hora de início obrigatória."
                });
                if (!endsAt) issues.push({
                    field: "endsAt",
                    message: "Data/hora de fim obrigatória."
                });
                if (!locationName.trim()) issues.push({
                    field: "locationName",
                    message: "Local obrigatório."
                });
                if (!locationCity.trim()) issues.push({
                    field: "locationCity",
                    message: "Cidade obrigatória."
                });
                if (endsAt && startsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
                    issues.push({
                        field: "endsAt",
                        message: "A data/hora de fim tem de ser depois do início."
                    });
                }
            }
            if (key === "tickets") {
                const preparedTickets = buildTicketsPayload();
                if (preparedTickets.length === 0) {
                    issues.push({
                        field: "tickets",
                        message: `Adiciona pelo menos ${ticketLabelIndefinite}.`
                    });
                }
                if (advancedAccessEnabled && publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC" && !preparedTickets.some((t)=>t.publicAccess)) {
                    issues.push({
                        field: "tickets",
                        message: `Seleciona pelo menos um ${ticketLabel} para o público.`
                    });
                }
                if (advancedAccessEnabled && participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC" && !preparedTickets.some((t)=>t.participantAccess)) {
                    issues.push({
                        field: "tickets",
                        message: `Seleciona pelo menos um ${ticketLabel} para participantes.`
                    });
                }
                if (!isFreeEvent) {
                    const hasNegativePrice = preparedTickets.some((t)=>t.price < 0);
                    const hasBelowMinimum = preparedTickets.some((t)=>t.price >= 0 && t.price < 1);
                    if (hasNegativePrice) {
                        issues.push({
                            field: "tickets",
                            message: "Preço tem de ser positivo."
                        });
                    }
                    if (hasBelowMinimum) {
                        issues.push({
                            field: "tickets",
                            message: isPadelContext ? "Para torneios de padel pagos, cada inscrição tem de custar pelo menos 1 €." : "Para eventos pagos, cada bilhete tem de custar pelo menos 1 €."
                        });
                    }
                }
                if (!isFreeEvent && hasPaidTicket && paidTicketsBlocked) {
                    issues.push({
                        field: "tickets",
                        message: paidTicketsBlockedMessage ?? (isPadelContext ? "Liga o Stripe e verifica o email oficial da organização para aceitar inscrições pagas." : "Liga o Stripe e verifica o email oficial da organização para vender bilhetes pagos.")
                    });
                }
            }
        });
        return issues;
    }
    const fieldStepMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[fieldStepMap]": ()=>({
                preset: "preset",
                title: "details",
                description: "details",
                startsAt: "schedule",
                endsAt: "schedule",
                locationName: "schedule",
                locationCity: "schedule",
                address: "schedule",
                tickets: "tickets"
            })
    }["NewOrganizerEventPage.useMemo[fieldStepMap]"], []);
    function clearErrorsForFields(fields) {
        setFieldErrors((prev)=>{
            const next = {
                ...prev
            };
            fields.forEach((field)=>{
                delete next[field];
            });
            return next;
        });
        setErrorSummary((prev)=>prev.filter((err)=>!fields.includes(err.field)));
    }
    function applyErrors(errors, focusSummary = true) {
        if (errors.length === 0) {
            setErrorSummary([]);
        } else {
            setErrorSummary(errors);
        }
        setFieldErrors((prev)=>{
            const next = {
                ...prev
            };
            errors.forEach((err)=>{
                next[err.field] = err.message;
            });
            return next;
        });
        if (errors.length > 0 && focusSummary) {
            setTimeout(()=>{
                errorSummaryRef.current?.focus({
                    preventScroll: false
                });
            }, 40);
        }
    }
    const focusField = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "NewOrganizerEventPage.useCallback[focusField]": (field)=>{
            const targetStep = fieldStepMap[field];
            const targetStepIndex = stepIndexMap.get(targetStep);
            if (typeof targetStepIndex === "number" && targetStepIndex !== currentStep) {
                setCurrentStep(targetStepIndex);
                setMaxStepReached({
                    "NewOrganizerEventPage.useCallback[focusField]": (prev)=>Math.max(prev, targetStepIndex)
                }["NewOrganizerEventPage.useCallback[focusField]"]);
                setPendingFocusField(field);
                return;
            }
            const focusable = field === "title" ? titleRef.current : field === "startsAt" ? startsRef.current?.querySelector("button") : field === "endsAt" ? endsRef.current?.querySelector("button") : field === "locationName" ? locationNameRef.current : field === "locationCity" ? cityRef.current : field === "tickets" ? ticketsRef.current?.querySelector("input,button,select,textarea") : null;
            if (focusable) {
                focusable.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
                focusable.focus({
                    preventScroll: true
                });
            }
        }
    }["NewOrganizerEventPage.useCallback[focusField]"], [
        currentStep,
        fieldStepMap,
        stepIndexMap
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (!pendingFocusField) return;
            const expectedStep = fieldStepMap[pendingFocusField];
            const targetStepIndex = stepIndexMap.get(expectedStep);
            if (typeof targetStepIndex === "number" && targetStepIndex !== currentStep) return;
            focusField(pendingFocusField);
            setPendingFocusField(null);
        }
    }["NewOrganizerEventPage.useEffect"], [
        pendingFocusField,
        currentStep,
        stepIndexMap,
        fieldStepMap,
        focusField
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            let timer = null;
            if (isSubmitting) {
                timer = setTimeout({
                    "NewOrganizerEventPage.useEffect": ()=>setShowLoadingHint(true)
                }["NewOrganizerEventPage.useEffect"], 750);
            } else {
                setShowLoadingHint(false);
            }
            return ({
                "NewOrganizerEventPage.useEffect": ()=>{
                    if (timer) clearTimeout(timer);
                }
            })["NewOrganizerEventPage.useEffect"];
        }
    }["NewOrganizerEventPage.useEffect"], [
        isSubmitting
    ]);
    const activeStepKey = stepOrder[currentStep]?.key ?? "preset";
    const nextDisabledReason = (()=>{
        const issues = activeStepKey === "review" ? collectStepErrors("all") : collectStepErrors(activeStepKey);
        if (isSubmitting) return isPadelContext ? "A criar torneio de padel…" : "A criar evento…";
        return issues[0]?.message ?? null;
    })();
    const currentWizardStepId = stepIdByKey[activeStepKey];
    const direction = currentStep >= prevStepIndexRef.current ? "right" : "left";
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            prevStepIndexRef.current = currentStep;
        }
    }["NewOrganizerEventPage.useEffect"], [
        currentStep
    ]);
    const filteredLocationSuggestions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "NewOrganizerEventPage.useMemo[filteredLocationSuggestions]": ()=>{
            const items = recentVenues?.ok && Array.isArray(recentVenues.items) ? recentVenues.items : [];
            if (items.length === 0) return [];
            const term = `${locationName} ${locationCity}`.toLowerCase().trim();
            const filtered = items.filter({
                "NewOrganizerEventPage.useMemo[filteredLocationSuggestions].filtered": (s)=>`${s.name} ${s.city ?? ""}`.toLowerCase().includes(term)
            }["NewOrganizerEventPage.useMemo[filteredLocationSuggestions].filtered"]);
            return (term ? filtered : items).slice(0, 8);
        }
    }["NewOrganizerEventPage.useMemo[filteredLocationSuggestions]"], [
        recentVenues,
        locationName,
        locationCity
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (title.trim()) clearErrorsForFields([
                "title"
            ]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        title
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (startsAt) clearErrorsForFields([
                "startsAt"
            ]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        startsAt
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (locationName.trim()) clearErrorsForFields([
                "locationName"
            ]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        locationName
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (locationCity.trim()) clearErrorsForFields([
                "locationCity"
            ]);
        }
    }["NewOrganizerEventPage.useEffect"], [
        locationCity
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NewOrganizerEventPage.useEffect": ()=>{
            if (endsAt && startsAt && new Date(endsAt).getTime() > new Date(startsAt).getTime()) {
                clearErrorsForFields([
                    "endsAt"
                ]);
            }
        }
    }["NewOrganizerEventPage.useEffect"], [
        endsAt,
        startsAt
    ]);
    const FormAlert = ({ variant, title: alertTitle, message, actionLabel, onAction })=>{
        const tones = variant === "error" ? "border-red-500/40 bg-red-500/10 text-red-100" : variant === "warning" ? "border-amber-400/40 bg-amber-400/10 text-amber-100" : "border-emerald-400/40 bg-emerald-500/10 text-emerald-50";
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `rounded-md border px-4 py-3 text-sm ${tones}`,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1",
                        children: [
                            alertTitle && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "font-semibold",
                                children: alertTitle
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 1064,
                                columnNumber: 28
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: message
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 1065,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 1063,
                        columnNumber: 11
                    }, this),
                    actionLabel && onAction && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: onAction,
                        className: "rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold hover:bg-white/10",
                        children: actionLabel
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 1068,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 1062,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 1061,
            columnNumber: 7
        }, this);
    };
    const goNext = ()=>{
        const activeKey = stepOrder[currentStep]?.key;
        if (!activeKey) return;
        const issues = activeKey === "review" ? collectStepErrors("all") : collectStepErrors(activeKey);
        const paidAlert = !isFreeEvent && hasPaidTicket && paidTicketsBlocked ? paidTicketsBlockedMessage : null;
        if (issues.length > 0) {
            applyErrors(issues);
            setValidationAlert("Revê os campos em falta antes de continuar.");
            setErrorMessage(issues[0]?.message ?? null);
            setStripeAlert(paidAlert);
            return;
        }
        clearErrorsForFields(fieldsByStep[activeKey]);
        setValidationAlert(null);
        setErrorMessage(null);
        setStripeAlert(null);
        setErrorSummary([]);
        if (currentStep >= stepOrder.length - 1) {
            handleSubmit();
            return;
        }
        setValidationAlert(null);
        setErrorMessage(null);
        setCurrentStep((s)=>s + 1);
        setMaxStepReached((prev)=>Math.max(prev, currentStep + 1));
    };
    const goPrev = ()=>{
        setValidationAlert(null);
        setErrorMessage(null);
        setErrorSummary([]);
        setStripeAlert(null);
        setCurrentStep((s)=>Math.max(0, s - 1));
    };
    const handleSubmit = async ()=>{
        setStripeAlert(null);
        setValidationAlert(null);
        setBackendAlert(null);
        setErrorMessage(null);
        const issues = collectStepErrors("all");
        const paidAlert = !isFreeEvent && hasPaidTicket && paidTicketsBlocked ? paidTicketsBlockedMessage : null;
        if (issues.length > 0) {
            applyErrors(issues);
            setValidationAlert(`Revê os campos em falta antes de criar o ${eventLabel}.`);
            setErrorMessage(issues[0]?.message ?? null);
            setStripeAlert(paidAlert);
            return;
        }
        const preparedTickets = buildTicketsPayload();
        const scrollTo = (el)=>el?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        if (!user) {
            handleRequireLogin();
            return;
        }
        if (!isOrganizer) {
            setErrorMessage("Ainda não és organizador. Vai à área de organizador para ativares essa função.");
            return;
        }
        setIsSubmitting(true);
        try {
            const preset = resolvedPreset ? presetMap.get(resolvedPreset) : null;
            const categoriesToSend = preset?.categories ?? [
                "OUTRO"
            ];
            const templateToSend = resolvedPreset === "padel" ? "PADEL" : resolvedPreset === "voluntariado" ? "VOLUNTEERING" : "OTHER";
            const payload = {
                title: title.trim(),
                description: description.trim() || null,
                startsAt,
                endsAt,
                locationName: locationName.trim() || null,
                locationCity: locationCity.trim() || null,
                templateType: templateToSend,
                address: address.trim() || null,
                categories: categoriesToSend,
                ticketTypes: preparedTickets,
                coverImageUrl: coverUrl,
                inviteOnly: publicAccessMode === "INVITE",
                publicAccessMode,
                participantAccessMode,
                publicTicketScope,
                participantTicketScope,
                liveHubVisibility,
                feeMode,
                isTest: isAdmin ? isTest : undefined,
                padel: isPadelPreset ? {
                    padelClubId: selectedPadelClubId,
                    courtIds: selectedPadelCourtIds,
                    staffIds: selectedPadelStaffIds,
                    numberOfCourts: selectedPadelCourtIds.length || 1,
                    padelV2Enabled: true
                } : undefined
            };
            const res = await fetch("/api/organizador/events/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) {
                throw new Error(data?.error || `Erro ao criar ${eventLabel}.`);
            }
            const event = data.event;
            if (event?.id || event?.slug) {
                if ("TURBOPACK compile-time truthy", 1) {
                    window.localStorage.removeItem(DRAFT_KEY);
                }
                setCreationSuccess({
                    eventId: event.id,
                    slug: event.slug
                });
                setCurrentStep(stepOrder.length - 1);
                setMaxStepReached(stepOrder.length - 1);
                setErrorSummary([]);
                setFieldErrors({});
            }
        } catch (err) {
            console.error("Erro ao criar evento de organizador:", err);
            const message = err instanceof Error ? err.message : null;
            setBackendAlert(message || `Algo correu mal ao guardar o ${eventLabel}. Tenta novamente em segundos.`);
            scrollTo(ctaAlertRef.current);
        } finally{
            setIsSubmitting(false);
        }
    };
    const resetForm = ()=>{
        setSelectedPreset(isPadelOrg ? "padel" : null);
        setTitle("");
        setDescription("");
        setStartsAt("");
        setEndsAt("");
        setLocationName("");
        setLocationCity(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PT_CITIES"][0]);
        setAddress("");
        setTicketTypes([
            {
                name: "Geral",
                price: "",
                totalQuantity: ""
            }
        ]);
        setIsFreeEvent(false);
        setFreeTicketName(isPadelOrg ? "Inscrição" : "Bilhete");
        setFreeCapacity("");
        setCoverUrl(null);
        setCreationSuccess(null);
        setCurrentStep(0);
        setMaxStepReached(0);
        setValidationAlert(null);
        setErrorMessage(null);
        setErrorSummary([]);
        setFieldErrors({});
        setStripeAlert(null);
        setBackendAlert(null);
        if ("TURBOPACK compile-time truthy", 1) {
            window.localStorage.removeItem(DRAFT_KEY);
        }
    };
    if (isUserLoading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full px-4 py-8 md:px-6 lg:px-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 text-white/70 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                children: "A carregar a tua conta…"
            }, void 0, false, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 1254,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 1253,
            columnNumber: 7
        }, this);
    }
    if (!user) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full px-4 py-8 md:px-6 lg:px-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "text-2xl font-semibold",
                        children: isPadelContext ? "Criar novo torneio de padel" : "Criar novo evento"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 1265,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-white/70",
                        children: [
                            "Precisas de iniciar sessão para criar ",
                            eventLabelPlural,
                            " como organizador."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 1268,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: handleRequireLogin,
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"],
                        children: "Entrar"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 1271,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 1264,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 1263,
            columnNumber: 7
        }, this);
    }
    if (!isOrganizer) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full px-4 py-8 md:px-6 lg:px-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "text-2xl font-semibold",
                        children: isPadelContext ? "Criar novo torneio de padel" : "Criar novo evento"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 1287,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-white/70",
                        children: "Ainda não és organizador. Vai à área de organizador para ativar essa função."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 1290,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: "/organizador",
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_PRIMARY"],
                        children: "Ir para área de organizador"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 1291,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 1286,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 1285,
            columnNumber: 7
        }, this);
    }
    const renderPresetStep = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-4 animate-fade-slide",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-white/75",
                            children: isPadelOrg ? "A tua organização está configurada para padel. Este torneio já usa o wizard dedicado." : "Escolhe o formato. Padel ativa o wizard dedicado; o formato padrão é neutro."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1305,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[12px] text-white/55",
                            children: isPadelOrg ? "Podes avançar sem mudar o formato." : "Tudo segue a mesma linguagem visual."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1310,
                            columnNumber: 9
                        }, this),
                        fieldErrors.preset && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: errorTextClass,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    "aria-hidden": true,
                                    children: "⚠️"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1315,
                                    columnNumber: 13
                                }, this),
                                fieldErrors.preset
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1314,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1304,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid gap-3 sm:grid-cols-2",
                    children: presetOptions.map((opt)=>{
                        const isActive = resolvedPreset === opt.key;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>handleSelectPreset(opt.key),
                            className: `group flex flex-col items-start gap-2 rounded-2xl border border-white/12 bg-black/40 p-4 text-left transition hover:border-white/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] ${isActive ? "ring-2 ring-[#6BFFFF]/40 border-white/30" : ""}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: `inline-flex items-center rounded-full bg-gradient-to-r ${opt.accent} px-3 py-1 text-[11px] font-semibold text-black shadow`,
                                    children: opt.label
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1332,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm text-white/80",
                                    children: opt.copy
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1337,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap gap-2 text-[11px] text-white/60",
                                    children: opt.categories.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/10 px-2 py-0.5",
                                        children: "Personalizado"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 1340,
                                        columnNumber: 19
                                    }, this) : opt.categories.map((cat)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "rounded-full border border-white/15 px-2 py-0.5",
                                            children: cat
                                        }, cat, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1343,
                                            columnNumber: 21
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1338,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, opt.key, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1324,
                            columnNumber: 13
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1320,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 1303,
            columnNumber: 5
        }, this);
    const renderDetailsStep = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-4 animate-fade-slide",
            children: [
                isAdmin && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                    className: "flex items-center gap-3 rounded-2xl border border-white/12 bg-black/30 px-3 py-2 text-sm",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            type: "checkbox",
                            checked: isTest,
                            onChange: (e)=>setIsTest(e.target.checked),
                            className: "h-4 w-4 rounded border-white/40 bg-transparent"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1360,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-white/80",
                            children: [
                                isPadelContext ? "Torneio de teste" : "Evento de teste",
                                " (visível só para admin, não aparece em explorar)"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1366,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1359,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 space-y-3 shadow-[0_14px_36px_rgba(0,0,0,0.45)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: labelClass,
                                            children: "Imagem de capa"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1375,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-white/65",
                                            children: [
                                                "Hero do ",
                                                eventLabel,
                                                " — legível em mobile."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1376,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1374,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 text-[11px] text-white/60",
                                    children: [
                                        uploadingCover && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "animate-pulse text-white/70",
                                            children: "A carregar…"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1379,
                                            columnNumber: 32
                                        }, this),
                                        coverUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setCoverUrl(null),
                                            className: "rounded-full border border-white/20 px-3 py-1 text-white/75 hover:bg-white/10",
                                            children: "Remover"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1381,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1378,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1373,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col gap-3 sm:flex-row sm:items-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-36 w-56 rounded-xl border border-white/15 bg-gradient-to-br from-[#12121f] via-[#0b0b18] to-[#1f1630] overflow-hidden flex items-center justify-center text-[11px] text-white/60",
                                    children: coverUrl ? // eslint-disable-next-line @next/next/no-img-element
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                        src: coverUrl,
                                        alt: "Capa",
                                        className: "h-full w-full object-cover"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 1395,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-white/55",
                                        children: "Sem imagem"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 1397,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1392,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap gap-2 text-[12px] text-white/60",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/25 px-3 py-1 hover:bg-white/10",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: coverUrl ? "Trocar imagem" : "Adicionar imagem"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1402,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "file",
                                                    accept: "image/*",
                                                    onChange: (e)=>handleCoverUpload(e.target.files?.[0] ?? null),
                                                    className: "hidden"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1403,
                                                    columnNumber: 15
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1401,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-white/50",
                                            children: "1200x630 recomendado"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1410,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1400,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1391,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1372,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 gap-4 md:grid-cols-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2 md:col-span-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: labelClass,
                                    children: [
                                        "Título ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "*"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1420,
                                            columnNumber: 20
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1419,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    value: title,
                                    onChange: (e)=>setTitle(e.target.value),
                                    ref: titleRef,
                                    "aria-invalid": Boolean(fieldErrors.title),
                                    className: inputClass(Boolean(fieldErrors.title)),
                                    placeholder: isPadelContext ? "Torneio Sunset Padel" : "Evento Sunset"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1422,
                                    columnNumber: 11
                                }, this),
                                fieldErrors.title && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: errorTextClass,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "⚠️"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1433,
                                            columnNumber: 15
                                        }, this),
                                        fieldErrors.title
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1432,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1418,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2 md:col-span-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: labelClass,
                                    children: "Descrição"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1440,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    value: description,
                                    onChange: (e)=>setDescription(e.target.value),
                                    rows: 4,
                                    className: inputClass(false),
                                    placeholder: `Explica rapidamente o que torna o ${eventLabel} único.`
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1441,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1439,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1417,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 1357,
            columnNumber: 5
        }, this);
    const renderScheduleStep = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-4 animate-fade-slide",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            ref: startsRef,
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$forms$2f$InlineDateTimePicker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["InlineDateTimePicker"], {
                                    label: "🗓️ Data/hora início *",
                                    value: startsAt,
                                    onChange: (v)=>setStartsAt(v),
                                    minDateTime: new Date(),
                                    required: true
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1457,
                                    columnNumber: 11
                                }, this),
                                fieldErrors.startsAt && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: errorTextClass,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "⚠️"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1466,
                                            columnNumber: 15
                                        }, this),
                                        fieldErrors.startsAt
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1465,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1456,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            ref: endsRef,
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$forms$2f$InlineDateTimePicker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["InlineDateTimePicker"], {
                                    label: "⏱️ Data/hora fim *",
                                    value: endsAt,
                                    onChange: (v)=>setEndsAt(v),
                                    minDateTime: startsAt ? new Date(startsAt) : new Date()
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1472,
                                    columnNumber: 11
                                }, this),
                                fieldErrors.endsAt ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: errorTextClass,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "⚠️"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1480,
                                            columnNumber: 15
                                        }, this),
                                        fieldErrors.endsAt
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1479,
                                    columnNumber: 13
                                }, this) : dateOrderWarning ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: errorTextClass,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "⚠️"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1485,
                                            columnNumber: 15
                                        }, this),
                                        "Fim antes do início"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1484,
                                    columnNumber: 13
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: helperClass,
                                    children: "Duração ajuda no planeamento de staff."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1488,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1471,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1455,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: labelClass,
                                    title: "Nome do local ou clube.",
                                    children: [
                                        "📍 Local ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "*"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1496,
                                            columnNumber: 22
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1495,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative overflow-visible",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            value: locationName,
                                            onChange: (e)=>{
                                                setLocationManuallySet(true);
                                                setLocationName(e.target.value);
                                                setShowLocationSuggestions(true);
                                            },
                                            onFocus: ()=>setShowLocationSuggestions(true),
                                            onBlur: ()=>{
                                                if (suggestionBlurTimeout.current) clearTimeout(suggestionBlurTimeout.current);
                                                suggestionBlurTimeout.current = setTimeout(()=>setShowLocationSuggestions(false), 120);
                                            },
                                            ref: locationNameRef,
                                            "aria-invalid": Boolean(fieldErrors.locationName),
                                            className: inputClass(Boolean(fieldErrors.locationName)),
                                            placeholder: "Clube, sala ou venue"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1499,
                                            columnNumber: 13
                                        }, this),
                                        showLocationSuggestions && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "absolute left-0 right-0 z-[70] mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-black/90 shadow-xl backdrop-blur-2xl animate-popover",
                                            children: recentVenues === undefined ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "px-3 py-2 text-sm text-white/70 animate-pulse",
                                                children: "A procurar…"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 1520,
                                                columnNumber: 19
                                            }, this) : filteredLocationSuggestions.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "px-3 py-2 text-sm text-white/60",
                                                children: "Sem locais recentes."
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 1522,
                                                columnNumber: 19
                                            }, this) : filteredLocationSuggestions.map((suggestion)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onMouseDown: (e)=>e.preventDefault(),
                                                    onClick: ()=>handleSelectLocationSuggestion(suggestion),
                                                    className: "flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex w-full items-center justify-between gap-3",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "font-semibold text-white",
                                                                    children: suggestion.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                    lineNumber: 1533,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-[12px] text-white/65",
                                                                    children: suggestion.city || "Cidade por definir"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                    lineNumber: 1534,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1532,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-[11px] text-white/50",
                                                            children: [
                                                                "Usado em ",
                                                                eventLabelPlural,
                                                                " deste organizador"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1536,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, `${suggestion.name}-${suggestion.city ?? "?"}`, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1525,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1518,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1498,
                                    columnNumber: 11
                                }, this),
                                fieldErrors.locationName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: errorTextClass,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "⚠️"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1545,
                                            columnNumber: 15
                                        }, this),
                                        fieldErrors.locationName
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1544,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1494,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: labelClass,
                                    title: "Escolhe a cidade para facilitar a procura.",
                                    children: [
                                        "🏙️ Cidade ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "*"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1553,
                                            columnNumber: 24
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1552,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    value: locationCity,
                                    onChange: (e)=>{
                                        setLocationManuallySet(true);
                                        setLocationCity(e.target.value);
                                        setShowLocationSuggestions(true);
                                    },
                                    ref: cityRef,
                                    "aria-invalid": Boolean(fieldErrors.locationCity),
                                    onFocus: ()=>setShowLocationSuggestions(true),
                                    onBlur: ()=>{
                                        if (suggestionBlurTimeout.current) clearTimeout(suggestionBlurTimeout.current);
                                        suggestionBlurTimeout.current = setTimeout(()=>setShowLocationSuggestions(false), 120);
                                    },
                                    className: inputClass(Boolean(fieldErrors.locationCity)),
                                    children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$ptCities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PT_CITIES"].map((city)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: city,
                                            children: city
                                        }, city, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1572,
                                            columnNumber: 15
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1555,
                                    columnNumber: 11
                                }, this),
                                fieldErrors.locationCity && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: errorTextClass,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "⚠️"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1579,
                                            columnNumber: 13
                                        }, this),
                                        fieldErrors.locationCity
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1578,
                                    columnNumber: 11
                                }, this),
                                !fieldErrors.locationCity && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[12px] text-white/60",
                                    children: "Usa a capital do concelho para pesquisa fácil."
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1583,
                                    columnNumber: 39
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1551,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1493,
                    columnNumber: 7
                }, this),
                isPadelPreset && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-3xl border border-white/12 bg-gradient-to-br from-[#0c1224]/88 via-[#0a0f1d]/90 to-[#0b1224]/88 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-5 transition-all",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                            children: "Wizard Padel avançado"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1591,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-white/70",
                                            children: "Liga clube, courts e staff herdado sem sair do fluxo. Ajusta detalhes no hub sempre que precisares."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1592,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1590,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/organizador?tab=manage&section=padel-hub",
                                    className: "rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:border-white/30 hover:bg-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.35)]",
                                    children: "Abrir hub de Padel"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1596,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1589,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid gap-4 md:grid-cols-[1.2fr_1fr]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4 shadow-inner",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: `${labelClass} m-0`,
                                                    children: "Clube"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1607,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/65",
                                                    children: [
                                                        "Courts ativos: ",
                                                        padelCourts?.items?.filter((c)=>c.isActive).length ?? "—",
                                                        " · Selecionados: ",
                                                        selectedPadelCourtIds.length || "—"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1608,
                                                    columnNumber: 15
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1606,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            className: "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]",
                                            value: selectedPadelClubId ?? "",
                                            onChange: (e)=>{
                                                setLocationManuallySet(false);
                                                setSelectedPadelClubId(Number(e.target.value) || null);
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "",
                                                    children: "Escolhe um clube"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1620,
                                                    columnNumber: 15
                                                }, this),
                                                (padelClubs?.items || []).filter((c)=>c.isActive).map((club)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: club.id,
                                                        children: [
                                                            club.name,
                                                            " ",
                                                            club.city ? `— ${club.city}` : ""
                                                        ]
                                                    }, club.id, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 1624,
                                                        columnNumber: 19
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1612,
                                            columnNumber: 13
                                        }, this),
                                        !padelClubs?.items?.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-white/60",
                                            children: "Adiciona um clube em Padel → Clubes para continuar."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1630,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1605,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: labelClass,
                                            children: "Courts (ativos)"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1635,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-2xl border border-white/12 bg-white/[0.04] p-3 max-h-56 overflow-auto space-y-2 shadow-inner",
                                            children: [
                                                (padelCourts?.items || []).filter((c)=>c.isActive).map((ct)=>{
                                                    const checked = selectedPadelCourtIds.includes(ct.id);
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: `flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${checked ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50" : "border-white/15 bg-black/30 text-white/80"} transition hover:border-[var(--orya-cyan)]/50`,
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: checked,
                                                                onChange: (e)=>setSelectedPadelCourtIds((prev)=>e.target.checked ? [
                                                                            ...prev,
                                                                            ct.id
                                                                        ] : prev.filter((id)=>id !== ct.id)),
                                                                className: "accent-white"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                lineNumber: 1650,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: ct.name
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                lineNumber: 1660,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] text-white/50",
                                                                children: [
                                                                    "#",
                                                                    ct.displayOrder
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                lineNumber: 1661,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, ct.id, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 1642,
                                                        columnNumber: 21
                                                    }, this);
                                                }),
                                                !padelCourts?.items?.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[12px] text-white/60",
                                                    children: "Sem courts ativos neste clube."
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1666,
                                                    columnNumber: 17
                                                }, this),
                                                selectedPadelCourtIds.length === 0 && (padelCourts?.items?.length || 0) > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] text-red-200",
                                                    children: "Seleciona pelo menos um court."
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1669,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1636,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1634,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1604,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: labelClass,
                                    children: "Staff herdado"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1676,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-white/12 bg-white/[0.04] p-3 max-h-48 overflow-auto space-y-2 shadow-inner",
                                    children: [
                                        (padelStaff?.items || []).map((member)=>{
                                            const checked = selectedPadelStaffIds.includes(member.id);
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: `flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${checked ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50" : "border-white/15 bg-black/30 text-white/80"} transition hover:border-[var(--orya-cyan)]/50`,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "checkbox",
                                                        checked: checked,
                                                        onChange: (e)=>setSelectedPadelStaffIds((prev)=>e.target.checked ? [
                                                                    ...prev,
                                                                    member.id
                                                                ] : prev.filter((id)=>id !== member.id)),
                                                        className: "accent-white"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 1687,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: member.fullName || member.email || "Staff"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 1697,
                                                        columnNumber: 19
                                                    }, this),
                                                    member.inheritToEvents && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[10px] text-emerald-300",
                                                        children: "herdado"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 1698,
                                                        columnNumber: 46
                                                    }, this)
                                                ]
                                            }, member.id, true, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 1681,
                                                columnNumber: 17
                                            }, this);
                                        }),
                                        !padelStaff?.items?.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-white/60",
                                            children: "Sem staff para herdar. Adiciona em Padel → Clubes."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1703,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1677,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1675,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1588,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: labelClass,
                            children: "Rua / morada (opcional)"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1711,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            type: "text",
                            value: address,
                            onChange: (e)=>setAddress(e.target.value),
                            className: inputClass(false),
                            placeholder: "Rua, número ou complemento"
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1712,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1710,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 1454,
            columnNumber: 5
        }, this);
    const renderTicketsStep = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: ticketsRef,
            className: "space-y-5 animate-fade-slide",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col gap-3 rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.45)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: labelClass,
                                            children: "Modelo"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1728,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-white/65",
                                            children: "Escolhe se é pago ou gratuito. Copy adapta-se."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1729,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1727,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[13px]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setIsFreeEvent(false),
                                            className: `rounded-full px-3 py-1 font-semibold transition ${!isFreeEvent ? "bg-white text-black shadow" : "text-white/70"}`,
                                            children: isPadelContext ? "Torneio pago" : "Evento pago"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1732,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setIsFreeEvent(true),
                                            className: `rounded-full px-3 py-1 font-semibold transition ${isFreeEvent ? "bg-white text-black shadow" : "text-white/70"}`,
                                            children: isPadelContext ? "Torneio grátis" : "Evento grátis"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1741,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1731,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1726,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[12px] text-white/55",
                            children: isPadelContext ? "Torneios pagos precisam de Stripe ligado e email oficial definido e verificado. Torneios grátis focam-se em inscrições e vagas." : "Eventos pagos precisam de Stripe ligado e email oficial definido e verificado. Eventos grátis focam-se em inscrições e vagas."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1752,
                            columnNumber: 9
                        }, this),
                        fieldErrors.tickets && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: errorTextClass,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    "aria-hidden": true,
                                    children: "⚠️"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1759,
                                    columnNumber: 13
                                }, this),
                                fieldErrors.tickets
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1758,
                            columnNumber: 11
                        }, this),
                        paidTicketsBlocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-[12px] text-amber-50 space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 text-sm font-semibold",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": true,
                                            children: "⚠️"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1766,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: isPadelContext ? "Só podes criar torneios gratuitos para já" : "Só podes criar eventos gratuitos para já"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1767,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1765,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-amber-50/90",
                                    children: paidTicketsBlockedMessage ?? (isPadelContext ? "Liga o Stripe e verifica o email oficial da organização para aceitar inscrições pagas. Até lá, cria torneios gratuitos (preço = 0 €)." : "Liga o Stripe e verifica o email oficial da organização para vender bilhetes pagos. Até lá, cria eventos gratuitos (preço = 0 €).")
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1769,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap gap-2",
                                    children: [
                                        stripeNotReady && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>router.push("/organizador?tab=analyze&section=financas"),
                                            className: "rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold text-amber-50 hover:bg-white/10",
                                            children: "Abrir Finanças & Payouts"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1777,
                                            columnNumber: 17
                                        }, this),
                                        needsOfficialEmailVerification && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>router.push("/organizador/settings"),
                                            className: "rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold text-amber-50 hover:bg-white/10",
                                            children: "Definir / verificar email oficial"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1786,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1775,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1764,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1725,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3 rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.45)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center justify-between gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: labelClass,
                                            children: "Acesso & participantes"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1802,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-white/65",
                                            children: [
                                                "Por defeito, o ",
                                                eventLabel,
                                                " é simples: ",
                                                ticketLabel,
                                                " pago ou entrada gratuita, sem separação de público."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1803,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1801,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setAdvancedAccessEnabled((prev)=>!prev),
                                    className: `rounded-full border px-3 py-1 text-[12px] font-semibold transition ${advancedAccessEnabled ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100" : "border-white/20 bg-black/40 text-white/70"}`,
                                    children: advancedAccessEnabled ? "Modo avançado ativo" : "Ativar modo avançado"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1807,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1800,
                            columnNumber: 9
                        }, this),
                        !advancedAccessEnabled ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-[12px] text-white/70",
                            children: [
                                "Público fica aberto e não há distinção de participantes. Se precisares de",
                                " ",
                                isPadelContext ? "inscrições pagas" : "bilhetes pagos",
                                " ou convites, ativa o modo avançado."
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1821,
                            columnNumber: 11
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap items-center justify-between gap-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[12px] text-white/70",
                                            children: [
                                                publicAccessLabel,
                                                " · ",
                                                participantAccessLabel
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1828,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[12px] text-white/70",
                                            children: [
                                                "LiveHub ",
                                                liveHubVisibility === "PUBLIC" ? "Público" : liveHubVisibility === "PRIVATE" ? "Privado" : "Desativado"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1831,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1827,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid gap-4 md:grid-cols-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: labelClass,
                                                    children: "Público"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1838,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap gap-2",
                                                    children: [
                                                        {
                                                            value: "OPEN",
                                                            label: "Aberto"
                                                        },
                                                        {
                                                            value: "TICKET",
                                                            label: `Por ${ticketLabel}`
                                                        },
                                                        {
                                                            value: "INVITE",
                                                            label: "Por convite"
                                                        }
                                                    ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setPublicAccessMode(opt.value),
                                                            className: `rounded-full border px-3 py-1 text-[12px] font-semibold transition ${publicAccessMode === opt.value ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100" : "border-white/20 bg-black/40 text-white/70"}`,
                                                            children: opt.label
                                                        }, opt.value, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1845,
                                                            columnNumber: 21
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1839,
                                                    columnNumber: 17
                                                }, this),
                                                publicAccessMode === "TICKET" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap gap-2",
                                                    children: [
                                                        {
                                                            value: "ALL",
                                                            label: ticketLabelPluralAll
                                                        },
                                                        {
                                                            value: "SPECIFIC",
                                                            label: "Tipos específicos"
                                                        }
                                                    ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setPublicTicketScope(opt.value),
                                                            className: `rounded-full border px-3 py-1 text-[11px] font-semibold transition ${publicTicketScope === opt.value ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100" : "border-white/20 bg-black/40 text-white/70"}`,
                                                            children: opt.label
                                                        }, `pub-scope-${opt.value}`, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1865,
                                                            columnNumber: 23
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1860,
                                                    columnNumber: 19
                                                }, this),
                                                publicAccessMode === "INVITE" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[12px] text-white/60",
                                                    children: [
                                                        "A lista de convites do público é adicionada depois de criares o ",
                                                        eventLabel,
                                                        "."
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1881,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1837,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: labelClass,
                                                    children: "Participantes"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1888,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap gap-2",
                                                    children: [
                                                        {
                                                            value: "NONE",
                                                            label: "Sem participantes"
                                                        },
                                                        {
                                                            value: "INSCRIPTION",
                                                            label: "Por inscrição"
                                                        },
                                                        {
                                                            value: "TICKET",
                                                            label: `Por ${ticketLabel}`
                                                        },
                                                        {
                                                            value: "INVITE",
                                                            label: "Por convite"
                                                        }
                                                    ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setParticipantAccessMode(opt.value),
                                                            className: `rounded-full border px-3 py-1 text-[12px] font-semibold transition ${participantAccessMode === opt.value ? "border-sky-400/60 bg-sky-500/15 text-sky-100" : "border-white/20 bg-black/40 text-white/70"}`,
                                                            children: opt.label
                                                        }, opt.value, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1896,
                                                            columnNumber: 21
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1889,
                                                    columnNumber: 17
                                                }, this),
                                                participantAccessMode === "TICKET" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-wrap gap-2",
                                                    children: [
                                                        {
                                                            value: "ALL",
                                                            label: ticketLabelPluralAll
                                                        },
                                                        {
                                                            value: "SPECIFIC",
                                                            label: "Tipos específicos"
                                                        }
                                                    ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>setParticipantTicketScope(opt.value),
                                                            className: `rounded-full border px-3 py-1 text-[11px] font-semibold transition ${participantTicketScope === opt.value ? "border-sky-400/60 bg-sky-500/15 text-sky-100" : "border-white/20 bg-black/40 text-white/70"}`,
                                                            children: opt.label
                                                        }, `part-scope-${opt.value}`, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1916,
                                                            columnNumber: 23
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1911,
                                                    columnNumber: 19
                                                }, this),
                                                participantAccessMode === "INVITE" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[12px] text-white/60",
                                                    children: [
                                                        "A lista de convites de participantes é adicionada depois de criares o ",
                                                        eventLabel,
                                                        "."
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1932,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1887,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1836,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: labelClass,
                                            children: "LiveHub"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1940,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap gap-2",
                                            children: [
                                                {
                                                    value: "PUBLIC",
                                                    label: "Público"
                                                },
                                                {
                                                    value: "PRIVATE",
                                                    label: "Privado"
                                                },
                                                {
                                                    value: "DISABLED",
                                                    label: "Desativado"
                                                }
                                            ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>setLiveHubVisibility(opt.value),
                                                    className: `rounded-full border px-3 py-1 text-[12px] font-semibold transition ${liveHubVisibility === opt.value ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100" : "border-white/20 bg-black/40 text-white/70"}`,
                                                    children: opt.label
                                                }, `livehub-${opt.value}`, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1947,
                                                    columnNumber: 19
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1941,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[12px] text-white/60",
                                            children: "Público fica sempre acessível; privado mostra só a participantes; desativado oculta o LiveHub."
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1961,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1939,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-xl border border-white/12 bg-black/40 px-3 py-3 space-y-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.22em] text-white/55",
                                            children: "Resumo rápido"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1967,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "grid gap-3 md:grid-cols-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-lg border border-white/10 bg-black/20 px-3 py-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                            children: "Público"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1970,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mt-1 text-sm font-semibold text-white",
                                                            children: publicAccessLabel
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1971,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] text-white/60",
                                                            children: publicAccessDescription
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1972,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1969,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-lg border border-white/10 bg-black/20 px-3 py-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[11px] uppercase tracking-[0.2em] text-white/60",
                                                            children: "Participantes"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1975,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mt-1 text-sm font-semibold text-white",
                                                            children: participantAccessLabel
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1976,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] text-white/60",
                                                            children: participantAccessDescription
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1977,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1974,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1968,
                                            columnNumber: 15
                                        }, this),
                                        accessNotes.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-50",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "font-semibold",
                                                    children: "Notas"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1982,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "mt-1 space-y-1 text-amber-50/90",
                                                    children: accessNotes.map((note)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            children: [
                                                                "• ",
                                                                note
                                                            ]
                                                        }, note, true, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 1985,
                                                            columnNumber: 23
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 1983,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 1981,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1966,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1799,
                    columnNumber: 7
                }, this),
                isFreeEvent ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1426]/65 to-[#050a14]/88 p-4 shadow-[0_16px_60px_rgba(0,0,0,0.45)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: labelClass,
                                    children: isPadelContext ? "Inscrições gratuitas" : "Bilhetes gratuitos"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1998,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[12px] text-emerald-50",
                                    children: "Sem taxas"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 1999,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 1997,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid gap-3 md:grid-cols-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: labelClass,
                                            children: isPadelContext ? "Nome da inscrição" : "Nome do bilhete"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2005,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            value: freeTicketName,
                                            onChange: (e)=>setFreeTicketName(e.target.value),
                                            className: inputClass(false),
                                            placeholder: isPadelContext ? "Inscrição geral, equipa…" : "Bilhete geral, VIP…"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2008,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 2004,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: labelClass,
                                            children: "Capacidade (opcional)"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2017,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "number",
                                            min: 0,
                                            value: freeCapacity,
                                            onChange: (e)=>setFreeCapacity(e.target.value),
                                            className: inputClass(false),
                                            placeholder: "Ex.: 64"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2018,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 2016,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 2003,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[12px] text-white/60",
                            children: "Só precisas disto para registar vagas. Podes abrir inscrições avançadas (equipas, rankings) no passo Padel."
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 2028,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 1996,
                    columnNumber: 9
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1426]/65 to-[#050a14]/88 p-4 shadow-[0_16px_60px_rgba(0,0,0,0.45)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center justify-between gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: labelClass,
                                    children: ticketLabelPluralTitle
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 2035,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: handleAddTicketType,
                                    className: "inline-flex items-center rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[13px] font-semibold hover:border-white/35 hover:bg-white/5 transition",
                                    children: [
                                        "+ Adicionar ",
                                        ticketLabel
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 2036,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 2034,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid gap-3",
                            children: ticketTypes.map((row, idx)=>{
                                const parsed = Number((row.price ?? "0").toString().replace(",", "."));
                                const priceEuro = Number.isFinite(parsed) ? parsed : 0;
                                const preview = computeFeePreview(priceEuro, feeMode, platformFees, stripeFees);
                                const combinedFeeCents = preview.combinedFeeCents ?? preview.feeCents + preview.stripeFeeCents;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-3 rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1728]/60 to-[#050912]/85 p-3 shadow-[0_14px_40px_rgba(0,0,0,0.45)] animate-step-pop",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/75",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            "aria-hidden": true,
                                                            className: "text-[#6BFFFF]",
                                                            children: "🎟️"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2058,
                                                            columnNumber: 23
                                                        }, this),
                                                        ticketLabelTitle,
                                                        " ",
                                                        idx + 1
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2057,
                                                    columnNumber: 21
                                                }, this),
                                                ticketTypes.length > 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>handleRemoveTicketType(idx),
                                                    className: "text-[11px] text-white/60 hover:text-white/90",
                                                    children: "Remover"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2062,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2056,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-1 flex-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: labelClass,
                                                        children: [
                                                            isPadelContext ? "Nome da inscrição" : "Nome do bilhete",
                                                            " ",
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                "aria-hidden": true,
                                                                children: "*"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                lineNumber: 2074,
                                                                columnNumber: 84
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2073,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "text",
                                                        value: row.name,
                                                        onChange: (e)=>handleTicketChange(idx, "name", e.target.value),
                                                        className: inputClass(false),
                                                        placeholder: "Early bird, Geral, VIP"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2076,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2072,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2071,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "grid grid-cols-1 gap-3 sm:grid-cols-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: labelClass,
                                                            children: [
                                                                "Preço (€) ",
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    "aria-hidden": true,
                                                                    children: "*"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                    lineNumber: 2089,
                                                                    columnNumber: 35
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2088,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "number",
                                                            min: isFreeEvent ? 0 : 1,
                                                            step: "0.01",
                                                            value: row.price,
                                                            onChange: (e)=>handleTicketChange(idx, "price", e.target.value),
                                                            className: inputClass(false),
                                                            placeholder: "Ex.: 12.50"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2091,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] text-white/55",
                                                            children: [
                                                                "Em ",
                                                                eventLabelPlural,
                                                                " pagos, o preço mínimo é 1,00 €."
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2100,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2087,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: labelClass,
                                                            children: "Capacidade (opcional)"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2103,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "number",
                                                            min: 0,
                                                            value: row.totalQuantity,
                                                            onChange: (e)=>handleTicketChange(idx, "totalQuantity", e.target.value),
                                                            className: inputClass(false),
                                                            placeholder: "Ex.: 100"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2104,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2102,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[12px] font-semibold text-white/75",
                                                            children: "Pré-visualização"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2114,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-[12px] rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-white/85",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    children: [
                                                                        "Cliente: ",
                                                                        (preview.totalCliente / 100).toFixed(2),
                                                                        " €"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                    lineNumber: 2116,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    children: [
                                                                        "Recebes (estimado): ",
                                                                        (preview.recebeOrganizador / 100).toFixed(2),
                                                                        " €"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                    lineNumber: 2117,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-white/50",
                                                                    children: [
                                                                        "Taxa da plataforma: ",
                                                                        (combinedFeeCents / 100).toFixed(2),
                                                                        " €"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                    lineNumber: 2118,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2115,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2113,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2086,
                                            columnNumber: 19
                                        }, this),
                                        advancedAccessEnabled && (publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC" || participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/75",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[11px] uppercase tracking-[0.18em] text-white/60",
                                                    children: isPadelContext ? "Esta inscrição dá acesso a" : "Este bilhete dá acesso a"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2127,
                                                    columnNumber: 25
                                                }, this),
                                                publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "flex items-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "checkbox",
                                                            checked: Boolean(row.publicAccess),
                                                            onChange: ()=>toggleTicketFlag(idx, "publicAccess")
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2132,
                                                            columnNumber: 29
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: "Público"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2137,
                                                            columnNumber: 29
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2131,
                                                    columnNumber: 27
                                                }, this),
                                                participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "flex items-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "checkbox",
                                                            checked: Boolean(row.participantAccess),
                                                            onChange: ()=>toggleTicketFlag(idx, "participantAccess")
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2142,
                                                            columnNumber: 29
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: "Participante"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                            lineNumber: 2147,
                                                            columnNumber: 29
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2141,
                                                    columnNumber: 27
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2126,
                                            columnNumber: 23
                                        }, this)
                                    ]
                                }, idx, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 2052,
                                    columnNumber: 17
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 2045,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: labelClass,
                                    children: "Modo de taxas"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 2158,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[13px]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setFeeMode("ADDED"),
                                            className: `rounded-full px-3 py-1 font-semibold transition ${feeMode === "ADDED" ? "bg-white text-black shadow" : "text-white/70"}`,
                                            children: "Cliente paga taxa"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2160,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setFeeMode("INCLUDED"),
                                            className: `rounded-full px-3 py-1 font-semibold transition ${feeMode === "INCLUDED" ? "bg-white text-black shadow" : "text-white/70"}`,
                                            children: "Preço inclui taxas"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2169,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 2159,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[12px] text-white/55",
                                    children: [
                                        "Podes ajustar depois no resumo. Para ",
                                        eventLabelPlural,
                                        " de plataforma, a taxa ORYA é zero."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                    lineNumber: 2179,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 2157,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                    lineNumber: 2033,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 1724,
            columnNumber: 5
        }, this);
    const renderReviewStep = ()=>{
        const previewTickets = buildTicketsPayload();
        const presetLabel = resolvedPreset === "padel" ? "Padel / Torneio" : resolvedPreset === "voluntariado" ? "Voluntariado" : "Evento";
        const presetDesc = resolvedPreset === "padel" ? "Wizard Padel ativo" : resolvedPreset === "voluntariado" ? "Fluxo focado em participacao e impacto" : "Fluxo base com tudo o que precisas";
        const pendingIssues = collectStepErrors("all");
        const pendingLabel = pendingIssues.length === 0 ? "Campos ok" : `Falta corrigir ${pendingIssues.length}`;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-4 animate-fade-slide",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1426]/65 to-[#050912]/88 p-4 space-y-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-start justify-between gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: labelClass,
                                        children: "Revisão final"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2209,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/70 text-sm",
                                        children: "Tudo pronto. Revê os detalhes antes de publicar."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2210,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2208,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col items-end gap-1 text-right",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[11px] uppercase tracking-[0.18em] text-white/55",
                                        children: "Passo 5/5"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2213,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "btn-chip bg-white/10 text-white/90",
                                        children: pendingLabel
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2214,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2212,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2207,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 gap-3 md:grid-cols-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1020]/65 to-[#060912]/85 p-3 shadow-[0_12px_38px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.55)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: `${labelClass} gap-2`,
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                "aria-hidden": true,
                                                                className: "text-[#6BFFFF]",
                                                                children: "✨"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                lineNumber: 2222,
                                                                columnNumber: 21
                                                            }, this),
                                                            "Essenciais"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2221,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "font-semibold text-white",
                                                        children: title || "Sem título"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2225,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2220,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>focusField("title"),
                                                className: "btn-chip",
                                                children: "Editar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2227,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2219,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-2 flex items-center gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-16 w-24 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-[#161623] via-[#0c0c18] to-[#241836] text-[11px] text-white/60",
                                                children: coverUrl ? // eslint-disable-next-line @next/next/no-img-element
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                    src: coverUrl,
                                                    alt: "Capa",
                                                    className: "h-full w-full object-cover"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2239,
                                                    columnNumber: 21
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex h-full w-full items-center justify-center text-[11px] text-white/60",
                                                    children: "Sem imagem"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2241,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2236,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-white/70 line-clamp-3",
                                                children: description || "Sem descrição"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2246,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2235,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2218,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1020]/65 to-[#060912]/85 p-3 shadow-[0_12px_38px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.55)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: `${labelClass} gap-2`,
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                "aria-hidden": true,
                                                                className: "text-[#AEE4FF]",
                                                                children: "📅"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                lineNumber: 2254,
                                                                columnNumber: 21
                                                            }, this),
                                                            "Datas"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2253,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "font-semibold text-white",
                                                        children: [
                                                            locationName || "Local a definir",
                                                            " · ",
                                                            locationCity || "Cidade a definir"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2257,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2252,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>focusField("startsAt"),
                                                className: "btn-chip",
                                                children: "Editar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2261,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2251,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/70",
                                        children: [
                                            startsAt ? new Date(startsAt).toLocaleString() : "Início por definir",
                                            " ",
                                            endsAt ? `→ ${new Date(endsAt).toLocaleString()}` : ""
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2269,
                                        columnNumber: 15
                                    }, this),
                                    address && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] text-white/60 flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                "aria-hidden": true,
                                                className: "text-white/60",
                                                children: "📍"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2275,
                                                columnNumber: 19
                                            }, this),
                                            address
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2274,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2250,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1020]/65 to-[#060912]/85 p-3 shadow-[0_12px_38px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.55)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: `${labelClass} gap-2`,
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                "aria-hidden": true,
                                                                className: "text-[#6BFFFF]",
                                                                children: "🎟️"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                lineNumber: 2285,
                                                                columnNumber: 21
                                                            }, this),
                                                            ticketLabelPluralTitle
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2284,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "font-semibold text-white",
                                                        children: isFreeEvent ? `Vagas: ${freeCapacity ? freeCapacity : "sem limite"}` : `${previewTickets.length} tipo${previewTickets.length === 1 ? "" : "s"} de ${ticketLabel}`
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2288,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2283,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>focusField("tickets"),
                                                className: "btn-chip",
                                                children: "Editar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2294,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2282,
                                        columnNumber: 15
                                    }, this),
                                    !isFreeEvent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "mt-2 space-y-1 text-sm text-white/70",
                                        children: previewTickets.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                className: "flex items-center justify-between gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: t.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2306,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-white/60",
                                                        children: [
                                                            t.price.toFixed(2),
                                                            " €"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2307,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, `${t.name}-${t.price}`, true, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2305,
                                                columnNumber: 21
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2303,
                                        columnNumber: 17
                                    }, this),
                                    isFreeEvent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/70",
                                        children: [
                                            "Entrada gratuita com ",
                                            ticketLabelPlural,
                                            " simples."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2312,
                                        columnNumber: 31
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2281,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1020]/65 to-[#060912]/85 p-3 shadow-[0_12px_38px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.55)]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: `${labelClass} gap-2`,
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                "aria-hidden": true,
                                                                className: "text-[#AEE4FF]",
                                                                children: "🛡️"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                                lineNumber: 2319,
                                                                columnNumber: 21
                                                            }, this),
                                                            "Modelo"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2318,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "font-semibold text-white",
                                                        children: isFreeEvent ? isPadelContext ? "Torneio grátis" : "Evento grátis" : isPadelContext ? "Torneio pago" : "Evento pago"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                        lineNumber: 2322,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2317,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>focusField("preset"),
                                                className: "btn-chip",
                                                children: "Editar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2326,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2316,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/70",
                                        children: [
                                            "Formato: ",
                                            presetLabel
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2334,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[12px] text-white/60",
                                        children: presetDesc
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2335,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2315,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2217,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 2206,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
            lineNumber: 2205,
            columnNumber: 7
        }, this);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        noValidate: true,
        onSubmit: (e)=>{
            e.preventDefault();
            goNext();
        },
        className: "relative w-full space-y-6 px-4 py-8 text-white md:px-6 lg:px-8",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative overflow-hidden rounded-[28px] border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 p-5 shadow-[0_32px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_35%),linear-gradient(225deg,rgba(255,255,255,0.08),transparent_40%)]"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2353,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                "aria-hidden": true,
                                                className: "text-[#6BFFFF]",
                                                children: "✨"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                lineNumber: 2357,
                                                columnNumber: 15
                                            }, this),
                                            isPadelContext ? "Novo torneio de padel" : "Novo evento"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2356,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                        className: "text-3xl font-semibold tracking-tight drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]",
                                        children: isPadelContext ? "Cria o teu torneio de padel" : "Cria o teu evento"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2360,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-white/70",
                                        children: "Fluxo premium com autosave, feedback imediato e vidro colorido."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2363,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2355,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center gap-2 text-[11px]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        href: "/organizador?tab=manage",
                                        className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                        children: "Voltar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2366,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: saveDraft,
                                        className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$organizador$2f$dashboardUi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CTA_SECONDARY"],
                                        children: "Guardar rascunho"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2372,
                                        columnNumber: 13
                                    }, this),
                                    draftSavedAt && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rounded-full border border-white/15 bg-white/10 px-3 py-1 text-white/75",
                                        children: "Guardado há pouco"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2380,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2365,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2354,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 2352,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b0f1f]/82 to-[#05070f]/94 p-5 md:p-6 space-y-6 shadow-[0_32px_110px_rgba(0,0,0,0.6)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_32%),linear-gradient(240deg,rgba(255,255,255,0.06),transparent_36%)]"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2389,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative pb-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$organizador$2f$eventos$2f$wizard$2f$StepperDots$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StepperDots"], {
                            steps: wizardSteps,
                            current: currentWizardStepId,
                            maxUnlockedIndex: Math.max(maxStepReached, currentStep),
                            onGoTo: (id)=>{
                                const idx = wizardSteps.findIndex((s)=>s.id === id);
                                const maxClickable = Math.max(maxStepReached, currentStep);
                                if (idx >= 0 && idx <= maxClickable) setCurrentStep(idx);
                            }
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 2391,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2390,
                        columnNumber: 9
                    }, this),
                    errorSummary.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        ref: errorSummaryRef,
                        tabIndex: -1,
                        className: "rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200/70",
                        "aria-live": "assertive",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 font-semibold",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        "aria-hidden": true,
                                        children: "⚠️"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2411,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Revê estes campos antes de continuar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2412,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2410,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "mt-2 space-y-1 text-[13px]",
                                children: errorSummary.map((err)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>focusField(err.field),
                                            className: "inline-flex items-center gap-2 text-left font-semibold text-white underline decoration-pink-200 underline-offset-4 hover:text-pink-50",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    "aria-hidden": true,
                                                    children: "↘"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2422,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: err.message
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                                    lineNumber: 2423,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                            lineNumber: 2417,
                                            columnNumber: 19
                                        }, this)
                                    }, `${err.field}-${err.message}`, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2416,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2414,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2404,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1224]/70 to-[#04060f]/90 p-4 md:p-5 min-h-[420px] md:min-h-[460px] shadow-[0_18px_70px_rgba(0,0,0,0.5)]",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: direction === "right" ? "wizard-step-in-right" : "wizard-step-in-left",
                            children: [
                                activeStepKey === "preset" && renderPresetStep(),
                                activeStepKey === "details" && renderDetailsStep(),
                                activeStepKey === "schedule" && renderScheduleStep(),
                                activeStepKey === "tickets" && renderTicketsStep(),
                                activeStepKey === "review" && renderReviewStep()
                            ]
                        }, activeStepKey, true, {
                            fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                            lineNumber: 2432,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2431,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        ref: ctaAlertRef,
                        className: "space-y-3",
                        children: [
                            stripeAlert && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FormAlert, {
                                variant: hasPaidTicket ? "error" : "warning",
                                title: "Conclui os passos para vender",
                                message: stripeAlert,
                                actionLabel: "Abrir Finanças & Payouts",
                                onAction: ()=>router.push("/organizador?tab=analyze&section=financas")
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2446,
                                columnNumber: 13
                            }, this),
                            validationAlert && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FormAlert, {
                                variant: "warning",
                                message: validationAlert
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2454,
                                columnNumber: 31
                            }, this),
                            errorMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FormAlert, {
                                variant: "error",
                                message: errorMessage
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2455,
                                columnNumber: 28
                            }, this),
                            backendAlert && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FormAlert, {
                                variant: "error",
                                title: `Algo correu mal ao guardar o ${eventLabel}`,
                                message: backendAlert
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2457,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2444,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$flows$2f$FlowStickyFooter$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FlowStickyFooter"], {
                        backLabel: "Anterior",
                        nextLabel: currentStep === stepOrder.length - 1 ? isPadelContext ? "Criar torneio de padel" : "Criar evento" : "Continuar",
                        helper: activeStepKey === "tickets" ? isFreeEvent ? isPadelContext ? "Inscrições sem taxas; capacidade é opcional." : "Bilhetes sem taxas; capacidade é opcional." : paidTicketsBlocked ? paidTicketsBlockedMessage ?? (isPadelContext ? "Torneios pagos precisam de Stripe ligado e email oficial verificado." : "Eventos pagos precisam de Stripe ligado e email oficial verificado.") : isPadelContext ? "Define preços, taxas e capacidade das inscrições." : "Define preços, taxas e capacidade dos bilhetes." : activeStepKey === "review" ? "Confirma blocos, edita no passo certo e cria com confiança." : "Navega sem perder contexto; feedback sempre visível.",
                        disabledReason: nextDisabledReason,
                        loading: isSubmitting,
                        loadingLabel: currentStep === stepOrder.length - 1 ? "A criar..." : "A processar...",
                        showLoadingHint: showLoadingHint,
                        disableBack: currentStep === 0,
                        onBack: goPrev,
                        onNext: goNext
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2465,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 2388,
                columnNumber: 9
            }, this),
            creationSuccess && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed bottom-6 right-6 z-[var(--z-popover)] w-[320px] max-w-full rounded-2xl border border-emerald-400/50 bg-emerald-500/15 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.55)] text-emerald-50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-start justify-between gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm font-semibold",
                                        children: isPadelContext ? "Torneio de padel criado" : "Evento criado"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2506,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[13px] text-emerald-50/85",
                                        children: "Escolhe o próximo passo ou cria outro."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                        lineNumber: 2509,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2505,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setCreationSuccess(null),
                                className: "text-[12px] text-emerald-50/80 hover:text-white",
                                "aria-label": "Fechar alerta de criação",
                                children: "✕"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2511,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2504,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-3 flex flex-wrap gap-2 text-[12px]",
                        children: [
                            creationSuccess.slug && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                href: `/eventos/${creationSuccess.slug}`,
                                className: "rounded-full border border-emerald-200/60 bg-emerald-500/15 px-3 py-1 font-semibold text-white hover:bg-emerald-500/25",
                                children: "Ver página pública"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2522,
                                columnNumber: 15
                            }, this),
                            creationSuccess.eventId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                href: `/organizador/eventos/${creationSuccess.eventId}`,
                                className: "rounded-full border border-emerald-200/60 bg-emerald-500/15 px-3 py-1 font-semibold text-white hover:bg-emerald-500/25",
                                children: isPadelContext ? "Editar torneio" : "Editar evento"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2530,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: resetForm,
                                className: "rounded-full border border-white/25 px-3 py-1 font-semibold text-white hover:bg-white/10",
                                children: isPadelContext ? "Criar outro torneio" : "Criar outro evento"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                                lineNumber: 2537,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2520,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 2503,
                columnNumber: 9
            }, this),
            toasts.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none fixed bottom-6 right-6 z-[var(--z-popover)] flex flex-col gap-2",
                children: toasts.map((toast)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `pointer-events-auto min-w-[240px] rounded-lg border px-4 py-3 text-sm shadow-lg ${toast.tone === "success" ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50" : "border-red-400/50 bg-red-500/15 text-red-50"}`,
                        children: toast.message
                    }, toast.id, false, {
                        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                        lineNumber: 2551,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/organizador/eventos/novo/page.tsx",
                lineNumber: 2549,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/eventos/novo/page.tsx",
        lineNumber: 2344,
        columnNumber: 5
    }, this);
}
_s(NewOrganizerEventPage, "JVn22brSdmO7NLxUY/+bO0b5txc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$hooks$2f$useUser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$autentica$e7e3$o$2f$AuthModalContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthModal"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]
    ];
});
_c = NewOrganizerEventPage;
var _c;
__turbopack_context__.k.register(_c, "NewOrganizerEventPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_c2244573._.js.map